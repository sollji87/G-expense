# -*- coding: utf-8 -*-
import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

df = pd.read_excel('./out/templates/월별_공통부서_인원수_입력템플릿.xlsx')

print("컬럼:", df.columns.tolist())
print(f"\n총 행 수: {len(df)}")
print("\n샘플 데이터 (상위 10개):")
print(df.head(10))

