import { kv } from '@vercel/kv';

// Redis 키 상수
export const REDIS_KEYS = {
  DESCRIPTIONS: 'account_descriptions_v2', // 새 키로 변경 (인코딩 문제 해결)
  INSIGHTS: 'insights',
  ALLOCATION_CRITERIA: 'allocation_criteria', // 공통비 배부기준
  LABOR_INSIGHT: 'labor_insight', // 인원 현황 주요 시사점
  LABOR_MOVEMENT: 'labor_movement', // 입사/퇴사/이동 데이터
  LABOR_REMARK: 'labor_remark', // 비고 데이터
} as const;

// 타입 정의
export type Descriptions = Record<string, string>;
export type Insight = {
  id: string;
  accountId: string;
  content: string;
  updatedAt: string;
  updatedBy?: string;
};

// === Descriptions (AI 설명) 관련 함수 ===

/**
 * 모든 설명 조회
 */
export async function getAllDescriptions(): Promise<Descriptions> {
  try {
    // 문자열로 저장된 JSON을 파싱
    const jsonString = await kv.get<string>(REDIS_KEYS.DESCRIPTIONS);
    if (!jsonString) return {};
    
    // 이미 객체로 파싱된 경우 (kv가 자동으로 파싱할 수 있음)
    if (typeof jsonString === 'object') {
      return jsonString as Descriptions;
    }
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Redis getAllDescriptions 오류:', error);
    return {}; // 오류 시 빈 객체 반환
  }
}

/**
 * 특정 계정 설명 조회
 */
export async function getDescription(accountId: string): Promise<string | null> {
  try {
    const descriptions = await getAllDescriptions();
    return descriptions[accountId] || null;
  } catch (error) {
    console.error('Redis getDescription 오류:', error);
    throw error;
  }
}

/**
 * 설명 저장 (단일)
 */
export async function saveDescription(accountId: string, description: string): Promise<Descriptions> {
  try {
    const descriptions = await getAllDescriptions();
    descriptions[accountId] = description;
    
    // JSON 문자열로 저장 (한글 인코딩 보장)
    await kv.set(REDIS_KEYS.DESCRIPTIONS, JSON.stringify(descriptions));
    return descriptions;
  } catch (error) {
    console.error('Redis saveDescription 오류:', error);
    throw error;
  }
}

/**
 * 여러 설명 일괄 저장
 */
export async function saveDescriptions(newDescriptions: Descriptions): Promise<Descriptions> {
  try {
    const descriptions = await getAllDescriptions();
    const merged = { ...descriptions, ...newDescriptions };
    
    // JSON 문자열로 저장 (한글 인코딩 보장)
    await kv.set(REDIS_KEYS.DESCRIPTIONS, JSON.stringify(merged));
    return merged;
  } catch (error) {
    console.error('Redis saveDescriptions 오류:', error);
    throw error;
  }
}

/**
 * 설명 삭제
 */
export async function deleteDescription(accountId: string): Promise<Descriptions> {
  try {
    const descriptions = await getAllDescriptions();
    delete descriptions[accountId];
    await kv.set(REDIS_KEYS.DESCRIPTIONS, JSON.stringify(descriptions));
    return descriptions;
  } catch (error) {
    console.error('Redis deleteDescription 오류:', error);
    throw error;
  }
}

/**
 * 모든 설명 삭제 (초기화)
 */
export async function clearAllDescriptions(): Promise<void> {
  try {
    await kv.set(REDIS_KEYS.DESCRIPTIONS, JSON.stringify({}));
  } catch (error) {
    console.error('Redis clearAllDescriptions 오류:', error);
    throw error;
  }
}

// === Insights 관련 함수 (확장용) ===

/**
 * 인사이트 저장
 */
