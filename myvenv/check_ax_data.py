# -*- coding: utf-8 -*-
import json

with open('out/it_maintenance_details.json', encoding='utf-8') as f:
    data = json.load(f)

# AX팀 + PI팀 데이터 확인
ax_data = [r for r in data['2025'] if 'AX' in r['cctr'] or 'PI' in r['cctr']]
print(f"AX/PI팀 2025년 건수: {len(ax_data)}")
print("\n텍스트 목록:")
for r in ax_data:
    print(f"  {r['month']}월 | {r['cctr']} | {r['text']} | {r['amount']}백만원")
