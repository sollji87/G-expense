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

// 카테고리 정렬 순서
const CATEGORY_ORDER = ['인건비', '직원경비', 'IT수수료', '지급수수료', '기타비용'];

// 노드를 결과 형태로 변환하는 헬퍼 함수
function convertNodeToResult(node: any, excludeDetailChildren = false): any {
  const current = toMillions(node.current);
  const previous = toMillions(node.previous);

  let children: any[] = [];
  if (!excludeDetailChildren && node.children instanceof Map) {
    children = Array.from(node.children.values())
      .map((child: any) => convertNodeToResult(child, false))
      .filter((child: any) => isSignificantAmount(child.current) || isSignificantAmount(child.previous));
  }

  return {
    id: node.id,
    name: node.name,
    current,
    previous,
    change: current - previous,
    yoy: calculateYoY(node.current, node.previous),
    children
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'monthly';
    const month = searchParams.get('month') || '10';

    const csvPath = findCsvPath('pivot_by_gl_yyyymm_combined.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parseCSV(fileContent);

    // 계층 구조: 대분류 -> 중분류 -> 소분류
    const hierarchy = new Map<string, any>();

    records.forEach((record: any) => {
      const major = record['계정대분류'];
      const middle = record['계정중분류'];
      const detail = record['G/L 계정 설명'];

      if (!major || major === '미배정') return;

      const { current: currentAmount, previous: previousAmount } = calculateAmounts(record, mode, month);

      // 대분류 추가
      if (!hierarchy.has(major)) {
        hierarchy.set(major, {
          id: major,
          name: major,
          current: 0,
          previous: 0,
          children: new Map<string, any>()
        });
      }

      const majorNode = hierarchy.get(major);
      majorNode.current += currentAmount;
      majorNode.previous += previousAmount;

      // 중분류 추가
      if (middle && middle !== '미배정') {
        if (!majorNode.children.has(middle)) {
          majorNode.children.set(middle, {
            id: `${major}_${middle}`,
            name: middle,
            current: 0,
            previous: 0,
            children: new Map<string, any>()
          });
        }

        const middleNode = majorNode.children.get(middle);
        middleNode.current += currentAmount;
        middleNode.previous += previousAmount;

        // 소분류 추가
        if (detail && detail !== '미배정') {
          if (!middleNode.children.has(detail)) {
            middleNode.children.set(detail, {
              id: `${major}_${middle}_${detail}`,
              name: detail,
              current: 0,
              previous: 0,
              children: []
            });
          }

          const detailNode = middleNode.children.get(detail);
          detailNode.current += currentAmount;
          detailNode.previous += previousAmount;
        }
      }
    });

    // Map을 배열로 변환
    const result = Array.from(hierarchy.values()).map(major => {
      const majorResult = convertNodeToResult(major);

      // 인건비는 소분류를 표시하지 않음
      if (major.name === '인건비') {
        majorResult.children = majorResult.children.map((middle: any) => ({
          ...middle,
          children: []
        }));
      }

      return majorResult;
    });

    // 비용 순서 정렬
    result.sort((a, b) => {
      const indexA = CATEGORY_ORDER.indexOf(a.name);
      const indexB = CATEGORY_ORDER.indexOf(b.name);

      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    // 공통비 합계 계산
    const totalCurrent = result.reduce((sum, item) => sum + item.current, 0);
    const totalPrevious = result.reduce((sum, item) => sum + item.previous, 0);

    // 공통비 합계를 맨 앞에 추가
    const finalResult = [
      {
        id: '공통비합계',
        name: '공통비 합계',
        current: totalCurrent,
        previous: totalPrevious,
        change: totalCurrent - totalPrevious,
        yoy: calculateYoY(totalCurrent * 1_000_000, totalPrevious * 1_000_000),
        children: [],
        isTotal: true
      },
      ...result
    ];

    return createSuccessResponse({
      mode,
      month,
      data: finalResult,
    });

  } catch (error) {
    return createErrorResponse('계층 데이터를 불러오는데 실패했습니다.', error);
  }
}
