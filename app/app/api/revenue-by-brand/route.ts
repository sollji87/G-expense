import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/snowflake';

interface BrandRevenue {
  YYMM: string;
  BRD_CD: string;
  ACT_SALE_AMT_MIL: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearMonth = searchParams.get('yearMonth') || '202512';
    
    // 브랜드별 월별 실판매출액 조회 (수출채널 9 제외)
    const sql = `
      SELECT
        a.pst_yyyymm AS yymm,
        a.brd_cd,
        ROUND(SUM(a.act_sale_amt) / 1000000, 0) AS act_sale_amt_mil
      FROM FNF.SAP_FNF.DM_PL_SHOP_PRDT_M a
      JOIN FNF.SAP_FNF.MST_SHOP b
        ON a.brd_cd = b.brd_cd
       AND a.shop_cd = b.sap_shop_cd
      WHERE 1 = 1
        AND a.corp_cd = '1000'
        AND a.pst_yyyymm = '${yearMonth}'
        AND TRY_TO_NUMBER(a.chnl_cd) <> 9
      GROUP BY
        a.pst_yyyymm,
        a.brd_cd
      ORDER BY
        act_sale_amt_mil DESC
    `;

    const rows = await executeQuery<BrandRevenue>(sql);
    
    // 브랜드별 총합 (이미 백만원 단위)
    const brandArray = rows
      .map(row => ({
        code: row.BRD_CD,
        name: row.BRD_CD,
        total: row.ACT_SALE_AMT_MIL || 0
      }))
      .sort((a, b) => b.total - a.total);
    
    // 전체 합계 계산
    const grandTotal = brandArray.reduce((sum, brand) => sum + brand.total, 0);
    
    return NextResponse.json({
      success: true,
      data: {
        yearMonth,
        brands: brandArray,
        summary: {
          total: grandTotal,
          totalExclVAT: grandTotal / 1.1 // 부가세 제외
        }
      }
    });
    
  } catch (error) {
    console.error('브랜드별 매출 조회 실패:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '브랜드별 매출 데이터를 불러오는데 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
