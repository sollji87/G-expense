# -*- coding: utf-8 -*-
"""
12월 상세 데이터 생성 스크립트
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from create_detail_data import create_detail_data_for_month

print("="*80)
print("공통부서비용 상세 데이터 생성 (24년 12월, 25년 12월)")
print("="*80)

# 24년 12월 처리
print("\n[1/2] 24년 12월 데이터 처리")
df_2412 = create_detail_data_for_month(
    input_file='24공통비.XLSX',
    target_month='202412',
    output_dir='./out/details'
)

# 25년 12월 처리
print("\n[2/2] 25년 12월 데이터 처리")
df_2512 = create_detail_data_for_month(
    input_file='25공통비.XLSX',
    target_month='202512',
    output_dir='./out/details'
)

print(f"\n{'='*80}")
print("✅ 12월 데이터 처리 완료!")
print(f"{'='*80}")
