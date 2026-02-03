# -*- coding: utf-8 -*-
"""
공통부서비용 데이터 정제 스크립트
목적: 엑셀 원장 데이터를 피벗 형태로 집계하여 CSV 출력
"""
import pandas as pd
import numpy as np
import argparse
import os
import sys
from pathlib import Path
import re

# 인코딩 설정
sys.stdout.reconfigure(encoding='utf-8')


def clean_amount(value):
    """
    금액 데이터 정제: 콤마, 공백, 하이픈, 문자 제거 후 숫자로 변환
    """
    if pd.isna(value):
        return 0
    
    if isinstance(value, (int, float)):
        return float(value)
    
    # 문자열인 경우 정제
    value = str(value).strip()
    value = value.replace(',', '').replace(' ', '').replace('-', '').replace('_', '')
    
    # 숫자가 아닌 문자 제거 (음수 부호와 소수점은 유지)
    value = re.sub(r'[^\d.-]', '', value)
    
    try:
        return float(value) if value else 0
    except:
        return 0


def normalize_yyyymm(value):
    """
    연도/월 정규화: 다양한 형식을 YYYYMM으로 통일
    예: 2024/01, 2024-01, 202401 → 202401
    """
    if pd.isna(value):
        return None
    
    value = str(value).strip()
    
    # 슬래시나 하이픈 제거
    value = value.replace('/', '').replace('-', '')
    
    # YYYYMM 형식 추출 (앞 6자리)
    if len(value) >= 6:
        return value[:6]
    
    return None


