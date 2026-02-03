# -*- coding: utf-8 -*-
import pandas as pd
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

print("=" * 80)
print("🔍 202510 데이터 상세 조사")
print("=" * 80)

# Excel 파일 읽기
df = pd.read_excel('25공통비.XLSX', sheet_name=0, engine='openpyxl')
print(f"\n총 행 수: {len(df):,}")

# YYYYMM 생성
df['YYYYMM'] = df['연도/월'].astype(str).str.replace('/', '').str.replace('-', '').str[:6]

# 202510 데이터만 필터링
df_202510 = df[df['YYYYMM'] == '202510'].copy()
print(f"\n202510 데이터 행 수: {len(df_202510):,}")

# 필수 컬럼 확인
print(f"\n필수 컬럼 결측값 확인:")
print(f"  - 계정대분류 결측: {df_202510['계정대분류'].isna().sum()}건")
print(f"  - 계정중분류 결측: {df_202510['계정중분류'].isna().sum()}건")
print(f"  - G/L 계정 결측: {df_202510['G/L 계정'].isna().sum()}건")
print(f"  - G/L 계정 설명 결측: {df_202510['G/L 계정 설명'].isna().sum()}건")

# 금액 확인
df_202510['금액_정제'] = pd.to_numeric(df_202510['금액(현지 통화)'], errors='coerce').fillna(0)
print(f"\n금액 정보:")
print(f"  - 금액 결측: {df_202510['금액_정제'].isna().sum()}건")
print(f"  - 금액 0인 행: {(df_202510['금액_정제'] == 0).sum()}건")
print(f"  - 금액 합계: {df_202510['금액_정제'].sum():,.0f}원")

# 다른 월 데이터와 비교
print(f"\n\n다른 월과 비교:")
for month in ['202509', '202510']:
    df_month = df[df['YYYYMM'] == month].copy()
    print(f"\n{month}:")
    print(f"  - 행 수: {len(df_month):,}")
    print(f"  - 계정대분류 결측: {df_month['계정대분류'].isna().sum()}")
    print(f"  - 계정중분류 결측: {df_month['계정중분류'].isna().sum()}")
    print(f"  - G/L 계정 결측: {df_month['G/L 계정'].isna().sum()}")
    print(f"  - G/L 계정 설명 결측: {df_month['G/L 계정 설명'].isna().sum()}")

# Pivot 테스트 - 결측값 제거 후
print(f"\n\nPivot 테스트 (결측값 제거 후):")
df_clean = df[df['계정대분류'].notna() & df['계정중분류'].notna() & 
              df['G/L 계정'].notna() & df['G/L 계정 설명'].notna()].copy()

print(f"정제 후 전체 행 수: {len(df_clean):,}")
print(f"정제 후 202510 행 수: {len(df_clean[df_clean['YYYYMM'] == '202510']):,}")

df_clean['금액_정제'] = pd.to_numeric(df_clean['금액(현지 통화)'], errors='coerce').fillna(0)

pivot_clean = df_clean.pivot_table(
    index=['계정대분류', '계정중분류', 'G/L 계정', 'G/L 계정 설명'],
    columns='YYYYMM',
    values='금액_정제',
    aggfunc='sum',
    fill_value=0
)

print(f"\nPivot 결과:")
print(f"  - 컬럼: {list(pivot_clean.columns)}")
print(f"  - 202510 존재: {'202510' in pivot_clean.columns}")

if '202510' in pivot_clean.columns:
    print(f"  - 202510 합계: {pivot_clean['202510'].sum():,.0f}원")

