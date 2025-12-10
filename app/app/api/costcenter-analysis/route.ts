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

// 코스트센터명 정규화 (여러 코스트센터를 하나로 통합)
function normalizeCostCenterName(name: string): string {
  // 프로세스 관련 코스트센터들을 통합
  if (name.includes('Process') || name.includes('AX팀') || name.includes('프로세스팀') || name.includes('PI팀')) {
    return '공통_프로세스팀';
  }
  
  return name;
}

// 인원수 데이터 로드
function loadHeadcountData(): Map<string, number> {
  const headcountMap = new Map<string, number>();
  
  try {
    let headcountPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'snowflake', 'headcount_monthly_latest.csv');
    
    if (!fs.existsSync(headcountPath)) {
      headcountPath = path.join(process.cwd(), '..', '..', 'myvenv', 'out', 'snowflake', 'headcount_monthly_latest.csv');
    }
    
    if (!fs.existsSync(headcountPath)) {
      return headcountMap;
    }
    
    const content = fs.readFileSync(headcountPath, 'utf-8');
    const records = parseCSV(content);
    
    records.forEach((record: any) => {
      const deptName = record['코스트센터명'];
      const headcount202411 = parseInt(record['202411'] || '0');
      const headcount202511 = parseInt(record['202511'] || '0');
      
      // 202411 데이터
      const key202411 = `202411_${deptName}`;
      headcountMap.set(key202411, headcount202411);
      
      // 202511 데이터
      const key202511 = `202511_${deptName}`;
      headcountMap.set(key202511, headcount202511);
    });
  } catch (error) {
    console.error('인원수 데이터 로드 실패:', error);
  }
  
  return headcountMap;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'monthly';
    const month = searchParams.get('month') || '11';
    const account = searchParams.get('account'); // 선택한 계정
    
    if (!account) {
      return NextResponse.json({ success: false, error: '계정이 필요합니다.' }, { status: 400 });
    }
    
    // CSV 파일 읽기
    let csvPath = path.join(process.cwd(), '..', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
    
    if (!fs.existsSync(csvPath)) {
      csvPath = path.join(process.cwd(), '..', '..', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
    }
    
    if (!fs.existsSync(csvPath)) {
      csvPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
    }
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV 파일을 찾을 수 없습니다.`);
    }
    
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parseCSV(fileContent);
    
    const monthNum = parseInt(month);
    const currentYearMonth = `2025${month.padStart(2, '0')}`;
    const previousYearMonth = `2024${month.padStart(2, '0')}`;
    
    // 인원수 데이터 로드
    const headcountMap = loadHeadcountData();
    
    // 코스트센터별 집계
    const costCenterMap = new Map<string, { current: number; previous: number; name: string }>();
    
    records.forEach((record: any) => {
      // 계정 필터링 (대분류, 중분류, 소분류 모두 체크)
      const major = record['계정대분류'];
      const middle = record['계정중분류'];
      const detail = record['G/L 계정 설명'];
      
      if (major !== account && middle !== account && detail !== account) return;
      
      const costCenter = record['코스트 센터'];
      let costCenterName = record['코스트센터명'];
      
      if (!costCenter || costCenter === '미배정') return;
      
      // 코스트센터명 정규화 (통합)
      costCenterName = normalizeCostCenterName(costCenterName);
      
      if (mode === 'monthly') {
        const currentAmount = parseFloat(record[currentYearMonth] || '0');
        const previousAmount = parseFloat(record[previousYearMonth] || '0');
        
        // 정규화된 이름을 키로 사용하여 통합
        if (!costCenterMap.has(costCenterName)) {
          costCenterMap.set(costCenterName, { current: 0, previous: 0, name: costCenterName });
        }
        
        const data = costCenterMap.get(costCenterName)!;
        data.current += currentAmount;
        data.previous += previousAmount;
      } else {
        // 누적
        let currentTotal = 0;
        let previousTotal = 0;
        
        for (let m = 1; m <= monthNum; m++) {
          const currentYM = `2025${m.toString().padStart(2, '0')}`;
          const previousYM = `2024${m.toString().padStart(2, '0')}`;
          currentTotal += parseFloat(record[currentYM] || '0');
          previousTotal += parseFloat(record[previousYM] || '0');
        }
        
        // 정규화된 이름을 키로 사용하여 통합
        if (!costCenterMap.has(costCenterName)) {
          costCenterMap.set(costCenterName, { current: 0, previous: 0, name: costCenterName });
        }
        
        const data = costCenterMap.get(costCenterName)!;
        data.current += currentTotal;
        data.previous += previousTotal;
      }
    });
    
    // 결과 생성
    const result = Array.from(costCenterMap.entries())
      .map(([name, data]) => {
        // 인원수 조회 (202411, 202511만 있음)
        let currentHeadcount = null;
        let previousHeadcount = null;
        
        // 코스트센터명 그대로 사용 (CSV에 "공통_" 포함되어 있음)
        const deptName = data.name;
        
        // 202511 또는 202411 데이터 조회
        if (currentYearMonth === '202511') {
          const currentKey = `202511_${deptName}`;
          currentHeadcount = headcountMap.get(currentKey) || null;
        }
        
        if (previousYearMonth === '202411') {
          const previousKey = `202411_${deptName}`;
          previousHeadcount = headcountMap.get(previousKey) || null;
        }
        
        return {
          code: name,
          name: data.name,
          current: data.current / 1_000_000,
          previous: data.previous / 1_000_000,
          change: (data.current - data.previous) / 1_000_000,
          yoy: data.previous !== 0 ? (data.current / data.previous) * 100 : 0,
          currentHeadcount,
          previousHeadcount,
        };
      })
      .filter(item => Math.abs(item.current) >= 0.5 || Math.abs(item.previous) >= 0.5); // 당년 또는 전년이 0.5백만원 이상인 항목만
    
    // 금액 순 정렬 후 TOP 10
    result.sort((a, b) => b.current - a.current);
    const top10 = result.slice(0, 10);
    
    return NextResponse.json({
      success: true,
      account,
      data: top10,
    });
    
  } catch (error) {
    console.error('코스트센터 분석 API 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '코스트센터 분석 데이터를 불러오는데 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

