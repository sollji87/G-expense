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
    
    # AI 도구 직접 키워드 (영문)
    ai_keywords_en = [
        'chatgpt', 'chat gpt', 'gpt', 'openai',
        'claude', 'anthropic',
        'cursor', 'cursur',  # 오타 포함
        'copilot', 'gemini',
        'krea', 'midjourney',
        'runway', 'higgsfiel', 'comfyui',
        'genspark', 'perplexity',
        'grok',
    ]
    
    # AI 도구 직접 키워드 (한글)
    ai_keywords_kr = [
        '클로드', '클루드',  # 오타 포함
        '커서', '코파일럿', '제미나이',
        '챗지피티', '챗GPT',
        '미드저니', '퍼플렉시티',
        '런웨이', '힉스필드', '컴피UI',
        '크레아',
    ]
    
    for kw in ai_keywords_en:
        if kw in lower:
            return True
    
    for kw in ai_keywords_kr:
        if kw in text:
            return True
    
    # "IT 사용비(AI)" 같은 패턴
    if 'ai' in lower and ('사용' in lower or '구독' in lower or '비용' in lower or '결제' in lower or '프로그램' in lower):
        return True
    
    # "AI 코딩", "AI 이미지" 등
    if 'ai 코딩' in lower or 'ai코딩' in lower:
        return True
    if 'ai 에이전트' in lower or 'ai에이전트' in lower:
        return True
    if 'ai 분석' in lower or 'ai분석' in lower:
        return True
    if 'ai 이미지' in lower or '생성형ai' in lower or '생성형 ai' in lower:
        return True
    if 'ai솔루션' in lower or 'ai 솔루션' in lower:
        return True
    
    # "보고용 AI 이미지 생성" 패턴
    if 'ai' in lower and '이미지' in lower:
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
    text = re.sub(r'^\d{2}\s+', '', text)  # "26 " 등
    text = text.replace('_', ' ').strip()
    text = re.sub(r'\s+', ' ', text)
    
    lower = text.lower()
    
    # --- 클라우드 인프라 ---
    if 'aws' in lower: return 'AWS'
    if 'alibaba' in lower: return 'Alibaba Cloud'
    if 'google cloud' in lower or 'gcp' in lower: return 'Google Cloud'
    if 'naver cloud' in lower or '네이버 클라우드' in text: return 'Naver Cloud'
    if 'azure' in lower: return 'Azure'
    if 'oci' in lower and ('클라우드' in text or 'msp' in lower): return 'OCI 클라우드'
    if 'cloudflare' in lower: return 'Cloudflare'
    if 'vercel' in lower: return 'Vercel'
    if 'datadog' in lower: return 'Datadog'
    if 'kinx' in lower: return 'KINX CloudHub'
    if 'heroku' in lower: return 'Salesforce'
    
    # --- 협업/생산성 도구 ---
    if 'm365' in lower or 'ms365' in lower or 'office 365' in lower: return 'MS 365'
    if 'sharepoint' in lower: return 'MS 365'
    if 'ms 라이' in lower or 'ms라이' in lower: return 'MS 365'
    if 'teams premium' in lower: return 'MS 365'
    if 'slack' in lower: return 'Slack'
    if 'notion' in lower or '노션' in text: return 'Notion'
    if 'atlassian' in lower: return 'Atlassian'
    if 'miro' in lower or '미로' in text: return 'Miro'
    if 'zoom' in lower or '화상회의' in text: return 'Zoom'
    if '카카오' in text: return '카카오워크'
    if 'figma' in lower or '피그마' in text: return 'Figma'
    if 'g.suite' in lower or 'gsuite' in lower or '구글 드라이브' in text: return 'Google Workspace'
    if '모두싸인' in text: return '전자계약(모두싸인)'
    
    # --- 개발 도구 ---
    if 'github' in lower: return 'GitHub'
    if 'jetbrain' in lower or '파이참' in lower or 'pycharm' in lower: return 'JetBrains'
    if 'sentry' in lower: return 'Sentry'
    if 'sendbird' in lower: return 'Sendbird'
    if 'fingerprint' in lower: return 'Fingerprint'
    if 'apify' in lower: return 'APIFY'
    if 'readme' in lower: return 'Readme'
    if 'n8n' in lower: return 'n8n'
    if 'obsidian' in lower: return 'Obsidian'
    if 'datagrip' in lower: return 'JetBrains'
    if 'rest 클라이언트' in lower or 'postman' in lower: return 'Postman'
    if 'font awesome' in lower: return 'Font Awesome'
    if 'apple developer' in lower: return 'Apple Developer'
    if '파워오토메이트' in text or 'power automate' in lower: return 'Power Automate'
    
    # --- 데이터/분석 ---
    if 'snowflake' in lower or '스노우플레이크' in text: return 'Snowflake'
    if 'power bi' in lower or 'powerbi' in lower: return 'Power BI'
    if 'ga4' in lower: return 'GA4'
    if 'retool' in lower: return 'Retool'
    if '차트메트릭' in text: return '차트메트릭'
    if '썸트렌드' in text: return '썸트렌드'
    if '블랙키위' in text: return '블랙키위'
    if '미디엄' in text or 'medium' in lower: return 'Medium'
    
    # --- SaaS/비즈니스 ---
    if 'salesforce' in lower or 'sfdc' in lower or '세일즈포스' in text: return 'Salesforce'
    if 'marketing cloud' in lower: return 'Salesforce'
    if 'sap' in lower: return 'SAP'
    if 'oracle' in lower or '오라클' in text: return 'Oracle'
    if 'okta' in lower: return 'Okta'
    if 'docusign' in lower: return 'DocuSign'
    if '1password' in lower: return '1Password'
    if 'tibco' in lower: return 'Tibco'
    if 'adobe' in lower: return 'Adobe'
    if 'plm' in lower: return 'PLM'
    if 'sac' in lower: return 'SAC Public Option'
    
    # --- 특수 서비스 ---
    if '브랜드폴더' in text or 'brandfolder' in lower: return '브랜드폴더'
    if '스마트시트' in text or 'smartsheet' in lower: return '스마트시트'
    if '유로모니터' in text or 'euromonitor' in lower: return '유로모니터'
    if 'nox' in lower or 'influencer' in lower: return 'Nox Influencer'
    if '인플루언서' in text: return '인플루언서시스템'
    if 'wgsn' in lower or '온라인 정보' in text: return '온라인 정보사이트(WGSN)'
    if 'udemy' in lower: return 'Udemy'
    if '채용플랫폼' in text or '잡플래닛' in text or 'jobplanet' in lower or '마이다스아이티' in text: return '채용플랫폼'
    if '직원 의견' in text or '직원의견' in text: return '채용플랫폼'
    if '한국평가데이터' in text or 'cretop' in lower or '크레탑' in text: return '기업정보 서비스'
    if '에프앤가이드' in text: return '에프앤가이드'
    if '로앤비' in text or 'lawnb' in lower: return '법률정보 서비스'
    if '쇼피파이' in text or 'shopify' in lower: return 'Shopify'
    if '한국기업데이터' in text: return '기업정보 서비스'
    if '산돌' in text: return '산돌구름 폰트'
    if 'canva' in lower: return 'Canva'
    if '캡컷' in text: return '캡컷'
    if '나노바나나' in text: return '나노바나나'
    if 'varco' in lower: return 'Varco Art'
    if '이지헬프' in text or '원격 지원' in text: return '원격지원 프로그램'
    
    # --- 보안 ---
    if '방화벽' in text: return '방화벽'
    if '방문객' in text or 'qr' in lower or '엔로비' in text: return '방문객 QR시스템'
    
    # --- 크롤링 ---
    if '크롤링' in text: return '크롤링 프록시'
    
    # --- CJ APP ---
    if 'cj app' in lower or 'cjapp' in lower: return 'CJ APP'
    
    # --- EAI ---
    if 'eai' in lower: return 'EAI'
    
    # --- E-LAW ---
    if 'e-law' in lower: return 'E-LAW Chatbot'
    
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
