import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface KpiData {
  category: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
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
    const month = searchParams.get('month') || '11'; // 선택된 월 (1-11)
    
    // CSV 파일 읽기 - 여러 경로 시도
    let csvPath = path.join(process.cwd(), '..', 'out', 'pivot_by_gl_yyyymm_combined.csv');
    
    // 경로가 없으면 다른 경로 시도
    if (!fs.existsSync(csvPath)) {
      csvPath = path.join(process.cwd(), '..', '..', 'out', 'pivot_by_gl_yyyymm_combined.csv');
    }
    
    if (!fs.existsSync(csvPath)) {
      csvPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'pivot_by_gl_yyyymm_combined.csv');
    }
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV 파일을 찾을 수 없습니다. 시도한 경로: ${csvPath}`);
    }
    
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    
    // CSV 파싱
    const records = parseCSV(fileContent);

    // 현재 월과 전년 동월 설정
    const currentYear = '2025';
    const previousYear = '2024';
    const targetMonth = month;
    
    // 카테고리별 집계 객체
    const categoryData: Record<string, { current: number; previous: number }> = {
      '인건비': { current: 0, previous: 0 },
      'IT수수료': { current: 0, previous: 0 },
      '지급수수료': { current: 0, previous: 0 },
      '직원경비': { current: 0, previous: 0 },
      '기타비용': { current: 0, previous: 0 },
    };

    // 데이터 집계
    records.forEach((record: any) => {
      const accountCategory = record['계정대분류'];
      const categoryName = getCategoryName(accountCategory);

      if (mode === 'monthly') {
        // 당월 모드: 202510 vs 202410
        const currentMonth = `${currentYear}${targetMonth.padStart(2, '0')}`;
        const previousMonth = `${previousYear}${targetMonth.padStart(2, '0')}`;
        
        const currentAmount = parseFloat(record[currentMonth] || '0');
        const previousAmount = parseFloat(record[previousMonth] || '0');
        
        categoryData[categoryName].current += currentAmount;
        categoryData[categoryName].previous += previousAmount;
      } else {
        // 누적 모드: 202501~202510 vs 202401~202410
        for (let month = 1; month <= parseInt(targetMonth); month++) {
          const currentYearMonth = `${currentYear}${month.toString().padStart(2, '0')}`;
          const previousYearMonth = `${previousYear}${month.toString().padStart(2, '0')}`;
          
          const currentAmount = parseFloat(record[currentYearMonth] || '0');
          const previousAmount = parseFloat(record[previousYearMonth] || '0');
          
          categoryData[categoryName].current += currentAmount;
          categoryData[categoryName].previous += previousAmount;
        }
      }
    });

    // KPI 데이터 생성 (백만원 단위로 변환)
    const kpiData: KpiData[] = Object.entries(categoryData).map(([category, data]) => {
      const current = data.current / 1_000_000; // 백만원 단위
      const previous = data.previous / 1_000_000;
      const change = current - previous;
      const changePercent = previous !== 0 ? (current / previous) * 100 : 0;

      return {
        category,
        current,
        previous,
        change,
        changePercent,
      };
    });

    // 카테고리 순서 정렬
    const categoryOrder = ['인건비', 'IT수수료', '지급수수료', '직원경비', '기타비용'];
    kpiData.sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category));

    return NextResponse.json({
      success: true,
      mode,
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

