import pandas as pd
import os
import sys
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv
import json

# 한글 출력 설정
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

# ============================================
# 여기에 OpenAI API 키를 직접 입력하세요
# ============================================
OPENAI_API_KEY = "your-openai-api-key-here"  # 실제 API 키로 교체하세요
OPENAI_MODEL = "gpt-4o-mini"
# ============================================

if OPENAI_API_KEY == "여기에_API_키를_입력하세요":
    print("❌ OPENAI_API_KEY를 입력해주세요!")
    print("   스크립트 상단의 OPENAI_API_KEY 변수에 API 키를 입력하세요.")
    exit(1)

# OpenAI 클라이언트 초기화
client = OpenAI(api_key=OPENAI_API_KEY)
model = OPENAI_MODEL

def analyze_with_ai(gl_account, current_amount, previous_amount, change, top_descriptions):
    """
    OpenAI를 사용하여 GL 계정 변동 분석
    """
    
    # 적요 정보 포맷팅
    desc_text = ""
    if top_descriptions:
        desc_text = "\n주요 적요별 변동:\n"
        for desc in top_descriptions:
            desc_text += f"- {desc['적요']}: {desc['차이_백만원']:+.0f}백만원 (당년 {desc['당년_백만원']:.0f}백만원, 전년 {desc['전년_백만원']:.0f}백만원)\n"
    
    prompt = f"""다음 비용 계정의 전년 대비 변동 내역을 분석하여 간결하고 명확한 설명을 작성해주세요.

**계정명**: {gl_account}
**전년 금액**: {previous_amount:.0f}백만원
**당년 금액**: {current_amount:.0f}백만원
**차이**: {change:+.0f}백만원
{desc_text}

**작성 요구사항**:
1. 구어체가 아닌 간결한 문체로 작성
2. **전년 대비 차이 금액을 정확하게 계산하여 먼저 언급** (차이_백만원 값을 그대로 사용)
3. 주요 변동 항목(적요)을 2-3개 포함하여 구체적으로 설명
4. 한 문단으로 작성 (2-3문장)
5. "증가했습니다", "감소했습니다" 같은 구어체 대신 "증가", "감소" 사용

**예시 형식**:
"전년 대비 50백만원 감소. 주요 변동: 직원식대(-30백만원), 워크샵비용(+20백만원), 회의비(-15백만원)로 전반적인 복리후생 지출 축소."

**중요**: 
- "절대금액"이라는 표현 대신 "전년 대비"를 사용하세요.
- 차이 금액은 반드시 제공된 차이_백만원 값({change:.0f}백만원)을 사용하세요. 절대 다른 숫자를 만들지 마세요.
"""
    
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "당신은 재무 분석 전문가입니다. 비용 변동 내역을 간결하고 명확하게 설명합니다."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=300
        )
        
        return response.choices[0].message.content.strip()
    
    except Exception as e:
        print(f"⚠️  AI 분석 실패 ({gl_account}): {e}")
        # 기본 설명 생성
        direction = "증가" if change >= 0 else "감소"
        desc_summary = ""
        if top_descriptions and len(top_descriptions) > 0:
            desc_list = [f"{d['적요']}({d['차이_백만원']:+.0f}백만원)" for d in top_descriptions[:3]]
            desc_summary = f" 주요 변동: {', '.join(desc_list)}."
        return f"전년 대비 {abs(change):.0f}백만원 {direction}.{desc_summary}"

