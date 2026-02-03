# -*- coding: utf-8 -*-
import pandas as pd
import sys
import io

# Windows 콘솔 인코딩 설정
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

print("=" * 80)
print("📊 25공통비.XLSX 파일 확인")
print("=" * 80)

# 25년 데이터 확인
df_25 = pd.read_excel('25공통비.XLSX', sheet_name=None)
print(f"\n✅ 25공통비.XLSX 시트 목록: {list(df_25.keys())}")

first_sheet_25 = list(df_25.keys())[0]
df_first_25 = df_25[first_sheet_25]

print(f"\n📋 첫 번째 시트: {first_sheet_25}")
print(f"   - 총 행 수: {len(df_first_25):,}")
print(f"   - 컬럼 목록: {list(df_first_25.columns)}")

# 전표일자 확인 (여러 가능한 컬럼명 확인)
date_columns = ['전표일자', '전기일', '증빙일', '입력일']
date_col = None
for col in date_columns:
    if col in df_first_25.columns:
        date_col = col
        break

if date_col:
    print(f"\n📅 날짜 컬럼 사용: {date_col}")
    df_first_25['날짜'] = pd.to_datetime(df_first_25[date_col], errors='coerce')
    dates = df_first_25['날짜'].dropna()
    print(f"   - 최소: {dates.min()}")
    print(f"   - 최대: {dates.max()}")
    
    # 월별 데이터 건수
    df_first_25['년월'] = dates.dt.strftime('%Y%m')
    month_counts = df_first_25['년월'].value_counts().sort_index()
    print(f"\n📊 월별 데이터 건수:")
    for month, count in month_counts.items():
        if pd.notna(month):
            print(f"   - {month}: {count:,}건")
else:
    print("\n⚠️ 날짜 컬럼을 찾을 수 없습니다!")

# 24년 데이터 확인
print("\n" + "=" * 80)
print("📊 24공통비.XLSX 파일 확인")
print("=" * 80)

df_24 = pd.read_excel('24공통비.XLSX', sheet_name=None)
print(f"\n✅ 24공통비.XLSX 시트 목록: {list(df_24.keys())}")

first_sheet_24 = list(df_24.keys())[0]
df_first_24 = df_24[first_sheet_24]

print(f"\n📋 첫 번째 시트: {first_sheet_24}")
print(f"   - 총 행 수: {len(df_first_24):,}")

date_col_24 = None
for col in date_columns:
    if col in df_first_24.columns:
        date_col_24 = col
        break

if date_col_24:
    print(f"\n📅 날짜 컬럼 사용: {date_col_24}")
    df_first_24['날짜'] = pd.to_datetime(df_first_24[date_col_24], errors='coerce')
    dates_24 = df_first_24['날짜'].dropna()
    print(f"   - 최소: {dates_24.min()}")
    print(f"   - 최대: {dates_24.max()}")
    
    df_first_24['년월'] = dates_24.dt.strftime('%Y%m')
    month_counts_24 = df_first_24['년월'].value_counts().sort_index()
    print(f"\n📊 월별 데이터 건수:")
    for month, count in month_counts_24.items():
        if pd.notna(month):
            print(f"   - {month}: {count:,}건")
else:
    print("\n⚠️ 날짜 컬럼을 찾을 수 없습니다!")

print("\n" + "=" * 80)
print("✅ 데이터 확인 완료!")
print("=" * 80)

