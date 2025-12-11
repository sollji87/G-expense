import { NextResponse } from 'next/server';
import { 
  getAllDescriptions, 
  saveDescription, 
  deleteDescription 
} from '@/lib/redis';

/**
 * GET /api/descriptions
 * 
 * 모든 AI 설명을 Redis에서 조회합니다.
 */
export async function GET() {
  try {
    const descriptions = await getAllDescriptions();
    
    return NextResponse.json({
      success: true,
      data: descriptions,
      count: Object.keys(descriptions).length,
      source: 'redis', // Vercel KV에서 조회됨을 표시
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

/**
 * POST /api/descriptions
 * 
 * AI 설명을 Redis에 저장합니다.
 * 
 * Body:
 * - accountId: 계정 ID
 * - description: 설명 내용
 */
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
    
    const descriptions = await saveDescription(accountId, description);
    
    return NextResponse.json({
      success: true,
      message: '설명이 저장되었습니다.',
      data: descriptions,
      source: 'redis',
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

/**
 * DELETE /api/descriptions
 * 
 * 특정 AI 설명을 Redis에서 삭제합니다.
 * 
 * Body:
 * - accountId: 삭제할 계정 ID
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { accountId } = body;
    
    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'accountId가 필요합니다.' },
        { status: 400 }
      );
    }
    
    const descriptions = await deleteDescription(accountId);
    
    return NextResponse.json({
      success: true,
      message: '설명이 삭제되었습니다.',
      data: descriptions,
      source: 'redis',
    });
    
  } catch (error) {
    console.error('설명 삭제 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '설명을 삭제하는데 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
