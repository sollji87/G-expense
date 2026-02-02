import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/snowflake';

interface AllocationData {
  PST_YYYYMM: string;
  BRD_NM: string;
  TTL_USE_AMT: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || '12';
    const mode = searchParams.get('mode') || 'monthly'; // monthly or ytd
    
    const monthNum = parseInt(month);
    
    let sql: string;
    
    if (mode === 'ytd') {
      // YTD 모드: 1월부터 선택 월까지 누적
      const currentYearMonths = Array.from({ length: monthNum }, (_, i) => 
        `'2025${(i + 1).toString().padStart(2, '0')}'`
      ).join(',');
      const previousYearMonths = Array.from({ length: monthNum }, (_, i) => 
        `'2024${(i + 1).toString().padStart(2, '0')}'`
      ).join(',');
      
      sql = `
        SELECT 
          CASE 
            WHEN SUBSTR(PST_YYYYMM, 1, 4) = '2025' THEN '2025YTD'
            ELSE '2024YTD'
          END AS PST_YYYYMM,
          BRD_NM,
          SUM("TTL_USE_AMT") AS TTL_USE_AMT
        FROM FNF.SAP_FNF.DM_IDCST_CCTR_M
        WHERE (PST_YYYYMM IN (${currentYearMonths}) OR PST_YYYYMM IN (${previousYearMonths}))
          AND CORP_CD = '1000'
          AND CTGR1 = '공통비'
        GROUP BY
          CASE 
            WHEN SUBSTR(PST_YYYYMM, 1, 4) = '2025' THEN '2025YTD'
            ELSE '2024YTD'
          END,
          BRD_NM
        ORDER BY
          PST_YYYYMM, BRD_NM ASC
      `;
    } else {
      // Monthly 모드: 선택 월만
      const currentYearMonth = `2025${month.padStart(2, '0')}`;
      const previousYearMonth = `2024${month.padStart(2, '0')}`;
      
      sql = `
        SELECT 
          PST_YYYYMM,
          BRD_NM,
          SUM("TTL_USE_AMT") AS TTL_USE_AMT
        FROM FNF.SAP_FNF.DM_IDCST_CCTR_M
        WHERE PST_YYYYMM IN ('${currentYearMonth}', '${previousYearMonth}')
          AND CORP_CD = '1000'
          AND CTGR1 = '공통비'
        GROUP BY
          PST_YYYYMM, BRD_NM
        ORDER BY
          PST_YYYYMM, BRD_NM ASC
      `;
    }
    
    const rows = await executeQuery<AllocationData>(sql);
    
    // 브랜드별 데이터 정리
    const brandMap = new Map<string, { current: number; previous: number }>();
    
    const currentKey = mode === 'ytd' ? '2025YTD' : `2025${month.padStart(2, '0')}`;
    const previousKey = mode === 'ytd' ? '2024YTD' : `2024${month.padStart(2, '0')}`;
    
    rows.forEach((row) => {
      const brandName = row.BRD_NM || '미분류';
      const amount = row.TTL_USE_AMT || 0;
      const yearMonth = row.PST_YYYYMM;
      
      if (!brandMap.has(brandName)) {
        brandMap.set(brandName, { current: 0, previous: 0 });
      }
      
      const brand = brandMap.get(brandName)!;
      if (yearMonth === currentKey) {
        brand.current += amount;
      } else if (yearMonth === previousKey) {
        brand.previous += amount;
      }
    });
    
    // 총합 계산
    let totalCurrent = 0;
    let totalPrevious = 0;
    
    brandMap.forEach((data) => {
      totalCurrent += data.current;
      totalPrevious += data.previous;
    });
    
    // 브랜드 순서 정의
    const brandOrder = ['MLB', 'MLB KIDS', 'DISCOVERY', 'DUVETICA', 'SERGIO TACCHINI', 'SUPRA', 'STRETCH ANGELS'];
    
    // 결과 배열 생성 (백만원 단위로 변환)
    const brands = Array.from(brandMap.entries())
      .map(([name, data]) => ({
        name,
        current: Math.round(data.current / 1_000_000), // 백만원 단위
        previous: Math.round(data.previous / 1_000_000),
        change: Math.round((data.current - data.previous) / 1_000_000),
        currentRatio: totalCurrent > 0 ? (data.current / totalCurrent) * 100 : 0,
        previousRatio: totalPrevious > 0 ? (data.previous / totalPrevious) * 100 : 0,
        changePercent: data.previous > 0 ? ((data.current / data.previous) * 100) : 0,
      }))
      .filter(b => brandOrder.includes(b.name)) // 지정된 브랜드만 포함
      .sort((a, b) => brandOrder.indexOf(a.name) - brandOrder.indexOf(b.name)); // 지정된 순서로 정렬
    
    return NextResponse.json({
      success: true,
      month,
      mode,
      currentYear: '2025',
      previousYear: '2024',
      total: {
        current: Math.round(totalCurrent / 1_000_000),
        previous: Math.round(totalPrevious / 1_000_000),
        change: Math.round((totalCurrent - totalPrevious) / 1_000_000),
        changePercent: totalPrevious > 0 ? ((totalCurrent / totalPrevious) * 100) : 0,
      },
      brands,
    });
    
  } catch (error) {
    console.error('사업부 배부 API 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '사업부 배부 데이터를 불러오는데 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
