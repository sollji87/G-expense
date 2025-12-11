import { NextResponse } from 'next/server';
import { saveDescriptions, getAllDescriptions } from '@/lib/redis';

/**
 * POST /api/insights/migrate
 * 
 * 기존 로컬 데이터를 Redis로 마이그레이션합니다.
 * 
 * Body:
 * - descriptions: { [accountId]: description } 형태의 객체
 * - overwrite: true이면 기존 데이터를 덮어씀 (기본값: false, 병합)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { descriptions, overwrite = false } = body;
    
    if (!descriptions || typeof descriptions !== 'object') {
      return NextResponse.json(
        { success: false, error: 'descriptions 객체가 필요합니다.' },
        { status: 400 }
      );
    }

    const inputCount = Object.keys(descriptions).length;

    if (inputCount === 0) {
      return NextResponse.json(
        { success: false, error: '마이그레이션할 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    // 기존 데이터 확인
    const existingDescriptions = await getAllDescriptions();
    const existingCount = Object.keys(existingDescriptions).length;

    // 데이터 저장 (병합 또는 덮어쓰기)
    let finalDescriptions;
    if (overwrite) {
      // 덮어쓰기 모드: 새 데이터로 완전 교체
      finalDescriptions = await saveDescriptions(descriptions);
    } else {
      // 병합 모드: 기존 데이터 + 새 데이터 (새 데이터 우선)
      const merged = { ...existingDescriptions, ...descriptions };
      finalDescriptions = await saveDescriptions(merged);
    }

    const finalCount = Object.keys(finalDescriptions).length;

    return NextResponse.json({
      success: true,
      message: '마이그레이션이 완료되었습니다.',
      stats: {
        inputCount,
        existingCount,
        finalCount,
        mode: overwrite ? 'overwrite' : 'merge',
      },
      data: finalDescriptions,
    });
    
  } catch (error) {
    console.error('마이그레이션 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '마이그레이션에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/insights/migrate
 * 
 * 현재 Redis 데이터 상태를 확인합니다.
 */
export async function GET() {
  try {
    const descriptions = await getAllDescriptions();
    const count = Object.keys(descriptions).length;

    return NextResponse.json({
      success: true,
      message: `Redis에 ${count}개의 설명이 저장되어 있습니다.`,
      count,
      data: descriptions,
    });
    
  } catch (error) {
    console.error('Redis 상태 확인 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Redis 상태 확인에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

