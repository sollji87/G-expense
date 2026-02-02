import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/snowflake';

interface HeadcountData {
  YYYYMM: string;
  DEPT_NM: string;
  CCTR_CD: string;
  CCTR_NM: string;
  HEADCOUNT: number;
}

// 부문(담당) 매핑 - 코스트센터 코드 기준
const divisionMapping: { [cctrPrefix: string]: string } = {
  'F000': '경영지원담당',
  'F001': '경영지원담당',
  'F002': '경영지원담당',
  'F003': '경영기획담당',
  'F004': '경영기획담당',
  'F005': '마케팅본부담당',
  'F006': '경영지원담당',
  'F007': '경영지원담당',
  'F008': '경영지원담당',
  'F009': '경영지원담당',
  'F012': '경영지원담당',
  'F013': '법무담당',
  'F018': '경영지원담당',
  'F019': 'HR/총무담당',
  'F023': '경영지원담당',
  'F024': '경영지원담당',
  'F025': '경영지원담당',
  'F026': '경영지원담당',
  'F027': '해외사업담당',
  'F029': '해외사업담당',
  'F030': '해외사업담당',
  'F032': 'Process담당',
  'F033': '경영기획담당',
  'F034': '경영기획담당',
  'F036': '경영기획담당',
  'F037': '경영지원담당',
  'F038': '경영기획담당',
  'F039': '해외사업담당',
  'F040': '경영기획담당',
  'F043': '디지털본부담당',
  'F044': '디지털본부담당',
  'F045': '디지털본부담당',
  'F048': 'IT담당',
  'F049': 'IT담당',
  'F051': '마케팅본부담당',
  'F052': '소비자전략팀',
};

// 특정 코스트센터명 -> 부문 매핑
const cctrNameToDivision: { [name: string]: string } = {
  '경영관리팀': '경영지원담당',
  '회계팀': '경영지원담당',
  '자금팀': '경영지원담당',
  '경영기획팀': '경영기획담당',
  '무역팀': '경영기획담당',
  '공간기획팀': '경영기획담당',
  '통합인테리어팀': '경영기획담당',
  '법무팀': '법무담당',
  '경영개선팀': '경영개선팀',
  'HR팀': 'HR/총무담당',
  '총무팀': 'HR/총무담당',
  '안전보건팀': 'HR/총무담당',
  '비서팀': 'HR/총무담당',
  'Commercial팀': '해외사업담당',
  'Operation팀': '해외사업담당',
  '글로벌마케팅팀': '해외사업담당',
  '해외사업담당': '해외사업담당',
  '신사업팀': '해외사업담당',
  'Branch팀': '해외사업담당',
  'Distributor팀': '해외사업담당',
  'e-BIZ팀': '디지털본부담당',
  '통합온라인채널팀': '디지털본부담당',
  '퍼포먼스마케팅팀': '디지털본부담당',
  '정보보안팀': '디지털본부담당',
  'MLB마케팅팀': '마케팅본부담당',
  'MK마케팅팀': '마케팅본부담당',
  'DX마케팅팀': '마케팅본부담당',
  'DV/ST마케팅팀': '마케팅본부담당',
  '인플루언서마케팅팀': '마케팅본부담당',
  '온라인마케팅팀': '마케팅본부담당',
  '소비자전략팀': '소비자전략팀',
  '자산관리담당': '자산관리담당',
};

