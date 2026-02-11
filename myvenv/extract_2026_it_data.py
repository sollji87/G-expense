# -*- coding: utf-8 -*-
import pandas as pd
import json
import os

def extract_2026_it_data():
    """detail_202601_all.csv에서 IT사용료와 IT유지보수비 데이터를 추출하여 기존 JSON에 추가"""
    
    # 기존 JSON 파일 로드
    usage_json_path = 'out/it_usage_details.json'
    maintenance_json_path = 'out/it_maintenance_details.json'
    
    # 기존 데이터 로드
    with open(usage_json_path, 'r', encoding='utf-8') as f:
        usage_data = json.load(f)
    
    with open(maintenance_json_path, 'r', encoding='utf-8') as f:
        maintenance_data = json.load(f)
    
    # 2026년 데이터 초기화
    usage_data['2026'] = []
    maintenance_data['2026'] = []
    
    # detail_202601_all.csv 로드
    detail_path = 'out/details/detail_202601_all.csv'
    print(f"Loading {detail_path}...")
    df = pd.read_csv(detail_path)
    print(f"Total rows: {len(df)}")
    
    # IT사용료 추출
    usage_mask = df['G/L 계정 설명'].astype(str).str.contains('IT사용료', na=False)
    usage_filtered = df[usage_mask].copy()
    print(f"\nIT사용료 rows: {len(usage_filtered)}")
    
    for _, row in usage_filtered.iterrows():
        yyyymm = str(row['YYYYMM'])
        month = yyyymm[-2:]  # 마지막 2자리가 월
        
        text = str(row['텍스트']) if pd.notna(row['텍스트']) else ''
        vendor = str(row['거래처명']) if pd.notna(row['거래처명']) else ''
        cctr = str(row['코스트센터명']) if pd.notna(row['코스트센터명']) else ''
        
        try:
            amount = float(row['금액_정제']) if pd.notna(row['금액_정제']) else 0
        except:
            amount = 0
        
        if amount != 0:  # 0이 아닌 금액만 (음수 포함)
            usage_data['2026'].append({
                'month': month,
                'text': text,
                'vendor': vendor,
                'cctr': cctr.replace('공통_', '').replace('[CLSD]공통_', '').replace('[CLSD]', ''),
                'amount': amount  # 이미 원 단위
            })
    
    # IT유지보수비 추출 (주의: 유지보수비 JSON은 백만원 단위로 저장해야 함 - API에서 변환 없이 그대로 표시)
    maintenance_mask = df['G/L 계정 설명'].astype(str).str.contains('IT유지보수비', na=False)
    maintenance_filtered = df[maintenance_mask].copy()
    print(f"IT유지보수비 rows: {len(maintenance_filtered)}")
    
    for _, row in maintenance_filtered.iterrows():
        yyyymm = str(row['YYYYMM'])
        month = yyyymm[-2:]
        
        text = str(row['텍스트']) if pd.notna(row['텍스트']) else ''
        vendor = str(row['거래처명']) if pd.notna(row['거래처명']) else ''
        cctr = str(row['코스트센터명']) if pd.notna(row['코스트센터명']) else ''
        
        try:
            amount = float(row['금액_정제']) if pd.notna(row['금액_정제']) else 0
        except:
            amount = 0
        
        if amount != 0:
            maintenance_data['2026'].append({
                'month': month,
                'text': text,
                'vendor': vendor,
                'cctr': cctr.replace('공통_', '').replace('[CLSD]공통_', '').replace('[CLSD]', ''),
                'amount': round(amount / 1_000_000)  # 백만원 단위 (유지보수비 API는 변환 없이 표시)
            })
    
    # JSON 파일 저장
    with open(usage_json_path, 'w', encoding='utf-8') as f:
        json.dump(usage_data, f, ensure_ascii=False, indent=2)
    
    with open(maintenance_json_path, 'w', encoding='utf-8') as f:
        json.dump(maintenance_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n[OK] 저장 완료!")
    print(f"IT사용료 2026년: {len(usage_data['2026'])}건")
    print(f"IT유지보수비 2026년: {len(maintenance_data['2026'])}건")
    
    # 합계 확인
    usage_total = sum(item['amount'] for item in usage_data['2026'])
    maintenance_total = sum(item['amount'] for item in maintenance_data['2026'])
    
    print(f"\nIT사용료 2026-01 합계: {usage_total:,.0f}원 ({usage_total/1_000_000:.0f}백만원)")
    print(f"IT유지보수비 2026-01 합계: {maintenance_total:,.0f}원 ({maintenance_total/1_000_000:.0f}백만원)")
    
    # 샘플 출력
    if usage_data['2026']:
        print("\nIT사용료 샘플 (처음 5건):")
        for item in usage_data['2026'][:5]:
            print(f"  {item['month']}월 | {item['cctr']} | {item['text'][:40]} | {item['amount']:,.0f}원")
    
    if maintenance_data['2026']:
        print("\nIT유지보수비 샘플 (처음 5건):")
        for item in maintenance_data['2026'][:5]:
            print(f"  {item['month']}월 | {item['cctr']} | {item['text'][:40]} | {item['amount']:,.0f}원")

if __name__ == '__main__':
    extract_2026_it_data()
