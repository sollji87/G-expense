import {
  parseCSV,
  findDetailsBasePath,
  createSuccessResponse,
  createErrorResponse
} from '@/lib/csv-utils';
import fs from 'fs';
import path from 'path';

// 폴더 내 모든 CSV 파일 데이터 로드
function loadAllCsvFromPath(basePath: string | null): any[] {
  const data: any[] = [];
  if (!basePath || !fs.existsSync(basePath)) return data;

  const folders = fs.readdirSync(basePath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory());

  for (const folder of folders) {
    const folderPath = path.join(basePath, folder.name);
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.csv'));

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const records = parseCSV(content);
      data.push(...records);
    }
  }

  return data;
}

// GL 계정별 금액 집계
function aggregateByGL(data: any[]): {
  byGL: Map<string, number>;
  byGLDetail: Map<string, Map<string, number>>;
} {
  const byGL = new Map<string, number>();
  const byGLDetail = new Map<string, Map<string, number>>();

  data.forEach((record: any) => {
    const glAccount = record['G/L 계정 설명'] || record['GL계정'] || '기타';
    const description = record['적요'] || record['Description'] || '';
    const amount = parseFloat(record['금액'] || record['Amount'] || '0');

    // GL 계정별 총액
    byGL.set(glAccount, (byGL.get(glAccount) || 0) + amount);

    // GL 계정 + 적요별 상세
    if (!byGLDetail.has(glAccount)) {
      byGLDetail.set(glAccount, new Map());
    }
    const detailMap = byGLDetail.get(glAccount)!;
    detailMap.set(description, (detailMap.get(description) || 0) + amount);
  });

  return { byGL, byGLDetail };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountName = searchParams.get('account');
    const currentMonth = searchParams.get('currentMonth') || '202510';
    const previousMonth = searchParams.get('previousMonth') || '202410';

    if (!accountName) {
      return createErrorResponse('Account parameter is required', new Error('Missing account'), 400);
    }

    // 폴더 경로 찾기
    const currentBasePath = findDetailsBasePath(currentMonth);
    const previousBasePath = findDetailsBasePath(previousMonth);

    // 모든 하위 폴더에서 CSV 파일 읽기
    const currentData = loadAllCsvFromPath(currentBasePath);
    const previousData = loadAllCsvFromPath(previousBasePath);

    // GL 계정별 집계
    const { byGL: currentByGL, byGLDetail: currentByGLDetail } = aggregateByGL(currentData);
    const { byGL: previousByGL, byGLDetail: previousByGLDetail } = aggregateByGL(previousData);

    // 총 금액 계산
    const currentTotal = Array.from(currentByGL.values()).reduce((sum, amt) => sum + amt, 0);
    const previousTotal = Array.from(previousByGL.values()).reduce((sum, amt) => sum + amt, 0);
    const totalChange = currentTotal - previousTotal;

    // G/L 계정별 차이 분석
    const allGLAccounts = new Set([...currentByGL.keys(), ...previousByGL.keys()]);
    const glAnalysis: any[] = [];

    allGLAccounts.forEach(glAccount => {
      const current = currentByGL.get(glAccount) || 0;
      const previous = previousByGL.get(glAccount) || 0;
      const change = current - previous;

      if (Math.abs(change) >= 1000000) { // 100만원 이상 차이나는 항목만
        const currentDetails = currentByGLDetail.get(glAccount) || new Map();
        const previousDetails = previousByGLDetail.get(glAccount) || new Map();

        // 적요별 차이 계산
        const allDescriptions = new Set([...currentDetails.keys(), ...previousDetails.keys()]);
        const descriptionChanges: any[] = [];

        allDescriptions.forEach(desc => {
          const currAmt = currentDetails.get(desc) || 0;
          const prevAmt = previousDetails.get(desc) || 0;
          const descChange = currAmt - prevAmt;

          if (Math.abs(descChange) >= 500000 && desc.trim()) {
            descriptionChanges.push({
              description: desc,
              change: descChange
            });
          }
        });

        // 변동이 큰 적요 상위 3개
        descriptionChanges.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

        glAnalysis.push({
          glAccount,
          current,
          previous,
          change,
          changePercent: previous !== 0 ? (change / previous) * 100 : 0,
          topDescriptions: descriptionChanges.slice(0, 3)
        });
      }
    });

    // 변동 금액이 큰 순서대로 정렬
    glAnalysis.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    return createSuccessResponse({
      data: {
        accountName,
        currentTotal,
        previousTotal,
        totalChange,
        glAccounts: glAnalysis.slice(0, 5)
      }
    });

  } catch (error) {
    return createErrorResponse('계정 상세 분석 데이터를 불러오는데 실패했습니다.', error);
  }
}