def process_excel_to_pivot(input_file, sheet_name=0, output_dir='./out'):
    """
    엑셀 파일을 읽어 피벗 형태로 집계
    
    Parameters:
    -----------
    input_file : str
        입력 엑셀 파일 경로
    sheet_name : int or str
        시트 이름 또는 인덱스 (기본값: 0)
    output_dir : str
        출력 디렉토리 (기본값: ./out)
    """
    print(f"\n{'='*80}")
    print(f"데이터 정제 시작: {input_file}")
    print(f"{'='*80}\n")
    
    # 1. 데이터 읽기
    print("1. 엑셀 파일 읽는 중...")
    df = pd.read_excel(input_file, sheet_name=sheet_name)
    print(f"   ✓ 총 {len(df):,}개 행 로드됨")
    
    # 2. 필수 컬럼 확인
    required_cols = ['연도/월', 'G/L 계정', 'G/L 계정 설명', '금액(현지 통화)', '계정대분류', '계정중분류', '코스트 센터', '코스트센터명']
    missing_cols = [col for col in required_cols if col not in df.columns]
    
    if missing_cols:
        raise ValueError(f"필수 컬럼이 없습니다: {missing_cols}")
    
    # 3. 연도/월 정규화
    print("\n2. 연도/월 정규화 중...")
    df['YYYYMM'] = df['연도/월'].apply(normalize_yyyymm)
    df = df[df['YYYYMM'].notna()]  # 연월이 없는 행 제거
    print(f"   ✓ {len(df):,}개 행 (유효한 연월만)")
    
    # 4. 금액 정제
    print("\n3. 금액 데이터 정제 중...")
    df['금액_정제'] = df['금액(현지 통화)'].apply(clean_amount)
    print(f"   ✓ 금액 합계: {df['금액_정제'].sum():,.0f}원")
    
    # 5. 코스트센터 정제 (결측값 처리)
    print("\n4. 코스트센터 정제 중...")
    df['코스트 센터'] = df['코스트 센터'].fillna('미배정')
    df['코스트센터명'] = df['코스트센터명'].fillna('미배정')
    print(f"   ✓ 코스트센터 수: {df['코스트 센터'].nunique()}개")
    
    # 6. 피벗 테이블 생성 - 계정별 (기본)
    print("\n5. 피벗 테이블 생성 중 (계정별)...")
    pivot_gl = df.pivot_table(
        index=['계정대분류', '계정중분류', 'G/L 계정', 'G/L 계정 설명'],
        columns='YYYYMM',
        values='금액_정제',
        aggfunc='sum',
        fill_value=0
    )
    
    # 컬럼(연월) 정렬
    pivot_gl = pivot_gl.reindex(sorted(pivot_gl.columns), axis=1)
    
    print(f"   ✓ 계정별 피벗 테이블 생성 완료")
    print(f"   - 행(계정): {len(pivot_gl)}개")
    print(f"   - 열(연월): {len(pivot_gl.columns)}개")
    print(f"   - 연월 범위: {pivot_gl.columns[0]} ~ {pivot_gl.columns[-1]}")
    
    # 7. 피벗 테이블 생성 - 계정+코스트센터별 (드릴다운용)
    print("\n6. 피벗 테이블 생성 중 (계정+코스트센터별)...")
    pivot_cctr = df.pivot_table(
        index=['계정대분류', '계정중분류', 'G/L 계정', 'G/L 계정 설명', '코스트 센터', '코스트센터명'],
        columns='YYYYMM',
        values='금액_정제',
        aggfunc='sum',
        fill_value=0
    )
    
    # 컬럼(연월) 정렬
    pivot_cctr = pivot_cctr.reindex(sorted(pivot_cctr.columns), axis=1)
    
    print(f"   ✓ 계정+코스트센터별 피벗 테이블 생성 완료")
    print(f"   - 행(계정+코스트센터): {len(pivot_cctr)}개")
    print(f"   - 열(연월): {len(pivot_cctr.columns)}개")
    
    # 8. 출력 디렉토리 생성
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    # 9. CSV 저장 - 계정별
    output_file_gl = os.path.join(output_dir, 'pivot_by_gl_yyyymm.csv')
    print(f"\n7. CSV 파일 저장 중: {output_file_gl}")
    pivot_gl.to_csv(output_file_gl, encoding='utf-8-sig')
    print(f"   ✓ 계정별 파일 저장 완료!")
    
    # 10. CSV 저장 - 계정+코스트센터별
    output_file_cctr = os.path.join(output_dir, 'pivot_by_gl_cctr_yyyymm.csv')
    print(f"\n8. CSV 파일 저장 중: {output_file_cctr}")
    pivot_cctr.to_csv(output_file_cctr, encoding='utf-8-sig')
    print(f"   ✓ 계정+코스트센터별 파일 저장 완료!")
    
    # 11. 요약 정보 출력
    print(f"\n{'='*80}")
    print("처리 완료 요약")
    print(f"{'='*80}")
    print(f"입력 파일: {input_file}")
    print(f"출력 파일:")
    print(f"  1. 계정별: {output_file_gl}")
    print(f"  2. 계정+코스트센터별: {output_file_cctr}")
    print(f"총 계정 수: {len(pivot_gl)}개")
    print(f"총 계정+코스트센터 조합: {len(pivot_cctr)}개")
    print(f"연월 범위: {', '.join(pivot_gl.columns)}")
    print(f"\n상위 5개 계정 (금액 합계 기준):")
    
    # 각 계정별 총합 계산
    pivot_gl['총합'] = pivot_gl.sum(axis=1)
    top5 = pivot_gl.nlargest(5, '총합')
    
    for idx, (index, row) in enumerate(top5.iterrows(), 1):
        대분류, 중분류, gl_cd, gl_nm = index
        print(f"  {idx}. [{대분류}] {gl_nm} (G/L: {gl_cd}): {row['총합']:,.0f}원")
    
    return {'gl': pivot_gl, 'cctr': pivot_cctr}


