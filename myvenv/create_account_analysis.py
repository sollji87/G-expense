import pandas as pd
import os
from pathlib import Path

def analyze_account_details(current_month='202510', previous_month='202410'):
    """
    GL 계정별 전년 대비 차이 분석 CSV 생성
    """
    
    base_path = Path('out/details')
    current_path = base_path / current_month
    previous_path = base_path / previous_month
    
    if not current_path.exists() or not previous_path.exists():
        print(f"❌ 경로를 찾을 수 없습니다: {current_path} 또는 {previous_path}")
        return
    
    print(f"📊 분석 시작: {previous_month} vs {current_month}")
    
    # 모든 CSV 파일 읽기
    current_data = []
    previous_data = []
    
    # 당년 데이터 읽기
    print(f"📂 {current_month} 데이터 로드 중...")
    for folder in current_path.iterdir():
        if folder.is_dir():
            for csv_file in folder.glob('*.csv'):
                try:
                    df = pd.read_csv(csv_file, encoding='utf-8-sig')
                    current_data.append(df)
                except Exception as e:
                    print(f"⚠️  파일 읽기 실패: {csv_file.name} - {e}")
    
    # 전년 데이터 읽기
    print(f"📂 {previous_month} 데이터 로드 중...")
    for folder in previous_path.iterdir():
        if folder.is_dir():
            for csv_file in folder.glob('*.csv'):
                try:
                    df = pd.read_csv(csv_file, encoding='utf-8-sig')
                    previous_data.append(df)
                except Exception as e:
                    print(f"⚠️  파일 읽기 실패: {csv_file.name} - {e}")
    
    # 데이터 합치기
    current_df = pd.concat(current_data, ignore_index=True) if current_data else pd.DataFrame()
    previous_df = pd.concat(previous_data, ignore_index=True) if previous_data else pd.DataFrame()
    
    print(f"✅ 당년 데이터: {len(current_df):,}건")
    print(f"✅ 전년 데이터: {len(previous_df):,}건")
    
    # GL 계정별 집계
    print("\n📊 GL 계정별 집계 중...")
    
    current_by_gl = current_df.groupby('G/L 계정 설명')['금액'].sum().reset_index()
    current_by_gl.columns = ['GL계정', '당년금액']
    
    previous_by_gl = previous_df.groupby('G/L 계정 설명')['금액'].sum().reset_index()
    previous_by_gl.columns = ['GL계정', '전년금액']
    
    # 합치기
    analysis = pd.merge(current_by_gl, previous_by_gl, on='GL계정', how='outer').fillna(0)
    analysis['차이'] = analysis['당년금액'] - analysis['전년금액']
    analysis['YOY'] = analysis.apply(
        lambda x: (x['당년금액'] / x['전년금액'] * 100) if x['전년금액'] != 0 else 0, 
        axis=1
    )
    
    # 백만원 단위로 변환
    analysis['당년금액_백만원'] = (analysis['당년금액'] / 1_000_000).round(0)
    analysis['전년금액_백만원'] = (analysis['전년금액'] / 1_000_000).round(0)
    analysis['차이_백만원'] = (analysis['차이'] / 1_000_000).round(0)
    
    # 100만원 이상 차이나는 항목만
    significant = analysis[analysis['차이_백만원'].abs() >= 1].copy()
    significant = significant.sort_values('차이_백만원', key=abs, ascending=False)
    
    print(f"✅ 총 {len(analysis)}개 GL 계정 중 {len(significant)}개 유의미한 변동")
    
    # 적요별 상세 분석
    print("\n📝 적요별 상세 분석 중...")
    
    gl_descriptions = []
    
    for _, row in significant.iterrows():
        gl_account = row['GL계정']
        
        # 해당 GL 계정의 적요별 집계
        current_detail = current_df[current_df['G/L 계정 설명'] == gl_account].groupby('적요')['금액'].sum()
        previous_detail = previous_df[previous_df['G/L 계정 설명'] == gl_account].groupby('적요')['금액'].sum()
        
        # 적요별 차이 계산
        detail_df = pd.DataFrame({
            '당년': current_detail,
            '전년': previous_detail
        }).fillna(0)
        detail_df['차이'] = detail_df['당년'] - detail_df['전년']
        detail_df['차이_백만원'] = (detail_df['차이'] / 1_000_000).round(0)
        
        # 50만원 이상 차이나는 적요만
        significant_desc = detail_df[detail_df['차이_백만원'].abs() >= 0.5].copy()
        significant_desc = significant_desc.sort_values('차이_백만원', key=abs, ascending=False)
        
        # 상위 3개 적요
        top_descriptions = []
        for desc, desc_row in significant_desc.head(3).iterrows():
            if desc and str(desc).strip():
                sign = '+' if desc_row['차이_백만원'] > 0 else ''
                top_descriptions.append(f"{desc}({sign}{desc_row['차이_백만원']:.0f}백만원)")
        
        gl_descriptions.append({
            'GL계정': gl_account,
            '당년_백만원': row['당년금액_백만원'],
            '전년_백만원': row['전년금액_백만원'],
            '차이_백만원': row['차이_백만원'],
            'YOY': f"{row['YOY']:.1f}%",
            '주요적요': '; '.join(top_descriptions) if top_descriptions else ''
        })
    
    # 결과 저장
    output_path = Path('out') / 'gl_account_analysis.csv'
    result_df = pd.DataFrame(gl_descriptions)
    result_df.to_csv(output_path, index=False, encoding='utf-8-sig')
    
    print(f"\n✅ 분석 완료! 파일 저장: {output_path}")
    print(f"📊 총 {len(result_df)}개 GL 계정 분석 결과")
    
    # 미리보기
    print("\n📋 상위 10개 변동 항목:")
    print(result_df.head(10).to_string(index=False))
    
    return result_df

if __name__ == '__main__':
    print("=" * 80)
    print("🔍 GL 계정별 전년 대비 차이 분석")
    print("=" * 80)
    
    result = analyze_account_details()
    
    if result is not None:
        print("\n" + "=" * 80)
        print("✅ 완료!")
        print("=" * 80)

