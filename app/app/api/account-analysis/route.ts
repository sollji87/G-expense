import {
  parseCSV,
  findCsvPath,
  createSuccessResponse,
  createErrorResponse,
  calculateAmounts,
  toMillions,
  calculateYoY,
  isSignificantAmount
} from '@/lib/csv-utils';
import fs from 'fs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'monthly';
    const month = searchParams.get('month') || '10';
    const level = searchParams.get('level') || 'major'; // major, middle, detail
    const category = searchParams.get('category');

    const csvPath = findCsvPath('pivot_by_gl_cctr_yyyymm_combined.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parseCSV(fileContent);

    // 레벨에 따라 집계
    const accountMap = new Map<string, { current: number; previous: number; parent: string }>();

    records.forEach((record: any) => {
      let key = '';
      let parentKey = '';

      if (level === 'major') {
        key = record['계정대분류'];
      } else if (level === 'middle') {
        if (category && record['계정대분류'] !== category) return;
        key = record['계정중분류'];
        parentKey = record['계정대분류'];
      } else if (level === 'detail') {
        if (category && record['계정중분류'] !== category) return;
        key = record['G/L 계정 설명'];
        parentKey = record['계정중분류'];
      }

      if (!key) return;

      const { current, previous } = calculateAmounts(record, mode, month);

      if (!accountMap.has(key)) {
        accountMap.set(key, { current: 0, previous: 0, parent: parentKey });
      }

      const data = accountMap.get(key)!;
      data.current += current;
      data.previous += previous;
    });

    // 결과 생성
    const result = Array.from(accountMap.entries())
      .map(([name, data]) => ({
        name,
        current: toMillions(data.current),
        previous: toMillions(data.previous),
        change: toMillions(data.current - data.previous),
        yoy: calculateYoY(data.current, data.previous),
        parent: data.parent
      }))
      .filter(item => isSignificantAmount(item.current) || isSignificantAmount(item.previous));

    // 금액 순 정렬
    result.sort((a, b) => b.current - a.current);

    return createSuccessResponse({
      level,
      category,
      data: result,
    });

  } catch (error) {
    return createErrorResponse('계정 분석 데이터를 불러오는데 실패했습니다.', error);
  }
}
