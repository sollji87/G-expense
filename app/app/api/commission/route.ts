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
    const account = searchParams.get('account');  // 계정 필터 (예: 지급수수료_법률자문료)
    const team = searchParams.get('team');  // 팀 필터 (특정 계정 내 팀별 상세)
    
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    
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
    if (detailData && detailData['2024']) {
      for (const record of detailData['2024']) {
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
  if (detailData['2024']) {
    for (const record of detailData['2024']) {
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
  
  // 원 -> 백만원 변환
  const items = Object.entries(teamData)
    .filter(([_, data]) => Math.abs(data.total) > 100000 || Math.abs(data.total2024) > 100000)  // 10만원 이상
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

// 특정 계정의 특정 팀 텍스트별 상세
async function getTeamAccountDetails(year: string, account: string, team: string, months: string[]) {
  const detailData = loadCommissionJson();
  
  if (!detailData) {
    return NextResponse.json({ success: true, year, account, team, items: [] });
  }
  
  const textData: { [text: string]: { monthly: { [m: string]: number }; total: number } } = {};
  
  if (detailData[year]) {
    for (const record of detailData[year]) {
      if (record.account !== account) continue;
      
      const teamName = normalizeTeamName(record.cctr);
      if (teamName !== team) continue;
      
      const textKey = record.text || 'Unknown';
      
      if (!textData[textKey]) {
        textData[textKey] = { monthly: {}, total: 0 };
        months.forEach(m => { textData[textKey].monthly[m] = 0; });
      }
      
      textData[textKey].monthly[record.month] += record.amount;
      textData[textKey].total += record.amount;
    }
  }
  
  // 원 -> 백만원 변환
  const items = Object.entries(textData)
    .filter(([_, data]) => Math.abs(data.total) > 100000)  // 10만원 이상
    .map(([text, data]) => ({
      text,
      total: Math.round(data.total / 1_000_000),
      monthly: Object.fromEntries(
        Object.entries(data.monthly).map(([m, v]) => [m, Math.round(v / 1_000_000)])
      ),
    }))
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
