import pandas as pd
import sys
import codecs

if sys.platform == 'win32':
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

df = pd.read_csv('out/pivot_by_gl_cctr_yyyymm_combined.csv', encoding='utf-8-sig')

print('=== CSV 컬럼 목록 ===')
print(df.columns.tolist())

print('\n=== 지급수수료 구조 (pivot_by_gl_cctr_yyyymm_combined.csv) ===\n')

fee = df[df['계정대분류'] == '지급수수료']

print('1. 계정중분류 목록:')
for mid in fee['계정중분류'].unique():
    print(f'  - {mid}')

print('\n2. G/L 계정 설명 목록 (소분류):')
for detail in fee['G/L 계정 설명'].unique()[:10]:
    print(f'  - {detail}')
print(f'  ... 총 {len(fee["G/L 계정 설명"].unique())}개')

print('\n3. 지급수수료(중분류)의 소분류들:')
fee_mid = fee[fee['계정중분류'] == '지급수수료']
for detail in fee_mid['G/L 계정 설명'].unique()[:10]:
    print(f'  - {detail}')
if len(fee_mid['G/L 계정 설명'].unique()) > 10:
    print(f'  ... 총 {len(fee_mid["G/L 계정 설명"].unique())}개')