def process_multiple_files(file_list, output_dir='./out'):
    """
    여러 엑셀 파일을 통합 처리
    """
    all_gl_dfs = []
    all_cctr_dfs = []
    
    for file_path in file_list:
        if not os.path.exists(file_path):
            print(f"⚠ 파일을 찾을 수 없습니다: {file_path}")
            continue
        
        result = process_excel_to_pivot(file_path, output_dir=output_dir)
        all_gl_dfs.append(result['gl'])
        all_cctr_dfs.append(result['cctr'])
    
    if len(all_gl_dfs) > 1:
        print(f"\n{'='*80}")
        print("통합 피벗 테이블 생성 중...")
        print(f"{'='*80}\n")
        
        # 계정별 통합
        print("1. 계정별 통합 중...")
        combined_gl = pd.concat(all_gl_dfs, axis=1)
        combined_gl = combined_gl.groupby(level=0, axis=1).sum()
        combined_gl = combined_gl.reindex(sorted(combined_gl.columns), axis=1)
        
        output_file_gl = os.path.join(output_dir, 'pivot_by_gl_yyyymm_combined.csv')
        combined_gl.to_csv(output_file_gl, encoding='utf-8-sig')
        
        print(f"   ✓ 계정별 통합 파일 저장: {output_file_gl}")
        print(f"   - 총 계정 수: {len(combined_gl)}개")
        print(f"   - 연월 범위: {combined_gl.columns[0]} ~ {combined_gl.columns[-1]}")
        
        # 계정+코스트센터별 통합
        print("\n2. 계정+코스트센터별 통합 중...")
        combined_cctr = pd.concat(all_cctr_dfs, axis=1)
        combined_cctr = combined_cctr.groupby(level=0, axis=1).sum()
        combined_cctr = combined_cctr.reindex(sorted(combined_cctr.columns), axis=1)
        
        output_file_cctr = os.path.join(output_dir, 'pivot_by_gl_cctr_yyyymm_combined.csv')
        combined_cctr.to_csv(output_file_cctr, encoding='utf-8-sig')
        
        print(f"   ✓ 계정+코스트센터별 통합 파일 저장: {output_file_cctr}")
        print(f"   - 총 계정+코스트센터 조합: {len(combined_cctr)}개")
        print(f"   - 연월 범위: {combined_cctr.columns[0]} ~ {combined_cctr.columns[-1]}")
        
        return {'gl': combined_gl, 'cctr': combined_cctr}
    
    return all_gl_dfs[0] if all_gl_dfs else None


def main():
    """
    메인 함수: CLI 인터페이스
    """
    parser = argparse.ArgumentParser(
        description='공통부서비용 엑셀 데이터를 피벗 형태로 집계하여 CSV 출력',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
사용 예시:
  # 단일 파일 처리
  python excel.py --input 24공통비.XLSX
  
  # 여러 파일 통합 처리
  python excel.py --input 24공통비.XLSX 25공통비.XLSX
  
  # 출력 경로 지정
  python excel.py --input 24공통비.XLSX --outdir ./output
  
  # 특정 시트 지정
  python excel.py --input 24공통비.XLSX --sheet "Sheet1"
        """
    )
    
    parser.add_argument(
        '--input', '-i',
        nargs='+',
        required=True,
        help='입력 엑셀 파일 경로 (여러 파일 가능)'
    )
    
    parser.add_argument(
        '--sheet', '-s',
        default=0,
        help='시트 이름 또는 인덱스 (기본값: 0)'
    )
    
    parser.add_argument(
        '--outdir', '-o',
        default='./out',
        help='출력 디렉토리 (기본값: ./out)'
    )
    
    args = parser.parse_args()
    
    try:
        # 시트 인덱스를 숫자로 변환 시도
        try:
            sheet = int(args.sheet)
        except:
            sheet = args.sheet
        
        # 파일 처리
        if len(args.input) == 1:
            process_excel_to_pivot(args.input[0], sheet_name=sheet, output_dir=args.outdir)
        else:
            process_multiple_files(args.input, output_dir=args.outdir)
        
        print(f"\n{'='*80}")
        print("✅ 모든 처리가 완료되었습니다!")
        print(f"{'='*80}\n")
        
    except Exception as e:
        print(f"\n❌ 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

