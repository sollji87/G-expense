# -*- coding: utf-8 -*-
import pandas as pd
import sys
import io
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def clean_amount(value):
    if pd.isna(value):
        return 0
    if isinstance(value, (int, float)):
        return float(value)
    value = str(value).strip()
    value = value.replace(',', '').replace(' ', '').replace('-', '').replace('_', '')
    value = re.sub(r'[^\d.-]', '', value)
    try:
        return float(value) if value else 0
    except:
        return 0

def normalize_yyyymm(value):
    if pd.isna(value):
        return None
    value = str(value).strip()
    value = value.replace('/', '').replace('-', '')
    if len(value) >= 6:
        return value[:6]
    return None

print("=" * 80)
print("📊 202510 데이터 디버깅")
print("=" * 80)

# 데이터 읽기
df = pd.read_excel('25공통비.XLSX')
print(f"\n총 행 수: {len(df):,}")

# YYYYMM 생성
df['YYYYMM'] = df['연도/월'].apply(normalize_yyyymm)
print(f"YYYYMM 생성 후 행 수: {len(df[df['YYYYMM'].notna()]):,}")

# 202510 데이터만 필터링
df_202510 = df[df['YYYYMM'] == '202510'].copy()
print(f"\n202510 데이터 행 수: {len(df_202510):,}")

# 금액 정제
df_202510['금액_정제'] = df_202510['금액(현지 통화)'].apply(clean_amount)
print(f"202510 금액 합계: {df_202510['금액_정제'].sum():,.0f}원")

# 계정별 집계
if len(df_202510) > 0:
    print(f"\n202510 계정별 상위 5개:")
    account_sum = df_202510.groupby(['G/L 계정', 'G/L 계정 설명'])['금액_정제'].sum().sort_values(ascending=False).head(5)
    for (gl, desc), amount in account_sum.items():
        print(f"  - [{gl}] {desc}: {amount:,.0f}원")

# 전체 데이터로 pivot 테스트
print(f"\n\n전체 데이터로 pivot 테스트:")
df['금액_정제'] = df['금액(현지 통화)'].apply(clean_amount)
df_valid = df[df['YYYYMM'].notna()].copy()

pivot_test = df_valid.pivot_table(
    index=['G/L 계정'],
    columns='YYYYMM',
    values='금액_정제',
    aggfunc='sum',
    fill_value=0
)

print(f"Pivot 컬럼: {list(pivot_test.columns)}")
print(f"202510 컬럼 존재: {'202510' in pivot_test.columns}")

if '202510' in pivot_test.columns:
    print(f"202510 컬럼 합계: {pivot_test['202510'].sum():,.0f}원")

