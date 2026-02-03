# -*- coding: utf-8 -*-
"""
엑셀 파일 구조 확인 스크립트
"""
import pandas as pd
import sys

# 인코딩 설정
sys.stdout.reconfigure(encoding='utf-8')

# 24년 데이터 확인
print("=" * 80)
print("24공통비.XLSX 파일 구조 확인")
print("=" * 80)

df_24 = pd.read_excel('24공통비.XLSX', sheet_name=0)
print(f"\n총 행 수: {len(df_24)}")
print(f"총 컬럼 수: {len(df_24.columns)}")
print(f"\n컬럼 목록:")
for i, col in enumerate(df_24.columns, 1):
    print(f"  {i}. {col}")

print(f"\n상위 5개 데이터:")
print(df_24.head())

print(f"\n데이터 타입:")
print(df_24.dtypes)

# 25년 데이터 확인
print("\n" + "=" * 80)
print("25공통비.XLSX 파일 구조 확인")
print("=" * 80)

df_25 = pd.read_excel('25공통비.XLSX', sheet_name=0)
print(f"\n총 행 수: {len(df_25)}")
print(f"총 컬럼 수: {len(df_25.columns)}")
print(f"\n컬럼 목록:")
for i, col in enumerate(df_25.columns, 1):
    print(f"  {i}. {col}")

print(f"\n상위 5개 데이터:")
print(df_25.head())

