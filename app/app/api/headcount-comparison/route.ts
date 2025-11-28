import {
  parseCSV,
  findCsvPath,
  createSuccessResponse,
  createErrorResponse
} from '@/lib/csv-utils';
import fs from 'fs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const currentMonth = searchParams.get('currentMonth') || '202510';
    const previousMonth = searchParams.get('previousMonth') || '202410';

    const headcountPath = findCsvPath('headcount_monthly_latest.csv', ['snowflake']);
    const fileContent = fs.readFileSync(headcountPath, 'utf-8');
    const records = parseCSV(fileContent);

    // 현재 월과 이전 월의 인원수 데이터 필터링
    const currentData = records.filter((r: any) => r['기준년월'] === currentMonth);
    const previousData = records.filter((r: any) => r['기준년월'] === previousMonth);

    // 부서별 인원수 맵 생성
    const currentDeptMap = new Map<string, number>();
    const previousDeptMap = new Map<string, number>();

    currentData.forEach((r: any) => {
      const dept = r['부서명'];
      const headcount = parseInt(r['정규직인원수'] || '0');
      currentDeptMap.set(dept, (currentDeptMap.get(dept) || 0) + headcount);
    });

    previousData.forEach((r: any) => {
      const dept = r['부서명'];
      const headcount = parseInt(r['정규직인원수'] || '0');

      // 프로세스팀 처리: 2024년에는 AX팀으로 표시
      const normalizedDept = dept === 'AX팀' ? '프로세스팀' : dept;
      previousDeptMap.set(normalizedDept, (previousDeptMap.get(normalizedDept) || 0) + headcount);
    });

    // 총 인원수 계산
    const currentTotal = Array.from(currentDeptMap.values()).reduce((sum, count) => sum + count, 0);
    const previousTotal = Array.from(previousDeptMap.values()).reduce((sum, count) => sum + count, 0);

    // 부서별 차이 계산
    const allDepartments = new Set([...currentDeptMap.keys(), ...previousDeptMap.keys()]);
    const departmentChanges: any[] = [];

    allDepartments.forEach(dept => {
      const current = currentDeptMap.get(dept) || 0;
      const previous = previousDeptMap.get(dept) || 0;
      const change = current - previous;

      if (change !== 0) {
        departmentChanges.push({
          department: dept,
          current,
          previous,
          change
        });
      }
    });

    // 변동이 큰 순서대로 정렬
    departmentChanges.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    return createSuccessResponse({
      data: {
        currentTotal,
        previousTotal,
        change: currentTotal - previousTotal,
        departments: departmentChanges
      }
    });

  } catch (error) {
    return createErrorResponse('인원수 비교 데이터를 불러오는데 실패했습니다.', error);
  }
}
