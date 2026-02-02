# -*- coding: utf-8 -*-
import pandas as pd
import os

# 파일 경로
file_24 = r'C:\Users\AC1162\ai_project\251106_G_expense\CAPEX\유무형자산_24년12월.XLSX'
file_25 = r'C:\Users\AC1162\ai_project\251106_G_expense\CAPEX\유무형자산_25년12월.XLSX'

# 파일 읽기
df_24 = pd.read_excel(file_24)
df_25 = pd.read_excel(file_25)

# 컬럼명 정리 (공백 제거)
df_24.columns = [str(c).replace('\xa0', ' ').strip() for c in df_24.columns]
df_25.columns = [str(c).replace('\xa0', ' ').strip() for c in df_25.columns]

# 자산번호를 키로 사용
assets_24 = set(df_24['자산번호'].astype(str).tolist())
assets_25 = set(df_25['자산번호'].astype(str).tolist())

# 분석
new_assets = assets_25 - assets_24  # 25년에 신규 취득
existing_assets = assets_24 & assets_25  # 양년도 모두 존재
completed_assets = assets_24 - assets_25  # 24년에만 존재 (상각 완료/폐기)

print('=' * 80)
print('유무형자산 분석 결과')
print('=' * 80)
print()
print(f'24년 12월 자산 수: {len(assets_24)}개')
print(f'25년 12월 자산 수: {len(assets_25)}개')
print()
print(f'신규 취득 (25년): {len(new_assets)}개')
print(f'기존 자산 (양년도): {len(existing_assets)}개')
print(f'상각 완료/폐기 (24년만): {len(completed_assets)}개')
print()

# 신규 취득 자산 상세
print('=' * 80)
print('[ 신규 취득 자산 (2025년) ]')
print('=' * 80)
new_df = df_25[df_25['자산번호'].astype(str).isin(new_assets)][['자산번호', '자산명', '취득일', '기말취득가액', '기말장부가액', '당기상각비']]
new_df = new_df.sort_values('기말취득가액', ascending=False)
for _, row in new_df.iterrows():
    acq_amt = row['기말취득가액'] / 1000000 if pd.notna(row['기말취득가액']) else 0
    book_amt = row['기말장부가액'] / 1000000 if pd.notna(row['기말장부가액']) else 0
    dep_amt = abs(row['당기상각비']) / 1000000 if pd.notna(row['당기상각비']) else 0
    print(f"  - {row['자산명'][:50]}")
    print(f"    취득일: {row['취득일']}, 취득가액: {acq_amt:.0f}백만원, 장부가액: {book_amt:.0f}백만원, 상각비: {dep_amt:.0f}백만원")
    print()

# 상각 완료/폐기 자산 상세
print('=' * 80)
print('[ 상각 완료/폐기 자산 (2024년) ]')
print('=' * 80)
completed_df = df_24[df_24['자산번호'].astype(str).isin(completed_assets)][['자산번호', '자산명', '취득일', '기말취득가액', '기말장부가액', '당기상각비', '구분']]
completed_df = completed_df.sort_values('기말취득가액', ascending=False)
for _, row in completed_df.iterrows():
    acq_amt = row['기말취득가액'] / 1000000 if pd.notna(row['기말취득가액']) else 0
    book_amt = row['기말장부가액'] / 1000000 if pd.notna(row['기말장부가액']) else 0
    dep_amt = abs(row['당기상각비']) / 1000000 if pd.notna(row['당기상각비']) else 0
    status = row['구분'] if pd.notna(row['구분']) else ''
    print(f"  - {row['자산명'][:50]}")
    print(f"    취득일: {row['취득일']}, 취득가액: {acq_amt:.0f}백만원, 장부가액: {book_amt:.0f}백만원, 상각비: {dep_amt:.0f}백만원, 구분: {status}")
    print()

# 월별 상각비 합계
print('=' * 80)
print('[ 월별 상각비 합계 (백만원) ]')
print('=' * 80)
months = ['01월', '02월', '03월', '04월', '05월', '06월', '07월', '08월', '09월', '10월', '11월', '12월']
print(f"{'월':>6} {'2024년':>12} {'2025년':>12} {'차이':>12} {'YOY':>10}")
print('-' * 55)
total_24 = 0
total_25 = 0
for m in months:
    if m in df_24.columns and m in df_25.columns:
        sum_24 = abs(df_24[m].sum()) / 1000000
        sum_25 = abs(df_25[m].sum()) / 1000000
        diff = sum_25 - sum_24
        yoy = (sum_25 / sum_24 * 100) if sum_24 > 0 else 0
        total_24 += sum_24
        total_25 += sum_25
        print(f"{m:>6} {sum_24:>12.0f} {sum_25:>12.0f} {diff:>+12.0f} {yoy:>9.1f}%")

print('-' * 55)
total_diff = total_25 - total_24
total_yoy = (total_25 / total_24 * 100) if total_24 > 0 else 0
print(f"{'합계':>6} {total_24:>12.0f} {total_25:>12.0f} {total_diff:>+12.0f} {total_yoy:>9.1f}%")

# 결과를 CSV로 저장
result_data = []

