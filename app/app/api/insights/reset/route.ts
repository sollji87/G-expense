import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { REDIS_KEYS } from '@/lib/redis';

/**
 * POST /api/insights/reset
 * 
 * Redis 데이터를 초기화하고 새로운 데이터로 설정합니다.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { descriptions } = body;
    
    // 기존 데이터 삭제
    await kv.del(REDIS_KEYS.DESCRIPTIONS);
    
    // 새로운 데이터 저장 (있는 경우)
    if (descriptions && typeof descriptions === 'object') {
      await kv.set(REDIS_KEYS.DESCRIPTIONS, descriptions);
      
      return NextResponse.json({
        success: true,
        message: 'Redis 데이터가 초기화되고 새 데이터가 저장되었습니다.',
        count: Object.keys(descriptions).length,
        data: descriptions,
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Redis 데이터가 초기화되었습니다.',
    });
    
  } catch (error) {
    console.error('Redis 초기화 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Redis 초기화에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/insights/reset
 * 
 * Redis 데이터를 완전히 삭제합니다.
 */
export async function DELETE() {
  try {
    await kv.del(REDIS_KEYS.DESCRIPTIONS);
    
    return NextResponse.json({
      success: true,
      message: 'Redis 데이터가 삭제되었습니다.',
    });
    
  } catch (error) {
    console.error('Redis 삭제 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Redis 삭제에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

