# -*- coding: utf-8 -*-
"""
월별 인원수 입력 템플릿 생성
"""
import pandas as pd
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

def create_headcount_template():
    """
    월별 부서별 인원수 입력 템플릿 생성
    """
    print("="*80)
    print("월별 부서별 공통부서 인원수 입력 템플릿 생성")
    print("="*80 + "\n")
    
    # 24년 1월 ~ 25년 10월 (22개월)
    months = []
    for year in [2024, 2025]:
        end_month = 12 if year == 2024 else 10
        for month in range(1, end_month + 1):
            months.append(f"{year}{month:02d}")
    
    # 공통부서 예시 (실제 부서명으로 수정 가능)
    departments = [
        '디지털본부',
        '경영지원본부',
        '재무팀',
        '인사팀',
        'IT팀',
        '법무팀',
        '전략기획팀'
    ]
    
    # 템플릿 데이터 생성 (월별 x 부서별)
    data_list = []
    for month in months:
        for dept in departments:
            data_list.append({
                '기준년월': month,
                '부서명': dept,
                '정규직인원수': 0,  # 0으로 초기화 (입력 필요)
                '비고': ''
            })
    
    df = pd.DataFrame(data_list)
    
    # 출력 디렉토리 생성
    output_dir = './out/templates'
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    # 엑셀 파일로 저장
    output_excel = f'{output_dir}/월별_공통부서_인원수_입력템플릿.xlsx'
    df.to_excel(output_excel, index=False, engine='openpyxl')
    print(f"✓ 엑셀 템플릿 생성: {output_excel}")
    
    # CSV 파일로도 저장
    output_csv = f'{output_dir}/월별_공통부서_인원수_입력템플릿.csv'
    df.to_csv(output_csv, encoding='utf-8-sig', index=False)
    print(f"✓ CSV 템플릿 생성: {output_csv}")
    
    print("\n" + "="*80)
    print("템플릿 구조")
    print("="*80)
    print(df.head(10))
    
    print("\n" + "="*80)
    print("입력 가이드")
    print("="*80)
    print("""
1. 엑셀 파일을 열어주세요:
   ./out/templates/월별_공통부서_인원수_입력템플릿.xlsx

2. 각 월별, 부서별로 '정규직인원수'를 입력하세요.
   예시:
   기준년월    부서명          정규직인원수    비고
   202401      디지털본부      25          
   202401      경영지원본부    15          
   202401      재무팀          8           
   202402      디지털본부      26          신규입사 1명
   ...

3. 부서명은 수정 가능합니다. 실제 부서명으로 변경하세요.

4. 비고 컬럼은 선택사항입니다 (예: "신규입사 2명", "퇴사 1명" 등)

5. 입력 완료 후 파일을 저장하세요.

6. 스크립트를 실행하여 자동 변환:
   python load_manual_headcount.py
    """)
    
    print("\n✅ 템플릿 생성 완료!")
    print(f"파일 위치: {output_dir}")
    
    return df


def create_sample_data():
    """
    샘플 데이터 생성 (참고용)
    """
    print("\n" + "="*80)
    print("샘플 데이터 생성 (참고용)")
    print("="*80 + "\n")
    
    import random
    
    # 샘플 데이터 (가상의 인원수)
    months = []
    for year in [2024, 2025]:
        end_month = 12 if year == 2024 else 10
        for month in range(1, end_month + 1):
            months.append(f"{year}{month:02d}")
    
    departments = [
        '디지털본부',
        '경영지원본부',
        '재무팀',
        '인사팀',
        'IT팀',
        '법무팀',
        '전략기획팀'
    ]
    
    # 부서별 기본 인원수 설정
    dept_base_headcount = {
        '디지털본부': 25,
        '경영지원본부': 15,
        '재무팀': 8,
        '인사팀': 6,
        'IT팀': 10,
        '법무팀': 4,
        '전략기획팀': 5
    }
    
    data_list = []
    for month in months:
        year = int(month[:4])
        for dept in departments:
            base = dept_base_headcount[dept]
            # 25년은 약간 감소
            if year == 2025:
                base = int(base * 0.95)
            # 랜덤 변동
            headcount = base + random.randint(-2, 2)
            data_list.append({
                '기준년월': month,
                '부서명': dept,
                '정규직인원수': headcount,
                '비고': '샘플 데이터'
            })
    
    df = pd.DataFrame(data_list)
    
    # 샘플 파일 저장
    output_dir = './out/templates'
    output_file = f'{output_dir}/월별_공통부서_인원수_샘플.xlsx'
    df.to_excel(output_file, index=False, engine='openpyxl')
    print(f"✓ 샘플 파일 생성: {output_file}")
    
    print("\n샘플 데이터 미리보기:")
    print(df)
    
    return df


if __name__ == '__main__':
    # 템플릿 생성
    create_headcount_template()
    
    # 샘플 데이터 생성
    create_sample_data()

