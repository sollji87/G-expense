# -*- coding: utf-8 -*-
import pandas as pd
import json
import os
import re

def is_ai_usage(text):
    """텍스트에서 임직원 AI사용료 여부를 판별 (법인카드 '지정' 필드 없을 때 텍스트 기반 분류)"""
    if not text:
        return False
    lower = text.lower()
    
    # AI 도구 직접 키워드
    ai_keywords = [
        'chatgpt', 'chat gpt', 'gpt', 'openai',
        'claude', '클로드',
        'cursor', '커서',
        'copilot', '코파일럿',
        'gemini', '제미나이',
        'krea',
        'ai 코딩', 'ai코딩',
        'ai 에이전트', 'ai에이전트',
        'ai 구독', 'ai구독',
        'ai 사용', 'ai사용', 'ai툴', 'ai 툴',
        'ai 서비스 구독',
    ]
    
    for kw in ai_keywords:
        if kw in lower:
            return True
    
    # "IT 사용비(AI)" 같은 패턴
    if 'ai' in lower and ('사용' in lower or '구독' in lower or '비용' in lower):
        return True
    
    return False

def normalize_usage_text(text, vendor=''):
    """IT사용료 텍스트 정규화 (extract_it_usage_v2.py의 normalize_text 기반)"""
    if not text:
        return vendor if vendor else 'Unknown'
    
    # 날짜 패턴 제거
    text = re.sub(r'^\d{2}\.\d{1,2}월?_?\s*', '', text)
    text = re.sub(r'^\d{4}\.\d{1,2}_?\s*', '', text)
    text = re.sub(r'^\d{2}년\s*\d{1,2}월\s*', '', text)
    text = re.sub(r'^\d{4}년도?\s*\d{0,2}월?\s*', '', text)
    text = re.sub(r'^\d{1,2}월\s*', '', text)
    text = re.sub(r'\d{2}\.\d{1,2}월?\s*', '', text)
    text = text.replace('_', ' ').strip()
    text = re.sub(r'\s+', ' ', text)
    
    lower = text.lower()
    
    if 'aws' in lower: return 'AWS 인프라'
    if 'alibaba' in lower: return 'Alibaba Cloud'
    if '1password' in lower: return '1Password'
    if 'atlassian' in lower: return 'Atlassian'
    if 'miro' in lower or '미로' in text: return 'Miro'
    if 'retool' in lower: return 'Retool'
    if 'm365' in lower or 'ms365' in lower or 'office 365' in lower: return 'MS 365'
    if 'slack' in lower: return 'Slack'
    if 'plm' in lower: return 'PLM'
    if 'ga4' in lower: return 'GA4'
    if 'github' in lower: return 'GitHub'
    if 'jetbrain' in lower: return 'JetBrains'
    if '카카오' in text: return '카카오워크'
    if 'marketing cloud' in lower: return 'Salesforce'
    if 'okta' in lower: return 'Okta'
    if 'oracle' in lower: return 'Oracle'
    if 'sap' in lower: return 'SAP'
    if 'sfdc' in lower or 'salesforce' in lower: return 'Salesforce'
    if 'tibco' in lower: return 'Tibco'
    if 'figma' in lower: return 'Figma'
    if 'docusign' in lower: return 'DocuSign'
    if 'powerbi' in lower or 'power bi' in lower: return 'Power BI'
    if 'zoom' in lower: return 'Zoom'
    if 'sentry' in lower: return 'Sentry'
    if 'adobe' in lower: return 'Adobe'
    if 'notion' in lower or '노션' in text: return 'Notion'
    if 'naver cloud' in lower or '네이버 클라우드' in text: return 'Naver Cloud'
    if 'vercel' in lower: return 'Vercel'
    if 'google cloud' in lower or 'gcp' in lower: return 'Google Cloud'
    if 'sendbird' in lower: return 'Sendbird'
    if 'snowflake' in lower or '스노우플레이크' in text: return 'Snowflake'
    if 'fingerprint' in lower: return 'Fingerprint'
    if 'apify' in lower: return 'APIFY'
    if 'nox' in lower or 'influencer' in lower: return 'Nox Influencer'
    if '인플루언서' in text: return '인플루언서시스템'
    if '차트메트릭' in text: return '차트메트릭'
    if '방화벽' in text: return '방화벽'
    if '방문객' in text or 'qr' in lower: return '방문객 QR시스템'
    if 'wgsn' in lower: return '온라인 정보사이트(WGSN)'
    
    return text.strip() if text.strip() else (vendor if vendor else 'Unknown')

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
    
    ai_usage_count = 0
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
            # 텍스트 기반 임직원 AI사용료 분류
            if is_ai_usage(text):
                normalized_text = '임직원 AI사용료'
                ai_usage_count += 1
            else:
                normalized_text = normalize_usage_text(text, vendor)
            
            usage_data['2026'].append({
                'month': month,
                'text': normalized_text,
                'original_text': text,
                'vendor': vendor,
                'cctr': cctr.replace('공통_', '').replace('[CLSD]공통_', '').replace('[CLSD]', ''),
                'amount': amount  # 원 단위 (IT사용료 API에서 백만원 변환)
            })
    
    print(f"  -> 임직원 AI사용료로 분류: {ai_usage_count}건")
    
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
