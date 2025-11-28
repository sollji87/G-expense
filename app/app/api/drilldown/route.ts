import {
  parseCSV,
  findCsvPath,
  createSuccessResponse,
  createErrorResponse,
  toMillions,
  calculateYoY,
  isSignificantAmount
} from '@/lib/csv-utils';
import fs from 'fs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const month = searchParams.get('month') || '10';
    const level = searchParams.get('level') || 'auto'; // major, middle, detail, auto

    if (!category) {
      return createErrorResponse('카테고리가 필요합니다.', new Error('Missing category'), 400);
    }

    // CSV 파일 읽기
    const csvPath = findCsvPath('pivot_by_gl_cctr_yyyymm_combined.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parseCSV(fileContent);

    // 선택한 카테고리의 하위 분류별 데이터 집계
    const monthNum = parseInt(month);
    const subcategoryMap = new Map<string, { current: number; previous: number }>();

    // 대분류인지 중분류인지 판단
    let isDrilldownToDetail = false;
    let isDrilldownToMiddle = false;

    if (level === 'major') {
      isDrilldownToMiddle = true;
    } else if (level === 'middle') {
      isDrilldownToDetail = true;
    } else {
      // auto: 자동 판단
      const hasAsMiddle = records.some(r => r['계정중분류'] === category && r['계정대분류'] !== category);
      const hasAsMajor = records.some(r => r['계정대분류'] === category);
      isDrilldownToDetail = hasAsMiddle;
      isDrilldownToMiddle = !hasAsMiddle && hasAsMajor;
    }

    // 헬퍼 함수: 레코드가 포함되어야 하는지 확인하고 서브카테고리 반환
    const getSubcategory = (record: any): string | null => {
      if (isDrilldownToDetail && record['계정중분류'] === category) {
        return record['G/L 계정 설명'];
      } else if (isDrilldownToMiddle && record['계정대분류'] === category) {
        return record['계정중분류'];
      }
      return null;
    };

    // 당월/전년동월 금액 집계
    records.forEach((record: any) => {
      const subcategory = getSubcategory(record);
      if (!subcategory) return;

      const currentMonth = `2025${month.padStart(2, '0')}`;
      const previousMonth = `2024${month.padStart(2, '0')}`;

      const currentAmount = parseFloat(record[currentMonth] || '0');
      const previousAmount = parseFloat(record[previousMonth] || '0');

      if (!subcategoryMap.has(subcategory)) {
        subcategoryMap.set(subcategory, { current: 0, previous: 0 });
      }

      const data = subcategoryMap.get(subcategory)!;
      data.current += currentAmount;
      data.previous += previousAmount;
    });

    // 월별 데이터 생성
    const months = [];
    for (let m = 1; m <= monthNum; m++) {
      const monthData: any = {
        month: `${m}월`,
        monthNum: m,
      };

      const subcategoryMonthMap = new Map<string, number>();

      records.forEach((record: any) => {
        const subcategory = getSubcategory(record);
        if (!subcategory) return;

        const yearMonth = `2025${m.toString().padStart(2, '0')}`;
        const amount = parseFloat(record[yearMonth] || '0');

        subcategoryMonthMap.set(
          subcategory,
          (subcategoryMonthMap.get(subcategory) || 0) + amount
        );
      });

      // 각 서브카테고리 데이터 추가 (금액이 있는 것만)
      subcategoryMonthMap.forEach((amount, subcategory) => {
        const amountInMillion = toMillions(amount);
        if (isSignificantAmount(amountInMillion)) {
          monthData[subcategory] = amountInMillion;
        }
      });

      // YOY 계산
      let totalCurrent = 0;
      let totalPrevious = 0;

      records.forEach((record: any) => {
        const subcategory = getSubcategory(record);
        if (!subcategory) return;

        const currentYM = `2025${m.toString().padStart(2, '0')}`;
        const previousYM = `2024${m.toString().padStart(2, '0')}`;
        totalCurrent += parseFloat(record[currentYM] || '0');
        totalPrevious += parseFloat(record[previousYM] || '0');
      });

      monthData['YOY'] = calculateYoY(totalCurrent, totalPrevious);
      months.push(monthData);
    }

    // 서브카테고리 목록 (금액이 있는 것만)
    const subcategories = Array.from(subcategoryMap.keys()).filter(key => {
      const data = subcategoryMap.get(key)!;
      return isSignificantAmount(toMillions(data.current)) || isSignificantAmount(toMillions(data.previous));
    });

    return createSuccessResponse({
      category,
      subcategories,
      data: months,
    });

  } catch (error) {
    return createErrorResponse('드릴다운 데이터를 불러오는데 실패했습니다.', error);
  }
}
