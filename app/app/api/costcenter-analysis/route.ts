import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { matchesCostCenterFilter, getDisplayName, loadCostCenterMapping } from '../utils/costcenter-mapping';

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

// 코스트센터명 정규화 (매핑 파일 사용)
function normalizeCostCenterName(name: string): string {
  return getDisplayName(name);
}

// 인원수 데이터 로드 (피벗 형식 지원)
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
    
    // 마케팅 관련 통합 인원수 저장용
    const marketingTotal: { [key: string]: number } = {};
    
    records.forEach((record: any) => {
      const deptName = record['코스트센터명'];
      const headcount202411 = parseInt(record['202411'] || '0') || 0;
      const headcount202511 = parseInt(record['202511'] || '0') || 0;
      const headcount202412 = parseInt(record['202412'] || '0') || 0;
      const headcount202512 = parseInt(record['202512'] || '0') || 0;
      
      // 마케팅 관련 팀은 합산
      if (deptName.includes('통합마케팅팀') || deptName.includes('통합인플루언서마케팅팀')) {
        marketingTotal['202411'] = (marketingTotal['202411'] || 0) + headcount202411;
        marketingTotal['202511'] = (marketingTotal['202511'] || 0) + headcount202511;
        marketingTotal['202412'] = (marketingTotal['202412'] || 0) + headcount202412;
        marketingTotal['202512'] = (marketingTotal['202512'] || 0) + headcount202512;
      }
      
      // 202411 데이터
      headcountMap.set(`202411_${deptName}`, headcount202411);
      // 202511 데이터
      headcountMap.set(`202511_${deptName}`, headcount202511);
      // 202412 데이터
      headcountMap.set(`202412_${deptName}`, headcount202412);
      // 202512 데이터
      headcountMap.set(`202512_${deptName}`, headcount202512);
    });
    
    // 마케팅본부에 통합마케팅+인플루언서 인원 합산 (해당 월에 마케팅본부 자체 인원이 없는 경우)
    const months = ['202411', '202511', '202412', '202512'];
    months.forEach(month => {
      const marketingKey = `${month}_공통_마케팅본부`;
      const currentMarketingHQ = headcountMap.get(marketingKey) || 0;
      const additionalMarketing = marketingTotal[month] || 0;
      
      // 마케팅본부 인원이 없거나 적으면 통합마케팅팀 인원 합산
      if (additionalMarketing > 0 && currentMarketingHQ < additionalMarketing) {
        headcountMap.set(marketingKey, currentMarketingHQ + additionalMarketing);
      }
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
    const month = searchParams.get('month') || '12';
    const account = searchParams.get('account'); // 선택한 계정
    
    // 필터 파라미터
    const costCentersParam = searchParams.get('costCenters') || '';
    const costCenters = costCentersParam ? costCentersParam.split(',').filter(c => c.trim()) : [];
    
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
      let detail = record['G/L 계정 설명'];
      
      // 복리후생비_근속지원을 복리후생비_총무지원으로 병합
      if (detail === '복리후생비_근속지원') {
        detail = '복리후생비_총무지원';
      }
      
      if (major !== account && middle !== account && detail !== account) return;
      
      const costCenter = record['코스트 센터'];
      let costCenterName = record['코스트센터명'];
      
      if (!costCenter || costCenter === '미배정') return;
      
      // 코스트센터 필터 적용 (매핑 사용)
      if (costCenters.length > 0) {
        if (!matchesCostCenterFilter(costCenterName, costCenters)) {
          return;
        }
      }
      
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
        // 인원수 조회 (현재 월 기준)
        const deptName = data.name;
        
        // 25년 해당월 인원수 (현재)
        const currentKey = `${currentYearMonth}_${deptName}`;
        const currentHeadcount = headcountMap.get(currentKey) || null;
        
        // 24년 해당월 인원수 (전년)
        const previousKey = `${previousYearMonth}_${deptName}`;
        const previousHeadcount = headcountMap.get(previousKey) || null;
        
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
