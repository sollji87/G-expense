# -*- coding: utf-8 -*-
"""
202411 상세 데이터 생성 스크립트
"""
import pandas as pd
import numpy as np
import sys
import os
from pathlib import Path
import re

# 인코딩 설정
sys.stdout.reconfigure(encoding='utf-8')


def clean_amount(value):
    """금액 데이터 정제"""
    if pd.isna(value):
        return 0
    
    if isinstance(value, (int, float)):
        return float(value)
    
    value = str(value).strip()
    value = value.replace(',', '').replace(' ', '').replace('-', '').replace('_', '')
    value = re.sub(r'[^\d.-]', '', value)
    
    try:
        return float(value) if value else 0
    except:
        return 0


def normalize_yyyymm(value):
    """연도/월 정규화"""
    if pd.isna(value):
        return None
    
    value = str(value).strip()
    value = value.replace('/', '').replace('-', '')
    
    if len(value) >= 6:
        return value[:6]
    
    return None


def create_detail_data_for_month(input_file, target_month, output_dir='./out/details'):
    """
    특정 월의 상세 데이터 생성
    
    Parameters:
    -----------
    input_file : str
        입력 엑셀 파일 경로
    target_month : str
        대상 월 (YYYYMM 형식, 예: '202411')
    output_dir : str
        출력 디렉토리
    """
    print(f"\n{'='*80}")
    print(f"상세 데이터 생성: {input_file} - {target_month}월")
    print(f"{'='*80}\n")
    
    # 1. 데이터 읽기
    print("1. 엑셀 파일 읽는 중...")
    df = pd.read_excel(input_file, sheet_name=0)
    print(f"   ✓ 총 {len(df):,}개 행 로드됨")
    
    # 2. 연도/월 정규화
    print("\n2. 연도/월 정규화 중...")
    df['YYYYMM'] = df['연도/월'].apply(normalize_yyyymm)
    
    # 3. 해당 월 데이터만 필터링
    print(f"\n3. {target_month}월 데이터 필터링 중...")
    df_month = df[df['YYYYMM'] == target_month].copy()
    print(f"   ✓ {len(df_month):,}개 행 추출됨")
    
    if len(df_month) == 0:
        print(f"   ⚠ {target_month}월 데이터가 없습니다.")
        return None
    
    # 4. 금액 정제
    print("\n4. 금액 데이터 정제 중...")
    df_month['금액_정제'] = df_month['금액(현지 통화)'].apply(clean_amount)
    
    # 5. 필요한 컬럼만 선택 및 정리
    print("\n5. 필요한 컬럼 선택 중...")
    
    # 선택할 컬럼
    columns_to_keep = [
        'YYYYMM',
        '계정대분류',
        '계정중분류', 
        'G/L 계정',
        'G/L 계정 설명',
        '코스트 센터',
        '코스트센터명',
        '전표 번호',
        '전기일',
        '증빙일',
        '텍스트',  # 적요
        '거래처명',
        '공급업체',
        '금액_정제',
        '차변/대변지시자'
    ]
    
    # 존재하는 컬럼만 선택
    available_columns = [col for col in columns_to_keep if col in df_month.columns]
    df_detail = df_month[available_columns].copy()
    
    # 6. 결측값 처리
    df_detail['코스트 센터'] = df_detail['코스트 센터'].fillna('미배정')
    df_detail['코스트센터명'] = df_detail['코스트센터명'].fillna('미배정')
    df_detail['텍스트'] = df_detail['텍스트'].fillna('')
    df_detail['거래처명'] = df_detail['거래처명'].fillna('')
    
    # 7. 금액 기준 정렬 (큰 금액 우선)
    df_detail = df_detail.sort_values('금액_정제', ascending=False)
    
    # 8. 출력 디렉토리 생성
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    # 9. 전체 상세 데이터 저장
    output_file_all = os.path.join(output_dir, f'detail_{target_month}_all.csv')
    print(f"\n6. 전체 상세 데이터 저장 중: {output_file_all}")
    df_detail.to_csv(output_file_all, encoding='utf-8-sig', index=False)
    print(f"   ✓ 저장 완료! ({len(df_detail):,}개 행)")
    
    # 10. 계정별로 분리 저장
    print(f"\n7. 계정별 파일 생성 중...")
    
    gl_groups = df_detail.groupby(['계정대분류', '계정중분류', 'G/L 계정', 'G/L 계정 설명'])
    gl_count = 0
    
    for (대분류, 중분류, gl_cd, gl_nm), group_df in gl_groups:
        # 계정별 디렉토리 생성
        gl_dir = os.path.join(output_dir, target_month, f"{대분류}_{중분류}")
        Path(gl_dir).mkdir(parents=True, exist_ok=True)
        
        # 파일명: GL코드_계정명.csv
        safe_gl_nm = gl_nm.replace('/', '_').replace('\\', '_').replace(':', '_')
        output_file_gl = os.path.join(gl_dir, f"GL_{gl_cd}_{safe_gl_nm}.csv")
        
        group_df.to_csv(output_file_gl, encoding='utf-8-sig', index=False)
        gl_count += 1
    
    print(f"   ✓ {gl_count}개 계정별 파일 생성 완료!")
    
    # 11. 요약 정보
    print(f"\n{'='*80}")
    print("처리 완료 요약")
    print(f"{'='*80}")
    print(f"대상 월: {target_month}")
    print(f"총 거래 건수: {len(df_detail):,}개")
    print(f"총 금액: {df_detail['금액_정제'].sum():,.0f}원")
    print(f"계정 수: {gl_count}개")
    print(f"코스트센터 수: {df_detail['코스트 센터'].nunique()}개")
    
    print(f"\n상위 10개 거래 (금액 기준):")
    top10 = df_detail.head(10)
    for idx, row in top10.iterrows():
        print(f"  - [{row['계정대분류']}] {row['G/L 계정 설명']}: {row['금액_정제']:,.0f}원")
        if row['텍스트']:
            print(f"    적요: {row['텍스트'][:50]}...")
    
    return df_detail


def main():
    """메인 함수"""
    print("="*80)
    print("공통부서비용 상세 데이터 생성 (24년 11월)")
    print("="*80)
    
    # 24년 11월 처리
    print("\n[1/1] 24년 11월 데이터 처리")
    df_2411 = create_detail_data_for_month(
        input_file='24공통비.XLSX',
        target_month='202411',
        output_dir='./out/details'
    )
    
    print(f"\n{'='*80}")
    print("✅ 모든 처리가 완료되었습니다!")
    print(f"{'='*80}")
    print("\n생성된 파일:")
    print("  1. ./out/details/detail_202411_all.csv - 24년 11월 전체 상세 데이터")
    print("  2. ./out/details/202411/ - 24년 11월 계정별 파일들")


if __name__ == '__main__':
    main()














