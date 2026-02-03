백백import { NextResponse } from 'next/server';
import { 
  getAllDescriptions, 
  getDescription, 
  getInsight, 
  getAllInsightKeys,
  kv 
} from '@/lib/redis';

/**
 * GET /api/insights/get
 * 
 * Redis에서 AI 설명/인사이트를 조회합니다.
 * 
 * Query Parameters:
 * - type: 'description' | 'insight' | 'all' (기본값: 'description')
 * - accountId: 특정 계정만 조회 (선택)
 * - id: 특정 인사이트 ID (type이 'insight'일 때)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'description';
    const accountId = searchParams.get('accountId');
    const insightId = searchParams.get('id');

    // 특정 인사이트 조회
    if (type === 'insight' && insightId) {
      const insight = await getInsight(insightId);
      
      if (!insight) {
        return NextResponse.json(
          { success: false, error: '인사이트를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: insight,
      });
    }

    // 모든 인사이트 키 조회
    if (type === 'insight') {
      const keys = await getAllInsightKeys();
      const insights = await Promise.all(
        keys.map(async (key) => {
          const id = key.replace('insights:', '');
          return await getInsight(id);
        })
      );

      return NextResponse.json({
        success: true,
        data: insights.filter(Boolean),
        count: insights.length,
      });
    }

    // 특정 계정 설명 조회
    if (accountId) {
      const description = await getDescription(accountId);
      
      return NextResponse.json({
        success: true,
        data: {
          accountId,
          description: description || '',
        },
      });
    }

    // 모든 설명 조회
    const descriptions = await getAllDescriptions();

    return NextResponse.json({
      success: true,
      data: descriptions,
      count: Object.keys(descriptions).length,
    });

  } catch (error) {
    console.error('인사이트 조회 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: '조회에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}


