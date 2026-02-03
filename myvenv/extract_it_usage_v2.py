# -*- coding: utf-8 -*-
import pandas as pd
import os
import json
import re

def normalize_text(text, vendor):
    """텍스트 정규화 - 날짜 패턴 제거 및 거래처명 기반 통합"""
    if not text or pd.isna(text):
        text = ''
    text = str(text)
    
    # 날짜 패턴 제거 (더 강력하게)
    # 25.01월_, 25.02월_ 등
    text = re.sub(r'^\d{2}\.\d{1,2}월?_?\s*', '', text)
    # 2025.01_, 2024.12_ 등
    text = re.sub(r'^\d{4}\.\d{1,2}_?\s*', '', text)
    # 25년 1월, 24년 12월 등
    text = re.sub(r'^\d{2}년\s*\d{1,2}월\s*', '', text)
    # 2025년 1월 등
    text = re.sub(r'^\d{4}년도?\s*\d{0,2}월?\s*', '', text)
    # 앞에 붙은 숫자 (20, 24, 25 등)
    text = re.sub(r'^20\d{2}\s*', '', text)
    text = re.sub(r'^2[0-5]\s+', '', text)
    text = re.sub(r'^20\s+', '', text)
    # 1월, 2월 등 단독 월 표시
    text = re.sub(r'^\d{1,2}월\s*', '', text)
    # 앞의 숫자와 언더스코어
    text = re.sub(r'^\d+_', '', text)
    # 중간에 있는 날짜 패턴
    text = re.sub(r'\d{2}\.\d{1,2}월?\s*', '', text)
    text = re.sub(r'\d{4}\.\d{1,2}\s*', '', text)
    text = re.sub(r'\d{2}년\s*\d{1,2}월\s*', '', text)
    # (1차), (2차), (1분기) 등 제거
    text = re.sub(r'\(\d+[차분기]+\)', '', text)
    text = re.sub(r'\(\d+월?\)', '', text)
    
    # 언더스코어를 공백으로
    text = text.replace('_', ' ')
    # 다중 공백 제거
    text = re.sub(r'\s+', ' ', text).strip()
    
    # 특정 키워드로 통합
    lower = text.lower()
    
    # AWS 관련 통합 (FNF AWS인프라 포함)
    if 'aws' in lower:
        return 'AWS 인프라'
    # Alibaba Cloud 통합
    if 'alibaba' in lower:
        return 'Alibaba Cloud'
    # 1Password 통합
    if '1password' in lower or 'password' in lower:
        return '1Password'
    # Atlassian 통합
    if 'atlassian' in lower:
        return 'Atlassian'
    # Miro 통합
    if 'miro' in lower:
        return 'Miro'
    # Retool 통합
    if 'retool' in lower:
        return 'Retool'
    # MS 365 통합 (Office 365 포함)
    if 'm365' in lower or 'ms365' in lower or 'office 365' in lower or 'office365' in lower:
        return 'MS 365'
    # MS로 시작하는 것들 → MS365 외
    if lower.startswith('ms') or 'microsoft' in lower:
        return 'MS365 외'
    # Slack 통합
    if 'slack' in lower:
        return 'Slack'
    # PLM 통합
    if 'plm' in lower:
        return 'PLM'
    # GA4 통합
    if 'ga4' in lower:
        return 'GA4'
    # Github 통합
    if 'github' in lower:
        return 'GitHub'
    # Jetbrain 통합
    if 'jetbrain' in lower:
        return 'JetBrains'
    # 카카오워크 통합
    if '카카오' in text:
        return '카카오워크'
    # Marketing Cloud → Salesforce 통합
    if 'marketing cloud' in lower:
        return 'Salesforce'
    # 계정 대체 → Salesforce 통합
    if '계정 대체' in text or '계정대체' in text:
        return 'Salesforce'
    # Okta 통합
    if 'okta' in lower:
        return 'Okta'
    # Oracle 통합
    if 'oracle' in lower:
        return 'Oracle'
    # SAP 통합
    if 'sap' in lower:
        return 'SAP'
    # Salesforce 통합
    if 'sfdc' in lower or 'salesforce' in lower:
        return 'Salesforce'
    # Tibco 통합
    if 'tibco' in lower:
        return 'Tibco'
    # Figma 통합
    if 'figma' in lower:
        return 'Figma'
    # Docusign 통합
    if 'docusign' in lower:
        return 'DocuSign'
    # Power BI 통합
    if 'powerbi' in lower or 'power bi' in lower:
        return 'Power BI'
    # Zoom 통합
    if 'zoom' in lower:
        return 'Zoom'
    # Sentry 통합
    if 'sentry' in lower:
        return 'Sentry'
    # Adobe 통합
    if 'adobe' in lower:
        return 'Adobe'
    # Notion 통합 (노션 포함)
    if 'notion' in lower or '노션' in text:
        return 'Notion'
    # 인플루언서시스템 통합
    if '인플루언서' in text:
        return '인플루언서시스템'
    # 브랜드폴더 통합
    if '브랜드폴더' in text or 'brandfolder' in lower:
        return '브랜드폴더'
    # 스마트시트 통합
    if '스마트시트' in text or 'smartsheet' in lower:
        return '스마트시트'
    # 유로모니터 통합
    if '유로모니터' in text or 'euromonitor' in lower:
        return '유로모니터'
    # HR 채용플랫폼 통합 (잡플래닛, 직원 의견 조사 포함)
    if '채용플랫폼' in text or '잡플래닛' in text or 'jobplanet' in lower or '직원 의견' in text or '직원의견' in text:
        return '채용플랫폼'
    # 경영관리팀 SAC Public Option 통합
    if 'sac' in lower or 'public option' in lower:
        return 'SAC Public Option'
    # 정보보안팀 방화벽 통합
    if '방화벽' in text or 'firewall' in lower:
        return '방화벽'
    # 이비즈 CJ APP 통합
    if 'cj app' in lower or 'cjapp' in lower or 'cj앱' in text:
        return 'CJ APP'
    # 총무 방문객 QR시스템 통합 (엔로비 포함)
    if '방문객' in text or 'qr' in lower or '총무' in text or '엔로비' in text or 'nlobby' in lower:
        return '방문객 QR시스템'
    # 소비자전략팀 온라인 정보사이트(WGSN) 통합
    if '온라인 정보' in text or '온라인정보' in text or 'wgsn' in lower:
        return '온라인 정보사이트(WGSN)'
    
    # 텍스트가 너무 짧으면 거래처명 사용
    if len(text) < 3 and vendor and not pd.isna(vendor) and str(vendor).strip():
        return str(vendor).strip()
    
    return text if text else (str(vendor).strip() if vendor and not pd.isna(vendor) else 'Unknown')

