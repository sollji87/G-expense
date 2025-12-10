import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 설명 파일 경로
function getDescriptionsPath(): string {
  let descriptionsPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'account_descriptions.json');
  
  if (!fs.existsSync(path.dirname(descriptionsPath))) {
    descriptionsPath = path.join(process.cwd(), '..', '..', 'myvenv', 'out', 'account_descriptions.json');
  }
  
  return descriptionsPath;
}

// GET: 설명 읽기
export async function GET(request: Request) {
  try {
    const descriptionsPath = getDescriptionsPath();
    
    // 파일이 없으면 빈 객체 반환
    if (!fs.existsSync(descriptionsPath)) {
      return NextResponse.json({
        success: true,
        data: {}
      });
    }
    
    const content = fs.readFileSync(descriptionsPath, 'utf-8');
    const descriptions = JSON.parse(content);
    
    return NextResponse.json({
      success: true,
      data: descriptions
    });
    
  } catch (error) {
    console.error('설명 읽기 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '설명을 불러오는데 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// POST: 설명 저장
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountId, description } = body;
    
    if (!accountId || description === undefined) {
      return NextResponse.json(
        { success: false, error: 'accountId와 description이 필요합니다.' },
        { status: 400 }
      );
    }
    
    const descriptionsPath = getDescriptionsPath();
    const dirPath = path.dirname(descriptionsPath);
    
    // 디렉토리가 없으면 생성
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // 기존 설명 읽기
    let descriptions: Record<string, string> = {};
    if (fs.existsSync(descriptionsPath)) {
      const content = fs.readFileSync(descriptionsPath, 'utf-8');
      descriptions = JSON.parse(content);
    }
    
    // 설명 업데이트
    descriptions[accountId] = description;
    
    // 파일에 저장
    fs.writeFileSync(descriptionsPath, JSON.stringify(descriptions, null, 2), 'utf-8');
    
    return NextResponse.json({
      success: true,
      message: '설명이 저장되었습니다.',
      data: descriptions
    });
    
  } catch (error) {
    console.error('설명 저장 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '설명을 저장하는데 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

