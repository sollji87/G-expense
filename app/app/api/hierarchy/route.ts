import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { matchesCostCenterFilter } from '../utils/costcenter-mapping';

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
    const mode = searchParams.get('mode') || 'monthly';
    const month = searchParams.get('month') || '12';
    
    // 필터 파라미터
    const costCentersParam = searchParams.get('costCenters') || '';
    const majorCategoriesParam = searchParams.get('majorCategories') || '';
    const costCenters = costCentersParam ? costCentersParam.split(',').filter(c => c.trim()) : [];
    const majorCategories = majorCategoriesParam ? majorCategoriesParam.split(',').filter(c => c.trim()) : [];
    
    // 코스트센터 필터가 있으면 상세 CSV 사용
    const useDetailedCSV = costCenters.length > 0;
    
    let csvPath: string;
    
    if (useDetailedCSV) {
      csvPath = path.join(process.cwd(), '..', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
      if (!fs.existsSync(csvPath)) {
        csvPath = path.join(process.cwd(), '..', '..', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
      }
      if (!fs.existsSync(csvPath)) {
        csvPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
      }
    } else {
      csvPath = path.join(process.cwd(), '..', 'out', 'pivot_by_gl_yyyymm_combined.csv');
      if (!fs.existsSync(csvPath)) {
        csvPath = path.join(process.cwd(), '..', '..', 'out', 'pivot_by_gl_yyyymm_combined.csv');
      }
      if (!fs.existsSync(csvPath)) {
        csvPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'pivot_by_gl_yyyymm_combined.csv');
      }
    }
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV 파일을 찾을 수 없습니다.`);
    }
    
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parseCSV(fileContent);
    
    const currentYear = '2025';
    const previousYear = '2024';
    const monthNum = parseInt(month);
    
    // 계층 구조: 대분류 -> 중분류 -> 소분류
    const hierarchy = new Map<string, any>();
    
    records.forEach((record: any) => {
      const major = record['계정대분류'];
      const middle = record['계정중분류'];
      let detail = record['G/L 계정 설명'];
      
      // 복리후생비_근속지원을 복리후생비_총무지원으로 병합
      if (detail === '복리후생비_근속지원') {
        detail = '복리후생비_총무지원';
      }
      
      if (!major || major === '미배정') return;
      
      // 코스트센터 필터 적용 (매핑 사용)
      if (costCenters.length > 0 && useDetailedCSV) {
        const recordCostCenter = record['코스트센터명'] || '';
        if (!matchesCostCenterFilter(recordCostCenter, costCenters)) {
          return;
        }
      }
      
      // 계정 대분류 필터 적용
      if (majorCategories.length > 0) {
        if (!majorCategories.includes(major)) {
          return;
        }
      }
      
      // 금액 계산
      let currentAmount = 0;
      let previousAmount = 0;
      
      if (mode === 'monthly') {
        const currentMonth = `${currentYear}${month.padStart(2, '0')}`;
        const previousMonth = `${previousYear}${month.padStart(2, '0')}`;
        currentAmount = parseFloat(record[currentMonth] || '0');
        previousAmount = parseFloat(record[previousMonth] || '0');
      } else {
        for (let m = 1; m <= monthNum; m++) {
          const currentYM = `${currentYear}${m.toString().padStart(2, '0')}`;
          const previousYM = `${previousYear}${m.toString().padStart(2, '0')}`;
          currentAmount += parseFloat(record[currentYM] || '0');
          previousAmount += parseFloat(record[previousYM] || '0');
        }
      }
      
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
    
    // Map을 배열로 변환하고 YOY 계산
    const result = Array.from(hierarchy.values()).map(major => {
      const majorCurrent = major.current / 1_000_000;
      const majorPrevious = major.previous / 1_000_000;
      const majorChange = majorCurrent - majorPrevious;
      const majorYoy = majorPrevious !== 0 ? (majorCurrent / majorPrevious) * 100 : 0;
      
      const majorChildren = Array.from(major.children.values())
        .map((middle: any) => {
          const middleCurrent = middle.current / 1_000_000;
          const middlePrevious = middle.previous / 1_000_000;
          const middleChange = middleCurrent - middlePrevious;
          const middleYoy = middlePrevious !== 0 ? (middleCurrent / middlePrevious) * 100 : 0;
          
          // 인건비는 소분류를 표시하지 않음
          let middleChildren: any[] = [];
          if (major.name !== '인건비') {
            middleChildren = Array.from(middle.children.values())
              .map((detail: any) => {
                const detailCurrent = detail.current / 1_000_000;
                const detailPrevious = detail.previous / 1_000_000;
                const detailChange = detailCurrent - detailPrevious;
                const detailYoy = detailPrevious !== 0 ? (detailCurrent / detailPrevious) * 100 : 0;
                
                return {
                  id: detail.id,
                  name: detail.name,
                  current: detailCurrent,
                  previous: detailPrevious,
                  change: detailChange,
                  yoy: detailYoy,
                  children: []
                };
              })
              .filter((detail: any) => Math.abs(detail.current) >= 0.5 || Math.abs(detail.previous) >= 0.5); // 금액이 0.5백만원 미만인 항목 제외
          }
          
          return {
            id: middle.id,
            name: middle.name,
            current: middleCurrent,
            previous: middlePrevious,
            change: middleChange,
            yoy: middleYoy,
            children: middleChildren
          };
        })
        .filter((middle: any) => Math.abs(middle.current) >= 0.5 || Math.abs(middle.previous) >= 0.5); // 금액이 0.5백만원 미만인 중분류 제외
      
      return {
        id: major.id,
        name: major.name,
        current: majorCurrent,
        previous: majorPrevious,
        change: majorChange,
        yoy: majorYoy,
        children: majorChildren
      };
    });
    
    // 비용 순서 정렬: 인건비 > 직원경비 > IT수수료 > 지급수수료 > 기타비용
    const order = ['인건비', '직원경비', 'IT수수료', '지급수수료', '기타비용'];
    result.sort((a, b) => {
      const indexA = order.indexOf(a.name);
      const indexB = order.indexOf(b.name);
      
      // 순서에 있는 항목은 해당 순서대로
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // 순서에 없는 항목은 뒤로
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      // 둘 다 순서에 없으면 이름순
      return a.name.localeCompare(b.name);
    });
    
    // 공통비 합계 계산
    const totalCurrent = result.reduce((sum, item) => sum + item.current, 0);
    const totalPrevious = result.reduce((sum, item) => sum + item.previous, 0);
    const totalChange = totalCurrent - totalPrevious;
    const totalYoy = totalPrevious !== 0 ? (totalCurrent / totalPrevious) * 100 : 0;
    
    // 공통비 합계를 맨 앞에 추가
    const finalResult = [
      {
        id: '공통비합계',
        name: '공통비 합계',
        current: totalCurrent,
        previous: totalPrevious,
        change: totalChange,
        yoy: totalYoy,
        children: [],
        isTotal: true // 합계 행임을 표시
      },
      ...result
    ];
    
    return NextResponse.json({
      success: true,
      mode,
      month,
      data: finalResult,
    });
    
  } catch (error) {
    console.error('계층 데이터 API 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '계층 데이터를 불러오는데 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

