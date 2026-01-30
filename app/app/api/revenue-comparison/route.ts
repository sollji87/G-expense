import { NextResponse } from 'next/server';
import { getMonthlyRevenue, getYTDRevenue } from '@/lib/snowflake';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const currentMonth = searchParams.get('currentMonth') || '202512';
    const previousMonth = searchParams.get('previousMonth') || '202412';
    const mode = searchParams.get('mode') || 'monthly'; // 'monthly' 또는 'ytd'
    
    console.log(`📊 매출 데이터 조회: 모드=${mode}, 당월=${currentMonth}, 전년=${previousMonth}`);
    
    // 스노우플레이크에서 직접 매출 데이터 조회
    let currentTotal: number;
    let previousTotal: number;
    
    if (mode === 'ytd') {
      // YTD 모드: 1월부터 선택한 월까지 누적 매출
      [currentTotal, previousTotal] = await Promise.all([
        getYTDRevenue(currentMonth, true),
        getYTDRevenue(previousMonth, true)
      ]);
      console.log(`✅ YTD 누적 매출 조회 완료: 당년=${currentTotal.toFixed(0)}백만원, 전년=${previousTotal.toFixed(0)}백만원`);
    } else {
      // 월별 모드: 해당 월만
      [currentTotal, previousTotal] = await Promise.all([
        getMonthlyRevenue(currentMonth, true),
        getMonthlyRevenue(previousMonth, true)
      ]);
      console.log(`✅ 매출 조회 완료: 당월=${currentTotal.toFixed(0)}백만원, 전년=${previousTotal.toFixed(0)}백만원`);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        currentTotal,
        previousTotal,
        change: currentTotal - previousTotal,
        changePercent: previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0
      }
    });
    
  } catch (error) {
    console.error('❌ 매출 비교 API 오류:', error);
    
    // 스노우플레이크 연결 실패 시 null 반환 (UI에서 "데이터 연동 필요" 표시)
    return NextResponse.json({
      success: true,
      data: {
        currentTotal: null,
        previousTotal: null,
        error: error instanceof Error ? error.message : '스노우플레이크 연결 실패'
      }
    });
  }
}
