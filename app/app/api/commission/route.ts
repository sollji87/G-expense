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

// 팀 이름 정규화
function normalizeTeamName(teamName: string): string {
  const name = teamName.replace('공통_', '').replace('[CLSD]공통_', '').replace('[CLSD]', '').replace('[종료]', '');
  
  // PI팀 → AX팀
  if (name === 'PI팀') return 'AX팀';
  
  return name;
}

// 계정명 간소화 (지급수수료_ 접두사 제거)
function simplifyAccountName(accountName: string): string {
  return accountName.replace('지급수수료_', '');
}

// 상세 JSON 파일에서 데이터 로드
function loadCommissionJson(): { [year: string]: { month: string; account: string; text: string; vendor: string; cctr: string; amount: number }[] } | null {
  const basePaths = [
    path.join(process.cwd(), '..', 'out', 'commission_details.json'),
    path.join(process.cwd(), '..', '..', 'out', 'commission_details.json'),
    path.join(process.cwd(), '..', 'myvenv', 'out', 'commission_details.json'),
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
    const prevYear = String(parseInt(year) - 1); // 전년도 동적 계산
    const account = searchParams.get('account');  // 계정 필터 (예: 지급수수료_법률자문료)
    const team = searchParams.get('team');  // 팀 필터 (특정 계정 내 팀별 상세)
    const detail = searchParams.get('detail');  // 'all' - 전체 텍스트별 상세 (팝업용)
    
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    
    // 계정 전체 텍스트별 상세 (팝업용)
    if (account && detail === 'all') {
      return getAccountAllDetails(year, account, months);
    }
    
    // 계정 + 팀 지정 시: 해당 계정의 해당 팀 텍스트별 상세
    if (account && team) {
      return getTeamAccountDetails(year, account, team, months);
    }
    
    // 계정만 지정 시: 해당 계정의 팀별 상세
    if (account) {
      return getAccountDetails(year, account, months);
    }
    
    // 계정별 요약 데이터
    const detailData = loadCommissionJson();
    
    const accountData: { [accName: string]: { monthly: { [m: string]: number }; monthly2024: { [m: string]: number }; total: number; total2024: number } } = {};
    
    // 당년 데이터 집계
    if (detailData && detailData[year]) {
      for (const record of detailData[year]) {
        const accName = record.account;
        
        if (!accountData[accName]) {
          accountData[accName] = { 
            monthly: {}, 
            monthly2024: {},
            total: 0,
            total2024: 0,
          };
          months.forEach(m => { 
            accountData[accName].monthly[m] = 0;
            accountData[accName].monthly2024[m] = 0;
          });
        }
        
        accountData[accName].monthly[record.month] = 
          (accountData[accName].monthly[record.month] || 0) + record.amount;
        accountData[accName].total += record.amount;
      }
    }
    
    // 전년 데이터 집계
    if (detailData && detailData[prevYear]) {
      for (const record of detailData[prevYear]) {
        const accName = record.account;
        
        if (!accountData[accName]) {
          accountData[accName] = { 
            monthly: {}, 
            monthly2024: {},
            total: 0,
            total2024: 0,
          };
          months.forEach(m => { 
            accountData[accName].monthly[m] = 0;
            accountData[accName].monthly2024[m] = 0;
          });
        }
        
        accountData[accName].monthly2024[record.month] = 
          (accountData[accName].monthly2024[record.month] || 0) + record.amount;
        accountData[accName].total2024 += record.amount;
      }
    }
    
    // 원 -> 백만원 변환 및 정렬
    const items = Object.entries(accountData)
      .map(([accName, data]) => ({
        account: accName,
        accountShort: simplifyAccountName(accName),
        total: Math.round(data.total / 1_000_000),
        total2024: Math.round(data.total2024 / 1_000_000),
        monthly: Object.fromEntries(
          Object.entries(data.monthly).map(([m, v]) => [m, Math.round(v / 1_000_000)])
        ),
        monthly2024: Object.fromEntries(
          Object.entries(data.monthly2024).map(([m, v]) => [m, Math.round(v / 1_000_000)])
        ),
      }))
      .sort((a, b) => b.total - a.total);
    
    // 전체 합계
    const totalMonthly: { [m: string]: number } = {};
    const totalMonthly2024: { [m: string]: number } = {};
    months.forEach(m => {
      totalMonthly[m] = items.reduce((sum, item) => sum + (item.monthly[m] || 0), 0);
      totalMonthly2024[m] = items.reduce((sum, item) => sum + (item.monthly2024[m] || 0), 0);
    });
    
    return NextResponse.json({
      success: true,
      year,
      items,
      totalMonthly,
      totalMonthly2024,
      grandTotal: items.reduce((sum, item) => sum + item.total, 0),
      grandTotal2024: items.reduce((sum, item) => sum + item.total2024, 0),
      months,
    });
    
  } catch (error) {
    console.error('Commission API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// 특정 계정의 팀별 상세
async function getAccountDetails(year: string, account: string, months: string[]) {
  const detailData = loadCommissionJson();
  const prevYear = String(parseInt(year) - 1);
  
  if (!detailData) {
    return NextResponse.json({ success: true, year, account, items: [] });
  }
  
  const teamData: { [teamName: string]: { monthly: { [m: string]: number }; monthly2024: { [m: string]: number }; total: number; total2024: number } } = {};
  
  // 당년 데이터
  if (detailData[year]) {
    for (const record of detailData[year]) {
      if (record.account !== account) continue;
      
      const teamName = normalizeTeamName(record.cctr);
      
      if (!teamData[teamName]) {
        teamData[teamName] = { monthly: {}, monthly2024: {}, total: 0, total2024: 0 };
        months.forEach(m => { teamData[teamName].monthly[m] = 0; teamData[teamName].monthly2024[m] = 0; });
      }
      
      teamData[teamName].monthly[record.month] += record.amount;
      teamData[teamName].total += record.amount;
    }
  }
  
  // 전년 데이터
  if (detailData[prevYear]) {
    for (const record of detailData[prevYear]) {
      if (record.account !== account) continue;
      
      const teamName = normalizeTeamName(record.cctr);
      
      if (!teamData[teamName]) {
        teamData[teamName] = { monthly: {}, monthly2024: {}, total: 0, total2024: 0 };
        months.forEach(m => { teamData[teamName].monthly[m] = 0; teamData[teamName].monthly2024[m] = 0; });
      }
      
      teamData[teamName].monthly2024[record.month] += record.amount;
      teamData[teamName].total2024 += record.amount;
    }
  }
  
  // 원 -> 백만원 변환 및 현재 연도 합계 0인 팀 제외
  const items = Object.entries(teamData)
    .filter(([_, data]) => Math.abs(data.total) > 100000)  // 현재 연도 10만원 이상만
    .map(([team, data]) => ({
      team,
      total: Math.round(data.total / 1_000_000),
      total2024: Math.round(data.total2024 / 1_000_000),
      monthly: Object.fromEntries(
        Object.entries(data.monthly).map(([m, v]) => [m, Math.round(v / 1_000_000)])
      ),
      monthly2024: Object.fromEntries(
        Object.entries(data.monthly2024).map(([m, v]) => [m, Math.round(v / 1_000_000)])
      ),
    }))
    .filter(item => item.total !== 0)  // 현재 연도 합계가 0인 팀 제외
    .sort((a, b) => b.total - a.total);
  
  return NextResponse.json({
    success: true,
    year,
    account,
    accountShort: simplifyAccountName(account),
    items,
    months,
  });
}

// 텍스트 그룹화 규칙 (특정 키워드가 포함된 텍스트들을 하나로 묶음)
const TEXT_GROUP_RULES: { keywords: string[]; groupName: string }[] = [
  { keywords: ['모빈', 'MOVIN', 'movin'], groupName: '모빈 분쟁대응' },
  { keywords: ['법무관리시스템', 'IPCUBE', 'ipcube'], groupName: '법무관리시스템 사용료' },
  { keywords: ['세무자문료', '세무자문'], groupName: '세무자문료' },
  { keywords: ['노무'], groupName: '노무자문수수료' },
  // IT팀 - 내부회계 운영용역
  { keywords: ['내부회계 운영용', '내부회계운영용'], groupName: '내부회계 운영용역' },
  // 무역팀 - 관세조사 대응 컨설팅
  { keywords: ['관세조사 대응', '관세조사대응'], groupName: '관세청 관세조사 대응 컨설팅' },
  // HR팀/회계팀 - EAP 비용 정산
  { keywords: ['EAP', 'eap', '[FnF]비용', 'FnF비용', '[FnF] 비용'], groupName: 'FnF EAP 비용 정산' },
  // AX팀 - RAG 컨설팅
  { keywords: ['RAG'], groupName: 'RAG 컨설팅' },
  // HR팀 - AI기반 직원의견조사 플랫폼
  { keywords: ['직원의견조사', 'AI기반 직원'], groupName: 'AI기반 직원의견조사 플랫폼' },
  // 회계팀 - BEPS
  { keywords: ['BEPS', 'beps'], groupName: 'BEPS' },
  // 회계팀 - 센터포인트 강남 평가
  { keywords: ['센터포인트', '센터포인드'], groupName: '센터포인트 강남 평가' },
  // 지급수수료_기타 - 공통 그룹화
  { keywords: ['금융조회서 수수료'], groupName: '금융조회서 수수료' },
  { keywords: ['샵캐스트 음원'], groupName: '샵캐스트 음원 정산' },
  { keywords: ['공인인증서 발급', '공인인증서 갱신'], groupName: '공인인증서 발급/갱신' },
  { keywords: ['등기부등본 조회', '등기부등본 발급'], groupName: '등기부등본 조회/발급' },
  { keywords: ['APEC카드 발급', 'APEC 카드 발급'], groupName: 'APEC카드 발급비' },
  { keywords: ['사원증 재발급', '사원증 발급'], groupName: '사원증 발급' },
  { keywords: ['상조용품 보관료'], groupName: '상조용품 보관료' },
  { keywords: ['사이버브랜치 수수료'], groupName: '사이버브랜치 수수료' },
  { keywords: ['NICE 본인인증'], groupName: 'NICE 본인인증 수수료' },
  // 공간기획팀 - 해외매뉴얼 설계 (파견직보다 먼저 체크)
  { keywords: ['해외매뉴얼 설계도급', '해외매뉴얼설계도급'], groupName: '해외매뉴얼 설계 도급계약' },
  // 총무팀 - 별도 표기 항목 (파견직보다 먼저 체크)
  { keywords: ['이천 도급 업무비', '이천도급업무비'], groupName: '이천 도급 업무비(미화/보안)' },
  { keywords: ['행낭차량 도급', '행낭차량도급'], groupName: '행낭차량 도급 업무비' },
  // 지급용역비 - 파견직 관련
  { keywords: ['아웃소싱', '파견직', '프리랜서', '파견', '도급', '외주', '아르바이트', '월 지급', '보보스링크'], groupName: '파견직' },
];

// 텍스트를 그룹화된 이름으로 변환
function normalizeTextKey(text: string, team?: string): string {
  // 1. 먼저 키워드 기반 그룹화 규칙 적용
  const lowerText = text.toLowerCase();
  
  for (const rule of TEXT_GROUP_RULES) {
    for (const keyword of rule.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        // 경영관리팀은 파견직 대신 CNSF 용역비로 표시
        if (rule.groupName === '파견직' && team === '경영관리팀') {
          return 'CNSF 용역비';
        }
        return rule.groupName;
      }
    }
  }
  
  // 2. 다양한 패턴 제거하여 프로젝트명으로 통합
  let normalizedText = text;
  
  // 연도/월 패턴 제거: "2024년", "2025년", "1월"~"12월", "24년", "25년"
  normalizedText = normalizedText.replace(/\s*(20)?\d{2}년\s*/g, ' ');
  normalizedText = normalizedText.replace(/\s*\d{1,2}월\s*/g, ' ');
  
  // 건수 패턴 제거: (12건), (2건) 등
  normalizedText = normalizedText.replace(/\s*[\(（]\d+건[\)）]\s*/g, ' ');
  
  // 인원수 패턴 제거: (9명), (1명), (2인) 등
  normalizedText = normalizedText.replace(/\s*[\(（]\d+[명인][\)）]\s*/g, ' ');
  
  // 이름 패턴 제거: (김경호), (임채승) 등 - 괄호 안 한글 2~4자
  normalizedText = normalizedText.replace(/\s*[\(（][가-힣]{2,4}[\)）]\s*/g, ' ');
  
  // 날짜 패턴 제거: "25.01", "2025.01", "25/01", "2025-01"
  normalizedText = normalizedText.replace(/\s*(20)?\d{2}[.\-\/]\d{1,2}\s*/g, ' ');
  
  // 차수 패턴 제거: "1차", "2차", "(1차)", "(2차)", "[1차]"
  normalizedText = normalizedText.replace(/\s*[\[(]?\d+차[\])']?\s*/g, ' ');
  
  // 괄호 안 숫자 제거: "(1)", "(2)", "[1]", "[2]"
  normalizedText = normalizedText.replace(/\s*[\[(]\d+[\])]\s*/g, ' ');
  
  // 결제 단계 키워드 제거
  const paymentKeywords = ['착수금', '중도금', '잔금', '선급금', '기성금', '완료금', '계약금'];
  for (const keyword of paymentKeywords) {
    const regex = new RegExp(`\\s*${keyword}\\s*`, 'gi');
    normalizedText = normalizedText.replace(regex, ' ');
  }
  
  // 언더스코어/하이픈 뒤 구분자 제거: "_1", "_2", "_A", "-1", "-2"
  normalizedText = normalizedText.replace(/[_\-]\s*[A-Za-z0-9]\s*$/g, '');
  normalizedText = normalizedText.replace(/[_\-]\s*\d+\s*/g, ' ');
  
  // 끝의 숫자만 있는 경우 제거: "용역 1", "용역 2"
  normalizedText = normalizedText.replace(/\s+\d+\s*$/g, '');
  
  // 앞뒤 공백 및 중복 공백 정리
  normalizedText = normalizedText.trim().replace(/\s+/g, ' ');
  
  // 끝의 특수문자 정리
  normalizedText = normalizedText.replace(/[\s_\-.,]+$/g, '');
  
  return normalizedText || text;
}

// 특정 계정의 특정 팀 텍스트별 상세
async function getTeamAccountDetails(year: string, account: string, team: string, months: string[]) {
  const detailData = loadCommissionJson();
  
  if (!detailData) {
    return NextResponse.json({ success: true, year, account, team, items: [] });
  }
  
  const textData: { [text: string]: { monthly: { [m: string]: number }; total: number } } = {};
  
  // 특정 팀의 지급용역비는 모두 파견직비용으로 처리
  const DISPATCH_TEAMS = ['통합인플루언서마케팅', '통합마케팅', '통합영업', '마케팅본부'];
  const isDispatchAccount = account === '지급수수료_지급용역비' && DISPATCH_TEAMS.includes(team);
  
  if (detailData[year]) {
    for (const record of detailData[year]) {
      if (record.account !== account) continue;
      
      const teamName = normalizeTeamName(record.cctr);
      if (teamName !== team) continue;
      
      // 텍스트 그룹화 적용 (특정 팀의 지급용역비는 모두 파견직비용)
      const textKey = isDispatchAccount ? '파견직비용' : normalizeTextKey(record.text || 'Unknown', team);
      
      if (!textData[textKey]) {
        textData[textKey] = { monthly: {}, total: 0 };
        months.forEach(m => { textData[textKey].monthly[m] = 0; });
      }
      
      textData[textKey].monthly[record.month] += record.amount;
      textData[textKey].total += record.amount;
    }
  }
  
  // 원 -> 백만원 변환 및 소액 항목 그룹화 (법무팀만 해당)
  const SMALL_AMOUNT_THRESHOLD = 1_000_000; // 1백만원
  const SMALL_AMOUNT_GROUP_NAME = '매장 근저당이전 외';
  const isLegalTeam = team === '법무팀'; // 법무팀 여부 확인
  
  // 제외할 텍스트 키워드 (CC대체, 신사옥 등 상쇄 항목)
  const EXCLUDE_KEYWORDS = ['CC대체', 'cc대체', '신사옥'];
  
  // 지급수수료_기타는 1백만원 미만 제외, 그 외는 10만원 미만 제외
  const minAmountThreshold = account === '지급수수료_기타' ? 1000000 : 100000;
  
  // 먼저 백만원 단위로 변환
  let convertedItems = Object.entries(textData)
    .filter(([text, data]) => {
      // 최소 금액 미만 제외
      if (Math.abs(data.total) < minAmountThreshold) return false;
      // 상쇄 키워드가 있는 항목은 모두 제외
      const hasExcludeKeyword = EXCLUDE_KEYWORDS.some(kw => text.toLowerCase().includes(kw.toLowerCase()));
      if (hasExcludeKeyword) return false;
      return true;
    })
    .map(([text, data]) => ({
      text,
      total: Math.round(data.total / 1_000_000),
      totalRaw: data.total, // 원본 금액 (그룹화 판단용)
      monthly: Object.fromEntries(
        Object.entries(data.monthly).map(([m, v]) => [m, Math.round(v / 1_000_000)])
      ),
      monthlyRaw: data.monthly, // 원본 월별 금액
    }));
  
  // 법무팀인 경우에만 1백만원 미만 항목들을 그룹화
  let finalItems;
  if (isLegalTeam) {
    const smallItems = convertedItems.filter(item => Math.abs(item.totalRaw) < SMALL_AMOUNT_THRESHOLD);
    const largeItems = convertedItems.filter(item => Math.abs(item.totalRaw) >= SMALL_AMOUNT_THRESHOLD);
    
    // 소액 항목들 합산
    if (smallItems.length > 0) {
      const smallGroupMonthly: { [m: string]: number } = {};
      const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
      months.forEach(m => { smallGroupMonthly[m] = 0; });
      
      let smallGroupTotal = 0;
      for (const item of smallItems) {
        smallGroupTotal += item.total;
        for (const m of months) {
          smallGroupMonthly[m] += item.monthly[m] || 0;
        }
      }
      
      // 소액 그룹이 0이 아닌 경우에만 추가
      if (smallGroupTotal !== 0) {
        largeItems.push({
          text: SMALL_AMOUNT_GROUP_NAME,
          total: smallGroupTotal,
          totalRaw: smallGroupTotal * 1_000_000,
          monthly: smallGroupMonthly,
          monthlyRaw: Object.fromEntries(Object.entries(smallGroupMonthly).map(([m, v]) => [m, v * 1_000_000])),
        });
      }
    }
    finalItems = largeItems;
  } else {
    // 법무팀이 아닌 경우 그대로 사용
    finalItems = convertedItems;
  }
  
  // 최종 정렬 (금액 큰 순)
  const items = finalItems
    .map(({ text, total, monthly }) => ({ text, total, monthly }))
    .sort((a, b) => b.total - a.total);
  
  return NextResponse.json({
    success: true,
    year,
    account,
    accountShort: simplifyAccountName(account),
    team,
    items,
    months,
  });
}

// 특정 계정의 전체 텍스트별 상세 (팝업용) - 부서 정보 포함
async function getAccountAllDetails(year: string, account: string, months: string[]) {
  const detailData = loadCommissionJson();
  
  if (!detailData) {
    return NextResponse.json({ success: true, year, account, items: [] });
  }
  
  // 텍스트 + 부서별로 그룹화
  const textData: { [key: string]: { text: string; dept: string; vendor: string; amount: number; monthly: { [m: string]: number } } } = {};
  
  if (detailData[year]) {
    for (const record of detailData[year]) {
      if (record.account !== account) continue;
      
      const dept = normalizeTeamName(record.cctr);
      const text = record.text || 'Unknown';
      const groupKey = `${text}__${dept}`;
      
      if (!textData[groupKey]) {
        textData[groupKey] = { text, dept, vendor: record.vendor || '', amount: 0, monthly: {} };
        months.forEach(m => { textData[groupKey].monthly[m] = 0; });
      }
      
      textData[groupKey].amount += record.amount;
      textData[groupKey].monthly[record.month] += record.amount;
    }
  }
  
  // 정렬 및 변환
  const items = Object.values(textData)
    .map(item => ({
      text: item.text,
      dept: item.dept,
      vendor: item.vendor,
      total: Math.round(item.amount / 1_000_000),
      totalRaw: item.amount,
      monthly: Object.fromEntries(
        Object.entries(item.monthly).map(([m, v]) => [m, Math.round(v / 1_000_000)])
      ),
    }))
    .sort((a, b) => b.totalRaw - a.totalRaw);
  
  return NextResponse.json({
    success: true,
    year,
    account,
    accountShort: simplifyAccountName(account),
    items,
    grandTotal: Math.round(items.reduce((sum, i) => sum + i.totalRaw, 0) / 1_000_000),
    months,
  });
}