def analyze_account_details(current_month='202510', previous_month='202410'):
    """
    GL 계정별 전년 대비 차이 분석 CSV 생성 (OpenAI 사용)
    """
    
    base_path = Path('out/details')
    current_path = base_path / current_month
    previous_path = base_path / previous_month
    
    if not current_path.exists() or not previous_path.exists():
        print(f"❌ 경로를 찾을 수 없습니다: {current_path} 또는 {previous_path}")
        return
    
    print("=" * 80)
    print(f"🤖 OpenAI 기반 GL 계정 분석 시작")
    print(f"📅 비교 기간: {previous_month} vs {current_month}")
    print(f"🔧 사용 모델: {model}")
    print("=" * 80)
    
    # 모든 CSV 파일 읽기
    current_data = []
    previous_data = []
    
    # 당년 데이터 읽기
    print(f"\n📂 {current_month} 데이터 로드 중...")
    for folder in current_path.iterdir():
        if folder.is_dir():
            for csv_file in folder.glob('*.csv'):
                try:
                    df = pd.read_csv(csv_file, encoding='utf-8-sig')
                    current_data.append(df)
                except Exception as e:
                    print(f"⚠️  파일 읽기 실패: {csv_file.name}")
    
    # 전년 데이터 읽기
    print(f"📂 {previous_month} 데이터 로드 중...")
    for folder in previous_path.iterdir():
        if folder.is_dir():
            for csv_file in folder.glob('*.csv'):
                try:
                    df = pd.read_csv(csv_file, encoding='utf-8-sig')
                    previous_data.append(df)
                except Exception as e:
                    print(f"⚠️  파일 읽기 실패: {csv_file.name}")
    
    # 데이터 합치기
    current_df = pd.concat(current_data, ignore_index=True) if current_data else pd.DataFrame()
    previous_df = pd.concat(previous_data, ignore_index=True) if previous_data else pd.DataFrame()
    
    print(f"✅ 당년 데이터: {len(current_df):,}건")
    print(f"✅ 전년 데이터: {len(previous_df):,}건")
    
    # GL 계정별 집계
    print("\n📊 GL 계정별 집계 중...")
    
    # 컬럼명 확인 (금액 컬럼)
    amount_col = '금액_정제' if '금액_정제' in current_df.columns else '금액'
    desc_col = 'G/L 계정 설명'
    text_col = '텍스트' if '텍스트' in current_df.columns else '적요'
    
    current_by_gl = current_df.groupby(desc_col)[amount_col].sum().reset_index()
    current_by_gl.columns = ['GL계정', '당년금액']
    
    previous_by_gl = previous_df.groupby(desc_col)[amount_col].sum().reset_index()
    previous_by_gl.columns = ['GL계정', '전년금액']
    
    # 합치기
    analysis = pd.merge(current_by_gl, previous_by_gl, on='GL계정', how='outer').fillna(0)
    analysis['차이'] = analysis['당년금액'] - analysis['전년금액']
    analysis['당년금액_백만원'] = (analysis['당년금액'] / 1_000_000)
    analysis['전년금액_백만원'] = (analysis['전년금액'] / 1_000_000)
    analysis['차이_백만원'] = (analysis['차이'] / 1_000_000)
    
    # 100만원 이상 차이나는 항목만
    significant = analysis[analysis['차이_백만원'].abs() >= 1].copy()
    significant = significant.sort_values('차이_백만원', key=abs, ascending=False)
    
    print(f"✅ 총 {len(analysis)}개 GL 계정 중 {len(significant)}개 유의미한 변동")
    
    # AI 분석 시작
    print(f"\n🤖 OpenAI 분석 시작 (총 {len(significant)}개 계정)...")
    print("-" * 80)
    
    gl_descriptions = []
    
    # 컬럼명 저장
    _desc_col = desc_col
    _amount_col = amount_col
    _text_col = text_col
    
    for idx, (_, row) in enumerate(significant.iterrows(), 1):
        gl_account = row['GL계정']
        
        print(f"[{idx}/{len(significant)}] 분석 중: {gl_account}...", end=" ")
        
        # 해당 GL 계정의 적요별 집계
        current_detail = current_df[current_df[_desc_col] == gl_account].groupby(_text_col)[_amount_col].sum()
        previous_detail = previous_df[previous_df[_desc_col] == gl_account].groupby(_text_col)[_amount_col].sum()
        
        # 적요별 차이 계산
        detail_df = pd.DataFrame({
            '당년': current_detail,
            '전년': previous_detail
        }).fillna(0)
        detail_df['차이'] = detail_df['당년'] - detail_df['전년']
        detail_df['차이_백만원'] = (detail_df['차이'] / 1_000_000)
        detail_df['당년_백만원'] = (detail_df['당년'] / 1_000_000)
        detail_df['전년_백만원'] = (detail_df['전년'] / 1_000_000)
        
        # 50만원 이상 차이나는 적요만
        significant_desc = detail_df[detail_df['차이_백만원'].abs() >= 0.5].copy()
        significant_desc = significant_desc.sort_values('차이_백만원', key=abs, ascending=False)
        
        # 상위 5개 적요
        top_descriptions = []
        for desc, desc_row in significant_desc.head(5).iterrows():
            if desc and str(desc).strip():
                top_descriptions.append({
                    '적요': str(desc),
                    '차이_백만원': desc_row['차이_백만원'],
                    '당년_백만원': desc_row['당년_백만원'],
                    '전년_백만원': desc_row['전년_백만원']
                })
        
        # OpenAI로 분석
        ai_description = analyze_with_ai(
            gl_account,
            row['당년금액_백만원'],
            row['전년금액_백만원'],
            row['차이_백만원'],
            top_descriptions
        )
        
        print("✅")
        
        gl_descriptions.append({
            'GL계정': gl_account,
            '당년_백만원': round(row['당년금액_백만원'], 0),
            '전년_백만원': round(row['전년금액_백만원'], 0),
            '차이_백만원': round(row['차이_백만원'], 0),
            '설명': ai_description
        })
    
    # 결과 저장
    output_path = Path('out') / 'gl_account_analysis_ai.csv'
    result_df = pd.DataFrame(gl_descriptions)
    result_df.to_csv(output_path, index=False, encoding='utf-8-sig')
    
    print("\n" + "=" * 80)
    print(f"✅ AI 분석 완료! 파일 저장: {output_path}")
    print(f"📊 총 {len(result_df)}개 GL 계정 분석 결과")
    print("=" * 80)
    
    # 미리보기
    print("\n📋 상위 5개 변동 항목:")
    for _, row in result_df.head(5).iterrows():
        print(f"\n🔹 {row['GL계정']}")
        print(f"   차이: {row['차이_백만원']:+.0f}백만원")
        print(f"   설명: {row['설명']}")
    
    return result_df

if __name__ == '__main__':
    result = analyze_account_details()
    
    if result is not None:
        print("\n" + "=" * 80)
        print("✅ 모든 작업 완료!")
        print("=" * 80)

