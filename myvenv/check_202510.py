# -*- coding: utf-8 -*-
import pandas as pd
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

print("=" * 80)
print("📊 202510 데이터 확인")
print("=" * 80)

# 25년 데이터 읽기
df = pd.read_excel('25공통비.XLSX')

print(f"\n총 행 수: {len(df):,}")

# 연도/월 컬럼 확인
if '연도/월' in df.columns:
    print(f"\n연도/월 컬럼의 고유값:")
    unique_months = df['연도/월'].dropna().unique()
    for month in sorted(unique_months):
        count = len(df[df['연도/월'] == month])
        print(f"  - {month}: {count:,}건")
else:
    print("\n⚠️ '연도/월' 컬럼이 없습니다!")
    print(f"사용 가능한 컬럼: {list(df.columns)}")

# 전기일로 확인
if '전기일' in df.columns:
    df['전기일_dt'] = pd.to_datetime(df['전기일'], errors='coerce')
    df['년월'] = df['전기일_dt'].dt.strftime('%Y%m')
    
    print(f"\n\n전기일 기준 월별 데이터:")
    month_counts = df['년월'].value_counts().sort_index()
    for month, count in month_counts.items():
        if pd.notna(month):
            print(f"  - {month}: {count:,}건")

