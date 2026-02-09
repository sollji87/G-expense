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

// 매핑 파일 로드
function loadCostCenterMapping(): Map<string, { displayName: string; hasHeadcount: boolean }> {
  const mappingMap = new Map<string, { displayName: string; hasHeadcount: boolean }>();
  
  // 매핑 파일 경로
  let mappingPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'costcenter_mapping.csv');
  if (!fs.existsSync(mappingPath)) {
    mappingPath = path.join(process.cwd(), '..', '..', 'myvenv', 'out', 'costcenter_mapping.csv');
  }
  
  if (fs.existsSync(mappingPath)) {
    const content = fs.readFileSync(mappingPath, 'utf-8');
    const records = parseCSV(content);
    
    records.forEach((record: any) => {
      const costCenterName = record['비용_코스트센터명'] || '';
      const displayName = record['표시명'] || costCenterName;
      const hasHeadcount = record['인원수'] !== '없음';
      
      if (costCenterName) {
        mappingMap.set(costCenterName, { displayName, hasHeadcount });
      }
    });
  }
  
  return mappingMap;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || '12';
    const yearParam = searchParams.get('year') || '2025';
    
    // 1. 매핑 파일 로드
    const mappingData = loadCostCenterMapping();
    
    // 2. 비용 데이터에서 코스트센터 목록 가져오기
    let costCsvPath = path.join(process.cwd(), '..', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
    if (!fs.existsSync(costCsvPath)) {
      costCsvPath = path.join(process.cwd(), '..', '..', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
    }
    if (!fs.existsSync(costCsvPath)) {
      costCsvPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
    }
    
    if (!fs.existsSync(costCsvPath)) {
      throw new Error('비용 데이터 파일을 찾을 수 없습니다.');
    }
    
    const costContent = fs.readFileSync(costCsvPath, 'utf-8');
    const costRecords = parseCSV(costContent);
    
    // 코스트센터별 비용 합계 계산 (표시명 기준으로 그룹핑)
    const currentYearMonth = `${yearParam}${month.padStart(2, '0')}`;
    const displayNameCostMap = new Map<string, { cost: number; hasHeadcount: boolean; originalNames: Set<string> }>();
    
    costRecords.forEach((record: any) => {
      const originalCostCenterName = record['코스트센터명'] || '';
      if (!originalCostCenterName || originalCostCenterName === '미배정') return;
      
      // 매핑에서 표시명 찾기
      const mapping = mappingData.get(originalCostCenterName);
      const displayName = mapping?.displayName || originalCostCenterName.replace('공통_', '');
      const hasHeadcount = mapping?.hasHeadcount ?? true;
      
      // [CLSD] 폐쇄된 팀은 제외
      if (displayName.startsWith('[CLSD]')) return;
      
      const amount = parseFloat(record[currentYearMonth] || '0');
      
      if (!displayNameCostMap.has(displayName)) {
        displayNameCostMap.set(displayName, { cost: 0, hasHeadcount, originalNames: new Set() });
      }
      
      const data = displayNameCostMap.get(displayName)!;
      data.cost += amount;
      data.originalNames.add(originalCostCenterName);
    });
    
    // 3. 인원수 데이터 로드
    let headcountPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'snowflake', 'headcount_monthly_latest.csv');
    if (!fs.existsSync(headcountPath)) {
      headcountPath = path.join(process.cwd(), '..', '..', 'myvenv', 'out', 'snowflake', 'headcount_monthly_latest.csv');
    }
    
    const headcountMap = new Map<string, number>();
    
    if (fs.existsSync(headcountPath)) {
      const headcountContent = fs.readFileSync(headcountPath, 'utf-8');
      const headcountRecords = parseCSV(headcountContent);
      
      const headcountMonth = `${yearParam}${month.padStart(2, '0')}`;
      
      headcountRecords.forEach((record: any) => {
        const dept = record['코스트센터명'] || '';
        if (!dept) return;
        
        // 인원 데이터의 코스트센터명도 매핑으로 변환
        const mapping = mappingData.get(dept);
        const displayName = mapping?.displayName || dept.replace('공통_', '');
        
        const headcount = parseInt(record[headcountMonth] || '0') || 0;
        headcountMap.set(displayName, (headcountMap.get(displayName) || 0) + headcount);
      });
    }
    
    // 4. 코스트센터 목록 생성 (인원이 있는 것 먼저)
    const costCenters = Array.from(displayNameCostMap.entries()).map(([name, data]) => ({
      name,
      cost: data.cost,
      headcount: headcountMap.get(name) || 0,
      hasHeadcount: data.hasHeadcount && (headcountMap.get(name) || 0) > 0,
      originalNames: Array.from(data.originalNames),
    }));
    
    // 인원이 있는 것 먼저, 그 다음 비용 순으로 정렬
    costCenters.sort((a, b) => {
      // 먼저 인원 유무로 정렬
      if (a.hasHeadcount !== b.hasHeadcount) {
        return a.hasHeadcount ? -1 : 1;
      }
      // 같은 그룹 내에서는 비용 순으로 정렬
      return b.cost - a.cost;
    });
    
    // 5. 계정 대분류 목록 가져오기
    const majorCategories = new Set<string>();
    costRecords.forEach((record: any) => {
      const major = record['계정대분류'];
      if (major && major !== '미배정') {
        majorCategories.add(major);
      }
    });
    
    // 카테고리 순서 정렬
    const categoryOrder = ['인건비', 'IT수수료', '지급수수료', '직원경비', '기타비용'];
    const sortedCategories = Array.from(majorCategories).sort((a, b) => {
      const aIdx = categoryOrder.indexOf(a);
      const bIdx = categoryOrder.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
    
    return NextResponse.json({
      success: true,
      costCenters: costCenters.map(cc => ({
        name: cc.name,
        hasHeadcount: cc.hasHeadcount,
        headcount: cc.headcount,
        originalNames: cc.originalNames, // 원본 이름들 (필터링에 사용)
      })),
      majorCategories: sortedCategories,
    });
    
  } catch (error) {
    console.error('필터 옵션 API 오류:', error);
    return NextResponse.json(
      { success: false, error: '필터 옵션을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