def extract_it_usage():
    output_data = {
        '2024': [],
        '2025': []
    }
    
    files = [
        ('24공통비.XLSX', '2024'),
        ('25공통비.XLSX', '2025')
    ]
    
    for filename, year in files:
        if not os.path.exists(filename):
            print(f"{filename} 파일 없음")
            continue
            
        print(f"\n{filename} 로딩 중...")
        df = pd.read_excel(filename)
        print(f"원장: {len(df)}행")
        
        # 컬럼명 매핑 (인덱스 기반)
        gl_col = df.columns[4]  # G/L 계정 설명
        period_col = df.columns[1]  # 기간/월
        text_col = df.columns[21]  # 텍스트
        vendor_col = df.columns[24]  # 거래처명
        amount_col = df.columns[16]  # 금액(문서 통화)
        cctr_col = df.columns[29]  # 코스트센터명
        assign_col = df.columns[30]  # 지정
        ref3_col = df.columns[34]  # 참조 키 3
        
        print(f"G/L계정설명: {gl_col}")
        print(f"텍스트: {text_col}")
        print(f"지정: {assign_col}")
        print(f"거래처명: {vendor_col}")
        print(f"참조키3: {ref3_col}")
        
        # IT사용료 필터링
        mask = df[gl_col].astype(str).str.contains('IT사용료', na=False)
        filtered = df[mask].copy()
        print(f"IT사용료 필터 후: {len(filtered)}행")
        
        # 지정탭 값 샘플 확인
        sample_assigns = filtered[assign_col].dropna().head(30).tolist()
        print(f"지정 샘플: {sample_assigns[:10]}")
        
        # 4265, 6243으로 시작하는 지정 건수 확인
        count_4265 = sum(1 for _, row in filtered.iterrows() 
                        if str(row[assign_col]).startswith('4265'))
        count_6243 = sum(1 for _, row in filtered.iterrows() 
                        if str(row[assign_col]).startswith('6243'))
        print(f"지정 4265로 시작: {count_4265}건")
        print(f"지정 6243으로 시작: {count_6243}건")
        
        for _, row in filtered.iterrows():
            # 기간/월 추출
            period = str(row[period_col]) if pd.notna(row[period_col]) else ''
            month = period.split('/')[-1] if '/' in period else period[-2:] if len(period) >= 2 else ''
            try:
                month = str(int(month)).zfill(2)
            except:
                month = ''
            
            # 지정 값 확인
            assign_val = str(row[assign_col]) if pd.notna(row[assign_col]) else ''
            
            text = str(row[text_col]) if pd.notna(row[text_col]) else ''
            vendor = str(row[vendor_col]) if pd.notna(row[vendor_col]) else ''
            ref3_vendor = str(row[ref3_col]) if pd.notna(row[ref3_col]) else ''
            cctr = str(row[cctr_col]) if pd.notna(row[cctr_col]) else ''
            
            # 거래처명은 거래처명 컬럼 또는 참조키3 사용
            final_vendor = vendor if vendor and vendor != 'nan' else ref3_vendor
            
            try:
                amount = float(row[amount_col]) if pd.notna(row[amount_col]) else 0
            except:
                amount = 0
            
            if amount > 0 and month:
                # 지정이 4265 또는 6243으로 시작하면 임직원 AI사용료
                if assign_val.startswith('4265') or assign_val.startswith('6243'):
                    normalized_text = '임직원 AI사용료'
                else:
                    normalized_text = normalize_text(text, final_vendor)
                
                output_data[year].append({
                    'month': month,
                    'text': normalized_text,
                    'original_text': text,
                    'vendor': final_vendor,
                    'cctr': cctr.replace('공통_', '').replace('[CLSD]공통_', '').replace('[CLSD]', ''),
                    'assign': assign_val,
                    'amount': amount  # 원 단위로 저장 (합산 후 백만원 변환)
                })
    
    # JSON 파일로 저장
    output_path = 'out/it_usage_details.json'
    os.makedirs('out', exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n저장 완료: {output_path}")
    print(f"2024년: {len(output_data['2024'])}건")
    print(f"2025년: {len(output_data['2025'])}건")
    
    # 정규화된 텍스트 통계
    text_counts = {}
    for item in output_data['2025']:
        text_counts[item['text']] = text_counts.get(item['text'], 0) + 1
    
    print("\n=== 2025년 정규화된 텍스트 (상위 30개) ===")
    for text, count in sorted(text_counts.items(), key=lambda x: -x[1])[:30]:
        print(f"{count:4d} | {text[:60]}")

if __name__ == '__main__':
    extract_it_usage()
