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

// 코스트센터 코드 → 대분류 및 중분류 매핑
// 대분류: 임원, 지원부서, 사업부서
// 중분류: 경영지원담당, 경영기획담당, 법무담당, 경영개선팀, HR/총무담당, 소비자전략팀, 자산관리담당, 디지털본부담당, 
//        퍼포먼스마케팅팀, e-BIZ팀, 마케팅본부담당, 해외사업담당, 통합소싱팀, 통합영업팀, 글로벌슈즈팀

interface CctrMapping {
  category: string;  // 대분류
  subDivision: string;  // 중분류
}

// 코스트센터명으로 중분류 결정 (labor API 로직과 동일하게)
function getCctrMapping(cctrCode: string, cctrName: string): CctrMapping {
  const code = cctrCode.trim();
  const name = cctrName.replace('공통_', '').replace('[CLSD]', '').trim();
  
  // 임원
  if (name.includes('임원') || code === 'F00100') {
    return { category: '임원', subDivision: '임원' };
  }
  
  // === 지원부서 (labor API의 팀 이름 매핑 로직 따름) ===
  
  // 경영지원담당: 경영관리, 회계, 자금
  if (name.includes('경영관리') || name.includes('회계') || name.includes('자금')) {
    return { category: '지원부서', subDivision: '경영지원담당' };
  }
  
  // 경영기획담당: 경영기획, 무역, 공간기획, 인테리어, 운영전략
  if (name.includes('경영기획') || name.includes('무역') || name.includes('공간기획') || 
      name.includes('인테리어') || name.includes('운영전략')) {
    return { category: '지원부서', subDivision: '경영기획담당' };
  }
  
  // 법무담당
  if (name.includes('법무')) {
    return { category: '지원부서', subDivision: '법무담당' };
  }
  
  // 경영개선팀
  if (name.includes('경영개선')) {
    return { category: '지원부서', subDivision: '경영개선팀' };
  }
  
  // HR/총무담당: HR, 총무, 안전보건
  if (name.includes('HR') || name.includes('총무') || name.includes('안전보건')) {
    return { category: '지원부서', subDivision: 'HR/총무담당' };
  }
  
  // 소비자전략팀
  if (name.includes('소비자전략')) {
    return { category: '지원부서', subDivision: '소비자전략팀' };
  }
  
  // 자산관리담당
  if (name.includes('자산관리')) {
    return { category: '지원부서', subDivision: '자산관리담당' };
  }
  
  // 디지털본부담당 (지원): IT, 정보보안, Process, PI, AX, AI, 데이터엔지니어링, 디지털본부
  if (name.includes('IT') || name.includes('정보보안') || name.includes('Process') || 
      name.includes('PI팀') || name.includes('AX') || name.includes('AI') || 
      name.includes('데이터엔지니어링') || name.includes('디지털본부')) {
    return { category: '지원부서', subDivision: '디지털본부담당' };
  }
  
  // === 사업부서 ===
  
  // 디지털본부담당 (사업): 퍼포먼스마케팅, e-BIZ, 통합온라인채널, 콘텐츠
  if (name.includes('퍼포먼스마케팅') || name.includes('e-BIZ') || name.includes('BIZ') || 
      name.includes('통합온라인채널') || name.includes('콘텐츠')) {
    return { category: '사업부서', subDivision: '디지털본부담당' };
  }
  
  // 마케팅본부담당: 통합마케팅, 마케팅본부, 인플루언서
  if (name.includes('마케팅본부') || name.includes('통합마케팅') || name.includes('인플루언서')) {
    return { category: '사업부서', subDivision: '마케팅본부담당' };
  }
  
  // 해외사업담당: 해외사업
  if (name.includes('해외사업')) {
    return { category: '사업부서', subDivision: '해외사업담당' };
  }
  
  // 글로벌슈즈팀 (별도 중분류)
  if (name.includes('글로벌슈즈')) {
    return { category: '사업부서', subDivision: '글로벌슈즈팀' };
  }
  
  // 통합소싱팀
  if (name.includes('통합소싱') || name.includes('소싱')) {
    return { category: '사업부서', subDivision: '통합소싱팀' };
  }
  
  // 통합영업팀
  if (name.includes('통합영업') || name.includes('영업')) {
    return { category: '사업부서', subDivision: '통합영업팀' };
  }
  
  // 기타 F0로 시작하는 경우 (공통)
  if (code.startsWith('F0')) {
    return { category: '기타', subDivision: '기타' };
  }
  
  return { category: '기타', subDivision: '기타' };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || '12';
    const yearParam = searchParams.get('year') || '2025';
    const currentYear = parseInt(yearParam);
    const prevYear = currentYear - 1;
    
    // 코스트센터별 인건비 CSV 로드
    let csvPath = path.join(process.cwd(), '..', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
    if (!fs.existsSync(csvPath)) {
      csvPath = path.join(process.cwd(), '..', '..', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
    }
    if (!fs.existsSync(csvPath)) {
      csvPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
    }
    
    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({ success: false, error: 'CSV 파일을 찾을 수 없습니다.' }, { status: 500 });
    }
    
    const content = fs.readFileSync(csvPath, 'utf-8');
    const records = parseCSV(content);
    
    const monthStr = month.padStart(2, '0');
    const monthNum = parseInt(monthStr);
    const prevMonthStr = (monthNum === 1 ? 12 : monthNum - 1).toString().padStart(2, '0');
    
    const current2025 = `${currentYear}${monthStr}`;
    const current2024 = `${prevYear}${monthStr}`;
    const prev2025 = monthNum === 1 ? `${prevYear}${prevMonthStr}` : `${currentYear}${prevMonthStr}`; // 전월
    
    // 대분류별 인건비 집계
    const categoryCosts: { [cat: string]: { cost2024: number; cost2025: number; costPrev: number } } = {
      '임원': { cost2024: 0, cost2025: 0, costPrev: 0 },
      '지원부서': { cost2024: 0, cost2025: 0, costPrev: 0 },
      '사업부서': { cost2024: 0, cost2025: 0, costPrev: 0 },
    };
    
    // 중분류별 인건비 집계 (대분류+중분류 복합키 사용)
    const subDivisionCosts: { [key: string]: { cost2024: number; cost2025: number; costPrev: number; category: string; name: string } } = {};
    
    // 전체 인건비
    let totalCost2024 = 0;
    let totalCost2025 = 0;
    let totalCostPrev = 0;
    
    records.forEach((record: any) => {
      // 인건비만 필터링
      if (record['계정대분류'] !== '인건비') return;
      
      const cctrCode = record['코스트 센터'] || '';
      const cctrName = record['코스트센터명'] || '';
      const mapping = getCctrMapping(cctrCode, cctrName);
      
      const cost2024 = parseFloat(record[current2024] || '0');
      const cost2025 = parseFloat(record[current2025] || '0');
      const costPrev = parseFloat(record[prev2025] || '0'); // 전월 인건비
      
      // 전체 합계
      totalCost2024 += cost2024;
      totalCost2025 += cost2025;
      totalCostPrev += costPrev;
      
      // 대분류별 집계
      if (categoryCosts[mapping.category]) {
        categoryCosts[mapping.category].cost2024 += cost2024;
        categoryCosts[mapping.category].cost2025 += cost2025;
        categoryCosts[mapping.category].costPrev += costPrev;
      }
      
      // 중분류별 집계 (대분류+중분류 조합으로 키 생성하여 동일 이름 구분)
      const subDivKey = `${mapping.category}::${mapping.subDivision}`;
      if (!subDivisionCosts[subDivKey]) {
        subDivisionCosts[subDivKey] = { cost2024: 0, cost2025: 0, costPrev: 0, category: mapping.category, name: mapping.subDivision };
      }
      subDivisionCosts[subDivKey].cost2024 += cost2024;
      subDivisionCosts[subDivKey].cost2025 += cost2025;
      subDivisionCosts[subDivKey].costPrev += costPrev;
    });
    
    // 백만원 단위로 변환
    const convertToMillion = (val: number) => val / 1_000_000;
    
    const categoryData = Object.entries(categoryCosts).map(([name, data]) => ({
      name,
      cost2024: convertToMillion(data.cost2024),
      cost2025: convertToMillion(data.cost2025),
      costPrev: convertToMillion(data.costPrev), // 전월 인건비
    }));
    
    // 중분류 데이터 변환
    const subDivisionData = Object.entries(subDivisionCosts).map(([, data]) => ({
      name: data.name,
      category: data.category,
      cost2024: convertToMillion(data.cost2024),
      cost2025: convertToMillion(data.cost2025),
      costPrev: convertToMillion(data.costPrev), // 전월 인건비
    }));
    
    return NextResponse.json({
      success: true,
      month: monthStr,
      total: {
        cost2024: convertToMillion(totalCost2024),
        cost2025: convertToMillion(totalCost2025),
      },
      categories: categoryData,
      subDivisions: subDivisionData,  // 중분류별 인건비 추가
    });
    
  } catch (error) {
    console.error('Labor cost API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
