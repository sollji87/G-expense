import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * CSV 파일을 파싱하여 객체 배열로 변환
 * @param content CSV 파일 내용
 * @param handleQuotedCommas 따옴표 안의 쉼표 처리 여부 (기본: false)
 */
export function parseCSV(content: string, handleQuotedCommas = false): any[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const record: any = {};

    let values: string[];

    if (handleQuotedCommas) {
      // 따옴표 안의 쉼표를 처리하는 파싱
      values = [];
      let currentValue = '';
      let insideQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim()); // 마지막 값 추가
    } else {
      // 단순 쉼표 분리
      values = line.split(',');
    }

    headers.forEach((header, index) => {
      record[header] = values[index]?.trim().replace(/^"|"$/g, '') || '';
    });
    records.push(record);
  }

  return records;
}

/**
 * CSV 파일 경로를 찾음 (여러 가능한 경로 시도)
 * @param filename CSV 파일명
 * @param subdirs 하위 디렉토리 경로 (예: ['snowflake'])
 */
export function findCsvPath(filename: string, subdirs: string[] = []): string {
  const subPath = subdirs.length > 0 ? path.join(...subdirs, filename) : filename;

  const possiblePaths = [
    path.join(process.cwd(), '..', 'out', subPath),
    path.join(process.cwd(), '..', '..', 'out', subPath),
    path.join(process.cwd(), '..', 'myvenv', 'out', subPath),
  ];

  for (const csvPath of possiblePaths) {
    if (fs.existsSync(csvPath)) {
      return csvPath;
    }
  }

  throw new Error(`CSV 파일을 찾을 수 없습니다: ${filename}`);
}

/**
 * 상세 데이터 폴더 경로를 찾음
 * @param yearMonth 연월 (예: '202510')
 */
export function findDetailsBasePath(yearMonth: string): string | null {
  const possiblePaths = [
    path.join(process.cwd(), '..', 'out', 'details', yearMonth),
    path.join(process.cwd(), '..', '..', 'out', 'details', yearMonth),
    path.join(process.cwd(), '..', 'myvenv', 'out', 'details', yearMonth),
  ];

  for (const basePath of possiblePaths) {
    if (fs.existsSync(basePath)) {
      return basePath;
    }
  }

  return null;
}

/**
 * API 성공 응답 생성
 */
export function createSuccessResponse(data: any) {
  return NextResponse.json({
    success: true,
    ...data
  });
}

/**
 * API 에러 응답 생성
 */
export function createErrorResponse(message: string, error: unknown, status = 500) {
  console.error(message, error);
  return NextResponse.json(
    {
      success: false,
      error: message,
      details: error instanceof Error ? error.message : String(error)
    },
    { status }
  );
}

/**
 * 월별/누적 금액 계산
 * @param record CSV 레코드
 * @param mode 'monthly' | 'ytd'
 * @param month 선택된 월 (1-12)
 * @param currentYear 당년 (기본: '2025')
 * @param previousYear 전년 (기본: '2024')
 */
export function calculateAmounts(
  record: any,
  mode: string,
  month: string,
  currentYear = '2025',
  previousYear = '2024'
): { current: number; previous: number } {
  const monthNum = parseInt(month);

  if (mode === 'monthly') {
    const currentYM = `${currentYear}${month.padStart(2, '0')}`;
    const previousYM = `${previousYear}${month.padStart(2, '0')}`;

    return {
      current: parseFloat(record[currentYM] || '0'),
      previous: parseFloat(record[previousYM] || '0')
    };
  } else {
    // 누적 (YTD)
    let current = 0;
    let previous = 0;

    for (let m = 1; m <= monthNum; m++) {
      const currentYM = `${currentYear}${m.toString().padStart(2, '0')}`;
      const previousYM = `${previousYear}${m.toString().padStart(2, '0')}`;
      current += parseFloat(record[currentYM] || '0');
      previous += parseFloat(record[previousYM] || '0');
    }

    return { current, previous };
  }
}

/**
 * 금액을 백만원 단위로 변환
 */
export function toMillions(amount: number): number {
  return amount / 1_000_000;
}

/**
 * YOY(전년대비) 비율 계산 (%)
 */
export function calculateYoY(current: number, previous: number): number {
  return previous !== 0 ? (current / previous) * 100 : 0;
}

/**
 * 금액 필터링 (최소 금액 이상인 항목만)
 * @param amount 금액 (백만원 단위)
 * @param minAmount 최소 금액 (기본: 0.5백만원)
 */
export function isSignificantAmount(amount: number, minAmount = 0.5): boolean {
  return Math.abs(amount) >= minAmount;
}
