# -*- coding: utf-8 -*-
import pandas as pd
import sys
import io
import os
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

print("=" * 80)
print("📊 강제 재처리 - 202510 포함 확인")
print("=" * 80)

# 1. Excel 파일 직접 읽기 (엔진 명시)
print("\n1. Excel 파일 읽기 (openpyxl 엔진 사용)...")
df = pd.read_excel('25공통비.XLSX', sheet_name=0, engine='openpyxl')
print(f"   ✓ 총 {len(df):,}행 로드")

# 2. 연도/월 확인
print("\n2. 연도/월 고유값 확인...")
unique_months = df['연도/월'].dropna().unique()
print(f"   고유값: {sorted(unique_months)}")

# 3. YYYYMM 생성
print("\n3. YYYYMM 생성...")
df['YYYYMM'] = df['연도/월'].astype(str).str.replace('/', '').str.replace('-', '').str[:6]
unique_yyyymm = sorted(df['YYYYMM'].dropna().unique())
print(f"   YYYYMM 고유값: {unique_yyyymm}")

# 4. 금액 정제
print("\n4. 금액 정제...")
df['금액_정제'] = pd.to_numeric(df['금액(현지 통화)'], errors='coerce').fillna(0)

# 5. 필수 컬럼 확인
required_cols = ['계정대분류', '계정중분류', 'G/L 계정', 'G/L 계정 설명']
for col in required_cols:
    if col not in df.columns:
        print(f"   ⚠️ 컬럼 없음: {col}")

# 6. Pivot 생성
print("\n5. Pivot 테이블 생성...")
pivot = df.pivot_table(
    index=['계정대분류', '계정중분류', 'G/L 계정', 'G/L 계정 설명'],
    columns='YYYYMM',
    values='금액_정제',
    aggfunc='sum',
    fill_value=0
)

print(f"   ✓ Pivot 생성 완료")
print(f"   - 행 수: {len(pivot)}")
print(f"   - 컬럼: {list(pivot.columns)}")
print(f"   - 202510 존재: {'202510' in pivot.columns}")

if '202510' in pivot.columns:
    print(f"   - 202510 합계: {pivot['202510'].sum():,.0f}원")

# 7. CSV 저장
output_dir = './out'
Path(output_dir).mkdir(parents=True, exist_ok=True)
output_file = os.path.join(output_dir, 'pivot_by_gl_yyyymm_FIXED.csv')

pivot_sorted = pivot.reindex(sorted(pivot.columns), axis=1)
pivot_sorted.to_csv(output_file, encoding='utf-8-sig')

print(f"\n6. CSV 저장 완료: {output_file}")
print(f"   - 저장된 컬럼: {list(pivot_sorted.columns)}")

