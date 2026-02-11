# -*- coding: utf-8 -*-
import pandas as pd
import os
import json

def extract_it_usage():
    output_data = {
        '2024': [],
        '2025': [],
        '2026': []
    }
    
    # 2024년 원장
    if os.path.exists('24공통비.XLSX'):
        print("24공통비.XLSX 로딩 중...")
        df = pd.read_excel('24공통비.XLSX')
        print(f"2024년 원장: {len(df)}행")
        
        # 컬럼명 확인
        gl_col = 'G/L 계정 설명' if 'G/L 계정 설명' in df.columns else df.columns[4]
        period_col = '기간/월' if '기간/월' in df.columns else df.columns[1]
        text_col = '텍스트' if '텍스트' in df.columns else df.columns[21]
        vendor_col = '거래처명' if '거래처명' in df.columns else df.columns[24]
        amount_col = '금액(문서 통화)' if '금액(문서 통화)' in df.columns else df.columns[16]
        cctr_col = '코스트센터명' if '코스트센터명' in df.columns else df.columns[29]
        
        # IT사용료 필터링
        mask = df[gl_col].astype(str).str.contains('IT사용료', na=False)
        filtered = df[mask].copy()
        print(f"IT사용료 필터 후: {len(filtered)}행")
        
        for _, row in filtered.iterrows():
            period = str(row[period_col]) if pd.notna(row[period_col]) else ''
            month = period.split('/')[-1] if '/' in period else period[-2:] if len(period) >= 2 else ''
            try:
                month = str(int(month)).zfill(2)
            except:
                month = ''
            
            text = str(row[text_col]) if pd.notna(row[text_col]) else ''
            vendor = str(row[vendor_col]) if pd.notna(row[vendor_col]) else ''
            cctr = str(row[cctr_col]) if pd.notna(row[cctr_col]) else ''
            
            try:
                amount = float(row[amount_col]) if pd.notna(row[amount_col]) else 0
            except:
                amount = 0
            
            if amount > 0 and month:
                output_data['2024'].append({
                    'month': month,
                    'text': text,
                    'vendor': vendor,
                    'cctr': cctr.replace('공통_', '').replace('[CLSD]공통_', '').replace('[CLSD]', ''),
                    'amount': round(amount / 1_000_000)
                })
    
    # 2025년 원장
    if os.path.exists('25공통비.XLSX'):
        print("\n25공통비.XLSX 로딩 중...")
        df = pd.read_excel('25공통비.XLSX')
        print(f"2025년 원장: {len(df)}행")
        
        # 컬럼명 확인
        gl_col = 'G/L 계정 설명' if 'G/L 계정 설명' in df.columns else df.columns[4]
        period_col = '기간/월' if '기간/월' in df.columns else df.columns[1]
        text_col = '텍스트' if '텍스트' in df.columns else df.columns[21]
        vendor_col = '거래처명' if '거래처명' in df.columns else df.columns[24]
        amount_col = '금액(문서 통화)' if '금액(문서 통화)' in df.columns else df.columns[16]
        cctr_col = '코스트센터명' if '코스트센터명' in df.columns else df.columns[29]
        
        # IT사용료 필터링
        mask = df[gl_col].astype(str).str.contains('IT사용료', na=False)
        filtered = df[mask].copy()
        print(f"IT사용료 필터 후: {len(filtered)}행")
        
        for _, row in filtered.iterrows():
            period = str(row[period_col]) if pd.notna(row[period_col]) else ''
            month = period.split('/')[-1] if '/' in period else period[-2:] if len(period) >= 2 else ''
            try:
                month = str(int(month)).zfill(2)
            except:
                month = ''
            
            text = str(row[text_col]) if pd.notna(row[text_col]) else ''
            vendor = str(row[vendor_col]) if pd.notna(row[vendor_col]) else ''
            cctr = str(row[cctr_col]) if pd.notna(row[cctr_col]) else ''
            
            try:
                amount = float(row[amount_col]) if pd.notna(row[amount_col]) else 0
            except:
                amount = 0
            
            if amount > 0 and month:
                output_data['2025'].append({
                    'month': month,
                    'text': text,
                    'vendor': vendor,
                    'cctr': cctr.replace('공통_', '').replace('[CLSD]공통_', '').replace('[CLSD]', ''),
                    'amount': round(amount / 1_000_000)
                })
    
    # 2026년 원장
    if os.path.exists('26공통비.XLSX'):
        print("\n26공통비.XLSX 로딩 중...")
        df = pd.read_excel('26공통비.XLSX')
        print(f"2026년 원장: {len(df)}행")
        
        # 컬럼명 확인
        gl_col = 'G/L 계정 설명' if 'G/L 계정 설명' in df.columns else df.columns[4]
        period_col = '기간/월' if '기간/월' in df.columns else df.columns[1]
        text_col = '텍스트' if '텍스트' in df.columns else df.columns[21]
        vendor_col = '거래처명' if '거래처명' in df.columns else df.columns[24]
        amount_col = '금액(문서 통화)' if '금액(문서 통화)' in df.columns else df.columns[16]
        cctr_col = '코스트센터명' if '코스트센터명' in df.columns else df.columns[29]
        
        # IT사용료 필터링
        mask = df[gl_col].astype(str).str.contains('IT사용료', na=False)
        filtered = df[mask].copy()
        print(f"IT사용료 필터 후: {len(filtered)}행")
        
        for _, row in filtered.iterrows():
            period = str(row[period_col]) if pd.notna(row[period_col]) else ''
            month = period.split('/')[-1] if '/' in period else period[-2:] if len(period) >= 2 else ''
            try:
                month = str(int(month)).zfill(2)
            except:
                month = ''
            
            text = str(row[text_col]) if pd.notna(row[text_col]) else ''
            vendor = str(row[vendor_col]) if pd.notna(row[vendor_col]) else ''
            cctr = str(row[cctr_col]) if pd.notna(row[cctr_col]) else ''
            
            try:
                amount = float(row[amount_col]) if pd.notna(row[amount_col]) else 0
            except:
                amount = 0
            
            if amount > 0 and month:
                output_data['2026'].append({
                    'month': month,
                    'text': text,
                    'vendor': vendor,
                    'cctr': cctr.replace('공통_', '').replace('[CLSD]공통_', '').replace('[CLSD]', ''),
                    'amount': round(amount / 1_000_000)
                })
    
    # JSON 파일로 저장
    output_path = 'out/it_usage_details.json'
    os.makedirs('out', exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n저장 완료: {output_path}")
    print(f"2024년: {len(output_data['2024'])}건")
    print(f"2025년: {len(output_data['2025'])}건")
    print(f"2026년: {len(output_data['2026'])}건")

if __name__ == '__main__':
    extract_it_usage()
