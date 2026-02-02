import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function parseCSV(content: string): any[] {
  const lines = content.split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const records: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const record: any = {};
    headers.forEach((header, idx) => {
      record[header] = values[idx] || '';
    });
    records.push(record);
  }
  
  return records;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || '2025';

    // CSV 파일 경로 (git에 포함된 파일)
    const fileName = year === '2024' ? 'assets_2024.csv' : 'assets_2025.csv';
    let filePath = path.join(process.cwd(), '..', 'CAPEX', fileName);
    
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), '..', '..', 'CAPEX', fileName);
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`파일을 찾을 수 없습니다: ${fileName}`);
    }

    // CSV 파일 읽기
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = parseCSV(fileContent);

    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    
    // 당기 취득, 이관, 처분 자산 필터링
    const targetYear = parseInt(year);
    const acquisitions: any[] = [];
    const transfers: any[] = [];
    const disposals: any[] = [];

    data.forEach((row: any) => {
      const assetNo = row['자산번호'];
      const assetName = row['자산명'] || '';
      const acquisitionDateRaw = row['취득일'];
      const acquisitionAmount = parseFloat(row['당기취득가액'] || '0');
      const transferAmount = parseFloat(row['당기이관자산가액'] || '0');
      const disposalAmount = parseFloat(row['당기처분가액'] || '0');
      
      if (!assetNo || assetNo === '') return;
      
      // 취득일 파싱
      let acquisitionDate: Date | null = null;
      if (acquisitionDateRaw) {
        if (typeof acquisitionDateRaw === 'number') {
          // 엑셀 날짜 시리얼
          acquisitionDate = new Date((acquisitionDateRaw - 25569) * 86400 * 1000);
        } else if (typeof acquisitionDateRaw === 'string') {
          acquisitionDate = new Date(acquisitionDateRaw);
        }
      }

      const acqYear = acquisitionDate?.getFullYear();
      const acqMonth = acquisitionDate ? String(acquisitionDate.getMonth() + 1).padStart(2, '0') : null;

      // 당기취득 자산 (해당 연도에 취득한 것만)
      if (acquisitionAmount > 0 && acqYear === targetYear) {
        acquisitions.push({
          assetNo,
          assetName: assetName.replace(/\xa0/g, ' ').trim(),
          acquisitionDate: acquisitionDate?.toISOString().split('T')[0] || '',
          month: acqMonth,
          amount: Math.round(acquisitionAmount / 1000000), // 백만원
        });
      }

      // 당기이관 자산 (양수만 - 이관받은 것)
      if (transferAmount > 0) {
        transfers.push({
          assetNo,
          assetName: assetName.replace(/\xa0/g, ' ').trim(),
          acquisitionDate: acquisitionDate?.toISOString().split('T')[0] || '',
          month: acqMonth,
          amount: Math.round(transferAmount / 1000000), // 백만원
        });
      }

      // 당기처분 자산 (마이너스 - 처분한 것)
      if (disposalAmount < 0) {
        disposals.push({
          assetNo,
          assetName: assetName.replace(/\xa0/g, ' ').trim(),
          acquisitionDate: acquisitionDate?.toISOString().split('T')[0] || '',
          month: acqMonth,
          amount: Math.round(Math.abs(disposalAmount) / 1000000), // 백만원 (절대값으로 표시)
        });
      }
    });

    // 월별 집계
    const monthlyAcquisitions: { [month: string]: number } = {};
    const monthlyTransfers: { [month: string]: number } = {};
    const monthlyDisposals: { [month: string]: number } = {};
    
    months.forEach(m => {
      monthlyAcquisitions[m] = 0;
      monthlyTransfers[m] = 0;
      monthlyDisposals[m] = 0;
    });

    acquisitions.forEach(item => {
      if (item.month && monthlyAcquisitions.hasOwnProperty(item.month)) {
        monthlyAcquisitions[item.month] += item.amount;
      }
    });

    transfers.forEach(item => {
      if (item.month && monthlyTransfers.hasOwnProperty(item.month)) {
        monthlyTransfers[item.month] += item.amount;
      }
    });

    disposals.forEach(item => {
      if (item.month && monthlyDisposals.hasOwnProperty(item.month)) {
        monthlyDisposals[item.month] += item.amount;
      }
    });

    // 정렬
    acquisitions.sort((a, b) => b.amount - a.amount);
    transfers.sort((a, b) => b.amount - a.amount);
    disposals.sort((a, b) => b.amount - a.amount);

    return NextResponse.json({
      success: true,
      year,
      months,
      acquisitions,
      transfers,
      disposals,
      monthlyAcquisitions,
      monthlyTransfers,
      monthlyDisposals,
      totals: {
        acquisitions: acquisitions.reduce((sum, item) => sum + item.amount, 0),
        transfers: transfers.reduce((sum, item) => sum + item.amount, 0),
        disposals: disposals.reduce((sum, item) => sum + item.amount, 0),
      }
    });

  } catch (error) {
    console.error('CAPEX API 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'CAPEX 데이터를 불러오는데 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
