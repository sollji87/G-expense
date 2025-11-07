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
      record[header] = values[index]?.trim().replace(/^"|"$/g, '') || '';
    });
    records.push(record);
  }
  
  return records;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountName = searchParams.get('account');
    const currentMonth = searchParams.get('currentMonth') || '202510';
    const previousMonth = searchParams.get('previousMonth') || '202410';
    
    if (!accountName) {
      return NextResponse.json({ success: false, error: 'Account parameter is required' }, { status: 400 });
    }
    
    // 폴더 경로 찾기 (대분류_중분류 폴더 구조)
    let currentBasePath = path.join(process.cwd(), '..', 'out', 'details', currentMonth);
    let previousBasePath = path.join(process.cwd(), '..', 'out', 'details', previousMonth);
    
    if (!fs.existsSync(currentBasePath)) {
      currentBasePath = path.join(process.cwd(), '..', '..', 'out', 'details', currentMonth);
      previousBasePath = path.join(process.cwd(), '..', '..', 'out', 'details', previousMonth);
    }
    
    if (!fs.existsSync(currentBasePath)) {
      currentBasePath = path.join(process.cwd(), '..', 'myvenv', 'out', 'details', currentMonth);
      previousBasePath = path.join(process.cwd(), '..', 'myvenv', 'out', 'details', previousMonth);
    }
    
    // 모든 하위 폴더에서 CSV 파일 읽기
    let currentData: any[] = [];
    let previousData: any[] = [];
    
    if (fs.existsSync(currentBasePath)) {
      const folders = fs.readdirSync(currentBasePath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory());
      
      for (const folder of folders) {
        const folderPath = path.join(currentBasePath, folder.name);
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.csv'));
        
        for (const file of files) {
          const filePath = path.join(folderPath, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const records = parseCSV(content);
          currentData.push(...records);
        }
      }
    }
    
    if (fs.existsSync(previousBasePath)) {
      const folders = fs.readdirSync(previousBasePath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory());
      
      for (const folder of folders) {
        const folderPath = path.join(previousBasePath, folder.name);
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.csv'));
        
        for (const file of files) {
          const filePath = path.join(folderPath, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const records = parseCSV(content);
          previousData.push(...records);
        }
      }
    }
    
    // G/L 계정(소분류) + 적요 단위로 금액 집계
    const currentByGL = new Map<string, number>();
    const previousByGL = new Map<string, number>();
    const currentByGLDetail = new Map<string, Map<string, number>>(); // GL계정 -> 적요 -> 금액
    const previousByGLDetail = new Map<string, Map<string, number>>();
    
    currentData.forEach((record: any) => {
      const glAccount = record['G/L 계정 설명'] || record['GL계정'] || '기타';
      const description = record['적요'] || record['Description'] || '';
      const amount = parseFloat(record['금액'] || record['Amount'] || '0');
      
      // GL 계정별 총액
      currentByGL.set(glAccount, (currentByGL.get(glAccount) || 0) + amount);
      
      // GL 계정 + 적요별 상세
      if (!currentByGLDetail.has(glAccount)) {
        currentByGLDetail.set(glAccount, new Map());
      }
      const detailMap = currentByGLDetail.get(glAccount)!;
      detailMap.set(description, (detailMap.get(description) || 0) + amount);
    });
    
    previousData.forEach((record: any) => {
      const glAccount = record['G/L 계정 설명'] || record['GL계정'] || '기타';
      const description = record['적요'] || record['Description'] || '';
      const amount = parseFloat(record['금액'] || record['Amount'] || '0');
      
      // GL 계정별 총액
      previousByGL.set(glAccount, (previousByGL.get(glAccount) || 0) + amount);
      
      // GL 계정 + 적요별 상세
      if (!previousByGLDetail.has(glAccount)) {
        previousByGLDetail.set(glAccount, new Map());
      }
      const detailMap = previousByGLDetail.get(glAccount)!;
      detailMap.set(description, (detailMap.get(description) || 0) + amount);
    });
    
    // 총 금액 계산
    const currentTotal = Array.from(currentByGL.values()).reduce((sum, amt) => sum + amt, 0);
    const previousTotal = Array.from(previousByGL.values()).reduce((sum, amt) => sum + amt, 0);
    const totalChange = currentTotal - previousTotal;
    
    // G/L 계정별 차이 분석 (적요 포함)
    const allGLAccounts = new Set([...currentByGL.keys(), ...previousByGL.keys()]);
    const glAnalysis: any[] = [];
    
    allGLAccounts.forEach(glAccount => {
      const current = currentByGL.get(glAccount) || 0;
      const previous = previousByGL.get(glAccount) || 0;
      const change = current - previous;
      
      if (Math.abs(change) >= 1000000) { // 100만원 이상 차이나는 항목만
        // 해당 GL 계정의 주요 적요 찾기
        const currentDetails = currentByGLDetail.get(glAccount) || new Map();
        const previousDetails = previousByGLDetail.get(glAccount) || new Map();
        
        // 적요별 차이 계산
        const allDescriptions = new Set([...currentDetails.keys(), ...previousDetails.keys()]);
        const descriptionChanges: any[] = [];
        
        allDescriptions.forEach(desc => {
          const currAmt = currentDetails.get(desc) || 0;
          const prevAmt = previousDetails.get(desc) || 0;
          const descChange = currAmt - prevAmt;
          
          if (Math.abs(descChange) >= 500000 && desc.trim()) { // 50만원 이상 & 적요가 있는 경우
            descriptionChanges.push({
              description: desc,
              change: descChange
            });
          }
        });
        
        // 변동이 큰 적요 상위 3개
        descriptionChanges.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
        const topDescriptions = descriptionChanges.slice(0, 3);
        
        glAnalysis.push({
          glAccount,
          current,
          previous,
          change,
          changePercent: previous !== 0 ? (change / previous) * 100 : 0,
          topDescriptions // 주요 적요 추가
        });
      }
    });
    
    // 변동 금액이 큰 순서대로 정렬
    glAnalysis.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    
    return NextResponse.json({
      success: true,
      data: {
        accountName,
        currentTotal,
        previousTotal,
        totalChange,
        glAccounts: glAnalysis.slice(0, 5) // 상위 5개만
      }
    });
    
  } catch (error) {
    console.error('계정 상세 분석 API 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '계정 상세 분석 데이터를 불러오는데 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

