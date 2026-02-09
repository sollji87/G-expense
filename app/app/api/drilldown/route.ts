import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { matchesCostCenterFilter } from '../utils/costcenter-mapping';

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const month = searchParams.get('month') || '12';
    const yearParam = searchParams.get('year') || '2025';
    const level = searchParams.get('level') || 'auto'; // major, middle, detail, auto
    
    // 필터 파라미터
    const costCentersParam = searchParams.get('costCenters') || '';
    const costCenters = costCentersParam ? costCentersParam.split(',').filter(c => c.trim()) : [];
    
    if (!category) {
      return NextResponse.json({ success: false, error: '카테고리가 필요합니다.' }, { status: 400 });
    }
    
    // CSV 파일 읽기 (코스트센터 정보 포함된 파일 사용)
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
    
    // 선택한 카테고리의 하위 분류별 데이터 집계
    const monthNum = parseInt(month);
    const drilldownData: any[] = [];
    const subcategoryMap = new Map<string, { current: number; previous: number }>();
    
    // 대분류인지 중분류인지 판단
    let isDrilldownToDetail = false;
    let isDrilldownToMiddle = false;
    
    if (level === 'major') {
      // 명시적으로 대분류 → 중분류
      isDrilldownToMiddle = true;
    } else if (level === 'middle') {
      // 명시적으로 중분류 → 소분류
      isDrilldownToDetail = true;
    } else {
      // auto: 자동 판단 (대분류와 중분류 이름이 다른 경우)
      const hasAsMiddle = records.some(r => r['계정중분류'] === category && r['계정대분류'] !== category);
      const hasAsMajor = records.some(r => r['계정대분류'] === category);
      isDrilldownToDetail = hasAsMiddle;
      isDrilldownToMiddle = !hasAsMiddle && hasAsMajor;
    }
    
    records.forEach((record: any) => {
      // 코스트센터 필터 적용 (매핑 사용)
      if (costCenters.length > 0) {
        const recordCostCenter = record['코스트센터명'] || '';
        if (!matchesCostCenterFilter(recordCostCenter, costCenters)) {
          return;
        }
      }
      
      let shouldInclude = false;
      let subcategory = '';
      
      if (isDrilldownToDetail && record['계정중분류'] === category) {
        // 중분류 → 소분류
        shouldInclude = true;
        subcategory = record['G/L 계정 설명'];
      } else if (isDrilldownToMiddle && record['계정대분류'] === category) {
        // 대분류 → 중분류
        shouldInclude = true;
        subcategory = record['계정중분류'];
      }
      
      if (shouldInclude && subcategory) {
        const currentMonth = `${yearParam}${month.padStart(2, '0')}`;
        const previousMonth = `${String(parseInt(yearParam) - 1)}${month.padStart(2, '0')}`;
        
        const currentAmount = parseFloat(record[currentMonth] || '0');
        const previousAmount = parseFloat(record[previousMonth] || '0');
        
        if (!subcategoryMap.has(subcategory)) {
          subcategoryMap.set(subcategory, { current: 0, previous: 0 });
        }
        
        const data = subcategoryMap.get(subcategory)!;
        data.current += currentAmount;
        data.previous += previousAmount;
      }
    });
    
    // 월별 데이터 생성 (최근 12개월)
    const months = [];
    const currentYear = parseInt(yearParam);
    
    for (let i = 11; i >= 0; i--) {
      let targetMonth = monthNum - i;
      let targetYear = currentYear;
      
      // 월이 0 이하면 전년도로
      while (targetMonth <= 0) {
        targetMonth += 12;
        targetYear -= 1;
      }
      
      const monthData: any = {
        month: `${targetYear.toString().slice(2)}년${targetMonth}월`,
        monthNum: targetMonth,
      };
      
      const subcategoryMonthMap = new Map<string, number>();
      
      records.forEach((record: any) => {
        // 코스트센터 필터 적용
        if (costCenters.length > 0) {
          const recordCostCenter = record['코스트센터명'] || '';
          if (!costCenters.some(cc => recordCostCenter.includes(cc) || cc.includes(recordCostCenter))) {
            return;
          }
        }
        
        let shouldInclude = false;
        let subcategory = '';
        
        if (isDrilldownToDetail && record['계정중분류'] === category) {
          shouldInclude = true;
          subcategory = record['G/L 계정 설명'];
        } else if (isDrilldownToMiddle && record['계정대분류'] === category) {
          shouldInclude = true;
          subcategory = record['계정중분류'];
        }
        
        if (shouldInclude && subcategory) {
          const yearMonth = `${targetYear}${targetMonth.toString().padStart(2, '0')}`;
          const amount = parseFloat(record[yearMonth] || '0');
          
          if (!subcategoryMonthMap.has(subcategory)) {
            subcategoryMonthMap.set(subcategory, 0);
          }
          subcategoryMonthMap.set(subcategory, subcategoryMonthMap.get(subcategory)! + amount);
        }
      });
      
      // 각 중분류 데이터 추가 (금액이 있는 것만)
      subcategoryMonthMap.forEach((amount, subcategory) => {
        const amountInMillion = amount / 1_000_000;
        if (Math.abs(amountInMillion) >= 0.5) {
          monthData[subcategory] = amountInMillion;
        }
      });
      
      // YOY 계산
      let totalCurrent = 0;
      let totalPrevious = 0;
      
      records.forEach((record: any) => {
        if (costCenters.length > 0) {
          const recordCostCenter = record['코스트센터명'] || '';
          if (!costCenters.some(cc => recordCostCenter.includes(cc) || cc.includes(recordCostCenter))) {
            return;
          }
        }
        
        let shouldInclude = false;
        
        if (isDrilldownToDetail && record['계정중분류'] === category) {
          shouldInclude = true;
        } else if (isDrilldownToMiddle && record['계정대분류'] === category) {
          shouldInclude = true;
        }
        
        if (shouldInclude) {
          const currentYM = `${targetYear}${targetMonth.toString().padStart(2, '0')}`;
          const previousYM = `${targetYear - 1}${targetMonth.toString().padStart(2, '0')}`;
          totalCurrent += parseFloat(record[currentYM] || '0');
          totalPrevious += parseFloat(record[previousYM] || '0');
        }
      });
      
      monthData['YOY'] = totalPrevious !== 0 ? (totalCurrent / totalPrevious) * 100 : 0;
      
      months.push(monthData);
    }
    
    // 중분류 목록 (12개월 데이터에서 등장한 모든 subcategory + 선택월 기준 금액 있는 것만)
    const allSubcategoriesFromMonths = new Set<string>();
    months.forEach((m: any) => {
      Object.keys(m).forEach(key => {
        if (key !== 'month' && key !== 'monthNum' && key !== 'YOY') {
          allSubcategoriesFromMonths.add(key);
        }
      });
    });
    
    const subcategories = Array.from(allSubcategoriesFromMonths).filter(key => {
      // subcategoryMap에 있는 경우 기존 로직 사용
      if (subcategoryMap.has(key)) {
        const data = subcategoryMap.get(key)!;
        return Math.abs(data.current / 1_000_000) >= 0.5 || Math.abs(data.previous / 1_000_000) >= 0.5;
      }
      // 12개월 차트에만 등장하는 경우 포함
      return true;
    });
    
    return NextResponse.json({
      success: true,
      category,
      subcategories,
      data: months,
    });
    
  } catch (error) {
    console.error('드릴다운 API 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '드릴다운 데이터를 불러오는데 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

