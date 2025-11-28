import {
  parseCSV,
  findCsvPath,
  createSuccessResponse,
  createErrorResponse,
  calculateAmounts,
  toMillions,
  calculateYoY
} from '@/lib/csv-utils';
import fs from 'fs';

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
};

const CATEGORY_ORDER = ['인건비', 'IT수수료', '지급수수료', '직원경비', '기타비용'];

function getCategoryName(accountCategory: string): string {
  return CATEGORY_MAPPING[accountCategory] || '기타비용';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'monthly';
    const month = searchParams.get('month') || '10';

    const csvPath = findCsvPath('pivot_by_gl_yyyymm_combined.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parseCSV(fileContent);

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
      const { current, previous } = calculateAmounts(record, mode, month);

      categoryData[categoryName].current += current;
      categoryData[categoryName].previous += previous;
    });

    // KPI 데이터 생성 (백만원 단위로 변환)
    const kpiData: KpiData[] = Object.entries(categoryData).map(([category, data]) => {
      const current = toMillions(data.current);
      const previous = toMillions(data.previous);

      return {
        category,
        current,
        previous,
        change: current - previous,
        changePercent: calculateYoY(data.current, data.previous),
      };
    });

    // 카테고리 순서 정렬
    kpiData.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));

    return createSuccessResponse({
      mode,
      month,
      data: kpiData,
    });

  } catch (error) {
    return createErrorResponse('KPI 데이터를 불러오는데 실패했습니다.', error);
  }
}
