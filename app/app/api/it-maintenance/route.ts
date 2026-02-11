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

// 팀 이름 정규화 (합치기)
function normalizeTeamName(teamName: string): string {
  const name = teamName.replace('공통_', '').replace('[CLSD]공통_', '').replace('[CLSD]', '').replace('[종료]', '');
  
  // PI팀 + AX팀 → AX팀
  if (name === 'PI팀') return 'AX팀';
  
  // 통합인플루언서마케팅팀 → 마케팅본부
  if (name.includes('통합인플루언서마케팅팀')) return '마케팅본부';
  if (name.includes('인플루언서마케팅')) return '마케팅본부';
  
  return name;
}

// 상세 JSON 파일에서 데이터 로드
function loadDetailJson(): { [year: string]: { month: string; text: string; vendor: string; cctr: string; amount: number }[] } | null {
  const basePaths = [
    path.join(process.cwd(), '..', 'out', 'it_maintenance_details.json'),
    path.join(process.cwd(), '..', '..', 'out', 'it_maintenance_details.json'),
    path.join(process.cwd(), '..', 'myvenv', 'out', 'it_maintenance_details.json'),
  ];
  
  for (const p of basePaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      return JSON.parse(content);
    }
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || '2025';
    const team = searchParams.get('team'); // 팀 상세 조회용
    
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const prevYear = String(parseInt(year) - 1);
    
    // 팀 상세 조회 모드 - 텍스트별 월별 금액 반환
    if (team) {
      return getTeamDetails(year, team, months);
    }
    
    // pivot_by_gl_cctr_yyyymm_combined.csv에서 코스트센터별 월별 데이터 로드
    let cctrPivotPath = path.join(process.cwd(), '..', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
    if (!fs.existsSync(cctrPivotPath)) {
      cctrPivotPath = path.join(process.cwd(), '..', '..', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
    }
    if (!fs.existsSync(cctrPivotPath)) {
      cctrPivotPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'pivot_by_gl_cctr_yyyymm_combined.csv');
    }
    
    const monthlyTotals: { [m: string]: number } = {};
    const monthlyTotalsPrev: { [m: string]: number } = {};
    const teamData: { [teamName: string]: { cctrCode: string; monthly: { [m: string]: number }; total: number } } = {};
    
    // 월별 합계 초기화
    months.forEach(m => { monthlyTotals[m] = 0; monthlyTotalsPrev[m] = 0; });
    
    // pivot_by_gl_yyyymm_combined.csv에서 전년도 월별 합계 로드
    let pivotPath = path.join(process.cwd(), '..', 'out', 'pivot_by_gl_yyyymm_combined.csv');
    if (!fs.existsSync(pivotPath)) {
      pivotPath = path.join(process.cwd(), '..', '..', 'out', 'pivot_by_gl_yyyymm_combined.csv');
    }
    if (!fs.existsSync(pivotPath)) {
      pivotPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'pivot_by_gl_yyyymm_combined.csv');
    }
    
    if (fs.existsSync(pivotPath)) {
      const pivotContent = fs.readFileSync(pivotPath, 'utf-8');
      const pivotRecords = parseCSV(pivotContent);
      const maintenanceRecord = pivotRecords.find(r => r['G/L 계정 설명'] === '지급수수료_IT유지보수비');
      
      if (maintenanceRecord) {
        for (const m of months) {
          const keyPrev = `${prevYear}${m}`;
          const valPrev = parseFloat(maintenanceRecord[keyPrev] || '0') / 1_000_000;
          monthlyTotalsPrev[m] = Math.round(valPrev);
        }
      }
    }
    
    if (fs.existsSync(cctrPivotPath)) {
      const content = fs.readFileSync(cctrPivotPath, 'utf-8');
      const records = parseCSV(content);
      
      // IT유지보수비 레코드들 필터링
      const maintenanceRecords = records.filter(r => 
        r['G/L 계정 설명'] === '지급수수료_IT유지보수비'
      );
      
      // 코스트센터별 집계 (팀 이름 정규화하여 합치기)
      for (const record of maintenanceRecords) {
        const rawName = record['코스트센터명'] || '';
        const normalizedName = normalizeTeamName(rawName);
        const cctrCode = record['코스트 센터'] || '';
        
        if (!teamData[normalizedName]) {
          teamData[normalizedName] = { cctrCode, monthly: {}, total: 0 };
          months.forEach(m => { teamData[normalizedName].monthly[m] = 0; });
        }
        
        for (const m of months) {
          const key = `${year}${m}`;
          const val = parseFloat(record[key] || '0') / 1_000_000; // 백만원 단위
          teamData[normalizedName].monthly[m] += val;
          teamData[normalizedName].total += val;
          monthlyTotals[m] += val;
        }
      }
    }
    
    // 배열로 변환하고 정렬
    const items = Object.entries(teamData)
      .filter(([_, data]) => data.total > 0.5) // 0.5백만원 이상만
      .map(([name, data]) => ({
        text: name,
        cctrCode: data.cctrCode,
        total: Math.round(data.total),
        monthly: Object.fromEntries(
          Object.entries(data.monthly).map(([m, v]) => [m, Math.round(v)])
        ),
      }))
      .sort((a, b) => b.total - a.total);
    
    // 월별 합계도 정수로
    const roundedTotals = Object.fromEntries(
      Object.entries(monthlyTotals).map(([m, v]) => [m, Math.round(v)])
    );
    
    return NextResponse.json({
      success: true,
      year,
      items,
      monthlyTotals: roundedTotals,
      monthlyTotalsPrev,
      prevYear,
      months,
    });
    
  } catch (error) {
    console.error('IT Maintenance API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// 텍스트 정규화 - 동일한 항목을 합치기 위해 핵심 키워드 추출
function normalizeDetailText(text: string): string {
  let normalized = text
    // 날짜/월 정보 제거
    .replace(/^\d{2}\.\d{2}월?_?\s*/g, '')  // 25.01월_ 또는 25.01 
    .replace(/^\d{2}\.\d{1,2}\s+/g, '')     // 25.01 (앞에서)
    .replace(/\d{2}년\s*\d{1,2}월/g, '')    // 25년 1월
    .replace(/\d{4}\.\d{1,2}월?/g, '')      // 2024.01
    .replace(/\(\d{2}년?\s*\d{1,2}월?\)/g, '') // (25년 1월) 또는 (25.01)
    .replace(/\(\d{2}\.\d{1,2}\)/g, '')     // (25.01)
    // 연도 정보 제거
    .replace(/\d{4}년도?\s*/g, '')
    // 공통 접두사 제거  
    .replace(/^공통\s*[A-Za-z가-힣]+팀?\s*/g, '') // 공통 IT팀, 공통_IT팀
    .replace(/^[A-Za-z]+팀\s*/g, '')          // IT팀 등
    // 접미사 제거
    .replace(/\s*정산의?\s*건?\s*$/g, '')
    .replace(/\s*계약\s*정산\s*$/g, '')
    .replace(/\s*계약\s*$/g, '')
    .replace(/\s*비용\s*$/g, '')
    .replace(/\s*의\s*건\s*$/g, '')
    .replace(/\s*갱신\s*$/g, '')
    .replace(/\s*연간\s*$/g, '')
    // 특수문자 정리
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // 특정 패턴 통합
  // MERP / CN_OMS / GOMS → MERP/OMS 시스템 유지보수
  if (normalized.includes('MERP') || normalized.includes('OMS') || normalized.includes('GOMS')) {
    normalized = 'MERP/OMS 시스템 유지보수';
  }
  // RFID 고도화 관련
  else if (normalized.includes('RFID') && normalized.includes('고도화')) {
    normalized = 'RFID 고도화';
  }
  // RFID S/W 유지보수
  else if (normalized.includes('RFID') && (normalized.includes('유지보수') || normalized.includes('S/W'))) {
    normalized = 'RFID S/W 유지보수';
  }
  // 물류 RFID
  else if (normalized.includes('물류') && normalized.includes('RFID')) {
    normalized = '물류 RFID 유지보수';
  }
  // PLM 관련
  else if (normalized.includes('PLM')) {
    normalized = 'PLM 유지보수';
  }
  // 인플루언서시스템
  else if (normalized.includes('인플루언서')) {
    normalized = '인플루언서시스템 유지보수';
  }
  // 웹플랫폼팀 인프라/FE
  else if (normalized.includes('웹플랫폼') && normalized.includes('인프라')) {
    normalized = '웹플랫폼 인프라 운영';
  }
  else if (normalized.includes('웹플랫폼') && normalized.includes('FE')) {
    normalized = '웹플랫폼 FE 개발/운영';
  }
  // WP팀 인프라
  else if (normalized.includes('WP팀') && normalized.includes('인프라')) {
    normalized = '웹플랫폼 인프라 운영';
  }
  // AWS MSP
  else if (normalized.includes('AWS') && normalized.includes('MSP')) {
    normalized = 'AWS MSP';
  }
  // AWS 클라우드
  else if (normalized.includes('AWS') || normalized.includes('클라우드')) {
    if (normalized.includes('OCI')) {
      normalized = 'OCI 클라우드 인프라';
    } else {
      normalized = 'AWS 클라우드';
    }
  }
  // OCI 클라우드
  else if (normalized.includes('OCI')) {
    normalized = 'OCI 클라우드 인프라';
  }
  // 크롤링 → 리틀플래닛(크롤링)으로 이동됨 (위에서 처리)
  // VLM 모델
  else if (normalized.includes('VLM')) {
    normalized = 'VLM 모델 파인튜닝';
  }
  // 네트워크 관련
  else if (normalized.includes('네트워크') && normalized.includes('유지보수')) {
    normalized = '네트워크 유지보수';
  }
  else if (normalized.includes('네트워크') && normalized.includes('접근제어')) {
    normalized = '네트워크 접근제어 솔루션';
  }
  // 방화벽
  else if (normalized.includes('방화벽')) {
    if (normalized.includes('웹')) {
      normalized = '웹방화벽 유지보수';
    } else {
      normalized = '방화벽 유지보수';
    }
  }
  // 스토리지
  else if (normalized.includes('스토리지')) {
    normalized = '스토리지 장비 유지보수';
  }
  // Github
  else if (normalized.includes('Github')) {
    normalized = 'Github SW 라이선스';
  }
  // 오라클 DB
  else if (normalized.includes('오라클') || (normalized.includes('DB') && normalized.includes('라이선스'))) {
    normalized = '오라클 DB 라이선스';
  }
  // SAP DB
  else if (normalized.includes('SAP') && normalized.includes('DB')) {
    normalized = 'SAP DB 암호화 솔루션';
  }
  // WMS 라이선스
  else if (normalized.includes('WMS')) {
    normalized = 'WMS 라이선스 유지보수';
  }
  // OZ Report
  else if (normalized.includes('OZ') && normalized.includes('Report')) {
    normalized = 'OZ Report 유지보수';
  }
  // POS 결제
  else if (normalized.includes('POS')) {
    normalized = 'POS 결제 솔루션';
  }
  // HR 대시보드
  else if (normalized.includes('HR') && normalized.includes('대시보드')) {
    normalized = 'HR 대시보드 유지보수';
  }
  // 연결솔루션/연결회계솔루션
  else if (normalized.includes('연결') && normalized.includes('솔루션')) {
    normalized = '연결회계솔루션 유지보수';
  }
  // 개인정보 검색
  else if (normalized.includes('개인정보')) {
    normalized = '개인정보 검색 솔루션';
  }
  // 망연계솔루션
  else if (normalized.includes('망연계')) {
    normalized = '망연계솔루션 유지보수';
  }
  // IDC 방화벽/관제
  else if (normalized.includes('IDC')) {
    normalized = 'IDC 보안 관제';
  }
  // 도메인 연장
  else if (normalized.includes('도메인')) {
    normalized = '도메인 연장';
  }
  // 메가존 운영
  else if (normalized.includes('메가존')) {
    normalized = '메가존 운영 인력 용역';
  }
  // EAI 유지보수
  else if (normalized.includes('EAI')) {
    normalized = 'EAI 유지보수';
  }
  // 사이트코어 운영
  else if (normalized.includes('사이트코어')) {
    normalized = '사이트코어 운영';
  }
  // 자사몰앱 QA
  else if (normalized.includes('자사몰') || normalized.includes('QA')) {
    normalized = '자사몰앱 QA';
  }
  // ERP 유지보수
  else if (normalized.includes('ERP')) {
    normalized = 'ERP 유지보수';
  }
  // PC 유지보수
  else if (normalized.includes('PC유지보수') || normalized.includes('PC 유지보수')) {
    normalized = 'PC 유지보수';
  }
  // 랜 유지보수
  else if (normalized.includes('랜유지보수') || normalized.includes('랜 유지보수')) {
    normalized = '랜 유지보수';
  }
  // 실시간 통신 솔루션 (푸셔)
  else if (normalized.includes('푸셔') || normalized.toLowerCase().includes('pusher')) {
    normalized = '실시간 통신 솔루션(푸셔)';
  }
  // EC OMS BE → MERP/OMS로
  else if (normalized.includes('EC') && normalized.includes('BE')) {
    normalized = 'EC 시스템 운영';
  }
  // 인프라 운영 (WP팀 없이)
  else if (normalized.includes('인프라') && normalized.includes('운영')) {
    normalized = '웹플랫폼 인프라 운영';
  }
  // 리틀플래닛/크롤링 관련
  else if (normalized.includes('리틀플래닛') || normalized.includes('크롤링')) {
    normalized = '리틀플래닛(크롤링)';
  }
  // Finstagram 관련
  else if (normalized.toLowerCase().includes('finstagram') || normalized.includes('핀스타그램')) {
    normalized = 'Finstagram 유지보수';
  }
  // SAC 시스템 관련
  else if (normalized.includes('SAC')) {
    normalized = 'SAC 유지보수';
  }
  
  return normalized || text;
}

// 팀 상세 내역 조회 - 텍스트별 월별 금액
async function getTeamDetails(year: string, team: string, months: string[]) {
  const detailData = loadDetailJson();
  
  if (!detailData || !detailData[year]) {
    return NextResponse.json({
      success: true,
      year,
      team,
      items: [],
    });
  }
  
  // 해당 팀의 데이터 필터링
  const teamRecords = detailData[year].filter(r => {
    const normalizedCctr = normalizeTeamName(r.cctr);
    return normalizedCctr === team && r.amount > 0;
  });
  
  // 텍스트별로 그룹핑하여 월별 금액 집계
  const textMap: { [text: string]: { monthly: { [m: string]: number }; total: number } } = {};
  
  for (const record of teamRecords) {
    let normalizedText = normalizeDetailText(record.text);
    
    // AI엔지니어링팀인 경우 모든 항목을 "리틀플래닛(크롤링)"으로 통합
    if (team === 'AI 엔지니어링팀') {
      normalizedText = '리틀플래닛(크롤링)';
    }
    
    if (!textMap[normalizedText]) {
      textMap[normalizedText] = { monthly: {}, total: 0 };
      months.forEach(m => { textMap[normalizedText].monthly[m] = 0; });
    }
    
    textMap[normalizedText].monthly[record.month] += record.amount;
    textMap[normalizedText].total += record.amount;
  }
  
  // 배열로 변환하고 연간 합계 기준 정렬
  const items = Object.entries(textMap)
    .filter(([_, data]) => data.total > 0)
    .map(([text, data]) => ({
      text,
      monthly: data.monthly,
      total: data.total,
    }))
    .sort((a, b) => b.total - a.total);
  
  return NextResponse.json({
    success: true,
    year,
    team,
    items,
    months,
  });
}
