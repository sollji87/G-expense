import pandas as pd

df = pd.read_csv('out/pivot_by_gl_yyyymm_combined.csv', encoding='utf-8-sig')
fee = df[df['계정대분류'] == '지급수수료']

print('=== 지급수수료 구조 ===\n')
print('중분류 목록:')
print(fee['계정중분류'].unique())

print('\n각 중분류별 소분류 (G/L 계정 설명):')
for mid in fee['계정중분류'].unique():
    print(f'\n[{mid}]')
    subs = fee[fee['계정중분류'] == mid]['G/L 계정 설명'].unique()
    for s in subs:
        # 해당 소분류의 2025년 10월 금액 확인
        amount_2025 = fee[(fee['계정중분류'] == mid) & (fee['G/L 계정 설명'] == s)]['202510'].sum()
        amount_2024 = fee[(fee['계정중분류'] == mid) & (fee['G/L 계정 설명'] == s)]['202410'].sum()
        print(f'  - {s}: 2025-10월={amount_2025:,.0f}원, 2024-10월={amount_2024:,.0f}원')

print('\n\n=== API 드릴다운 테스트 ===')
print('\n1. 지급수수료 (대분류) 클릭 시 → 중분류 표시:')
for mid in fee['계정중분류'].unique():
    total_2025 = fee[fee['계정중분류'] == mid]['202510'].sum()
    total_2024 = fee[fee['계정중분류'] == mid]['202410'].sum()
    print(f'  {mid}: 2025={total_2025/1_000_000:.1f}백만원, 2024={total_2024/1_000_000:.1f}백만원')

print('\n2. 전문용역 (중분류) 클릭 시 → 소분류 표시:')
jeonmun = fee[fee['계정중분류'] == '전문용역']
for sub in jeonmun['G/L 계정 설명'].unique():
    total_2025 = jeonmun[jeonmun['G/L 계정 설명'] == sub]['202510'].sum()
    total_2024 = jeonmun[jeonmun['G/L 계정 설명'] == sub]['202410'].sum()
    print(f'  {sub}: 2025={total_2025/1_000_000:.1f}백만원, 2024={total_2024/1_000_000:.1f}백만원')