export async function saveInsight(insight: Omit<Insight, 'updatedAt'>): Promise<Insight> {
  try {
    const key = `${REDIS_KEYS.INSIGHTS}:${insight.id}`;
    const data: Insight = {
      ...insight,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(key, JSON.stringify(data));
    return data;
  } catch (error) {
    console.error('Redis saveInsight 오류:', error);
    throw error;
  }
}

/**
 * 인사이트 조회
 */
export async function getInsight(id: string): Promise<Insight | null> {
  try {
    const key = `${REDIS_KEYS.INSIGHTS}:${id}`;
    const data = await kv.get<string>(key);
    if (!data) return null;
    if (typeof data === 'object') return data as Insight;
    return JSON.parse(data);
  } catch (error) {
    console.error('Redis getInsight 오류:', error);
    throw error;
  }
}

/**
 * 모든 인사이트 키 조회 (패턴 매칭)
 */
export async function getAllInsightKeys(): Promise<string[]> {
  try {
    const keys = await kv.keys(`${REDIS_KEYS.INSIGHTS}:*`);
    return keys;
  } catch (error) {
    console.error('Redis getAllInsightKeys 오류:', error);
    throw error;
  }
}

// === Labor Insight (인원 현황 주요 시사점) 관련 함수 ===

/**
 * 인원 현황 시사점 조회
 */
export async function getLaborInsight(): Promise<string> {
  try {
    const jsonString = await kv.get<string>(REDIS_KEYS.LABOR_INSIGHT);
    if (!jsonString) return '';
    
    if (typeof jsonString === 'string') {
      // JSON 문자열인 경우 파싱
      try {
        return JSON.parse(jsonString);
      } catch {
        return jsonString;
      }
    }
    
    return jsonString as string;
  } catch (error) {
    console.error('Redis getLaborInsight 오류:', error);
    return '';
  }
}

/**
 * 인원 현황 시사점 저장
 */
export async function saveLaborInsight(insight: string): Promise<string> {
  try {
    await kv.set(REDIS_KEYS.LABOR_INSIGHT, JSON.stringify(insight));
    return insight;
  } catch (error) {
    console.error('Redis saveLaborInsight 오류:', error);
    throw error;
  }
}

// === Allocation Criteria (공통비 배부기준) 관련 함수 ===

/**
 * 배부기준 조회
 */
export async function getAllocationCriteria(): Promise<string[]> {
  try {
    const jsonString = await kv.get<string>(REDIS_KEYS.ALLOCATION_CRITERIA);
    if (!jsonString) return [''];
    
    if (typeof jsonString === 'object' && Array.isArray(jsonString)) {
      return jsonString;
    }
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Redis getAllocationCriteria 오류:', error);
    return [''];
  }
}

/**
 * 배부기준 저장
 */
export async function saveAllocationCriteria(criteria: string[]): Promise<string[]> {
  try {
    await kv.set(REDIS_KEYS.ALLOCATION_CRITERIA, JSON.stringify(criteria));
    return criteria;
  } catch (error) {
    console.error('Redis saveAllocationCriteria 오류:', error);
    throw error;
  }
}

// === Labor Movement (입사/퇴사/이동) 관련 함수 ===

export type LaborMovementData = Record<string, { hire: string; resign: string; transfer: string }>;

/**
 * 입사/퇴사/이동 데이터 조회
 */
export async function getLaborMovement(): Promise<LaborMovementData> {
  try {
    const jsonString = await kv.get<string>(REDIS_KEYS.LABOR_MOVEMENT);
    if (!jsonString) return {};
    
    if (typeof jsonString === 'object') {
      return jsonString as LaborMovementData;
    }
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Redis getLaborMovement 오류:', error);
    return {};
  }
}

/**
 * 입사/퇴사/이동 데이터 저장
 */
export async function saveLaborMovement(data: LaborMovementData): Promise<LaborMovementData> {
  try {
    await kv.set(REDIS_KEYS.LABOR_MOVEMENT, JSON.stringify(data));
    return data;
  } catch (error) {
    console.error('Redis saveLaborMovement 오류:', error);
    throw error;
  }
}

// === Labor Remark (비고) 관련 함수 ===

export type LaborRemarkData = Record<string, string>;

/**
 * 비고 데이터 조회
 */
export async function getLaborRemark(): Promise<LaborRemarkData> {
  try {
    const jsonString = await kv.get<string>(REDIS_KEYS.LABOR_REMARK);
    if (!jsonString) return {};
    
    if (typeof jsonString === 'object') {
      return jsonString as LaborRemarkData;
    }
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Redis getLaborRemark 오류:', error);
    return {};
  }
}

/**
 * 비고 데이터 저장
 */
export async function saveLaborRemark(data: LaborRemarkData): Promise<LaborRemarkData> {
  try {
    await kv.set(REDIS_KEYS.LABOR_REMARK, JSON.stringify(data));
    return data;
  } catch (error) {
    console.error('Redis saveLaborRemark 오류:', error);
    throw error;
  }
}

// === Monthly Analysis (월별 계정 분석) 관련 함수 ===

export type MonthlyAnalysis = {
  descriptions: Record<string, string>;  // accountId -> AI 분석 설명
  generatedAt: string;                    // 생성 시간
  year: string;
  month: string;
};

/**
 * 월별 분석 키 생성
 */
function getMonthlyAnalysisKey(year: string, month: string): string {
  return `monthly_analysis:${year}:${month.padStart(2, '0')}`;
}

/**
 * 월별 분석 결과 조회
 */
export async function getMonthlyAnalysis(year: string, month: string): Promise<MonthlyAnalysis | null> {
  try {
    const key = getMonthlyAnalysisKey(year, month);
    const jsonString = await kv.get<string>(key);
    if (!jsonString) return null;
    
    if (typeof jsonString === 'object') {
      return jsonString as MonthlyAnalysis;
    }
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Redis getMonthlyAnalysis 오류:', error);
    return null;
  }
}

/**
 * 월별 분석 결과 저장
 */
export async function saveMonthlyAnalysis(year: string, month: string, descriptions: Record<string, string>): Promise<MonthlyAnalysis> {
  try {
    const key = getMonthlyAnalysisKey(year, month);
    const data: MonthlyAnalysis = {
      descriptions,
      generatedAt: new Date().toISOString(),
      year,
      month,
    };
    await kv.set(key, JSON.stringify(data));
    return data;
  } catch (error) {
    console.error('Redis saveMonthlyAnalysis 오류:', error);
    throw error;
  }
}

/**
 * 월별 분석 결과 개별 항목 업데이트
 */
export async function updateMonthlyAnalysisItem(year: string, month: string, accountId: string, description: string): Promise<MonthlyAnalysis> {
  try {
    const existing = await getMonthlyAnalysis(year, month);
    const descriptions = existing?.descriptions || {};
    descriptions[accountId] = description;
    return await saveMonthlyAnalysis(year, month, descriptions);
  } catch (error) {
    console.error('Redis updateMonthlyAnalysisItem 오류:', error);
    throw error;
  }
}

// Vercel KV 인스턴스 직접 export (필요시 사용)
export { kv };
