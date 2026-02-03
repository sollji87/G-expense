import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 간단한 CSV 파서
function parseCSV(content: string): any[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const record: any = {};
    headers.forEach((header, index) => {
      record[header] = values[index]?.trim() || '';
    });
    records.push(record);
  }
  
  return records;
}

// 월별 전체 인원수 로드
function loadMonthlyHeadcount(): { [yyyymm: string]: number } {
  const headcountMap: { [yyyymm: string]: number } = {};
  
  const basePaths = [
    path.join(process.cwd(), '..', 'myvenv', 'out', 'snowflake', 'headcount_monthly_latest.csv'),
    path.join(process.cwd(), '..', '..', 'myvenv', 'out', 'snowflake', 'headcount_monthly_latest.csv'),
  ];
  
  for (const p of basePaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      const records = parseCSV(content);
      
      // 월별 컬럼 (202401, 202402, ... 형식)
      const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
      const years = ['2024', '2025'];
      
      for (const year of years) {
        for (const month of months) {
          const key = `${year}${month}`;
          let total = 0;
          
          for (const record of records) {
            const val = parseInt(record[key] || '0') || 0;
            total += val;
          }
          
          if (total > 0) {
            headcountMap[key] = total;
          }
        }
      }
      
      break;
    }
  }
  
  return headcountMap;
}

// 팀 이름 정규화
function normalizeTeamName(teamName: string): string {
  const name = teamName.replace('공통_', '').replace('[CLSD]공통_', '').replace('[CLSD]', '').replace('[종료]', '');
  
  // PI팀 + AX팀 → AX팀
  if (name === 'PI팀') return 'AX팀';
  
  // 통합인플루언서마케팅팀 → 마케팅본부
  if (name.includes('통합인플루언서마케팅팀')) return '마케팅본부';
  if (name.includes('인플루언서마케팅')) return '마케팅본부';
  
  return name;
}

// 텍스트 정규화 - IT사용료용
function normalizeUsageText(text: string): string {
  const lower = text.toLowerCase();
  
  // 임직원 AI사용료 (ChatGPT, Claude, Cursor, Copilot, Gemini, KREA 등)
  if (lower.includes('chatgpt') || lower.includes('chat gpt') || lower.includes('gpt') || lower.includes('openai') ||
      lower.includes('claude') || lower.includes('cursor') || lower.includes('copilot') ||
      lower.includes('gemini') || lower.includes('krea')) {
    return '임직원 AI사용료';
  }
  // Pycharm / JetBrains 관련
  if (lower.includes('pycharm') || lower.includes('jetbrain') || lower.includes('intellij')) {
    return 'JetBrains';
  }
  // AWS 관련
  if (lower.includes('aws')) {
    return 'AWS';
  }
  // GCP 관련
  if (lower.includes('gcp')) {
    return 'GCP';
  }
  // Azure 관련
  if (lower.includes('azure')) {
    return 'Azure';
  }
  // Oracle 관련
  if (lower.includes('oracle')) {
    return 'Oracle';
  }
  // Sentry 관련
  if (lower.includes('sentry')) {
    return 'Sentry';
  }
  // Retool 관련
  if (lower.includes('retool')) {
    return 'Retool';
  }
  // Figma 관련
  if (lower.includes('figma')) {
    return 'Figma';
  }
  // SAP 관련
  if (lower.includes('sap')) {
    return 'SAP';
  }
  // MS 365/Office 관련
  if (lower.includes('m365') || lower.includes('ms365') || (lower.includes('microsoft') && lower.includes('365'))) {
    return 'MS 365';
  }
  // Adobe 관련
  if (lower.includes('adobe')) {
    return 'Adobe';
  }
  // Salesforce / SFDC 관련
  if (lower.includes('salesforce') || lower.includes('sfdc')) {
    return 'Salesforce';
  }
  // Slack 관련
  if (lower.includes('slack')) {
    return 'Slack';
  }
  // Jira/Confluence/Atlassian 관련
  if (lower.includes('jira') || lower.includes('confluence') || lower.includes('atlassian')) {
    return 'Atlassian';
  }
  // Notion 관련
  if (lower.includes('notion')) {
    return 'Notion';
  }
  // Zoom 관련
  if (lower.includes('zoom')) {
    return 'Zoom';
  }
  // Miro 관련
  if (lower.includes('miro')) {
    return 'Miro';
  }
  // 1Password 관련
  if (lower.includes('1password')) {
    return '1Password';
  }
  // Okta 관련
  if (lower.includes('okta')) {
    return 'Okta';
  }
  // GitHub 관련
  if (lower.includes('github')) {
    return 'GitHub';
  }
  // Postman 관련
  if (lower.includes('postman')) {
    return 'Postman';
  }
  // Power BI 관련
  if (lower.includes('powerbi') || lower.includes('power bi')) {
    return 'Power BI';
  }
  // DocuSign 관련
  if (lower.includes('docusign')) {
    return 'DocuSign';
  }
  // Tibco 관련
  if (lower.includes('tibco')) {
    return 'Tibco EAI';
  }
  // PLM 관련
  if (lower.includes('plm')) {
    return 'PLM';
  }
  // EAI 관련
  if (lower.includes('eai') && !lower.includes('tibco')) {
    return 'EAI';
  }
  // LUCY 플랫폼 관련
  if (lower.includes('lucy')) {
    return 'LUCY';
  }
  // Vimeo 관련
  if (lower.includes('vimeo')) {
    return 'Vimeo';
  }
  // OZ Report 관련
  if (lower.includes('oz report') || lower.includes('ozreport')) {
    return 'OZ Report';
  }
  // Marketing Cloud 관련
  if (lower.includes('marketing cloud')) {
    return 'Marketing Cloud';
  }
  // 카카오 관련
  if (text.includes('카카오') || lower.includes('kakao')) {
    return '카카오워크';
  }
  // AI툴 / AI사용료 일반 패턴
  if ((lower.includes('ai') && (lower.includes('툴') || lower.includes('tool'))) ||
      (text.includes('AI') && text.includes('사용')) ||
      lower.includes('dcsai') ||
      lower.includes('ai사용') ||
      lower.includes('ai이용')) {
    return 'AI 도구';
  }
  // IT사용료 일반 패턴 (AX팀, ES팀 등)
  if (lower.includes('it사용') || lower.includes('it 사용') || 
      lower.includes('it비용') || lower.includes('it 비용')) {
    return 'IT 일반 사용료';
  }
  
  return text;
}

