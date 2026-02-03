import { NextResponse } from 'next/server';
import { getLaborMovement, saveLaborMovement, getLaborRemark, saveLaborRemark } from '@/lib/redis';

// GET: 입사/퇴사/이동 및 비고 데이터 조회
export async function GET() {
  try {
    const [movement, remark] = await Promise.all([
      getLaborMovement(),
      getLaborRemark()
    ]);
    
    return NextResponse.json({ 
      success: true, 
      movement,
      remark
    });
  } catch (error) {
    console.error('Labor movement GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch labor movement data' },
      { status: 500 }
    );
  }
}

// POST: 입사/퇴사/이동 및 비고 데이터 저장
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { movement, remark } = body;
    
    const results = await Promise.all([
      movement !== undefined ? saveLaborMovement(movement) : getLaborMovement(),
      remark !== undefined ? saveLaborRemark(remark) : getLaborRemark()
    ]);
    
    return NextResponse.json({ 
      success: true, 
      movement: results[0],
      remark: results[1]
    });
  } catch (error) {
    console.error('Labor movement POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save labor movement data' },
      { status: 500 }
    );
  }
}
