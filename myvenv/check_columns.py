# -*- coding: utf-8 -*-
import pandas as pd

df = pd.read_excel('25공통비.XLSX', nrows=5)
print('모든 컬럼:')
for i, col in enumerate(df.columns):
    val = df[col].iloc[0] if len(df) > 0 else ''
    print(f'{i:2d}: {col} = {val}')
