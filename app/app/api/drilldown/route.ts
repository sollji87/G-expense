import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 간단한 CSV 파서
function parseCSV(content: string): any[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const record: any = {};
    headers.forEach((header, index) => {
      record[header] = values[index]?.trim() || '';
    });
    records.push(record);
  }
  
  return records;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const month = searchParams.get('month') || '10';
    
    if (!category) {
      return NextResponse.json({ success: false, error: '카테고리가 필요합니다.' }, { status: 400 });
    }
    
    // CSV 파일 읽기
    let csvPath = path.join(process.cwd(), '..', 'out', 'pivot_by_gl_yyyymm_combined.csv');
    
    if (!fs.existsSync(csvPath)) {
      csvPath = path.join(process.cwd(), '..', '..', 'out', 'pivot_by_gl_yyyymm_combined.csv');
    }
    
    if (!fs.existsSync(csvPath)) {
      csvPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'pivot_by_gl_yyyymm_combined.csv');
    }
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV 파일을 찾을 수 없습니다.`);
    }
    
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parseCSV(fileContent);
    
    // 선택한 카테고리의 계정중분류별 데이터 집계
    const monthNum = parseInt(month);
    const drilldownData: any[] = [];
    const subcategoryMap = new Map<string, { current: number; previous: number }>();
    
    records.forEach((record: any) => {
      if (record['계정대분류'] === category) {
        const subcategory = record['계정중분류'];
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
      }
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
        if (record['계정대분류'] === category) {
          const subcategory = record['계정중분류'];
          const yearMonth = `2025${m.toString().padStart(2, '0')}`;
          const amount = parseFloat(record[yearMonth] || '0');
          
          if (!subcategoryMonthMap.has(subcategory)) {
            subcategoryMonthMap.set(subcategory, 0);
          }
          subcategoryMonthMap.set(subcategory, subcategoryMonthMap.get(subcategory)! + amount);
        }
      });
      
      // 각 중분류 데이터 추가
      subcategoryMonthMap.forEach((amount, subcategory) => {
        monthData[subcategory] = amount / 1_000_000; // 백만원 단위
      });
      
      // YOY 계산
      let totalCurrent = 0;
      let totalPrevious = 0;
      
      records.forEach((record: any) => {
        if (record['계정대분류'] === category) {
          const currentYM = `2025${m.toString().padStart(2, '0')}`;
          const previousYM = `2024${m.toString().padStart(2, '0')}`;
          totalCurrent += parseFloat(record[currentYM] || '0');
          totalPrevious += parseFloat(record[previousYM] || '0');
        }
      });
      
      monthData['YOY'] = totalPrevious !== 0 ? (totalCurrent / totalPrevious) * 100 : 0;
      
      months.push(monthData);
    }
    
    // 중분류 목록
    const subcategories = Array.from(subcategoryMap.keys());
    
    return NextResponse.json({
      success: true,
      category,
      subcategories,
      data: months,
    });
    
  } catch (error) {
    console.error('드릴다운 API 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '드릴다운 데이터를 불러오는데 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

