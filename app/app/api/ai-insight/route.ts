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
당신은 기업 경영관리(FP&A) 관점의 조직/인력 분석 전문가입니다.
아래는 공통사업부 내 부문·팀별 인원 변동 데이터이며,
조직 통합 및 기능 재편은 이미 완료된 상태입니다.

## 분석 전제
- 본 인력 변동은 확장이나 증원이 아닌, 조직 통합 및 기능 재배치 결과입니다.
- 마케팅본부, 해외사업담당은 공통사업부로 이관 완료된 조직입니다.
- 통합소싱/통합영업은 소규모 브랜드(DV, ST 등)에 분산된 인력을 기능 단위로 통합한 결과입니다.
- '확장, 성장, 신규 투자' 관점의 해석은 금지합니다.

## 데이터
- 2024년 12월 전체 인원: ${dec2024Total}명
- 2025년 12월 전체 인원: ${dec2025Total}명
- 전년 대비 증감: ${totalDiff >= 0 ? '+' : ''}${totalDiff}명 (${totalDiffPercent}%)

## 증가 부문
${increased.map((d: any) => `- ${d.name}: +${d.diff}명`).join('\n')}

## 감소 부문
${decreased.map((d: any) => `- ${d.name}: ${d.diff}명`).join('\n')}

## 작성 요청
- 시사점 4개 내외
- 각 bullet은 한 문장 이내
- 결론형·판단형 문장 사용
- 설명·배경 서술 없이 결과만 제시
- 경영 보고용으로 담백하게 작성

## 문체 가이드 (중요)
- "~완료", "~구조 정리", "~효과 확인" 등의 표현 선호
- "~로 판단됨", "~로 보임" 등의 추정형 표현 사용 금지
- "~기여할 것으로 예상", "~기반 마련" 등의 미래형 표현 사용 금지
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
