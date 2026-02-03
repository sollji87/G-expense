# -*- coding: utf-8 -*-
import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

# CSV 읽기
df = pd.read_csv('./out/pivot_by_gl_yyyymm_combined.csv', encoding='utf-8-sig')

# 계정대분류 → KPI 카테고리 매핑
CATEGORY_MAPPING = {
    '인건비': '인건비',
    'IT수수료': 'IT수수료',
    '지급수수료': '지급수수료',
    '직원경비': '직원경비',
}

def get_category_name(account_category):
    return CATEGORY_MAPPING.get(account_category, '기타비용')

# 카테고리별 집계
category_data = {
    '인건비': {'current': 0, 'previous': 0},
    'IT수수료': {'current': 0, 'previous': 0},
    '지급수수료': {'current': 0, 'previous': 0},
    '직원경비': {'current': 0, 'previous': 0},
    '기타비용': {'current': 0, 'previous': 0},
}

# 1-11월 누적 계산
for idx, row in df.iterrows():
    account_category = row['계정대분류']
    category_name = get_category_name(account_category)
    
    # 2025년 1-11월 누적
    for month in range(1, 12):
        current_month = f'2025{month:02d}'
        if current_month in df.columns:
            category_data[category_name]['current'] += float(row.get(current_month, 0))
    
    # 2024년 1-11월 누적
    for month in range(1, 12):
        previous_month = f'2024{month:02d}'
        if previous_month in df.columns:
            category_data[category_name]['previous'] += float(row.get(previous_month, 0))

# 백만원 단위로 변환 및 계산
print("="*80)
print("2025년 1-11월 vs 2024년 1-11월 비교 (누적)")
print("="*80)

results = []
total_current = 0
total_previous = 0

for category, data in category_data.items():
    current = data['current'] / 1_000_000
    previous = data['previous'] / 1_000_000
    change = current - previous
    change_pct = (current / previous * 100 - 100) if previous != 0 else 0
    
    total_current += current
    total_previous += previous
    
    results.append({
        'category': category,
        'current': current,
        'previous': previous,
        'change': change,
        'change_pct': change_pct
    })
    
    print(f"\n{category}:")
    print(f"  당년(2025): {current:,.0f}백만원")
    print(f"  전년(2024): {previous:,.0f}백만원")
    print(f"  증감: {change:+,.0f}백만원 ({change_pct:+.1f}%)")

total_change = total_current - total_previous
total_change_pct = (total_current / total_previous * 100 - 100) if total_previous != 0 else 0

print(f"\n{'='*80}")
print(f"총 비용:")
print(f"  당년(2025): {total_current:,.0f}백만원")
print(f"  전년(2024): {total_previous:,.0f}백만원")
print(f"  증감: {total_change:+,.0f}백만원 ({total_change_pct:+.1f}%)")
print(f"{'='*80}")

# 증가/감소 항목 정렬
results_sorted = sorted(results, key=lambda x: x['change'], reverse=True)

print(f"\n증가 항목 (상위 3개):")
for item in [r for r in results_sorted if r['change'] > 0][:3]:
    print(f"  {item['category']}: {item['change']:+,.0f}백만원 ({item['change_pct']:+.1f}%)")

print(f"\n감소 항목 (상위 3개):")
for item in [r for r in results_sorted if r['change'] < 0][:3]:
    print(f"  {item['category']}: {item['change']:+,.0f}백만원 ({item['change_pct']:+.1f}%)")

