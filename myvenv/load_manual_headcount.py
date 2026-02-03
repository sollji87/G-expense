# -*- coding: utf-8 -*-
"""
수동 입력한 인원수 데이터 로드 및 변환
"""
import pandas as pd
import sys
import os
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')


def load_and_convert_headcount(input_file, output_dir='./out/snowflake'):
    """
    수동 입력한 인원수 파일을 로드하고 변환
    
    Parameters:
    -----------
    input_file : str
        입력 파일 경로 (엑셀 또는 CSV)
    output_dir : str
        출력 디렉토리
    """
    print("="*80)
    print("월별 인원수 데이터 로드")
    print("="*80 + "\n")
    
    # 파일 읽기
    print(f"파일 읽는 중: {input_file}")
    
    if input_file.endswith('.xlsx') or input_file.endswith('.xls'):
        df = pd.read_excel(input_file)
    else:
        df = pd.read_csv(input_file, encoding='utf-8-sig')
    
    print(f"✓ 데이터 로드 완료: {len(df)}개 행")
    
    # 필수 컬럼 확인
    required_cols = ['기준년월', '부서명', '정규직인원수']
    missing_cols = [col for col in required_cols if col not in df.columns]
    
    if missing_cols:
        print(f"❌ 필수 컬럼이 없습니다: {missing_cols}")
        print(f"현재 컬럼: {df.columns.tolist()}")
        return None
    
    # 데이터 정제
    print("\n데이터 정제 중...")
    
    # 기준년월을 문자열로 변환 (YYYYMM 형식)
    df['기준년월'] = df['기준년월'].astype(str).str.replace('-', '').str.replace('/', '')
    
    # 인원수를 숫자로 변환
    df['정규직인원수'] = pd.to_numeric(df['정규직인원수'], errors='coerce').fillna(0).astype(int)
    
    # 0인 행 확인
    zero_count = (df['정규직인원수'] == 0).sum()
    if zero_count > 0:
        print(f"⚠ 인원수가 0인 월이 {zero_count}개 있습니다. 입력을 확인해주세요.")
        print(df[df['정규직인원수'] == 0][['기준년월', '정규직인원수']])
    
    # 출력 디렉토리 생성
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    # CSV 저장
    output_file = os.path.join(output_dir, 'headcount_monthly_latest.csv')
    df.to_csv(output_file, encoding='utf-8-sig', index=False)
    print(f"\n✓ 변환 완료: {output_file}")
    
    # 통계 출력
    print("\n" + "="*80)
    print("데이터 요약")
    print("="*80)
    print(f"총 데이터 수: {len(df)}개 (월 x 부서)")
    print(f"기준년월 범위: {df['기준년월'].min()} ~ {df['기준년월'].max()}")
    print(f"부서 수: {df['부서명'].nunique()}개")
    print(f"부서 목록: {', '.join(df['부서명'].unique())}")
    
    # 월별 총 인원
    monthly_total = df.groupby('기준년월')['정규직인원수'].sum()
    print(f"\n월별 평균 총 인원: {monthly_total.mean():.1f}명")
    print(f"최소 총 인원: {monthly_total.min()}명 ({monthly_total.idxmin()})")
    print(f"최대 총 인원: {monthly_total.max()}명 ({monthly_total.idxmax()})")
    
    # 전년동월 비교 (총 인원)
    print("\n전년동월 비교 - 총 인원 (24년 vs 25년):")
    print("-" * 80)
    
    monthly_total = df.groupby('기준년월')['정규직인원수'].sum()
    
    for month in range(1, 11):  # 1월~10월
        ym_24 = f'2024{month:02d}'
        ym_25 = f'2025{month:02d}'
        
        if ym_24 in monthly_total.index and ym_25 in monthly_total.index:
            count_24 = monthly_total[ym_24]
            count_25 = monthly_total[ym_25]
            diff = count_25 - count_24
            pct = (diff / count_24 * 100) if count_24 > 0 else 0
            
            print(f"  {month:2d}월: {count_24:3.0f}명 → {count_25:3.0f}명 ({diff:+3.0f}명, {pct:+5.1f}%)")
    
    # 부서별 인원 (최신 월 기준)
    print("\n부서별 인원 (최신 월 기준):")
    print("-" * 80)
    latest_month = df['기준년월'].max()
    latest_data = df[df['기준년월'] == latest_month]
    
    for _, row in latest_data.iterrows():
        print(f"  {row['부서명']}: {row['정규직인원수']}명")
    
    print(f"\n  총계: {latest_data['정규직인원수'].sum()}명")
    
    return df


def create_pivot_from_manual(df, output_dir='./out/snowflake'):
    """
    수동 입력 데이터로 피벗 테이블 생성
    """
    print("\n" + "="*80)
    print("피벗 테이블 생성")
    print("="*80 + "\n")
    
    # 피벗 테이블 생성 (부서별 x 월별)
    pivot_df = df.pivot_table(
        index='부서명',
        columns='기준년월',
        values='정규직인원수',
        aggfunc='sum',
        fill_value=0
    )
    
    # 컬럼 정렬
    pivot_df = pivot_df.reindex(sorted(pivot_df.columns), axis=1)
    
    # 총계 행 추가
    pivot_df.loc['총계'] = pivot_df.sum()
    
    # CSV 저장
    output_file = os.path.join(output_dir, 'headcount_pivot_by_month.csv')
    pivot_df.to_csv(output_file, encoding='utf-8-sig')
    print(f"✓ 피벗 파일 저장: {output_file}")
    
    print("\n피벗 테이블 (부서별 x 월별):")
    print(pivot_df)
    
    return pivot_df


def main():
    """
    메인 함수
    """
    print("="*80)
    print("수동 입력 인원수 데이터 변환")
    print("="*80 + "\n")
    
    # 입력 파일 경로
    template_dir = './out/templates'
    input_file = os.path.join(template_dir, '월별_공통부서_인원수_입력템플릿.xlsx')
    
    # 파일 존재 확인
    if not os.path.exists(input_file):
        print(f"❌ 입력 파일을 찾을 수 없습니다: {input_file}")
        print("\n먼저 다음 명령을 실행하여 템플릿을 생성하세요:")
        print("  python create_headcount_template.py")
        print("\n그 다음 템플릿 파일에 인원수를 입력하고 다시 실행하세요.")
        return
    
    # 데이터 로드 및 변환
    df = load_and_convert_headcount(input_file)
    
    if df is not None:
        # 피벗 테이블 생성
        pivot_df = create_pivot_from_manual(df)
        
        print("\n" + "="*80)
        print("✅ 모든 처리가 완료되었습니다!")
        print("="*80)
        print("\n생성된 파일:")
        print("  1. ./out/snowflake/headcount_monthly_latest.csv - 월별 인원 데이터")
        print("  2. ./out/snowflake/headcount_pivot_by_month.csv - 월별 인원 피벗")
        print("\n이 파일들을 대시보드에서 사용할 수 있습니다.")


if __name__ == '__main__':
    main()