# 신규 취득
for _, row in new_df.iterrows():
    result_data.append({
        '구분': '신규취득(25년)',
        '자산번호': row['자산번호'],
        '자산명': row['자산명'],
        '취득일': row['취득일'],
        '취득가액(백만)': row['기말취득가액'] / 1000000 if pd.notna(row['기말취득가액']) else 0,
        '장부가액(백만)': row['기말장부가액'] / 1000000 if pd.notna(row['기말장부가액']) else 0,
        '상각비(백만)': abs(row['당기상각비']) / 1000000 if pd.notna(row['당기상각비']) else 0,
    })

# 상각완료/폐기
for _, row in completed_df.iterrows():
    result_data.append({
        '구분': '상각완료/폐기(24년)',
        '자산번호': row['자산번호'],
        '자산명': row['자산명'],
        '취득일': row['취득일'],
        '취득가액(백만)': row['기말취득가액'] / 1000000 if pd.notna(row['기말취득가액']) else 0,
        '장부가액(백만)': row['기말장부가액'] / 1000000 if pd.notna(row['기말장부가액']) else 0,
        '상각비(백만)': abs(row['당기상각비']) / 1000000 if pd.notna(row['당기상각비']) else 0,
    })

result_df = pd.DataFrame(result_data)
result_df.to_csv(r'C:\Users\AC1162\ai_project\251106_G_expense\CAPEX\asset_analysis_result.csv', index=False, encoding='utf-8-sig')
print()
print('분석 결과가 asset_analysis_result.csv에 저장되었습니다.')

# 취득일 기준 분석 (2025년에 취득한 자산)
print()
print('=' * 80)
print('[ 2025년 신규 취득 자산 (취득일 기준) ]')
print('=' * 80)
df_25['취득일'] = pd.to_datetime(df_25['취득일'], errors='coerce')
new_2025 = df_25[df_25['취득일'].dt.year == 2025][['자산번호', '자산명', '취득일', '기말취득가액', '기말장부가액', '당기상각비']]
new_2025 = new_2025.sort_values('기말취득가액', ascending=False)
print(f'2025년 취득 자산 수: {len(new_2025)}개')
print()
for _, row in new_2025.iterrows():
    acq_amt = row['기말취득가액'] / 1000000 if pd.notna(row['기말취득가액']) else 0
    book_amt = row['기말장부가액'] / 1000000 if pd.notna(row['기말장부가액']) else 0
    dep_amt = abs(row['당기상각비']) / 1000000 if pd.notna(row['당기상각비']) else 0
    acq_date = row['취득일'].strftime('%Y-%m-%d') if pd.notna(row['취득일']) else ''
    print(f"  - {row['자산명'][:60]}")
    print(f"    취득일: {acq_date}, 취득가액: {acq_amt:.0f}백만원, 장부가액: {book_amt:.0f}백만원, 25년상각비: {dep_amt:.0f}백만원")
    print()

# 2024년 취득 자산 (24년 신규)
print('=' * 80)
print('[ 2024년 취득 자산 ]')
print('=' * 80)
df_24['취득일'] = pd.to_datetime(df_24['취득일'], errors='coerce')
new_2024 = df_24[df_24['취득일'].dt.year == 2024][['자산번호', '자산명', '취득일', '기말취득가액', '기말장부가액', '당기상각비']]
new_2024 = new_2024.sort_values('기말취득가액', ascending=False)
print(f'2024년 취득 자산 수: {len(new_2024)}개')
print()
for _, row in new_2024.iterrows():
    acq_amt = row['기말취득가액'] / 1000000 if pd.notna(row['기말취득가액']) else 0
    book_amt = row['기말장부가액'] / 1000000 if pd.notna(row['기말장부가액']) else 0
    dep_amt = abs(row['당기상각비']) / 1000000 if pd.notna(row['당기상각비']) else 0
    acq_date = row['취득일'].strftime('%Y-%m-%d') if pd.notna(row['취득일']) else ''
    print(f"  - {row['자산명'][:60]}")
    print(f"    취득일: {acq_date}, 취득가액: {acq_amt:.0f}백만원, 장부가액: {book_amt:.0f}백만원, 24년상각비: {dep_amt:.0f}백만원")
    print()

# 상각 완료 예정 자산 (장부가액이 0에 가까운 자산)
print('=' * 80)
print('[ 2025년 상각 완료 예정 자산 (장부가액 10백만원 이하) ]')
print('=' * 80)
almost_done = df_25[(df_25['기말장부가액'].abs() <= 10000000) & (df_25['기말장부가액'] != 0)]
almost_done = almost_done[['자산번호', '자산명', '취득일', '기말취득가액', '기말장부가액', '당기상각비']]
almost_done = almost_done.sort_values('기말장부가액')
print(f'상각 완료 예정 자산 수: {len(almost_done)}개')
print()
for _, row in almost_done.head(20).iterrows():
    acq_amt = row['기말취득가액'] / 1000000 if pd.notna(row['기말취득가액']) else 0
    book_amt = row['기말장부가액'] / 1000000 if pd.notna(row['기말장부가액']) else 0
    dep_amt = abs(row['당기상각비']) / 1000000 if pd.notna(row['당기상각비']) else 0
    print(f"  - {row['자산명'][:60]}")
    print(f"    취득가액: {acq_amt:.0f}백만원, 잔존장부가액: {book_amt:.1f}백만원, 25년상각비: {dep_amt:.0f}백만원")
    print()
