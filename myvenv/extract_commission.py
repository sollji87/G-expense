# -*- coding: utf-8 -*-
"""
지급수수료 데이터 추출 스크립트
공통비 원장에서 지급수수료 관련 계정 데이터를 추출하여 JSON으로 저장
"""
import pandas as pd
import os
import json
import re

def normalize_text(text, vendor):
    """텍스트 정규화 - 날짜 패턴 제거 및 거래처명 기반 통합"""
    if not text or pd.isna(text):
        text = ''
    text = str(text)
    
    # 날짜 패턴 제거
    text = re.sub(r'^\d{2}\.\d{1,2}월?_?\s*', '', text)
    text = re.sub(r'^\d{4}\.\d{1,2}_?\s*', '', text)
    text = re.sub(r'^\d{2}년\s*\d{1,2}월\s*', '', text)
    text = re.sub(r'^\d{4}년도?\s*\d{0,2}월?\s*', '', text)
    text = re.sub(r'^20\d{2}\s*', '', text)
    text = re.sub(r'^2[0-5]\s+', '', text)
    text = re.sub(r'^20\s+', '', text)
    text = re.sub(r'^\d{1,2}월\s*', '', text)
    text = re.sub(r'^\d+_', '', text)
    text = re.sub(r'\d{2}\.\d{1,2}월?\s*', '', text)
    text = re.sub(r'\d{4}\.\d{1,2}\s*', '', text)
    text = re.sub(r'\d{2}년\s*\d{1,2}월\s*', '', text)
    text = re.sub(r'\(\d+[차분기]+\)', '', text)
    text = re.sub(r'\(\d+월?\)', '', text)
    
    # 언더스코어를 공백으로
    text = text.replace('_', ' ')
    # 다중 공백 제거
    text = re.sub(r'\s+', ' ', text).strip()
    
    # 텍스트가 너무 짧으면 거래처명 사용
    if len(text) < 3 and vendor and not pd.isna(vendor) and str(vendor).strip():
        return str(vendor).strip()
    
    return text if text else (str(vendor).strip() if vendor and not pd.isna(vendor) else 'Unknown')

def extract_commission():
    output_data = {
        '2024': [],
        '2025': []
    }
    
    files = [
        ('24공통비.XLSX', '2024'),
        ('25공통비.XLSX', '2025')
    ]
    
    # 지급수수료 관련 G/L 계정 설명 패턴 (IT수수료 제외)
    commission_accounts = [
        '지급수수료_그룹CI사용료',
        '지급수수료_회계감사',
        '지급수수료_법률자문료',
        '지급수수료_컨설팅',
        '지급수수료_물류운송비',
        '지급수수료_물류용역비',
        '지급수수료_온라인몰운영비',
        '지급수수료_매장보수대',
        '지급수수료_인사채용',
        '지급수수료_교육훈련',
        '지급수수료_공증_등기',
        '지급수수료_폐기물처리',
        '지급수수료_퀵서비스',
        '지급수수료_보안',
        '지급수수료_리스료(차량)',
        '지급수수료_렌탈료(차량)',
        '지급수수료_렌탈료(차량제외)',
        '지급수수료_기타',
        '지급수수료_지급용역비',
        '지급수수료_이체수수료',
        '지급수수료_안전보건진단',
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
        ref3_col = df.columns[34]  # 참조 키 3
        
        print(f"G/L계정설명: {gl_col}")
        print(f"텍스트: {text_col}")
        print(f"거래처명: {vendor_col}")
        
        # 지급수수료 필터링 (IT사용료, IT유지보수비 제외)
        def is_commission_account(gl_desc):
            gl_str = str(gl_desc)
            # IT수수료는 제외
            if 'IT사용료' in gl_str or 'IT유지보수비' in gl_str:
                return False
            # 지급수수료로 시작하는 것만
            return gl_str.startswith('지급수수료_')
        
        mask = df[gl_col].apply(is_commission_account)
        filtered = df[mask].copy()
        print(f"지급수수료 필터 후: {len(filtered)}행")
        
        # 계정별 건수 확인
        account_counts = filtered[gl_col].value_counts()
        print("\n계정별 건수 (상위 10개):")
        for acc, cnt in account_counts.head(10).items():
            print(f"  {acc}: {cnt}건")
        
        for _, row in filtered.iterrows():
            # 기간/월 추출
            period = str(row[period_col]) if pd.notna(row[period_col]) else ''
            month = period.split('/')[-1] if '/' in period else period[-2:] if len(period) >= 2 else ''
            try:
                month = str(int(month)).zfill(2)
            except:
                month = ''
            
            gl_desc = str(row[gl_col]) if pd.notna(row[gl_col]) else ''
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
            
            if amount != 0 and month:  # 음수 금액도 포함 (대변)
                normalized_text = normalize_text(text, final_vendor)
                
                output_data[year].append({
                    'month': month,
                    'account': gl_desc,  # 계정 설명 추가
                    'text': normalized_text,
                    'original_text': text,
                    'vendor': final_vendor,
                    'cctr': cctr.replace('공통_', '').replace('[CLSD]공통_', '').replace('[CLSD]', ''),
                    'amount': amount  # 원 단위로 저장
                })
    
    # JSON 파일로 저장
    output_path = 'out/commission_details.json'
    os.makedirs('out', exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n저장 완료: {output_path}")
    print(f"2024년: {len(output_data['2024'])}건")
    print(f"2025년: {len(output_data['2025'])}건")
    
    # 계정별 통계
    account_stats = {}
    for item in output_data['2025']:
        acc = item['account']
        account_stats[acc] = account_stats.get(acc, 0) + 1
    
    print("\n=== 2025년 계정별 건수 ===")
    for acc, count in sorted(account_stats.items(), key=lambda x: -x[1]):
        print(f"{count:4d} | {acc}")

if __name__ == '__main__':
    extract_commission()