// 상세 JSON 파일에서 데이터 로드
function loadDetailJson(): { [year: string]: { month: string; text: string; vendor: string; cctr: string; amount: number }[] } | null {
  const basePaths = [
    path.join(process.cwd(), '..', 'out', 'it_usage_details.json'),
    path.join(process.cwd(), '..', '..', 'out', 'it_usage_details.json'),
    path.join(process.cwd(), '..', 'myvenv', 'out', 'it_usage_details.json'),
  ];
  
  for (const p of basePaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      return JSON.parse(content);
    }
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || '2025';
    const team = searchParams.get('team');
    
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    
    if (team) {
      return getTeamDetails(year, team, months);
    }
    
    // JSON 상세 데이터에서 임직원 AI사용료와 팀별 데이터 분리
    const detailData = loadDetailJson();
    
    const monthlyTotals: { [m: string]: number } = {};
    const monthlyTotals2024: { [m: string]: number } = {};
    const aiUsageData: { monthly: { [m: string]: number }; total: number } = { monthly: {}, total: 0 };
    const teamData: { [teamName: string]: { monthly: { [m: string]: number }; total: number } } = {};
    
    months.forEach(m => { 
      monthlyTotals[m] = 0; 
      monthlyTotals2024[m] = 0;
      aiUsageData.monthly[m] = 0;
    });
    
    // pivot_by_gl_yyyymm_combined.csv에서 24년 월별 합계 로드
    let pivotPath = path.join(process.cwd(), '..', 'out', 'pivot_by_gl_yyyymm_combined.csv');
    if (!fs.existsSync(pivotPath)) {
      pivotPath = path.join(process.cwd(), '..', '..', 'out', 'pivot_by_gl_yyyymm_combined.csv');
    }
    if (!fs.existsSync(pivotPath)) {
      pivotPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'pivot_by_gl_yyyymm_combined.csv');
    }
    
    if (fs.existsSync(pivotPath)) {
      const pivotContent = fs.readFileSync(pivotPath, 'utf-8');
      const pivotRecords = parseCSV(pivotContent);
      const usageRecord = pivotRecords.find(r => r['G/L 계정 설명'] === '지급수수료_IT사용료');
      
      if (usageRecord) {
        for (const m of months) {
          const key2024 = `2024${m}`;
          const val2024 = parseFloat(usageRecord[key2024] || '0') / 1_000_000;
          monthlyTotals2024[m] = Math.round(val2024);
        }
      }
    }
    
    // JSON에서 당년 데이터 로드
    if (detailData && detailData[year]) {
      for (const record of detailData[year]) {
        const normalizedTeam = normalizeTeamName(record.cctr);
        const isAiUsage = record.text === '임직원 AI사용료';
        
        // 월별 합계에 추가
        monthlyTotals[record.month] = (monthlyTotals[record.month] || 0) + record.amount;
        
        if (isAiUsage) {
          // 임직원 AI사용료는 별도로 합산
          aiUsageData.monthly[record.month] = (aiUsageData.monthly[record.month] || 0) + record.amount;
          aiUsageData.total += record.amount;
        } else {
          // 나머지는 팀별로 집계
          if (!teamData[normalizedTeam]) {
            teamData[normalizedTeam] = { monthly: {}, total: 0 };
            months.forEach(m => { teamData[normalizedTeam].monthly[m] = 0; });
          }
          
          teamData[normalizedTeam].monthly[record.month] = 
            (teamData[normalizedTeam].monthly[record.month] || 0) + record.amount;
          teamData[normalizedTeam].total += record.amount;
        }
      }
    }
    
    // 팀별 데이터를 items 배열로 변환 (원 -> 백만원)
    const teamItems = Object.entries(teamData)
      .filter(([_, data]) => data.total > 500000)  // 50만원 이상만
      .map(([name, data]) => ({
        text: name,
        total: Math.round(data.total / 1_000_000),
        monthly: Object.fromEntries(
          Object.entries(data.monthly).map(([m, v]) => [m, Math.round(v / 1_000_000)])
        ),
      }))
      .sort((a, b) => b.total - a.total);
    
    // 임직원 AI사용료를 맨 앞에 추가 (원 -> 백만원)
    const items = [
      {
        text: '임직원 AI사용료',
        total: Math.round(aiUsageData.total / 1_000_000),
        monthly: Object.fromEntries(
          Object.entries(aiUsageData.monthly).map(([m, v]) => [m, Math.round(v / 1_000_000)])
        ),
        isAiUsage: true,  // 특별 표시용
      },
      ...teamItems,
    ];
    
    // 원 -> 백만원 변환
    const roundedTotals = Object.fromEntries(
      Object.entries(monthlyTotals).map(([m, v]) => [m, Math.round(v / 1_000_000)])
    );
    
    // 월별 인원수 로드
    const headcountData = loadMonthlyHeadcount();
    const monthlyHeadcount: { [m: string]: number } = {};
    for (const m of months) {
      monthlyHeadcount[m] = headcountData[`${year}${m}`] || 0;
    }
    
    return NextResponse.json({
      success: true,
      year,
      items,
      monthlyTotals: roundedTotals,
      monthlyTotals2024,
      monthlyHeadcount,
      months,
    });
    
  } catch (error) {
    console.error('IT Usage API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

async function getTeamDetails(year: string, team: string, months: string[]) {
  const detailData = loadDetailJson();
  
  if (!detailData || !detailData[year]) {
    return NextResponse.json({
      success: true,
      year,
      team,
      items: [],
    });
  }
  
  const teamRecords = detailData[year].filter(r => {
    const normalizedCctr = normalizeTeamName(r.cctr);
    // 임직원 AI사용료 제외
    return normalizedCctr === team && r.amount > 0 && r.text !== '임직원 AI사용료';
  });
  
  const textMap: { [text: string]: { monthly: { [m: string]: number }; total: number } } = {};
  
  for (const record of teamRecords) {
    // 파이썬에서 이미 정규화된 text 사용
    const textKey = record.text || 'Unknown';
    
    if (!textMap[textKey]) {
      textMap[textKey] = { monthly: {}, total: 0 };
      months.forEach(m => { textMap[textKey].monthly[m] = 0; });
    }
    
    textMap[textKey].monthly[record.month] += record.amount;
    textMap[textKey].total += record.amount;
  }
  
  // 원 -> 백만원 변환
  const items = Object.entries(textMap)
    .filter(([_, data]) => data.total > 500000)  // 50만원 이상만
    .map(([text, data]) => ({
      text,
      monthly: Object.fromEntries(
        Object.entries(data.monthly).map(([m, v]) => [m, Math.round(v / 1_000_000)])
      ),
      total: Math.round(data.total / 1_000_000),
    }))
    .sort((a, b) => b.total - a.total);
  
  return NextResponse.json({
    success: true,
    year,
    team,
    items,
    months,
  });
}
