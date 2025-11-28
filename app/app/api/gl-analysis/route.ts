import {
  parseCSV,
  findCsvPath,
  createSuccessResponse,
  createErrorResponse
} from '@/lib/csv-utils';
import fs from 'fs';

export async function GET(request: Request) {
  try {
    // OpenAI로 생성한 분석 CSV 파일 읽기
    const csvPath = findCsvPath('gl_account_analysis_ai.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');

    // 따옴표 안의 쉼표를 처리해야 하므로 handleQuotedCommas = true
    const records = parseCSV(fileContent, true);

    // GL계정명을 키로 하는 맵 생성
    const analysisMap: Record<string, any> = {};

    records.forEach((record: any) => {
      const glAccount = record['GL계정'];
      analysisMap[glAccount] = {
        glAccount: glAccount,
        current: parseFloat(record['당년_백만원'] || '0'),
        previous: parseFloat(record['전년_백만원'] || '0'),
        change: parseFloat(record['차이_백만원'] || '0'),
        description: record['설명'] || ''
      };
    });

    return createSuccessResponse({
      data: analysisMap,
      count: records.length
    });

  } catch (error) {
    return createErrorResponse('GL 분석 데이터를 불러오는데 실패했습니다.', error);
  }
}
