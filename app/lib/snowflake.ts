// 서버 사이드에서만 snowflake-sdk 로드
import snowflake from 'snowflake-sdk';

// 스노우플레이크 연결 설정
const connectionConfig = {
  account: process.env.SNOWFLAKE_ACCOUNT || '',
  username: process.env.SNOWFLAKE_USERNAME || '',
  password: process.env.SNOWFLAKE_PASSWORD || '',
  warehouse: process.env.SNOWFLAKE_WAREHOUSE || '',
  database: process.env.SNOWFLAKE_DATABASE || '',
  schema: process.env.SNOWFLAKE_SCHEMA || '',
  role: process.env.SNOWFLAKE_ROLE || '',
};

// 쿼리 실행 함수
export async function executeQuery<T = any>(sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const connection = snowflake.createConnection(connectionConfig);

    connection.connect((err, conn) => {
      if (err) {
        console.error('❌ 스노우플레이크 연결 실패:', err.message);
        reject(err);
        return;
      }

      console.log('✅ 스노우플레이크 연결 성공');

      conn.execute({
        sqlText: sql,
        complete: (err, stmt, rows) => {
          // 연결 종료
          conn.destroy((destroyErr) => {
            if (destroyErr) {
              console.error('연결 종료 실패:', destroyErr);
            }
          });

          if (err) {
            console.error('❌ 쿼리 실행 실패:', err.message);
            reject(err);
            return;
          }

          console.log(`✅ 쿼리 실행 완료: ${rows?.length || 0}건`);
          resolve(rows as T[]);
        },
      });
    });
  });
}

// 브랜드별 매출 상세 타입
interface BrandRevenue {
  YYMM: string;
  BRD_CD: string;
  ACT_SALE_AMT_MIL: number;
}

// 월별 매출 조회 함수 (브랜드별 상세 포함)
export async function getMonthlyRevenue(yearMonth: string, logDetails: boolean = false): Promise<number> {
  const year = yearMonth.substring(0, 4);
  const month = yearMonth.substring(4, 6);
  const startDate = `${year}-${month}-01`;
  const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0]; // 해당 월 마지막 날
  
  // 브랜드별 월별 실판매출액 조회 (수출채널 9 제외)
  const yyyymm = `${year}${month.padStart(2, '0')}`;
  const detailSql = `
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
      AND a.pst_yyyymm = '${yyyymm}'
      AND TRY_TO_NUMBER(a.chnl_cd) <> 9
    GROUP BY
      a.pst_yyyymm,
      a.brd_cd
    ORDER BY
      act_sale_amt_mil DESC
  `;

  try {
    const rows = await executeQuery<BrandRevenue>(detailSql);
    
    // 브랜드별 상세 로그 출력
    if (logDetails && rows.length > 0) {
      console.log(`\n📊 ${yearMonth} 브랜드별 매출 상세 (수출채널 9 제외):`);
      console.log('─'.repeat(50));
      
      // 브랜드별 총합 (이미 백만원 단위)
      const brandTotals = rows
        .map(row => ({
          code: row.BRD_CD,
          total: row.ACT_SALE_AMT_MIL || 0
        }))
        .sort((a, b) => b.total - a.total);
      
      console.log(`${'브랜드'.padEnd(25)} ${'매출액(백만원)'.padStart(15)}`);
      console.log('─'.repeat(50));
      
      let grandTotal = 0;
      brandTotals.forEach(brand => {
        console.log(
          `${brand.code.padEnd(25)} ${brand.total.toFixed(0).padStart(15)}`
        );
        grandTotal += brand.total;
      });
      
      console.log('─'.repeat(50));
      console.log(`${'합계'.padEnd(25)} ${grandTotal.toFixed(0).padStart(15)}`);
      console.log(`부가세 포함 매출: ${grandTotal.toFixed(0)}백만원`);
      console.log(`부가세 제외 매출: ${(grandTotal / 1.1).toFixed(0)}백만원 (공통비 비교용)`);
      console.log('');
    }
    
    // 총 매출 계산 (이미 백만원 단위로 반환됨)
    const totalSales = rows.reduce((sum, row) => sum + (row.ACT_SALE_AMT_MIL || 0), 0);
    
    return totalSales;
  } catch (error) {
    console.error('매출 조회 실패:', error);
    throw error;
  }
}

// YTD 누적 매출 조회 함수 (1월부터 선택한 월까지)
export async function getYTDRevenue(yearMonth: string, logDetails: boolean = false): Promise<number> {
  const year = yearMonth.substring(0, 4);
  const month = yearMonth.substring(4, 6);
  const toYyyymm = `${year}${month.padStart(2, '0')}`;
  const fromYyyymm = `${year}01`; // 해당 연도 1월부터
  
  // YTD 누적 매출 조회 (1월부터 선택한 월까지)
  const detailSql = `
    SELECT
      a.brd_cd,
      ROUND(SUM(a.act_sale_amt) / 1000000, 0) AS act_sale_amt_mil
    FROM FNF.SAP_FNF.DM_PL_SHOP_PRDT_M a
    JOIN FNF.SAP_FNF.MST_SHOP b
      ON a.brd_cd = b.brd_cd
     AND a.shop_cd = b.sap_shop_cd
    WHERE 1 = 1
      AND a.corp_cd = '1000'
      AND a.pst_yyyymm BETWEEN '${fromYyyymm}' AND '${toYyyymm}'
      AND TRY_TO_NUMBER(a.chnl_cd) <> 9
    GROUP BY
      a.brd_cd
    ORDER BY
      act_sale_amt_mil DESC
  `;

  try {
    const rows = await executeQuery<{ BRD_CD: string; ACT_SALE_AMT_MIL: number }>(detailSql);
    
    // 브랜드별 상세 로그 출력
    if (logDetails && rows.length > 0) {
      console.log(`\n📊 ${yearMonth} YTD 누적 매출 상세 (${fromYyyymm}~${toYyyymm}, 수출채널 9 제외):`);
      console.log('─'.repeat(50));
      
      const brandTotals = rows
        .map(row => ({
          code: row.BRD_CD,
          total: row.ACT_SALE_AMT_MIL || 0
        }))
        .sort((a, b) => b.total - a.total);
      
      console.log(`${'브랜드'.padEnd(25)} ${'누적매출(백만원)'.padStart(15)}`);
      console.log('─'.repeat(50));
      
      let grandTotal = 0;
      brandTotals.forEach(brand => {
        console.log(
          `${brand.code.padEnd(25)} ${brand.total.toFixed(0).padStart(15)}`
        );
        grandTotal += brand.total;
      });
      
      console.log('─'.repeat(50));
      console.log(`${'합계'.padEnd(25)} ${grandTotal.toFixed(0).padStart(15)}`);
      console.log(`부가세 포함 누적 매출: ${grandTotal.toFixed(0)}백만원`);
      console.log(`부가세 제외 누적 매출: ${(grandTotal / 1.1).toFixed(0)}백만원 (공통비 비교용)`);
      console.log('');
    }
    
    // 총 누적 매출 계산 (이미 백만원 단위로 반환됨)
    const totalSales = rows.reduce((sum, row) => sum + (row.ACT_SALE_AMT_MIL || 0), 0);
    
    return totalSales;
  } catch (error) {
    console.error('YTD 매출 조회 실패:', error);
    throw error;
  }
}

// 연결 테스트 함수
export async function testConnection(): Promise<boolean> {
  try {
    await executeQuery('SELECT 1 AS TEST');
    return true;
  } catch (error) {
    return false;
  }
}
