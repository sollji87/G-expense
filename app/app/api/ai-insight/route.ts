import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { type, data } = await request.json();
    
    if (type === 'labor') {
      const { year2024, year2025, divisions } = data;
      
      // 데이터 분석
      const dec2024Total = year2024?.['12'] || 0;
      const dec2025Total = year2025?.['12'] || 0;
      const totalDiff = dec2025Total - dec2024Total;
      const totalDiffPercent = dec2024Total > 0 ? ((totalDiff / dec2024Total) * 100).toFixed(1) : 0;
      
      const increased = divisions.filter((d: any) => d.diff > 0).sort((a: any, b: any) => b.diff - a.diff);
      const decreased = divisions.filter((d: any) => d.diff < 0).sort((a: any, b: any) => a.diff - b.diff);
      
      // OpenAI API 호출
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      
      if (!OPENAI_API_KEY) {
        // API 키가 없으면 규칙 기반 분석 제공
        const insight = generateRuleBasedInsight(dec2024Total, dec2025Total, totalDiff, totalDiffPercent, increased, decreased);
        return NextResponse.json({ insight });
      }
      
      const prompt = `
당신은 기업 인사/경영 분석 전문가입니다.
아래는 공통사업부 내 부문·팀별 인원 변동 데이터입니다.
본 데이터는 '사업 확장에 따른 증원'이 아니라,
조직 통합 및 운영 효율화 목적의 구조 재편 결과임을 전제로 분석해주세요.

## 분석 전제 (중요)
- 마케팅본부 및 해외사업담당은 기존 사업부 소속에서 공통사업부로 이관된 조직입니다.
- 통합소싱 / 통합영업은 DV, ST 등 소규모 신규사업 브랜드에 분산되어 있던 인력을
  기능 단위로 통합 운영하기 위한 조직 개편 결과입니다.
- 따라서 인력 증감의 원인을 '시장 확대, 사업 확장, 외형 성장'으로 해석하지 마세요.

## 데이터
- 2024년 12월 전체 인원: ${dec2024Total}명
- 2025년 12월 전체 인원: ${dec2025Total}명
- 전년 대비 증감: ${totalDiff >= 0 ? '+' : ''}${totalDiff}명 (${totalDiffPercent}%)

## 증가 부문 (${increased.length}개)
${increased.map((d: any) => `- ${d.name}: ${d.prev}명 → ${d.curr}명 (+${d.diff}명)`).join('\n')}

## 감소 부문 (${decreased.length}개)
${decreased.map((d: any) => `- ${d.name}: ${d.prev}명 → ${d.curr}명 (${d.diff}명)`).join('\n')}

## 분석 요청
- 조직 통합, 기능 재배치, 중복 제거 관점에서 인력 변동의 의미를 해석해주세요.
- 공통사업부 운영 효율성, 관리 단위 명확화, 협업 구조 측면의 시사점을 도출해주세요.
- 향후 인력 운영 시 고려해야 할 관리 리스크나 운영 포인트를 언급해주세요.

## 작성 가이드
- 한국어로 작성
- bullet point 4개 내외
- 경영 보고용 톤 (정성 과장 없이, 담백하게)
- '확장, 성장, 공격적 투자, 신규 확대' 등의 표현은 사용하지 마세요.
`;

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: '당신은 기업 인사/경영 분석 전문가입니다. 간결하고 인사이트 있는 분석을 제공합니다.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });
      
      if (!openaiResponse.ok) {
        // OpenAI 실패 시 규칙 기반 분석 제공
        const insight = generateRuleBasedInsight(dec2024Total, dec2025Total, totalDiff, totalDiffPercent, increased, decreased);
        return NextResponse.json({ insight });
      }
      
      const openaiData = await openaiResponse.json();
      const aiInsight = openaiData.choices?.[0]?.message?.content || '';
      
      return NextResponse.json({ insight: aiInsight });
    }
    
    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    
  } catch (error) {
    console.error('AI insight error:', error);
    return NextResponse.json({ error: 'Failed to generate insight' }, { status: 500 });
  }
}

function generateRuleBasedInsight(
  dec2024Total: number,
  dec2025Total: number,
  totalDiff: number,
  totalDiffPercent: string | number,
  increased: any[],
  decreased: any[]
): string {
  const insights: string[] = [];
  
  // 전체 트렌드
  if (totalDiff > 0) {
    insights.push(`• 전체 인원이 전년 대비 ${totalDiff}명(${totalDiffPercent}%) 증가하여 사업 확장 기조를 반영`);
  } else if (totalDiff < 0) {
    insights.push(`• 전체 인원이 전년 대비 ${Math.abs(totalDiff)}명(${Math.abs(Number(totalDiffPercent))}%) 감소하여 조직 효율화 진행`);
  }
  
  // 주요 증가 부문
  if (increased.length > 0) {
    const topIncrease = increased[0];
    insights.push(`• ${topIncrease.name}이(가) ${topIncrease.diff}명 증가로 가장 큰 인력 확충 - 해당 부문 사업 강화 추진`);
    
    if (increased.filter(d => d.name.includes('마케팅') || d.name.includes('해외')).length > 0) {
      insights.push(`• 마케팅/해외사업 부문 인력 확대는 브랜드 성장 및 글로벌 진출 전략과 연계`);
    }
  }
  
  // 감소 부문
  if (decreased.length > 0) {
    const supportDepts = decreased.filter(d => 
      d.name.includes('경영') || d.name.includes('법무') || d.name.includes('임원') || d.name.includes('HR')
    );
    if (supportDepts.length > 0) {
      insights.push(`• 경영지원 부문(${supportDepts.map(d => d.name).join(', ')}) 인력 최적화로 운영 효율성 제고`);
    }
  }
  
  // 리스크/권고
  if (increased.length > 3) {
    insights.push(`• 다수 부문에서 동시 인력 증가 - 채용/온보딩 프로세스 부담 관리 필요`);
  }
  
  if (decreased.length > 3) {
    insights.push(`• 다수 부문 인력 감소 - 핵심 인재 이탈 방지 및 업무 연속성 확보 필요`);
  }
  
  return insights.join('\n');
}
