# -*- coding: utf-8 -*-
import pandas as pd
import sys
import io
from excel import process_excel_to_pivot

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

print("=" * 80)
print("📊 25공통비.XLSX 재처리")
print("=" * 80)

# 먼저 원본 데이터 확인
df = pd.read_excel('25공통비.XLSX')
print(f"\n원본 데이터 행 수: {len(df):,}")

# 연도/월 컬럼 확인
df['YYYYMM'] = df['연도/월'].str.replace('/', '').str.replace('-', '').str[:6]
unique_months = sorted(df['YYYYMM'].dropna().unique())
print(f"\nYYYYMM 고유값: {unique_months}")

for month in unique_months:
    count = len(df[df['YYYYMM'] == month])
    print(f"  - {month}: {count:,}건")

# 재처리
print("\n" + "=" * 80)
print("재처리 시작...")
print("=" * 80)

result = process_excel_to_pivot('25공통비.XLSX', output_dir='./out')

print("\n✅ 재처리 완료!")

