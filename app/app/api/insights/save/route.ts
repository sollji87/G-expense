import { NextResponse } from 'next/server';
import { saveDescription, saveDescriptions, saveInsight } from '@/lib/redis';

/**
 * POST /api/insights/save
 * 
 * AI 설명/인사이트를 Redis에 저장합니다.
 * 
 * Body:
 * - accountId: 계정 ID (단일 저장 시)
 * - description: 설명 내용 (단일 저장 시)
 * - descriptions: { [accountId]: description } (일괄 저장 시)
 * - type: 'description' | 'insight' (기본값: 'description')
 * - insight: Insight 객체 (type이 'insight'일 때)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type = 'description' } = body;

    // 인사이트 저장
    if (type === 'insight') {
      const { insight } = body;
      
      if (!insight || !insight.id || !insight.accountId || insight.content === undefined) {
        return NextResponse.json(
          { success: false, error: 'insight 객체에 id, accountId, content가 필요합니다.' },
          { status: 400 }
        );
      }

      const savedInsight = await saveInsight(insight);
      
      return NextResponse.json({
        success: true,
        message: '인사이트가 저장되었습니다.',
        data: savedInsight,
      });
    }

    // 설명 일괄 저장
    if (body.descriptions) {
      const { descriptions } = body;
      
      if (typeof descriptions !== 'object') {
        return NextResponse.json(
          { success: false, error: 'descriptions는 객체여야 합니다.' },
          { status: 400 }
        );
      }

      const savedDescriptions = await saveDescriptions(descriptions);
      
      return NextResponse.json({
        success: true,
        message: '설명이 일괄 저장되었습니다.',
        data: savedDescriptions,
        count: Object.keys(descriptions).length,
      });
    }

    // 단일 설명 저장
    const { accountId, description } = body;

    if (!accountId || description === undefined) {
      return NextResponse.json(
        { success: false, error: 'accountId와 description이 필요합니다.' },
        { status: 400 }
      );
    }

    const savedDescriptions = await saveDescription(accountId, description);

    return NextResponse.json({
      success: true,
      message: '설명이 저장되었습니다.',
      data: savedDescriptions,
    });

  } catch (error) {
    console.error('인사이트 저장 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: '저장에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}


