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

// 코스트센터명 정규화 (여러 코스트센터를 하나로 통합)
function normalizeCostCenterName(name: string): string {
  if (name.includes('Process') || name.includes('AX팀') || name.includes('프로세스팀') || name.includes('PI팀')) {
    return '공통_프로세스팀';
  }
  return name;
}

// 인원수 데이터 로드
function loadHeadcountData(): Map<string, number> {
  const headcountMap = new Map<string, number>();

  try {
    const headcountPath = findCsvPath('headcount_monthly_latest.csv', ['snowflake']);
    const content = fs.readFileSync(headcountPath, 'utf-8');
    const records = parseCSV(content);

    records.forEach((record: any) => {
      const yearMonth = record['기준년월'];
      const deptName = record['부서명'];
      const headcount = parseInt(record['정규직인원수'] || '0');

      const key = `${yearMonth}_${deptName}`;
      headcountMap.set(key, headcount);
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
    const month = searchParams.get('month') || '10';
    const account = searchParams.get('account');

    if (!account) {
      return createErrorResponse('계정이 필요합니다.', new Error('Missing account'), 400);
    }

    // CSV 파일 읽기
    const csvPath = findCsvPath('pivot_by_gl_cctr_yyyymm_combined.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parseCSV(fileContent);

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

      const { current: currentAmount, previous: previousAmount } = calculateAmounts(record, mode, month);

      if (!costCenterMap.has(costCenterName)) {
        costCenterMap.set(costCenterName, { current: 0, previous: 0, name: costCenterName });
      }

      const data = costCenterMap.get(costCenterName)!;
      data.current += currentAmount;
      data.previous += previousAmount;
    });

    // 결과 생성
    const result = Array.from(costCenterMap.entries())
      .map(([name, data]) => {
        // 인원수 조회
        let currentHeadcount = null;
        let previousHeadcount = null;

        // 코스트센터명에서 "공통_" 제거하여 부서명과 매칭
        let currentDeptName = data.name.replace('공통_', '');
        let previousDeptName = data.name.replace('공통_', '');

        // 프로세스팀의 경우 연도별로 다른 부서명 사용
        if (currentDeptName === '프로세스팀') {
          currentDeptName = '프로세스팀';
          previousDeptName = 'AX팀';
        }

        if (currentYearMonth === '202510' || currentYearMonth === '202410') {
          const currentKey = `${currentYearMonth}_${currentDeptName}`;
          currentHeadcount = headcountMap.get(currentKey) || null;
        }

        if (previousYearMonth === '202410' || previousYearMonth === '202510') {
          const previousKey = `${previousYearMonth}_${previousDeptName}`;
          previousHeadcount = headcountMap.get(previousKey) || null;
        }

        return {
          code: name,
          name: data.name,
          current: toMillions(data.current),
          previous: toMillions(data.previous),
          change: toMillions(data.current - data.previous),
          yoy: calculateYoY(data.current, data.previous),
          currentHeadcount,
          previousHeadcount,
        };
      })
      .filter(item => isSignificantAmount(item.current) || isSignificantAmount(item.previous));

    // 금액 순 정렬 후 TOP 10
    result.sort((a, b) => b.current - a.current);
    const top10 = result.slice(0, 10);

    return createSuccessResponse({
      account,
      data: top10,
    });

  } catch (error) {
    return createErrorResponse('코스트센터 분석 데이터를 불러오는데 실패했습니다.', error);
  }
}
