import { NextRequest, NextResponse } from 'next/server';
import { getAllocationCriteria, saveAllocationCriteria } from '@/lib/redis';

// GET: 배부기준 조회
export async function GET() {
  try {
    const criteria = await getAllocationCriteria();
    return NextResponse.json({ 
      success: true, 
      data: criteria 
    });
  } catch (error) {
    console.error('배부기준 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '배부기준을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 배부기준 저장
export async function POST(request: NextRequest) {
  try {
    const { criteria } = await request.json();
    
    if (!Array.isArray(criteria)) {
      return NextResponse.json(
        { success: false, error: '잘못된 데이터 형식입니다.' },
        { status: 400 }
      );
    }
    
    const saved = await saveAllocationCriteria(criteria);
    return NextResponse.json({ 
      success: true, 
      data: saved,
      message: '배부기준이 저장되었습니다.'
    });
  } catch (error) {
    console.error('배부기준 저장 오류:', error);
    return NextResponse.json(
      { success: false, error: '배부기준 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}
