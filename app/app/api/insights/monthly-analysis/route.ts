import { NextResponse } from 'next/server';
import { getMonthlyAnalysis, saveMonthlyAnalysis, updateMonthlyAnalysisItem } from '@/lib/redis';
import fs from 'fs';
import path from 'path';

// CSV 파싱 함수 (따옴표 내 쉼표 처리)
function parseCSV(content: string): any[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = parseCSVLine(lines[0]);
  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record: any = {};
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    records.push(record);
  }
  
  return records;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let insideQuotes = false;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      values.push(currentValue.trim().replace(/^"|"$/g, ''));
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  values.push(currentValue.trim().replace(/^"|"$/g, ''));
  return values;
}

// 상세 CSV 데이터 경로 찾기
function findDetailsPath(): string {
  const candidates = [
    path.join(process.cwd(), '..', 'out', 'details'),
    path.join(process.cwd(), '..', '..', 'out', 'details'),
    path.join(process.cwd(), '..', 'myvenv', 'out', 'details'),
  ];
  
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  
  throw new Error('상세 데이터 디렉토리를 찾을 수 없습니다.');
}

// 특정 월의 상세 CSV 데이터 로드
function loadMonthData(basePath: string, yearMonth: string): any[] {
  const monthPath = path.join(basePath, yearMonth);
  if (!fs.existsSync(monthPath)) return [];
  
  const allData: any[] = [];
  
  const folders = fs.readdirSync(monthPath);
  for (const folder of folders) {
    const folderPath = path.join(monthPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;
    
    const csvFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.csv'));
    for (const csvFile of csvFiles) {
      try {
        const content = fs.readFileSync(path.join(folderPath, csvFile), 'utf-8');
        const records = parseCSV(content);
        allData.push(...records);
      } catch (e) {
        console.error(`파일 읽기 실패: ${csvFile}`, e);
      }
    }
  }
  
  return allData;
}

// GL 계정별 집계
function aggregateByGL(data: any[]): Map<string, { amount: number; details: Map<string, number> }> {
  const result = new Map<string, { amount: number; details: Map<string, number> }>();
  
  const amountCol = data.length > 0 && data[0]['금액_정제'] !== undefined ? '금액_정제' : '금액';
  const descCol = 'G/L 계정 설명';
  const textCol = data.length > 0 && data[0]['텍스트'] !== undefined ? '텍스트' : '적요';
  
  for (const row of data) {
    const glAccount = row[descCol];
    if (!glAccount) continue;
    
    const amount = parseFloat(row[amountCol] || '0');
    const text = row[textCol] || '기타';
    
    if (!result.has(glAccount)) {
      result.set(glAccount, { amount: 0, details: new Map() });
    }
    
    const entry = result.get(glAccount)!;
    entry.amount += amount;
    entry.details.set(text, (entry.details.get(text) || 0) + amount);
  }
  
  return result;
}

// OpenAI로 계정 분석
async function analyzeWithAI(
  glAccount: string,
  currentAmount: number,
  previousAmount: number,
  change: number,
  topDescriptions: { text: string; change: number; current: number; previous: number }[]
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // API 키가 없으면 기본 설명 생성
    const direction = change >= 0 ? '증가' : '감소';
    const descSummary = topDescriptions.length > 0
      ? ` 주요 변동: ${topDescriptions.slice(0, 3).map(d => `${d.text}(${d.change >= 0 ? '+' : ''}${Math.round(d.change)}백만원)`).join(', ')}.`
      : '';
    return `전년 대비 ${Math.abs(Math.round(change))}백만원 ${direction}.${descSummary}`;
  }
  
  // 적요 정보 포맷팅
  let descText = '';
  if (topDescriptions.length > 0) {
    descText = '\n주요 적요별 변동:\n';
    for (const desc of topDescriptions) {
      descText += `- ${desc.text}: ${desc.change >= 0 ? '+' : ''}${Math.round(desc.change)}백만원 (당년 ${Math.round(desc.current)}백만원, 전년 ${Math.round(desc.previous)}백만원)\n`;
    }
  }
  
  const prompt = `다음 비용 계정의 전년 대비 변동 내역을 분석하여 간결하고 명확한 설명을 작성해주세요.

**계정명**: ${glAccount}
**전년 금액**: ${Math.round(previousAmount)}백만원
**당년 금액**: ${Math.round(currentAmount)}백만원
**차이**: ${change >= 0 ? '+' : ''}${Math.round(change)}백만원
${descText}

**작성 요구사항**:
1. 구어체가 아닌 간결한 문체로 작성
2. **전년 대비 차이 금액을 정확하게 계산하여 먼저 언급** (차이 값을 그대로 사용)
3. 주요 변동 항목(적요)을 2-3개 포함하여 구체적으로 설명
4. 한 문단으로 작성 (2-3문장)
5. "증가했습니다", "감소했습니다" 같은 구어체 대신 "증가", "감소" 사용

**예시 형식**:
"전년 대비 50백만원 감소. 주요 변동: 직원식대(-30백만원), 워크샵비용(+20백만원), 회의비(-15백만원)로 전반적인 복리후생 지출 축소."

**중요**: 
- "절대금액"이라는 표현 대신 "전년 대비"를 사용하세요.
- 차이 금액은 반드시 제공된 값(${Math.round(change)}백만원)을 사용하세요.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '당신은 재무 분석 전문가입니다. 비용 변동 내역을 간결하고 명확하게 설명합니다.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API 오류: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || '';
  } catch (error) {
    console.error(`AI 분석 실패 (${glAccount}):`, error);
    const direction = change >= 0 ? '증가' : '감소';
    const descSummary = topDescriptions.length > 0
      ? ` 주요 변동: ${topDescriptions.slice(0, 3).map(d => `${d.text}(${d.change >= 0 ? '+' : ''}${Math.round(d.change)}백만원)`).join(', ')}.`
      : '';
    return `전년 대비 ${Math.abs(Math.round(change))}백만원 ${direction}.${descSummary}`;
  }
}

/**
 * GET /api/insights/monthly-analysis
 * 
 * Redis에서 월별 분석 결과 조회
 * Query: year, month
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || '2026';
    const month = searchParams.get('month') || '1';
    
    const analysis = await getMonthlyAnalysis(year, month);
    
    if (!analysis) {
      return NextResponse.json({
        success: true,
        exists: false,
        data: null,
        message: `${year}년 ${month}월 분석 데이터가 없습니다.`,
      });
    }
    
    return NextResponse.json({
      success: true,
      exists: true,
      data: analysis,
    });
    
  } catch (error) {
    console.error('월별 분석 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '월별 분석 데이터 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/insights/monthly-analysis
 * 
 * 계정별 AI 분석 실행 후 Redis에 저장
 * Body: { year, month, hierarchyData? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { year, month, accountId, description } = body;
    
    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'year와 month는 필수입니다.' },
        { status: 400 }
      );
    }
    
    // 개별 항목 업데이트인 경우
    if (accountId && description !== undefined) {
      const updated = await updateMonthlyAnalysisItem(year, month, accountId, description);
      return NextResponse.json({
        success: true,
        data: updated,
        message: `${accountId} 항목이 업데이트되었습니다.`,
      });
    }
    
    // 전체 AI 분석 실행
    const currentYearMonth = `${year}${month.padStart(2, '0')}`;
    const prevYear = String(parseInt(year) - 1);
    const previousYearMonth = `${prevYear}${month.padStart(2, '0')}`;
    
    console.log(`🤖 AI 분석 시작: ${previousYearMonth} vs ${currentYearMonth}`);
    
    // 상세 데이터 로드
    const basePath = findDetailsPath();
    const currentData = loadMonthData(basePath, currentYearMonth);
    const previousData = loadMonthData(basePath, previousYearMonth);
    
    if (currentData.length === 0) {
      return NextResponse.json(
        { success: false, error: `${currentYearMonth} 상세 데이터를 찾을 수 없습니다.` },
        { status: 404 }
      );
    }
    
    console.log(`✅ 당년 데이터: ${currentData.length}건, 전년 데이터: ${previousData.length}건`);
    
    // GL 계정별 집계
    const currentByGL = aggregateByGL(currentData);
    const previousByGL = aggregateByGL(previousData);
    
    // 모든 GL 계정 합치기
    const allAccounts = new Set([...currentByGL.keys(), ...previousByGL.keys()]);
    
    // 차이 계산 및 유의미한 변동 필터링
    const accountAnalysis: { 
      glAccount: string; 
      current: number; 
      previous: number; 
      change: number;
      topDescs: { text: string; change: number; current: number; previous: number }[];
    }[] = [];
    
    for (const glAccount of allAccounts) {
      const currentEntry = currentByGL.get(glAccount);
      const previousEntry = previousByGL.get(glAccount);
      
      const currentAmount = (currentEntry?.amount || 0) / 1_000_000; // 백만원
      const previousAmount = (previousEntry?.amount || 0) / 1_000_000;
      const change = currentAmount - previousAmount;
      
      // 1백만원 이상 차이나는 항목만
      if (Math.abs(change) < 1) continue;
      
      // 적요별 차이 계산
      const allTexts = new Set([
        ...(currentEntry?.details.keys() || []),
        ...(previousEntry?.details.keys() || []),
      ]);
      
      const textDiffs: { text: string; change: number; current: number; previous: number }[] = [];
      for (const text of allTexts) {
        const curr = ((currentEntry?.details.get(text) || 0) / 1_000_000);
        const prev = ((previousEntry?.details.get(text) || 0) / 1_000_000);
        const diff = curr - prev;
        if (Math.abs(diff) >= 0.5) {
          textDiffs.push({ text, change: diff, current: curr, previous: prev });
        }
      }
      
      // 차이 절대값으로 정렬 후 상위 5개
      textDiffs.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
      
      accountAnalysis.push({
        glAccount,
        current: currentAmount,
        previous: previousAmount,
        change,
        topDescs: textDiffs.slice(0, 5),
      });
    }
    
    // 차이 절대값으로 정렬
    accountAnalysis.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    
    console.log(`📊 유의미한 변동 계정: ${accountAnalysis.length}개`);
    
    // OpenAI로 분석 (순차 실행 - rate limit 고려)
    const descriptions: Record<string, string> = {};
    let processed = 0;
    
    for (const account of accountAnalysis) {
      processed++;
      console.log(`[${processed}/${accountAnalysis.length}] 분석 중: ${account.glAccount}...`);
      
      const aiDescription = await analyzeWithAI(
        account.glAccount,
        account.current,
        account.previous,
        account.change,
        account.topDescs
      );
      
      descriptions[account.glAccount] = aiDescription;
    }
    
    // Redis에 저장
    const saved = await saveMonthlyAnalysis(year, month, descriptions);
    
    console.log(`✅ AI 분석 완료! ${Object.keys(descriptions).length}개 계정 분석 결과 Redis에 저장`);
    
    return NextResponse.json({
      success: true,
      data: saved,
      message: `${year}년 ${month}월 AI 분석 완료 (${Object.keys(descriptions).length}개 계정)`,
      stats: {
        currentDataCount: currentData.length,
        previousDataCount: previousData.length,
        analyzedAccounts: accountAnalysis.length,
      },
    });
    
  } catch (error) {
    console.error('월별 AI 분석 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '월별 AI 분석에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/insights/monthly-analysis
 * 
 * 개별 항목 편집 후 Redis에 저장
 * Body: { year, month, accountId, description }
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { year, month, accountId, description } = body;
    
    if (!year || !month || !accountId) {
      return NextResponse.json(
        { success: false, error: 'year, month, accountId는 필수입니다.' },
        { status: 400 }
      );
    }
    
    const updated = await updateMonthlyAnalysisItem(year, month, accountId, description);
    
    return NextResponse.json({
      success: true,
      data: updated,
      message: `${accountId} 분석 내용이 업데이트되었습니다.`,
    });
    
  } catch (error) {
    console.error('월별 분석 업데이트 오류:', error);
    return NextResponse.json(
      { success: false, error: '분석 내용 업데이트에 실패했습니다.' },
      { status: 500 }
    );
  }
}
