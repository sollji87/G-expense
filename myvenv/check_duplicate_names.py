import pandas as pd
import sys
import codecs

if sys.platform == 'win32':
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

df = pd.read_csv('out/pivot_by_gl_yyyymm_combined.csv', encoding='utf-8-sig')

print('=== 대분류와 중분류 이름이 같은 경우 ===\n')

for major in df['계정대분류'].unique():
    middles = df[df['계정대분류'] == major]['계정중분류'].unique()
    for mid in middles:
        if major == mid:
            print(f'[!] 대분류: {major} = 중분류: {mid}')
            details = df[(df['계정대분류'] == major) & (df['계정중분류'] == mid)]['G/L 계정 설명'].unique()
            print(f'   소분류 개수: {len(details)}개')
            print(f'   소분류 목록:')
            for d in details[:5]:  # 처음 5개만
                print(f'     - {d}')
            if len(details) > 5:
                print(f'     ... 외 {len(details)-5}개')
            print()

