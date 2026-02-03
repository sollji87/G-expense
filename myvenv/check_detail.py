# -*- coding: utf-8 -*-
import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

# 24년 10월 데이터 확인
df = pd.read_csv('./out/details/detail_202410_all.csv', encoding='utf-8-sig')

print("24년 10월 상세 데이터 샘플 (상위 5건):")
print("\n")
print(df[['계정대분류', 'G/L 계정 설명', '텍스트', '거래처명', '금액_정제']].head())

print("\n\n25년 10월 상세 데이터 샘플 (상위 5건):")
df2 = pd.read_csv('./out/details/detail_202510_all.csv', encoding='utf-8-sig')
print(df2[['계정대분류', 'G/L 계정 설명', '텍스트', '거래처명', '금액_정제']].head())

