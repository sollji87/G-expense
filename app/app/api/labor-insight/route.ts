import { NextRequest, NextResponse } from 'next/server';
import { getLaborInsight, saveLaborInsight } from '@/lib/redis';

// GET: 인원 현황 시사점 조회
export async function GET() {
  try {
    const insight = await getLaborInsight();
    return NextResponse.json({ 
      success: true, 
      data: insight 
    });
  } catch (error) {
    console.error('인원 시사점 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '시사점을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 인원 현황 시사점 저장
export async function POST(request: NextRequest) {
  try {
    const { insight } = await request.json();
    
    if (typeof insight !== 'string') {
      return NextResponse.json(
        { success: false, error: '잘못된 데이터 형식입니다.' },
        { status: 400 }
      );
    }
    
    const saved = await saveLaborInsight(insight);
    return NextResponse.json({ 
      success: true, 
      data: saved,
      message: '시사점이 저장되었습니다.'
    });
  } catch (error) {
    console.error('인원 시사점 저장 오류:', error);
    return NextResponse.json(
      { success: false, error: '시사점 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}
