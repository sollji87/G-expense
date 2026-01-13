import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function parseCSV(content: string): { headers: string[], records: any[] } {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return { headers: [], records: [] };
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const records: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const record: any = {};
    headers.forEach((header, index) => {
      record[header] = values[index]?.trim() || '';
    });
    records.push(record);
  }
  
  return { headers, records };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const currentMonth = searchParams.get('currentMonth') || '202512';
    const previousMonth = searchParams.get('previousMonth') || '202412';
    
    let headcountPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'snowflake', 'headcount_monthly_latest.csv');
    
    if (!fs.existsSync(headcountPath)) {
      headcountPath = path.join(process.cwd(), '..', '..', 'myvenv', 'out', 'snowflake', 'headcount_monthly_latest.csv');
    }
    
    if (!fs.existsSync(headcountPath)) {
      throw new Error('인원수 데이터 파일을 찾을 수 없습니다.');
    }
    
    const fileContent = fs.readFileSync(headcountPath, 'utf-8');
    const { headers, records } = parseCSV(fileContent);
    
    // 피벗 형식 CSV 지원: 컬럼명이 YYYYMM 형태인지 확인
    const isPivotFormat = headers.some(h => /^\d{6}$/.test(h));
    
    const currentDeptMap = new Map<string, number>();
    const previousDeptMap = new Map<string, number>();
    
    if (isPivotFormat) {
      // 피벗 형식: 코스트센터명,직군,202411,202511,202412,202512
      records.forEach((r: any) => {
        const dept = r['코스트센터명'] || '';
        const currentHeadcount = parseInt(r[currentMonth] || '0') || 0;
        const previousHeadcount = parseInt(r[previousMonth] || '0') || 0;
        
        if (dept) {
          // 부서명에서 '공통_' 제거
          const deptName = dept.replace('공통_', '');
          currentDeptMap.set(deptName, (currentDeptMap.get(deptName) || 0) + currentHeadcount);
          previousDeptMap.set(deptName, (previousDeptMap.get(deptName) || 0) + previousHeadcount);
        }
      });
    } else {
      // 기존 형식: 기준년월, 부서명, 정규직인원수
      const currentData = records.filter((r: any) => r['기준년월'] === currentMonth);
      const previousData = records.filter((r: any) => r['기준년월'] === previousMonth);
      
      currentData.forEach((r: any) => {
        const dept = r['부서명'];
        const headcount = parseInt(r['정규직인원수'] || '0');
        currentDeptMap.set(dept, (currentDeptMap.get(dept) || 0) + headcount);
      });
      
      previousData.forEach((r: any) => {
        const dept = r['부서명'];
        const headcount = parseInt(r['정규직인원수'] || '0');
        let normalizedDept = dept;
        if (dept === 'AX팀') {
          normalizedDept = '프로세스팀';
        }
        previousDeptMap.set(normalizedDept, (previousDeptMap.get(normalizedDept) || 0) + headcount);
      });
    }
    
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
    
    return NextResponse.json({
      success: true,
      data: {
        currentTotal,
        previousTotal,
        change: currentTotal - previousTotal,
        departments: departmentChanges
      }
    });
    
  } catch (error) {
    console.error('인원수 비교 API 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '인원수 비교 데이터를 불러오는데 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
