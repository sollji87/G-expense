공통부서비용 대시보드 – README
1) 목적/범위

목적: 공통부서비용 원장을 기준으로 월별·계정별 CSV 자동 분기 및 웹 대시보드(당년/전년/전년비/YOY%) 구현.

범위: MS365(Windows) 환경. 입력 엑셀의 B열=연월(YYYYMM/일자 포함 가능), 계정=GL_CD/GL_NM, 코스트센터=CCTR_CD/CCTR_NM 기준.

2) 디렉토리 구조
project/
  data/
    incoming/         # 사용자가 파일 투입(엑셀 .xlsx)
    processed/
      monthly/        # YYYYMM 단위 CSV (계정별 분기)
      agg/            # 집계 결과 (대시보드 사용)
  app/                # 웹 대시보드(Next.js/React)
  scripts/            # 파이썬 ETL 스크립트
  config/
    schema.yaml       # 컬럼 매핑/데이터 사전
  README.md

3) 입력 스펙 (엑셀)

파일: data/incoming/*.xlsx, 시트명 자유(최초 시트 사용).

필수 컬럼(예시):

PST_YYYYMM 또는 PST_DT(일자) → 연월 파생

GL_CD, GL_NM

CCTR_CD, CCTR_NM

AMT (원 단위 금액, 음수 허용)

인코딩/로케일: 파이썬 출력은 utf-8-sig(엑셀 한글 호환).

4) ETL 요건 (파이썬 스크립트)
4.1 실행
# 예시
python scripts/split_and_aggregate.py \
  --input "data/incoming/공통부서비용_원장.xlsx" \
  --outdir "data/processed" \
  --ym-col "PST_YYYYMM" \
  --encoding "utf-8-sig"

4.2 처리 로직

연월 정규화

PST_YYYYMM 또는 PST_DT → YYYYMM 파생(형식 혼재: 2025-01, 2025/01, 일자 포함값 모두 허용).

월별·계정별 분기 CSV 생성

경로: data/processed/monthly/{YYYYMM}/GL_{GL_CD}.csv

파일명 예: GL_53010101.csv

컬럼은 원본 유지 + YYYYMM 파생.

집계 파일 생성(대시보드용)

경로: data/processed/agg/summary.csv

그레인: YYYYMM, GL_CD, GL_NM, CCTR_CD, CCTR_NM

지표:

AMT 합계(원) → AMT_M(백만원) = AMT/1_000_000 반올림.

품질 로그

파싱 실패/결측: data/processed/invalid_rows.csv

중복 키(YYYYMM+GL_CD+CCTR_CD) 경고 카운트.

5) 지표 정의(대시보드)

기준 연도: UI에서 기준연도=당해 연도 선택. 예: 2025.

집계 레벨: 기본 GL_CD(계정) → 드릴다운 CCTR_CD(코스트센터).

지표

당년 금액(백만원) = SUM(AMT_M) where YYYY = 기준연도

전년 금액(백만원) = SUM(AMT_M) where YYYY = 기준연도-1

전년비 금액(백만원) = 당년 - 전년

YOY(%) = (당년 / 전년) * 100

전년=0인 경우: UI 표기 N/A 또는 분모 0 처리 로직 적용.

설명 포맷(계정 카드 상단)

당년 **{당년 금액} 백만원 -> 전년 **{전년 금액} 백만원 (전년비 {증감 금액} 백만원, YOY {yoy}%)

RAW 코멘트(LLM)

계정 카드를 열면 해당 GL의 원시 트랜잭션 샘플/변동 Top 항목 기반으로 AI 코멘트 자동 생성.

6) 대시보드 UI/UX 요건

스택 제안: Next.js + Tailwind + shadcn/ui + Recharts

상단 KPI(전체 합계): 당년, 전년, 전년비, YOY% 4칸 카드.

메인 테이블(계정 레벨):

컬럼: GL_CD, GL_NM, 당년(백만원), 전년(백만원), 전년비(백만원), YOY(%), 행동(드릴다운/자세히)

정렬: 전년비 또는 YOY% desc 기본.

드릴다운 패널(코스트센터 레벨):

선택한 GL 기준 CCTR별 동일 지표 노출 + 월별 트렌드 미니차트.

AI 코멘트 패널:

탭1: 자동 요약(핵심변동, 주요비용처, 이슈/리스크)

탭2: RAW 근거(Top 거래처/적요/문서번호 링크)

필터/토글:

연도(기준), 월 범위, 계정 검색, 코스트센터 검색.

포맷:

금액 백만원 단위 표시(천단위 구분, 소수 1자리 예: 1,234.5)

YOY %는 소수 1자리.

7) AI 코멘트 프롬프트(예시)

역할: FP&A 애널리스트
입력: 선택된 GL_CD/GL_NM, 기간(당년/전년), 집계 결과(당년/전년/전년비/YOY), 상위 원시 트랜잭션 Top N(금액 기준), 코스트센터 Top N.
지시:

핵심변동 2~3줄: 전년 대비 증감 원인(거래처/코스트센터/월) 중심 요약

리스크/이슈: 일회성·계절성·이상거래 패턴(월 급등/특이 적요)

후속 액션: 비용 통제/정책 제안 2~3개
톤: 간결한 임원 보고체, 수치/근거 우선. 과도한 추측 금지.

8) 집계 로직 명세(쿼리 유사 의사코드)
# base: scripts 결과 summary.csv (YYYYMM, GL_CD, GL_NM, CCTR_CD, CCTR_NM, AMT_M)
# 연도 파생: YYYY = LEFT(YYYYMM,4), MM = RIGHT(YYYYMM,2)

BY GL as g:
  TY = SUM(AMT_M WHERE YYYY=기준연도)
  LY = SUM(AMT_M WHERE YYYY=기준연도-1)
  DIFF = TY - LY
  YOY_PCT = IF(LY=0, NULL, (TY/LY)*100)

  For drilldown (CCTR):
    동일 계산을 CCTR별로 반복

9) 파일 규칙/네이밍

월별·계정별: data/processed/monthly/{YYYYMM}/GL_{GL_CD}.csv

집계: data/processed/agg/summary.csv

로그: data/processed/invalid_rows.csv

10) 인코딩/로캘 정책

CSV 저장/읽기: utf-8-sig 기본(MS365 Excel 호환).

엑셀 직출 필요 시: to_excel(..., engine="openpyxl").

터미널 한글 깨짐 시: chcp 65001 또는 VSCode/Cursor 파일 인코딩 UTF-8 with BOM.

11) 예외/에지 케이스

전년 데이터 부재: YOY % → N/A; 전년비 금액은 당년과 동일 증감 로직 유지.

마이너스 금액: 그대로 집계(환입/대체 고려).

월 미존재: 해당 월은 0으로 간주하지 않고 표시 생략(오해 방지).

중복 로우: 동일 키(YYYYMM, GL_CD, CCTR_CD) 다건은 합산. 키 충돌 다수 발생 시 로그 경고.

