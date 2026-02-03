# -*- coding: utf-8 -*-
import pandas as pd
import os

# headcount 파일 찾기
paths = [
    'out/snowflake/headcount_monthly_latest.csv',
]

for p in paths:
    if os.path.exists(p):
        print(f'Found: {p}')
        df = pd.read_csv(p)
        print(f'Columns: {list(df.columns)}')
        print(df.head(10))
        
        # 월별 합계 계산
        months = ['202501', '202502', '202503', '202504', '202505', '202506', 
                  '202507', '202508', '202509', '202510', '202511', '202512']
        print('\nMonthly headcount totals:')
        for m in months:
            if m in df.columns:
                total = df[m].sum()
                print(f'{m}: {total}')
        break
    else:
        print(f'Not found: {p}')
