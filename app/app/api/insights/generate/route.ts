import { NextResponse } from 'next/server';
import { getAllDescriptions, saveDescription } from '@/lib/redis';

/**
 * POST /api/insights/generate
 * 
 * 계층형 분석의 AI 코멘트들을 기반으로 요약 인사이트를 생성합니다.
 * OpenAI API를 사용하여 요약을 생성하고, Redis에 저장합니다.
 * 
 * Body:
 * - descriptions: { [accountId]: description } (선택, 없으면 Redis에서 조회)
 * - kpiData: KPI 요약 정보 (선택)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { descriptions, kpiData } = body;
    
    // descriptions가 없으면 Redis에서 조회
    if (!descriptions || Object.keys(descriptions).length === 0) {
      descriptions = await getAllDescriptions();
    }
    
    // __AI_INSIGHT__ 키 제외
    const accountDescriptions: Record<string, string> = {};
    for (const [key, value] of Object.entries(descriptions)) {
      if (key !== '__AI_INSIGHT__' && value) {
        accountDescriptions[key] = value as string;
      }
    }
    
    if (Object.keys(accountDescriptions).length === 0) {
      return NextResponse.json(
        { success: false, error: '분석할 AI 코멘트가 없습니다.' },
        { status: 400 }
      );
    }
    
    // OpenAI API 키 확인
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'OPENAI_API_KEY가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }
    
    // 코멘트들을 카테고리별로 그룹화
    const categoryGroups: Record<string, string[]> = {};
    
    for (const [accountId, description] of Object.entries(accountDescriptions)) {
      // accountId 형식: "대분류_중분류_소분류_계정명" 또는 다른 형태
      const parts = accountId.split('_');
      const category = parts[0] || '기타';
      
      if (!categoryGroups[category]) {
        categoryGroups[category] = [];
      }
      categoryGroups[category].push(`- ${accountId}: ${description}`);
    }
    
    // 프롬프트 생성
    let descriptionsText = '';
    for (const [category, items] of Object.entries(categoryGroups)) {
      descriptionsText += `\n[${category}]\n${items.join('\n')}\n`;
    }
    
    // KPI 정보 포함 (카테고리별 상세 정보)
    let kpiText = '';
    if (kpiData) {
      kpiText = `
**[중요] 반드시 아래 KPI 수치를 정확히 사용하세요:**

📊 **총비용**: ${kpiData.totalCost}백만원 (전년 ${kpiData.totalPrevious}백만원)
📈 **전년 대비 변화**: ${kpiData.change > 0 ? '+' : ''}${kpiData.change}백만원 (${kpiData.changePercent}%)
`;
      
      // 카테고리별 상세 정보 추가
      if (kpiData.categories && kpiData.categories.length > 0) {
        kpiText += `\n**카테고리별 현황**:\n`;
        for (const cat of kpiData.categories) {
          const changeSign = cat.change > 0 ? '+' : '';
          kpiText += `- ${cat.category}: ${cat.current}백만원 (전년 ${cat.previous}백만원, ${changeSign}${cat.change}백만원, ${cat.changePercent > 0 ? '+' : ''}${cat.changePercent.toFixed(1)}%)\n`;
        }
      }
    }
    
    const prompt = `당신은 재무 분석 전문가입니다. 아래 KPI 데이터와 계정별 AI 분석 코멘트를 종합하여 전체 비용 현황에 대한 요약 인사이트를 작성해주세요.

${kpiText}

**계정별 AI 분석 코멘트** (참고용):
${descriptionsText}

**[필수] 작성 요구사항**:
1. **반드시 위의 KPI 수치를 정확히 사용** - 총비용 ${kpiData?.totalCost || 'N/A'}백만원, 변화 ${kpiData?.change || 'N/A'}백만원
2. 전체 비용 규모와 전년 대비 증감을 먼저 언급
3. 주요 증가/감소 항목을 카테고리별로 정리 (3~5개 핵심 포인트)
4. 비용 관리 관점에서의 시사점이나 모니터링 포인트 제시
5. 구어체가 아닌 간결한 문체 사용
6. 4~5개 문단으로 작성 (각 문단 2~3문장)
7. 금액은 "백만원" 단위로 표기, 소수점 없이 정수로

**형식**:
- 첫 문단: 총비용 ${kpiData?.totalCost || 'N/A'}백만원, 전년 대비 ${kpiData?.change || 'N/A'}백만원 변화 언급
- 중간 문단들: 카테고리별 주요 증감 항목 설명
- 마지막 문단: 종합 분석 및 시사점`;

    // OpenAI API 호출
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 재무 분석 전문가입니다. 비용 분석 내용을 간결하고 명확하게 요약합니다.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API 오류:', error);
      return NextResponse.json(
        { success: false, error: 'OpenAI API 호출 실패', details: error },
        { status: 500 }
      );
    }
    
    const data = await response.json();
    const insight = data.choices[0]?.message?.content?.trim();
    
    if (!insight) {
      return NextResponse.json(
        { success: false, error: 'AI 응답이 비어있습니다.' },
        { status: 500 }
      );
    }
    
    // Redis에 저장
    await saveDescription('__AI_INSIGHT__', insight);
    
    return NextResponse.json({
      success: true,
      data: {
        insight,
        accountCount: Object.keys(accountDescriptions).length,
        categories: Object.keys(categoryGroups),
      },
      message: 'AI 인사이트가 생성되어 저장되었습니다.',
    });
    
  } catch (error) {
    console.error('인사이트 생성 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: '인사이트 생성에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