function getDivision(cctrCd: string, cctrNm: string): string {
  // 먼저 코스트센터명으로 매핑 시도
  if (cctrNm && cctrNameToDivision[cctrNm]) {
    return cctrNameToDivision[cctrNm];
  }
  
  // 코스트센터 코드 prefix로 매핑 시도
  const prefix = cctrCd.substring(0, 4);
  if (divisionMapping[prefix]) {
    return divisionMapping[prefix];
  }
  
  // 기본값
  return '기타';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || '2025';
    
    const sql = `
      /* =========================================================
         급여 기준(매월 18일) 공통부서 월별 인원수
         ========================================================= */
      WITH pay_cal AS (
          SELECT
                TO_CHAR(DATEADD(month, seq4(), TO_DATE('2024-01-18')), 'YYYYMM') AS yyyymm
              , DATEADD(month, seq4(), TO_DATE('2024-01-18'))                    AS std_date
          FROM TABLE(GENERATOR(ROWCOUNT => 24))
      ),

      base_emp AS (
          SELECT
                a.emp_no
              , a.ent_date
              , a.retire_date
          FROM comm.mst_emp a
          WHERE 1=1
            AND a.emp_type = 'A01'
            AND a.corp_cd  = 'A'
      ),

      active_base AS (
          SELECT
                p.yyyymm
              , p.std_date
              , e.emp_no
          FROM pay_cal p
          JOIN base_emp e
            ON e.ent_date <= p.std_date
           AND COALESCE(e.retire_date, DATE '9999-12-31') >= p.std_date
      ),

      loa AS (
          SELECT emp_no, order_date, order_date_to
          FROM fnf.hr_order
          WHERE order_type = 'LOA'
            AND COALESCE(apply_yn, 'Y') = 'Y'
      ),

      asof_dept AS (
          SELECT
                a.yyyymm
              , a.std_date
              , a.emp_no
              , h.order_code AS dept_code
          FROM active_base a
          LEFT JOIN fnf.hr_order h
            ON h.emp_no = a.emp_no
           AND h.order_type = 'DEPT'
           AND COALESCE(h.apply_yn, 'Y') = 'Y'
           AND h.order_date <= a.std_date
           AND h.order_code IS NOT NULL
          QUALIFY ROW_NUMBER() OVER (
              PARTITION BY a.yyyymm, a.emp_no
              ORDER BY h.order_date DESC, h.input_date DESC
          ) = 1
      ),

      active_emp AS (
          SELECT
                d.yyyymm
              , d.emp_no
              , d.dept_code
          FROM asof_dept d
          LEFT JOIN loa l
            ON d.emp_no = l.emp_no
           AND d.std_date BETWEEN l.order_date AND l.order_date_to
          WHERE l.emp_no IS NULL
      ),

      dept_cctr_map AS (
          SELECT * FROM VALUES
              ('10001','F02300'),('10002','F00300'),('10003','F03600'),('10004','F03400'),
              ('10005','F03400'),('10007','F03800'),('10008','F03700'),('10009','F04000'),
              ('10010','F04200'),('10011','F04200'),('10012','F04200'),('10013','F04200'),
              ('10014','F04300'),('10015','F04400'),('10016','F04500'),('10017','F04800'),
              ('10018','F04800'),('10019','F04800'),('10020','F04800'),('10021','F04800'),
              ('10022','F04900'),('10023','F04900'),('10024','F04800'),('10025','F04800'),
              ('10026','F00500'),('20001','F02700'),('20002','F02900'),('20003','F03000'),
              ('20004','F03000'),('20005','F03200'),('20006','F03900'),('20007','F02900'),
              ('20008','F03000'),('20009','F03000'),('20012','F05200'),('31005','F00000'),
              ('31010','F00100'),('31012','F00200'),('31014','F02400'),('31015','F00300'),
              ('31016','F00400'),('31017','F00500'),('31018','F00600'),('31020','F00700'),
              ('31021','F00400'),('31022','F02300'),('31023','F01900'),('31025','F01300'),
              ('31036','F03300'),('31037','FO0000'),('31043','F01200'),('31050','F01800'),
              ('31067','F00700'),('31068','F00800'),('31071','F02500'),('32010','F00900'),
              ('32300','F01200'),('32400','F01300'),('32500','F01900'),('32600','F01300'),
              ('32700','F01300'),('32800','F01300'),('32810','F02600'),('32900','F01300'),
              ('32910','F01300'),('34003','FM0100'),('34005','FM0000'),('34006','FM0700'),
              ('34007','FM0700'),('34008','FM0100'),('34009','FM0200'),('34010','FM0300'),
              ('34012','FM0700'),('34013','FM0700'),('34014','FM0600'),('34015','FM0500'),
              ('34016','FM0700'),('34017','FM0700'),('34018','FM0700'),('34021','FM0600'),
              ('34024','FM0600'),('34025','FM0700'),('34029','FM0800'),('34030','FM1400'),
              ('34031','FM0600'),('34032','FM0900'),('34038','FM0900'),('34039','FM1600'),
              ('34042','FM0900'),('34043','FM1500'),('34046','FM1000'),('34047','FM1700'),
              ('34049','FM1200'),('34050','F01200'),('34205','FI0000'),('34208','FI0100'),
              ('34210','FI0300'),('34215','FI0400'),('34224','FI0500'),('34225','FI0600'),
              ('34226','FI0500'),('34228','FI2000'),('34238','FI0700'),('34245','FI0800'),
              ('34246','FI0800'),('34249','FI1000'),('39310','FO0100'),('39720','FO0000'),
              ('3ST01','FT0400'),('3ST02','FT0400'),('3ST03','FT0200'),('3ST08','FT0600'),
              ('3ST10','FT0700'),('3ST11','FT0901'),('40002','FM1100'),('40003','FM0600'),
              ('40004','FM0300'),('40005','FM0300'),('40006','FM0800'),('40007','FM0800'),
              ('40008','FM0800'),('40009','FM0500'),('40014','FM0100'),('40015','FM0200'),
              ('40016','FM1400'),('40018','FM0600'),('40019','FM1000'),('40020','FM1700'),
              ('40021','FM1100'),('40022','FM1200'),('40024','FM2300'),('40025','FM1000'),
              ('40026','FM1700'),('40028','FM2400'),('41020','FM0700'),('41030','FM0700'),
              ('41040','FM0700'),('41041','FM0700'),('41042','FM0700'),('42010','R00000'),
              ('42011','FI0100'),('42012','FI1000'),('43012','FI2000'),('43013','FI0600'),
              ('43014','FI0600'),('43015','FI0600'),('43016','FI0600'),('43017','FI0600'),
              ('44010','R00200'),('46010','R00300'),('47010','R00100'),('51005','J00000'),
              ('51030','J00100'),('51050','J00200'),('53005','FX0100'),('53007','FX0000'),
              ('53008','FX0100'),('53009','FX0200'),('53010','FX0300'),('53011','FX1700'),
              ('53012','FX1800'),('53013','FX1500'),('53014','FX2100'),('53015','FX0400'),
              ('53016','FX1600'),('53024','FX0500'),('53025','FX0600'),('53031','FX2100'),
              ('53032','FX0800'),('53038','FX1500'),('53039','FX1600'),('53041','FX1000'),
              ('53042','FX1100'),('53046','FX1200'),('53047','FX1300'),('53049','FX1400'),
              ('55007','FA0000'),('55015','FA0200'),('55025','FA0300'),('55026','FA0600'),
              ('55028','FA0600'),('55035','FA0400'),('55041','FA0800'),('55042','FA0900'),
              ('55045','FA0500'),('55051','FA0700'),('56110','FM0700'),('56120','FM0800'),
              ('56210','FI0600'),('56310','FX0600'),('56311','FX0600'),('56312','FX0500'),
              ('56313','FX2100'),('56320','FX2100'),('56330','FX0800'),('61010','L00000'),
              ('62010','L00100'),('63007','FV0000'),('63010','FV0600'),('63025','FV1100'),
              ('63030','FV0200'),('63042','FV0700'),('63060','FV0900'),('64007','FW0000'),
              ('64010','FW0200'),('64015','FW0100'),('65017','FW0300'),('DO001','FX1200'),
              ('DO002','FX1300'),('DO003','FX1400'),('DO004','FX1500'),('DO005','FX2300'),
              ('DO006','FX1000'),('DO007','FX1100'),('DO008','FX0200'),('DO009','FX2400'),
              ('DP001','FX0500'),('DP002','FX2600'),('DP003','FX2800'),('DP004','FX2700'),
              ('DU001','FV0700'),('DU002','FV0900'),('DU003','FV1200'),('DU004','FV1100'),
              ('DU005','FV1100'),('DU006','FV1100'),('MK001','F05100'),('MK002','F05100'),
              ('MK003','F05100'),('MK004','F05100'),('MK005','F05100'),('MK006','F05100'),
              ('MK007','F05100'),('ST001','FT1100'),('ST002','FT0901'),('ST003','FT1000'),
              ('ST004','FT1400'),('SU001','FW0600'),('SU002','FW0600'),('SU003','FW0700'),
              ('SU004','FW0800')
          AS t(dept_code, cctr_cd)
      ),

      mapped AS (
          SELECT
                a.yyyymm
              , a.emp_no
              , a.dept_code
              , m.cctr_cd
          FROM active_emp a
          JOIN dept_cctr_map m
            ON a.dept_code = m.dept_code
          WHERE m.cctr_cd LIKE 'F0%'
      )

      SELECT
            x.yyyymm
          , d.dept_name AS dept_nm
          , x.cctr_cd
          , c.cctr_nm
          , COUNT(DISTINCT x.emp_no) AS headcount
      FROM mapped x
      LEFT JOIN fnf.hr_dept d
        ON x.dept_code = d.dept_code
      LEFT JOIN sap_fnf.mst_cctr c
        ON x.cctr_cd = c.cctr_cd
       AND c.corp_cd = '1000'
      GROUP BY
            x.yyyymm, d.dept_name, x.cctr_cd, c.cctr_nm
      ORDER BY
            x.yyyymm ASC, x.cctr_cd, d.dept_name
    `;
    
    const rows = await executeQuery<HeadcountData>(sql);
    
    // 월별로 데이터 정리
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    
    // 부서명 병합 매핑
    const deptNameMerge: { [key: string]: string } = {
      '신사업팀': 'Operation팀',
      'Branch팀': 'Operation팀',
      'Distributor팀': 'Commercial팀',
      '직원서비스안전담당': '총무팀',
      '통합인플루언서마케팅팀': '인플루언서마케팅팀',
      '통합마케팅담당': 'DV/ST마케팅팀',
      '통합마케팅팀': 'DV/ST마케팅팀',
      '성장브랜드마케팅팀담당': 'DV/ST마케팅팀',
      '성장브랜드마케팅팀': 'DV/ST마케팅팀',
      '성장브랜드마케팅담당': 'DV/ST마케팅팀',
      '사업운영지원담당': '임원',
    };

    // 부서명 기준으로 데이터 집계 (코스트센터가 아닌 부서명 기준)
    const deptMap = new Map<string, {
      deptNm: string;
      monthly: { [key: string]: number };
    }>();
    
    rows.forEach((row) => {
      let deptNm = row.DEPT_NM || row.CCTR_NM || '미분류';
      // 부서명 병합 적용
      if (deptNameMerge[deptNm]) {
        deptNm = deptNameMerge[deptNm];
      }
      const yyyymm = row.YYYYMM;
      
      if (!deptMap.has(deptNm)) {
        deptMap.set(deptNm, {
          deptNm,
          monthly: {},
        });
      }
      
      const entry = deptMap.get(deptNm)!;
      entry.monthly[yyyymm] = (entry.monthly[yyyymm] || 0) + row.HEADCOUNT;
    });
    
    // 부문별로 그룹화
    const divisionMap = new Map<string, {
      divisionName: string;
      teams: { deptNm: string; monthly: { [key: string]: number } }[];
      subDivisions: { name: string; teams: { deptNm: string; monthly: { [key: string]: number } }[]; monthly: { [key: string]: number } }[];
      monthly: { [key: string]: number };
    }>();
    
    // 부문 순서 정의
    const divisionOrder = [
      '임원',
      '경영지원담당',
      '경영기획담당',
      '법무담당',
      '경영개선팀',
      'HR/총무담당',
      '해외사업담당',
      '디지털본부담당',
      '마케팅본부담당',
      '소비자전략팀',
      '자산관리담당',
      '통합소싱팀',
      '통합영업팀',
      '글로벌슈즈팀',
      '기타',
    ];
    
    deptMap.forEach((dept) => {
      // 부서명에서 부문 결정
      let division = '기타';
      
      // 부서명 기반 매핑
      if (dept.deptNm.includes('임원') || dept.deptNm === '임원') {
        division = '임원';
      } else if (dept.deptNm.includes('경영관리') || dept.deptNm.includes('회계') || dept.deptNm.includes('자금')) {
        division = '경영지원담당';
      } else if (dept.deptNm.includes('경영기획') || dept.deptNm.includes('무역') || dept.deptNm.includes('공간기획') || dept.deptNm.includes('인테리어') || dept.deptNm.includes('운영전략')) {
        division = '경영기획담당';
      } else if (dept.deptNm.includes('법무')) {
        division = '법무담당';
      } else if (dept.deptNm.includes('경영개선')) {
        division = '경영개선팀';
      } else if (dept.deptNm.includes('HR') || dept.deptNm.includes('총무') || dept.deptNm.includes('안전보건') || dept.deptNm.includes('비서')) {
        division = 'HR/총무담당';
      } else if (dept.deptNm.includes('Commercial') || dept.deptNm.includes('Operation') || dept.deptNm.includes('글로벌마케팅') || dept.deptNm.includes('해외') || dept.deptNm.includes('신사업') || dept.deptNm.includes('Branch') || dept.deptNm.includes('Distributor')) {
        division = '해외사업담당';
      } else if (
        dept.deptNm.includes('e-BIZ') || 
        dept.deptNm.includes('온라인채널') || 
        dept.deptNm.includes('퍼포먼스마케팅') || 
        dept.deptNm.includes('정보보안') || 
        dept.deptNm.includes('디지털') || 
        dept.deptNm.includes('IT') || 
        dept.deptNm.includes('시스템') || 
        dept.deptNm.includes('Process') || 
        dept.deptNm.includes('프로세스') ||
        dept.deptNm.includes('Enterprise') ||
        dept.deptNm.includes('Web Platform') ||
        dept.deptNm.includes('PI팀') ||
        dept.deptNm.includes('AX') ||
        dept.deptNm.includes('AI Engineering') ||
        dept.deptNm.includes('데이터기획') ||
        dept.deptNm.includes('데이터엔지니어링') ||
        dept.deptNm.includes('데이터팀')
      ) {
        division = '디지털본부담당';
      } else if (dept.deptNm.includes('마케팅') && !dept.deptNm.includes('글로벌') && !dept.deptNm.includes('퍼포먼스')) {
        division = '마케팅본부담당';
      } else if (dept.deptNm.includes('소비자전략')) {
        division = '소비자전략팀';
      } else if (dept.deptNm.includes('자산관리')) {
        division = '자산관리담당';
      } else if (dept.deptNm.includes('통합소싱')) {
        division = '통합소싱팀';
      } else if (dept.deptNm.includes('통합영업')) {
        division = '통합영업팀';
      } else if (dept.deptNm.includes('글로벌슈즈')) {
        division = '글로벌슈즈팀';
      }
      
      if (!divisionMap.has(division)) {
        divisionMap.set(division, {
          divisionName: division,
          teams: [],
          subDivisions: [],
          monthly: {},
        });
      }
      
      const divEntry = divisionMap.get(division)!;
      divEntry.teams.push({
        deptNm: dept.deptNm,
        monthly: dept.monthly,
      });
      
      // 부문 월별 합계
      Object.entries(dept.monthly).forEach(([yyyymm, count]) => {
        divEntry.monthly[yyyymm] = (divEntry.monthly[yyyymm] || 0) + count;
      });
    });
    
    // 연도별 월별 전체 합계 계산
    const yearlyTotals: { [key: string]: { [month: string]: number } } = {
      '2024': {},
      '2025': {},
    };
    
    rows.forEach((row) => {
      const yearMonth = row.YYYYMM;
      const rowYear = yearMonth.substring(0, 4);
      const month = yearMonth.substring(4, 6);
      
      if (!yearlyTotals[rowYear][month]) {
        yearlyTotals[rowYear][month] = 0;
      }
      yearlyTotals[rowYear][month] += row.HEADCOUNT;
    });
    
    // 정렬된 부문 배열 생성
    const divisions = divisionOrder
      .filter(div => divisionMap.has(div))
      .map(div => {
        const entry = divisionMap.get(div)!;
        let sortedTeams = entry.teams.sort((a, b) => a.deptNm.localeCompare(b.deptNm));
        
        // HR/총무담당인 경우 특별 처리
        if (div === 'HR/총무담당') {
          const hrDamdangIdx = sortedTeams.findIndex(t => t.deptNm === 'HR총무담당');
          const hrTeam = sortedTeams.find(t => t.deptNm === 'HR팀');
          
          if (hrDamdangIdx >= 0 && hrTeam) {
            // HR총무담당이 존재하는 경우
            const hrDamdang = sortedTeams[hrDamdangIdx];
            
            // 모든 월을 체크해서 빈 월에 1 채우고 HR팀에서 1 빼기
            const allMonths = ['202401', '202402', '202403', '202404', '202405', '202406', 
                              '202407', '202408', '202409', '202410', '202411', '202412',
                              '202501', '202502', '202503', '202504', '202505', '202506',
                              '202507', '202508', '202509', '202510', '202511', '202512'];
            
            allMonths.forEach(yyyymm => {
              if (!hrDamdang.monthly[yyyymm] || hrDamdang.monthly[yyyymm] === 0) {
                if (hrTeam.monthly[yyyymm] && hrTeam.monthly[yyyymm] > 0) {
                  hrDamdang.monthly[yyyymm] = 1;
                  hrTeam.monthly[yyyymm] = hrTeam.monthly[yyyymm] - 1;
                }
              }
            });
            
            // HR총무담당을 맨 위로
            sortedTeams = [hrDamdang, ...sortedTeams.filter((_, i) => i !== hrDamdangIdx)];
          } else if (!hrDamdangIdx || hrDamdangIdx < 0) {
            // HR총무담당이 없는 경우 생성하고 HR팀에서 1명 이동
            if (hrTeam) {
              const hrDamdangMonthly: { [key: string]: number } = {};
              Object.keys(hrTeam.monthly).forEach(yyyymm => {
                if (hrTeam.monthly[yyyymm] > 0) {
                  hrDamdangMonthly[yyyymm] = 1;
                  hrTeam.monthly[yyyymm] = Math.max(0, hrTeam.monthly[yyyymm] - 1);
                }
              });
              sortedTeams = [{ deptNm: 'HR총무담당', monthly: hrDamdangMonthly }, ...sortedTeams];
            }
          }
        }
        
        // 해외사업담당인 경우 특별 처리
        if (div === '해외사업담당') {
          // 해외사업담당 팀을 맨 위로
          const damdangIdx = sortedTeams.findIndex(t => t.deptNm === '해외사업담당');
          if (damdangIdx >= 0) {
            const damdang = sortedTeams[damdangIdx];
            sortedTeams = [damdang, ...sortedTeams.filter((_, i) => i !== damdangIdx)];
          }
        }
        
        // 디지털본부담당인 경우 특별 처리 - IT담당, Process담당을 subDivisions로
        if (div === '디지털본부담당') {
          const itTeams: typeof sortedTeams = [];
          const processTeams: typeof sortedTeams = [];
          const directTeams: typeof sortedTeams = [];
          
          sortedTeams.forEach(team => {
            if (
              team.deptNm.includes('IT') || 
              team.deptNm.includes('시스템') ||
              team.deptNm.includes('Enterprise Architecture') ||
              team.deptNm.includes('Enterprise Solution') ||
              team.deptNm.includes('Web Platform')
            ) {
              itTeams.push(team);
            } else if (
              team.deptNm.includes('Process') || 
              team.deptNm.includes('프로세스') ||
              team.deptNm.includes('디지털전략') ||
              team.deptNm.includes('데이터기획') ||
              team.deptNm.includes('AI Engineering') ||
              team.deptNm.includes('AX') ||
              team.deptNm === 'PI팀' ||
              team.deptNm.includes('데이터엔지니어링') ||
              team.deptNm === '데이터팀'
            ) {
              processTeams.push(team);
            } else {
              directTeams.push(team);
            }
          });
          
          // 현재 연도 기준 총 인원수 계산 함수
          const getTotalHeadcount = (team: { monthly: { [key: string]: number } }) => {
            // 가장 최근 월의 인원수 사용
            const months2025 = ['202512', '202511', '202510', '202509', '202508', '202507', '202506', '202505', '202504', '202503', '202502', '202501'];
            for (const m of months2025) {
              if (team.monthly[m] && team.monthly[m] > 0) {
                return team.monthly[m];
              }
            }
            return 0;
          };
          
          // IT담당 정렬: IT담당을 맨 위로, 나머지는 인원수 내림차순
          const itDamdangIdx = itTeams.findIndex(t => t.deptNm === 'IT담당');
          let sortedItTeams = [...itTeams];
          if (itDamdangIdx >= 0) {
            const itDamdang = sortedItTeams[itDamdangIdx];
            sortedItTeams = sortedItTeams.filter((_, i) => i !== itDamdangIdx);
            sortedItTeams.sort((a, b) => getTotalHeadcount(b) - getTotalHeadcount(a));
            sortedItTeams = [itDamdang, ...sortedItTeams];
          } else {
            sortedItTeams.sort((a, b) => getTotalHeadcount(b) - getTotalHeadcount(a));
          }
          
          // Process담당 정렬: Process담당을 맨 위로, 나머지는 인원수 내림차순
          const processDamdangIdx = processTeams.findIndex(t => t.deptNm === 'Process담당');
          let sortedProcessTeams = [...processTeams];
          if (processDamdangIdx >= 0) {
            const processDamdang = sortedProcessTeams[processDamdangIdx];
            sortedProcessTeams = sortedProcessTeams.filter((_, i) => i !== processDamdangIdx);
            sortedProcessTeams.sort((a, b) => getTotalHeadcount(b) - getTotalHeadcount(a));
            sortedProcessTeams = [processDamdang, ...sortedProcessTeams];
          } else {
            sortedProcessTeams.sort((a, b) => getTotalHeadcount(b) - getTotalHeadcount(a));
          }
          
          // IT담당 월별 합계
          const itMonthly: { [key: string]: number } = {};
          itTeams.forEach(t => {
            Object.entries(t.monthly).forEach(([yyyymm, count]) => {
              itMonthly[yyyymm] = (itMonthly[yyyymm] || 0) + count;
            });
          });
          
          // Process담당 월별 합계
          const processMonthly: { [key: string]: number } = {};
          processTeams.forEach(t => {
            Object.entries(t.monthly).forEach(([yyyymm, count]) => {
              processMonthly[yyyymm] = (processMonthly[yyyymm] || 0) + count;
            });
          });
          
          // 디지털본부담당 팀을 맨 앞으로
          const damdangIdx = directTeams.findIndex(t => t.deptNm === '디지털본부담당');
          if (damdangIdx >= 0) {
            const damdang = directTeams[damdangIdx];
            directTeams.splice(damdangIdx, 1);
            directTeams.unshift(damdang);
          }
          
          entry.subDivisions = [];
          if (sortedItTeams.length > 0) {
            entry.subDivisions.push({
              name: 'IT담당',
              teams: sortedItTeams,
              monthly: itMonthly,
            });
          }
          if (sortedProcessTeams.length > 0) {
            entry.subDivisions.push({
              name: 'Process담당',
              teams: sortedProcessTeams,
              monthly: processMonthly,
            });
          }
          
          sortedTeams = directTeams;
        }
        
        return {
          ...entry,
          teams: sortedTeams,
        };
      });
    
    return NextResponse.json({
      success: true,
      year,
      months,
      divisions,
      yearlyTotals,
    });
    
  } catch (error) {
    console.error('인건비 API 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '인원수 데이터를 불러오는데 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
