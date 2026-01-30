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
    const mode = searchParams.get('mode') || 'monthly'; // monthly or ytd
    const month = searchParams.get('month') || '12';
    const level = searchParams.get('level') || 'major'; // major, middle, detail
    const category = searchParams.get('category'); // 선택한 상위 카테고리
    const majorCategory = searchParams.get('majorCategory'); // 대분류 카테고리 (detail에서 대분류로 바로 접근 시)
    
    // CSV 파일 읽기
    let csvPath = path.join(process.cwd(), '..', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
    
    if (!fs.existsSync(csvPath)) {
      csvPath = path.join(process.cwd(), '..', '..', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
    }
    
    if (!fs.existsSync(csvPath)) {
      csvPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
    }
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV 파일을 찾을 수 없습니다.`);
    }
    
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parseCSV(fileContent);
    
    const monthNum = parseInt(month);
    const currentYearMonth = `2025${month.padStart(2, '0')}`;
    const previousYearMonth = `2024${month.padStart(2, '0')}`;
    
    // 레벨에 따라 집계
    const accountMap = new Map<string, { current: number; previous: number; detail?: any }>();
    
    records.forEach((record: any) => {
      let key = '';
      let parentKey = '';
      
      // 복리후생비_근속지원을 복리후생비_총무지원으로 병합
      const glDescription = record['G/L 계정 설명'] === '복리후생비_근속지원' 
        ? '복리후생비_총무지원' 
        : record['G/L 계정 설명'];
      
      if (level === 'major') {
        key = record['계정대분류'];
      } else if (level === 'middle') {
        if (category && record['계정대분류'] !== category) return;
        key = record['계정중분류'];
        parentKey = record['계정대분류'];
      } else if (level === 'detail') {
        // majorCategory가 있으면 대분류로 필터링 (KPI 카드에서 바로 접근 시)
        if (majorCategory && record['계정대분류'] !== majorCategory) return;
        // category가 있으면 중분류로 필터링 (일반 드릴다운 시)
        if (category && !majorCategory && record['계정중분류'] !== category) return;
        key = glDescription;
        parentKey = record['계정중분류'];
      }
      
      if (!key) return;
      
      if (mode === 'monthly') {
        const currentAmount = parseFloat(record[currentYearMonth] || '0');
        const previousAmount = parseFloat(record[previousYearMonth] || '0');
        
        if (!accountMap.has(key)) {
          accountMap.set(key, { current: 0, previous: 0, detail: { parent: parentKey } });
        }
        
        const data = accountMap.get(key)!;
        data.current += currentAmount;
        data.previous += previousAmount;
      } else {
        // 누적
        let currentTotal = 0;
        let previousTotal = 0;
        
        for (let m = 1; m <= monthNum; m++) {
          const currentYM = `2025${m.toString().padStart(2, '0')}`;
          const previousYM = `2024${m.toString().padStart(2, '0')}`;
          currentTotal += parseFloat(record[currentYM] || '0');
          previousTotal += parseFloat(record[previousYM] || '0');
        }
        
        if (!accountMap.has(key)) {
          accountMap.set(key, { current: 0, previous: 0, detail: { parent: parentKey } });
        }
        
        const data = accountMap.get(key)!;
        data.current += currentTotal;
        data.previous += previousTotal;
      }
    });
    
    // 결과 생성
    const result = Array.from(accountMap.entries())
      .map(([name, data]) => ({
        name,
        current: data.current / 1_000_000, // 백만원
        previous: data.previous / 1_000_000,
        change: (data.current - data.previous) / 1_000_000,
        yoy: data.previous !== 0 ? (data.current / data.previous) * 100 : 0,
        parent: data.detail?.parent
      }))
      .filter(item => Math.abs(item.current) >= 0.5 || Math.abs(item.previous) >= 0.5); // 당년 또는 전년이 0.5백만원 이상인 항목만
    
    // 금액 순 정렬
    result.sort((a, b) => b.current - a.current);
    
    return NextResponse.json({
      success: true,
      level,
      category,
      data: result,
    });
    
  } catch (error) {
    console.error('계정 분석 API 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '계정 분석 데이터를 불러오는데 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

