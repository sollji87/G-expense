import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { matchesCostCenterFilter } from '../utils/costcenter-mapping';

interface KpiData {
  category: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  // MoM (전월 대비) 데이터
  previousMonth: number;  // 전월 금액
  momChange: number;      // 전월 대비 증감액
  momPercent: number;     // 전월 대비 증감률 (%)
}

// 계정대분류 → KPI 카테고리 매핑
const CATEGORY_MAPPING: Record<string, string> = {
  '인건비': '인건비',
  'IT수수료': 'IT수수료',
  '지급수수료': '지급수수료',
  '직원경비': '직원경비',
  // 나머지는 모두 기타비용
};

function getCategoryName(accountCategory: string): string {
  return CATEGORY_MAPPING[accountCategory] || '기타비용';
}

// 간단한 CSV 파서 (헤더 포함)
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
    const mode = searchParams.get('mode') || 'monthly'; // 'monthly' or 'ytd'
    const month = searchParams.get('month') || '12'; // 선택된 월 (1-12)
    const year = searchParams.get('year') || '2025'; // 선택된 연도 (기본값 2025)
    
    // 필터 파라미터 (콤마로 구분된 문자열)
    const costCentersParam = searchParams.get('costCenters') || '';
    const majorCategoriesParam = searchParams.get('majorCategories') || '';
    
    // 필터 배열로 변환
    const costCenters = costCentersParam ? costCentersParam.split(',').filter(c => c.trim()) : [];
    const majorCategories = majorCategoriesParam ? majorCategoriesParam.split(',').filter(c => c.trim()) : [];
    
    // 필터가 있으면 코스트센터 포함 CSV 사용, 없으면 기본 CSV 사용
    const useDetailedCSV = costCenters.length > 0;
    
    let csvPath: string;
    
    if (useDetailedCSV) {
      // 코스트센터 필터가 있으면 상세 CSV 사용
      csvPath = path.join(process.cwd(), '..', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
      if (!fs.existsSync(csvPath)) {
        csvPath = path.join(process.cwd(), '..', '..', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
      }
      if (!fs.existsSync(csvPath)) {
        csvPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
      }
    } else {
      // 기본 CSV 사용
      csvPath = path.join(process.cwd(), '..', 'out', 'pivot_by_gl_yyyymm_combined.csv');
      if (!fs.existsSync(csvPath)) {
        csvPath = path.join(process.cwd(), '..', '..', 'out', 'pivot_by_gl_yyyymm_combined.csv');
      }
      if (!fs.existsSync(csvPath)) {
        csvPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'pivot_by_gl_yyyymm_combined.csv');
      }
    }
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV 파일을 찾을 수 없습니다. 시도한 경로: ${csvPath}`);
    }
    
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    
    // CSV 파싱
    const records = parseCSV(fileContent);

    // 현재 월과 전년 동월 설정
    const currentYear = year;
    const previousYear = (parseInt(year) - 1).toString();
    const targetMonth = month;
    
    // 카테고리별 집계 객체 (전월 데이터 포함)
    const categoryData: Record<string, { current: number; previous: number; previousMonth: number }> = {
      '인건비': { current: 0, previous: 0, previousMonth: 0 },
      'IT수수료': { current: 0, previous: 0, previousMonth: 0 },
      '지급수수료': { current: 0, previous: 0, previousMonth: 0 },
      '직원경비': { current: 0, previous: 0, previousMonth: 0 },
      '기타비용': { current: 0, previous: 0, previousMonth: 0 },
    };

    // 데이터 집계
    records.forEach((record: any) => {
      const accountCategory = record['계정대분류'];
      const categoryName = getCategoryName(accountCategory);
      
      // 코스트센터 필터 적용 (필터가 있고 상세 CSV 사용 시)
      if (costCenters.length > 0 && useDetailedCSV) {
        const recordCostCenter = record['코스트센터명'] || '';
        // 매핑을 사용하여 필터 적용 (표시명 → 원본 이름들로 변환하여 비교)
        if (!matchesCostCenterFilter(recordCostCenter, costCenters)) {
          return;
        }
      }
      
      // 계정 대분류 필터 적용
      if (majorCategories.length > 0) {
        if (!majorCategories.includes(accountCategory)) {
          return;
        }
      }

      if (mode === 'monthly') {
        // 당월 모드: 202510 vs 202410
        const currentMonth = `${currentYear}${targetMonth.padStart(2, '0')}`;
        const previousYearMonth = `${previousYear}${targetMonth.padStart(2, '0')}`;
        
        // 전월 계산 (1월인 경우 전년 12월)
        const prevMonthNum = parseInt(targetMonth) - 1;
        const prevMonthStr = prevMonthNum > 0 
          ? `${currentYear}${prevMonthNum.toString().padStart(2, '0')}`
          : `${previousYear}12`;
        
        const currentAmount = parseFloat(record[currentMonth] || '0');
        const previousYearAmount = parseFloat(record[previousYearMonth] || '0');
        const previousMonthAmount = parseFloat(record[prevMonthStr] || '0');
        
        categoryData[categoryName].current += currentAmount;
        categoryData[categoryName].previous += previousYearAmount;
        categoryData[categoryName].previousMonth += previousMonthAmount;
      } else {
        // 누적 모드: 202501~202510 vs 202401~202410
        for (let month = 1; month <= parseInt(targetMonth); month++) {
          const currentYearMonth = `${currentYear}${month.toString().padStart(2, '0')}`;
          const previousYearMonth = `${previousYear}${month.toString().padStart(2, '0')}`;
          
          const currentAmount = parseFloat(record[currentYearMonth] || '0');
          const previousYearAmount = parseFloat(record[previousYearMonth] || '0');
          
          categoryData[categoryName].current += currentAmount;
          categoryData[categoryName].previous += previousYearAmount;
        }
        
        // 누적 모드에서 MoM은 전월 누적 대비 (n-1월까지의 누적)
        if (parseInt(targetMonth) > 1) {
          for (let month = 1; month < parseInt(targetMonth); month++) {
            const currentYearMonth = `${currentYear}${month.toString().padStart(2, '0')}`;
            const prevMonthAmount = parseFloat(record[currentYearMonth] || '0');
            categoryData[categoryName].previousMonth += prevMonthAmount;
          }
        }
      }
    });

    // KPI 데이터 생성 (백만원 단위로 변환)
    const kpiData: KpiData[] = Object.entries(categoryData).map(([category, data]) => {
      const current = data.current / 1_000_000; // 백만원 단위
      const previous = data.previous / 1_000_000;
      const previousMonth = data.previousMonth / 1_000_000;
      const change = current - previous;
      const changePercent = previous !== 0 ? (current / previous) * 100 : 0;
      
      // MoM 계산
      const momChange = current - previousMonth;
      const momPercent = previousMonth !== 0 ? ((current - previousMonth) / previousMonth) * 100 : 0;

      return {
        category,
        current,
        previous,
        change,
        changePercent,
        previousMonth,
        momChange,
        momPercent,
      };
    });

    // 카테고리 순서 정렬
    const categoryOrder = ['인건비', 'IT수수료', '지급수수료', '직원경비', '기타비용'];
    kpiData.sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category));

    return NextResponse.json({
      success: true,
      mode,
      year: currentYear,
      month: targetMonth,
      data: kpiData,
    });

  } catch (error) {
    console.error('KPI API 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'KPI 데이터를 불러오는데 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

