import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function parseCSV(content: string): any[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const record: any = {};
    
    // CSV 파싱 (쉼표로 구분하되, 따옴표 안의 쉼표는 무시)
    const values: string[] = [];
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
    
    headers.forEach((header, index) => {
      record[header] = values[index]?.replace(/^"|"$/g, '') || '';
    });
    records.push(record);
  }
  
  return records;
}

export async function GET(request: Request) {
  try {
    // OpenAI로 생성한 분석 CSV 파일 읽기
    let csvPath = path.join(process.cwd(), '..', 'out', 'gl_account_analysis_ai.csv');
    
    if (!fs.existsSync(csvPath)) {
      csvPath = path.join(process.cwd(), '..', '..', 'out', 'gl_account_analysis_ai.csv');
    }
    
    if (!fs.existsSync(csvPath)) {
      csvPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'gl_account_analysis_ai.csv');
    }
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`GL 분석 CSV 파일을 찾을 수 없습니다: ${csvPath}`);
    }
    
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parseCSV(fileContent);
    
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
    
    return NextResponse.json({
      success: true,
      data: analysisMap,
      count: records.length
    });
    
  } catch (error) {
    console.error('GL 분석 API 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'GL 분석 데이터를 불러오는데 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

