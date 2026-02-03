import pandas as pd
import sys
import codecs

if sys.platform == 'win32':
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

df = pd.read_csv('out/pivot_by_gl_cctr_yyyymm_combined.csv', encoding='utf-8-sig')

category = '지급수수료'  # 중분류 이름
month = '10'

print(f'=== 드릴다운 테스트: "{category}" 클릭 ===\n')

# 대분류인지 중분류인지 판단
hasAsMiddle = df[(df['계정중분류'] == category) & (df['계정대분류'] != category)].shape[0] > 0
hasAsMajor = df[df['계정대분류'] == category].shape[0] > 0

print(f'hasAsMiddle (중분류로 존재하는지): {hasAsMiddle}')
print(f'hasAsMajor (대분류로 존재하는지): {hasAsMajor}')

isDrilldownToDetail = hasAsMiddle
isDrilldownToMiddle = not hasAsMiddle and hasAsMajor

print(f'\nisDrilldownToDetail: {isDrilldownToDetail}')
print(f'isDrilldownToMiddle: {isDrilldownToMiddle}')

if isDrilldownToDetail:
    print(f'\n✅ 중분류 → 소분류 드릴다운')
    filtered = df[df['계정중분류'] == category]
    print(f'필터링된 행 수: {len(filtered)}')
    
    # G/L 계정 설명별로 집계
    result = filtered.groupby('G/L 계정 설명').agg({
        '202510': 'sum',
        '202410': 'sum'
    }).reset_index()
    
    result['차이'] = result['202510'] - result['202410']
    result = result[result['차이'].abs() >= 500000]  # 0.5백만원 이상만
    
    print(f'\n소분류 목록 (0.5백만원 이상):')
    for idx, row in result.iterrows():
        print(f'  - {row["G/L 계정 설명"]}: 2025={row["202510"]/1_000_000:.1f}백만원, 2024={row["202410"]/1_000_000:.1f}백만원')
    
elif isDrilldownToMiddle:
    print(f'\n✅ 대분류 → 중분류 드릴다운')
    filtered = df[df['계정대분류'] == category]
    print(f'필터링된 행 수: {len(filtered)}')
    
    # 계정중분류별로 집계
    result = filtered.groupby('계정중분류').agg({
        '202510': 'sum',
        '202410': 'sum'
    }).reset_index()
    
    print(f'\n중분류 목록:')
    for idx, row in result.iterrows():
        print(f'  - {row["계정중분류"]}: 2025={row["202510"]/1_000_000:.1f}백만원, 2024={row["202410"]/1_000_000:.1f}백만원')

