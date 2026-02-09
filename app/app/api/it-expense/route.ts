import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
    const year = searchParams.get('year') || '2025';
    
    // CSV 파일 경로
    let csvPath = path.join(process.cwd(), '..', 'out', 'pivot_by_gl_yyyymm_combined.csv');
    if (!fs.existsSync(csvPath)) {
      csvPath = path.join(process.cwd(), '..', '..', 'out', 'pivot_by_gl_yyyymm_combined.csv');
    }
    if (!fs.existsSync(csvPath)) {
      csvPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'pivot_by_gl_yyyymm_combined.csv');
    }
    
    if (!fs.existsSync(csvPath)) {
      throw new Error('CSV 파일을 찾을 수 없습니다.');
    }
    
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parseCSV(fileContent);
    
    // IT수수료 카테고리만 필터링
    const itRecords = records.filter(record => record['계정대분류'] === 'IT수수료');
    
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    
    // 선택된 연도와 전년도
    const prevYear = String(parseInt(year) - 1);
    
    // 계정별 월별 데이터 구조화
    interface AccountData {
      id: string;
      glCode: string;
      accountName: string;
      middleCategory: string;
      monthly2024: { [month: string]: number };
      monthly2025: { [month: string]: number };
    }
    
    const accountMap = new Map<string, AccountData>();
    
    itRecords.forEach(record => {
      const glCode = record['G/L 계정'] || '';
      const accountName = record['G/L 계정 설명'] || '';
      const middleCategory = record['계정중분류'] || '';
      const id = `${middleCategory}_${accountName}`;
      
      if (!accountMap.has(id)) {
        accountMap.set(id, {
          id,
          glCode,
          accountName,
          middleCategory,
          monthly2024: {},
          monthly2025: {},
        });
      }
      
      const account = accountMap.get(id)!;
      
      // 월별 데이터 추출 (백만원 단위로 변환) - 전년/당년 동적 매핑
      months.forEach(month => {
        const keyPrev = `${prevYear}${month}`;
        const keyCurr = `${year}${month}`;
        
        const valPrev = parseFloat(record[keyPrev] || '0');
        const valCurr = parseFloat(record[keyCurr] || '0');
        
        account.monthly2024[month] = (account.monthly2024[month] || 0) + Math.round(valPrev / 1000000);
        account.monthly2025[month] = (account.monthly2025[month] || 0) + Math.round(valCurr / 1000000);
      });
    });
    
    // 중분류별로 그룹화
    interface MiddleCategoryData {
      id: string;
      name: string;
      accounts: AccountData[];
      monthly2024: { [month: string]: number };
      monthly2025: { [month: string]: number };
    }
    
    const middleCategoryMap = new Map<string, MiddleCategoryData>();
    
    accountMap.forEach(account => {
      const midCat = account.middleCategory;
      
      if (!middleCategoryMap.has(midCat)) {
        middleCategoryMap.set(midCat, {
          id: midCat,
          name: midCat,
          accounts: [],
          monthly2024: {},
          monthly2025: {},
        });
      }
      
      const category = middleCategoryMap.get(midCat)!;
      category.accounts.push(account);
      
      // 중분류별 월별 합계
      months.forEach(month => {
        category.monthly2024[month] = (category.monthly2024[month] || 0) + (account.monthly2024[month] || 0);
        category.monthly2025[month] = (category.monthly2025[month] || 0) + (account.monthly2025[month] || 0);
      });
    });
    
    // 전체 합계 계산
    const totals = {
      monthly2024: {} as { [month: string]: number },
      monthly2025: {} as { [month: string]: number },
    };
    
    middleCategoryMap.forEach(category => {
      months.forEach(month => {
        totals.monthly2024[month] = (totals.monthly2024[month] || 0) + (category.monthly2024[month] || 0);
        totals.monthly2025[month] = (totals.monthly2025[month] || 0) + (category.monthly2025[month] || 0);
      });
    });
    
    // 중분류 순서 정의
    const categoryOrder = ['IT수수료', 'SW상각비'];
    
    const categories = categoryOrder
      .filter(name => middleCategoryMap.has(name))
      .map(name => {
        const cat = middleCategoryMap.get(name)!;
        // 계정명 정렬
        cat.accounts.sort((a, b) => a.accountName.localeCompare(b.accountName));
        return cat;
      });
    
    return NextResponse.json({
      success: true,
      months,
      categories,
      totals,
    });
    
  } catch (error) {
    console.error('IT수수료 API 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'IT수수료 데이터를 불러오는데 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
