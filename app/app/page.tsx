'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpIcon, ArrowDownIcon, TrendingUpIcon, CalendarIcon, PencilIcon, ChevronUpIcon, ChevronDownIcon, ChevronRightIcon, SaveIcon, XIcon, SparklesIcon } from 'lucide-react';
import { ComposedChart, Bar, Line, LineChart, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, BarChart, Cell, ScatterChart, Scatter, ReferenceArea, LabelList, Rectangle } from 'recharts';

// 비용 카테고리 정의
const COST_CATEGORIES = {
  인건비: '인건비',
  IT수수료: 'IT수수료',
  지급수수료: '지급수수료',
  직원경비: '직원경비',
  기타비용: '기타비용'
};

// 계정별 고정 색상 매핑 (월 변경 시에도 동일한 색상 유지)
const getColorForAccount = (accountName: string): string => {
  const colorMap: Record<string, string> = {
    // 대분류 (메인 차트)
    '인건비': '#a7c7e7',
    'IT수수료': '#f4a6c3',
    '지급수수료': '#b4e7ce',
    '직원경비': '#ffd4a3',
    '기타비용': '#e0b0ff',
    
    // 중분류/소분류 (드릴다운 차트) - 추가 색상
    '급여': '#a7c7e7',
    '상여': '#8fb3d9',
    '퇴직급여': '#779fcb',
    '복리후생비': '#5f8bbd',
    
    '라이센스': '#f4a6c3',
    '유지보수': '#e88aad',
    'IT컨설팅': '#dc6e97',
    
    '전문용역': '#b4e7ce',
    '지급용역비': '#9ad9ba',
    '지급수수료_기타': '#80cba6',
    
    '교육훈련비': '#ffd4a3',
    '복리후생': '#ffbe7a',
    '출장비': '#ffa851',
    '직원경비_기타': '#ff9228',
    
    '감가상각비': '#e0b0ff',
    '세금과공과': '#c9b7eb',
    '도서인쇄비': '#c9b7eb',
    '소모품비': '#b29ed7',
    '통신비': '#9b85c3',
    '운반비': '#8470af',
    '지급임차료': '#6d5b9b',
    '보험료': '#564687',
    '기타': '#ffc9c9',
  };
  
  // 매핑에 없는 경우 해시 기반으로 일관된 색상 생성
  if (colorMap[accountName]) {
    return colorMap[accountName];
  }
  
  // 해시 함수로 문자열을 숫자로 변환
  let hash = 0;
  for (let i = 0; i < accountName.length; i++) {
    hash = accountName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // 기본 색상 팔레트
  const defaultColors = [
    '#a7c7e7', '#f4a6c3', '#b4e7ce', '#ffd4a3', '#e0b0ff', 
    '#c9b7eb', '#ffc9c9', '#b5e7a0', '#ffb3ba', '#bae1ff'
  ];
  
  return defaultColors[Math.abs(hash) % defaultColors.length];
};

interface KpiData {
  category: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  // MoM (전월 대비) 데이터
  previousMonth?: number;
  momChange?: number;
  momPercent?: number;
}

export default function Dashboard() {
  const [kpiData, setKpiData] = useState<KpiData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'monthly' | 'ytd'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState('12');
  const [isEditMode, setIsEditMode] = useState(false);
  const [mainTab, setMainTab] = useState<'summary' | 'allocation' | 'labor' | 'it' | 'commission'>('summary'); // 메인 탭
  const [allocationCriteria, setAllocationCriteria] = useState<string[]>(['']); // 배부기준 입력 (불릿 배열)
  const [criteriaEditMode, setCriteriaEditMode] = useState(true); // 편집 모드 여부
  const [allocationData, setAllocationData] = useState<{
    total: { current: number; previous: number; change: number; changePercent: number };
    brands: { name: string; current: number; previous: number; change: number; currentRatio: number; previousRatio: number; changePercent: number }[];
  } | null>(null);
  const [allocationLoading, setAllocationLoading] = useState(false);
  const [laborData, setLaborData] = useState<{
    months: string[];
    yearlyTotals: { [year: string]: { [month: string]: number } };
    divisions: { 
      divisionName: string; 
      teams: { deptNm: string; monthly: { [key: string]: number } }[];
      subDivisions: { name: string; teams: { deptNm: string; monthly: { [key: string]: number } }[]; monthly: { [key: string]: number } }[];
      monthly: { [key: string]: number };
    }[];
  } | null>(null);
  const [laborLoading, setLaborLoading] = useState(false);
  const [itExpenseData, setItExpenseData] = useState<{
    months: string[];
    categories: {
      id: string;
      name: string;
      accounts: {
        id: string;
        glCode: string;
        accountName: string;
        middleCategory: string;
        monthly2024: { [month: string]: number };
        monthly2025: { [month: string]: number };
      }[];
      monthly2024: { [month: string]: number };
      monthly2025: { [month: string]: number };
    }[];
    totals: {
      monthly2024: { [month: string]: number };
      monthly2025: { [month: string]: number };
    };
  } | null>(null);
  const [itExpenseLoading, setItExpenseLoading] = useState(false);
  const [itExpenseYear, setItExpenseYear] = useState<'2024' | '2025'>('2025');
  const [expandedItCategories, setExpandedItCategories] = useState<Set<string>>(new Set());
  const [swCapexExpanded, setSwCapexExpanded] = useState(false); // SW상각비 클릭 시 유무형자산 섹션 펼침
  const [itMaintenanceExpanded, setItMaintenanceExpanded] = useState(false); // IT유지보수비 클릭 시 상세 섹션 펼침
  const [itMaintenanceData, setItMaintenanceData] = useState<{
    items: { text: string; cctrCode: string; total: number; monthly: { [m: string]: number } }[];
    monthlyTotals: { [m: string]: number };
    monthlyTotals2024: { [m: string]: number };
    months: string[];
  } | null>(null);
  const [itMaintenanceLoading, setItMaintenanceLoading] = useState(false);
  const [expandedMaintenanceTeam, setExpandedMaintenanceTeam] = useState<string | null>(null);
  const [teamMaintenanceDetails, setTeamMaintenanceDetails] = useState<{
    text: string; monthly: { [m: string]: number }; total: number;
  }[]>([]);
  const [teamDetailsLoading, setTeamDetailsLoading] = useState(false);
  const [allMaintenanceExpanded, setAllMaintenanceExpanded] = useState(false);
  const [allTeamDetails, setAllTeamDetails] = useState<{ [team: string]: { text: string; monthly: { [m: string]: number }; total: number }[] }>({});
  
  // IT사용료 상세 상태
  const [itUsageExpanded, setItUsageExpanded] = useState(false);
  const [itUsageData, setItUsageData] = useState<{
    items: { text: string; total: number; monthly: { [m: string]: number } }[];
    monthlyTotals: { [m: string]: number };
    monthlyTotals2024: { [m: string]: number };
    monthlyHeadcount: { [m: string]: number };
    months: string[];
  } | null>(null);
  const [itUsageLoading, setItUsageLoading] = useState(false);
  const [expandedUsageTeam, setExpandedUsageTeam] = useState<string | null>(null);
  const [teamUsageDetails, setTeamUsageDetails] = useState<{
    text: string; monthly: { [m: string]: number }; total: number;
  }[]>([]);
  const [teamUsageDetailsLoading, setTeamUsageDetailsLoading] = useState(false);
  const [allUsageExpanded, setAllUsageExpanded] = useState(false);
  const [allUsageTeamDetails, setAllUsageTeamDetails] = useState<{ [team: string]: { text: string; monthly: { [m: string]: number }; total: number }[] }>({});
  
  // CAPEX (유무형자산) 상태
  const [capexData, setCapexData] = useState<{
    year: string;
    months: string[];
    acquisitions: { assetNo: string; assetName: string; acquisitionDate: string; month: string; amount: number }[];
    transfers: { assetNo: string; assetName: string; acquisitionDate: string; month: string; amount: number }[];
    disposals: { assetNo: string; assetName: string; acquisitionDate: string; month: string; amount: number }[];
    monthlyAcquisitions: { [month: string]: number };
    monthlyTransfers: { [month: string]: number };
    monthlyDisposals: { [month: string]: number };
    totals: { acquisitions: number; transfers: number; disposals: number };
  } | null>(null);
  const [capexLoading, setCapexLoading] = useState(false);
  const [capexYear, setCapexYear] = useState<'2024' | '2025'>('2025');
  
  const [laborYear, setLaborYear] = useState<'2024' | '2025'>('2025');
  const [laborMonthsExpanded, setLaborMonthsExpanded] = useState(false); // 과거 월 펼침/접힘
  const [laborDecemberExpanded, setLaborDecemberExpanded] = useState(true); // 12월 입사/퇴사/이동 상세 펼침 (디폴트 펼침)
  const [laborMovementData, setLaborMovementData] = useState<Record<string, { hire: string; resign: string; transfer: string }>>({}); // 입사/퇴사/이동 입력 데이터
  const [laborRemarkData, setLaborRemarkData] = useState<Record<string, string>>({}); // 비고 입력 데이터
  
  // 입사/퇴사/이동 합계 계산 함수
  const calculateMovementSum = (keys: string[], field: 'hire' | 'resign' | 'transfer'): number => {
    return keys.reduce((sum, key) => {
      const value = parseInt(laborMovementData[key]?.[field] || '0', 10);
      return sum + (isNaN(value) ? 0 : value);
    }, 0);
  };
  
  // 부문별 팀 키 목록 생성 함수
  const getTeamKeysForDivision = (division: any): string[] => {
    const keys: string[] = [];
    // 직속 팀
    division.teams?.forEach((team: any) => {
      keys.push(`${division.divisionName}-${team.deptNm}`);
    });
    // 하위 부문의 팀
    division.subDivisions?.forEach((subDiv: any) => {
      subDiv.teams?.forEach((team: any) => {
        keys.push(`${subDiv.name}-${team.deptNm}`);
      });
    });
    return keys;
  };
  
  // 하위 부문별 팀 키 목록 생성 함수
  const getTeamKeysForSubDivision = (subDiv: any): string[] => {
    return subDiv.teams?.map((team: any) => `${subDiv.name}-${team.deptNm}`) || [];
  };
  
  // 전체 팀 키 목록 생성 함수
  const getAllTeamKeys = (): string[] => {
    if (!laborData) return [];
    const keys: string[] = [];
    laborData.divisions.forEach((division: any) => {
      keys.push(...getTeamKeysForDivision(division));
    });
    return keys;
  };
  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(new Set());
  const [expandedSubDivisions, setExpandedSubDivisions] = useState<Set<string>>(new Set());
  const [laborInsight, setLaborInsight] = useState<string>('');
  const [laborInsightEditMode, setLaborInsightEditMode] = useState(false);
  const [laborInsightLoading, setLaborInsightLoading] = useState(false);
  const [laborDetailPopup, setLaborDetailPopup] = useState<{ divisionName: string; data: any } | null>(null);
  const [laborCostMonthly, setLaborCostMonthly] = useState<{ month: string; cost2024: number; cost2025: number; headcount2024: number; headcount2025: number }[]>([]); // 월별 인건비/인원수
  const [laborCostByCategory, setLaborCostByCategory] = useState<{ name: string; cost2024: number; cost2025: number; costPrev: number }[]>([]); // 대분류별 인건비
  const [laborCostBySubDiv, setLaborCostBySubDiv] = useState<{ name: string; category: string; cost2024: number; cost2025: number; costPrev: number }[]>([]); // 중분류별 인건비
  const [editedData, setEditedData] = useState<Record<string, { amount?: number; comment?: string }>>({});
  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedChartMonth, setSelectedChartMonth] = useState<string | null>(null);
  const [isChartExpanded, setIsChartExpanded] = useState(true);
  const [highlightedCategory, setHighlightedCategory] = useState<string | null>(null); // 하이라이트된 카테고리
  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(null);
  const [drilldownData, setDrilldownData] = useState<any[]>([]);
  const [drilldownLevel, setDrilldownLevel] = useState<'middle' | 'detail'>('middle');
  const [detailDrilldownCategory, setDetailDrilldownCategory] = useState<string | null>(null);
  const [detailDrilldownData, setDetailDrilldownData] = useState<any[]>([]);
  
  // 계정별/코스트센터별 분석
  const [accountViewMode, setAccountViewMode] = useState<'monthly' | 'ytd'>('monthly');
  const [isAccountExpanded, setIsAccountExpanded] = useState(true);
  const [accountLevel, setAccountLevel] = useState<'major' | 'middle' | 'detail'>('major');
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedMajorCategory, setSelectedMajorCategory] = useState<string | null>(null); // KPI에서 바로 소분류 접근 시
  const [accountData, setAccountData] = useState<any[]>([]);
  const [costCenterData, setCostCenterData] = useState<any[]>([]);
  const [hoveredAccount, setHoveredAccount] = useState<string | null>(null);
  const [selectedCostCenterDetail, setSelectedCostCenterDetail] = useState<any | null>(null);
  
  // 구조화된 테이블 (계층형)
  const [tableViewMode, setTableViewMode] = useState<'monthly' | 'ytd'>('monthly');
  const [isTableExpanded, setIsTableExpanded] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [hierarchyData, setHierarchyData] = useState<any[]>([]);
  
  // AI 인사이트
  const defaultAiInsight = '총비용은 5,617백만원으로 전년 대비 39백만원(-0.7%) 감소했습니다. 전반적인 비용 수준은 안정적이지만, 일부 항목에서 구조적 변동이 발생했습니다.\n\n특히 직원경비는 -162백만원(-46.5%) 감소하며 전체 비용 감소의 주요 요인으로 작용했습니다. 복리후생비_기타(-57백만원), 총무지원(-30백만원), 차량유지비(-29백만원) 등에서 비용 절감이 이루어졌습니다.\n\n반면 인건비는 +186백만원(+8.6%) 증가했으며, 급료와임금(+50백만원)과 제수당(+112백만원) 증가가 주요 요인입니다. 지급수수료 내에서는 지급용역비(+44백만원), 인사채용(+39백만원)이 증가했으나, 법률자문료(-79백만원) 감소로 전체적으로는 소폭 감소했습니다.\n\nIT수수료는 소프트웨어 감가상각비 감소(-86백만원)로 -62백만원(-4.1%) 감소했습니다. 기타비용은 접대비 증가(+38백만원)로 인해 소폭 상승했습니다.\n\n결과적으로 인건비 증가에도 불구하고 직원경비 및 IT수수료 절감으로 전체 비용은 안정적으로 관리되고 있으며, 향후 인건비 및 지급용역비 관리가 주요 모니터링 포인트로 판단됩니다.';
  const [aiInsight, setAiInsight] = useState<string>(defaultAiInsight);
  const [editingAiInsight, setEditingAiInsight] = useState<boolean>(false);
  const [tempAiInsight, setTempAiInsight] = useState<string>('');
  
  // 구조화된 인사이트
  interface InsightItem {
    id: string;
    name: string;
    category: string; // 대분류
    changePercent: number; // YOY 변동률
    current: number;
    previous: number;
    change: number;
    description: string;
    level: 'major' | 'middle' | 'detail';
  }
  const [structuredInsights, setStructuredInsights] = useState<InsightItem[]>([]);
  const [expandedInsightCategories, setExpandedInsightCategories] = useState<{
    critical: boolean;
    warning: boolean;
    positive: boolean;
  }>({ critical: true, warning: true, positive: true });
  const [selectedInsightItem, setSelectedInsightItem] = useState<InsightItem | null>(null);
  
  // 효율성 지표
  interface EfficiencyMetrics {
    costPerHead: { current: number; previous: number; change: number; changePercent: number };
    revenueRatio: { 
      current: number | null; 
      previous: number | null; 
      change: number;
      revenueCurrent: number | null; // 부가세 포함 매출액
      revenuePrevious: number | null; // 부가세 포함 매출액
      revenueCurrentExclVAT: number | null; // 부가세 제외 매출액
      revenuePreviousExclVAT: number | null; // 부가세 제외 매출액
    };
    costConcentration: { top3Items: { name: string; amount: number; ratio: number }[]; totalRatio: number };
    headcount: { current: number; previous: number };
  }
  const [efficiencyMetrics, setEfficiencyMetrics] = useState<EfficiencyMetrics | null>(null);
  const [isEfficiencyExpanded, setIsEfficiencyExpanded] = useState(true);
  
  // Waterfall 차트 상태
  const [showAllWaterfallItems, setShowAllWaterfallItems] = useState(false);
  
  // 필터 상태
  const [selectedCostCenters, setSelectedCostCenters] = useState<string[]>([]); // 표시명 기준
  const [selectedMajorCategories, setSelectedMajorCategories] = useState<string[]>([]);
  const [costCenterOptions, setCostCenterOptions] = useState<{ name: string; hasHeadcount: boolean; headcount: number; originalNames: string[] }[]>([]);
  const [majorCategoryOptions, setMajorCategoryOptions] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isNoHeadcountExpanded, setIsNoHeadcountExpanded] = useState(false); // 인원 없음 섹션 접기/펼치기
  
  const [activeTab, setActiveTab] = useState<'data' | 'description'>('data');
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [editingDescription, setEditingDescription] = useState<string | null>(null);
  const [tempDescription, setTempDescription] = useState<string>('');
  const [isGeneratingAI, setIsGeneratingAI] = useState<string | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState<boolean>(false);
  
  // 서버에서 저장된 설명을 저장하는 ref (state보다 먼저 접근 가능)
  const serverDescriptionsRef = useRef<Record<string, string>>({});
  
  // 섹션 스크롤을 위한 ref
  const chartSectionRef = useRef<HTMLDivElement>(null);
  const accountSectionRef = useRef<HTMLDivElement>(null);
  
  // KPI 카드 클릭 시 해당 섹션으로 스크롤 이동
  const handleKpiCardClick = (category: string) => {
    if (category === '총비용') {
      // 총비용 클릭 → 월별 비용 추이 섹션으로
      chartSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setIsChartExpanded(true);
    } else {
      // 개별 카테고리 클릭 → 비용 대분류별 YOY 비교 섹션으로 (계정소분류까지 바로 이동)
      accountSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setIsAccountExpanded(true);
      // 바로 계정소분류(detail) 단계로 이동 (대분류에서 바로 접근)
      setAccountLevel('detail');
      setSelectedAccount(category);
      setSelectedMajorCategory(category); // 대분류 카테고리 저장
    }
  };

  // 서버에서 저장된 설명 불러오기
  const loadDescriptions = async () => {
    try {
      const response = await fetch('/api/descriptions');
      const result = await response.json();
      
      if (result.success && result.data) {
        // ref에 먼저 저장 (즉시 접근 가능)
        serverDescriptionsRef.current = result.data;
        
        // 기존 자동 생성된 설명과 병합 (서버 데이터 우선)
        setDescriptions(prev => ({
          ...prev,
          ...result.data
        }));
        console.log('✅ 서버에서 설명 로드 완료:', Object.keys(result.data).length, '개');
        console.log('✅ 저장된 키 목록:', Object.keys(result.data));
        
        // AI 인사이트도 descriptions에서 불러오기 (특별 키 사용)
        if (result.data['__AI_INSIGHT__']) {
          setAiInsight(result.data['__AI_INSIGHT__']);
          console.log('✅ AI 인사이트 로드 완료');
        }
      }
    } catch (error) {
      console.error('❌ 서버에서 설명 로드 실패:', error);
    }
  };

  // AI 인사이트 저장
  const saveAiInsight = async () => {
    try {
      const response = await fetch('/api/descriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: '__AI_INSIGHT__',
          description: tempAiInsight
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 로컬 상태 즉시 업데이트 (기존 설명과 병합)
        setAiInsight(tempAiInsight);
        if (result.data) {
          setDescriptions(prev => ({
            ...prev,
            ...(result.data || {})
          }));
        }
        setEditingAiInsight(false);
        setTempAiInsight('');
        console.log('✅ AI 인사이트 저장 완료');
        alert('AI 인사이트가 저장되었습니다!');
      } else {
        console.error('❌ AI 인사이트 저장 실패:', result.error);
        alert('AI 인사이트 저장에 실패했습니다: ' + result.error);
      }
    } catch (error) {
      console.error('❌ AI 인사이트 저장 실패:', error);
      alert('AI 인사이트 저장에 실패했습니다. 네트워크를 확인해주세요.');
    }
  };

  // AI 인사이트 편집 시작
  const startEditAiInsight = () => {
    setEditingAiInsight(true);
    setTempAiInsight(aiInsight);
  };

  // AI 인사이트 편집 취소
  const cancelEditAiInsight = () => {
    setEditingAiInsight(false);
    setTempAiInsight('');
  };

  // AI 인사이트 자동 생성 (계층형 분석 코멘트 기반)
  const generateAiInsight = async () => {
    if (isGeneratingInsight) return;
    
    setIsGeneratingInsight(true);
    try {
      // KPI 데이터: kpiData[0]이 총비용, 나머지가 개별 카테고리
      const totalData = kpiData[0]; // 총비용
      const categories = kpiData.slice(1); // 개별 카테고리들 (인건비, IT수수료 등)
      
      const kpiInfo = kpiData.length > 0 ? {
        totalCost: totalData.current,
        totalPrevious: totalData.previous,
        change: totalData.change,
        changePercent: totalData.changePercent,
        categories: categories.map(k => ({
          category: k.category,
          current: k.current,
          previous: k.previous,
          change: k.change,
          changePercent: k.changePercent
        }))
      } : undefined;
      
      const response = await fetch('/api/insights/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          descriptions: descriptions,
          kpiData: kpiInfo
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setAiInsight(result.data.insight);
        // ref도 업데이트
        serverDescriptionsRef.current['__AI_INSIGHT__'] = result.data.insight;
        setDescriptions(prev => ({
          ...prev,
          '__AI_INSIGHT__': result.data.insight
        }));
        console.log('✅ AI 인사이트 자동 생성 완료:', result.data.accountCount, '개 코멘트 기반');
        alert(`AI 인사이트가 생성되었습니다! (${result.data.accountCount}개 코멘트 기반)`);
      } else {
        console.error('❌ AI 인사이트 생성 실패:', result.error);
        alert('AI 인사이트 생성에 실패했습니다: ' + result.error);
      }
    } catch (error) {
      console.error('❌ AI 인사이트 생성 오류:', error);
      alert('AI 인사이트 생성에 실패했습니다. 네트워크를 확인해주세요.');
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  // 사업부 배부 데이터 로드
  const loadAllocationData = async () => {
    setAllocationLoading(true);
    try {
      const response = await fetch(`/api/allocation?month=${selectedMonth}&mode=${viewMode}`);
      const result = await response.json();
      
      if (result.success) {
        setAllocationData({
          total: result.total,
          brands: result.brands,
        });
      }
    } catch (error) {
      console.error('사업부 배부 데이터 로드 실패:', error);
    } finally {
      setAllocationLoading(false);
    }
  };

  // 인건비(인원수) 데이터 로드
  const loadLaborData = async () => {
    setLaborLoading(true);
    try {
      const response = await fetch(`/api/labor?year=${laborYear}`);
      const result = await response.json();
      
      if (result.success) {
        setLaborData({
          months: result.months,
          yearlyTotals: result.yearlyTotals,
          divisions: result.divisions.map((d: { divisionName: string; teams: { deptNm: string; monthly: { [key: string]: number } }[]; subDivisions?: { name: string; teams: { deptNm: string; monthly: { [key: string]: number } }[]; monthly: { [key: string]: number } }[]; monthly: { [key: string]: number } }) => ({
            ...d,
            subDivisions: d.subDivisions || [],
          })),
        });
      }
      
      // 입사/퇴사/이동/비고 데이터 로드
      const movementResponse = await fetch('/api/labor-movement');
      const movementResult = await movementResponse.json();
      if (movementResult.success) {
        setLaborMovementData(movementResult.movement || {});
        setLaborRemarkData(movementResult.remark || {});
      }
    } catch (error) {
      console.error('인원수 데이터 로드 실패:', error);
    } finally {
      setLaborLoading(false);
    }
  };

  // IT수수료 데이터 로드
  const loadItExpenseData = async () => {
    setItExpenseLoading(true);
    try {
      const response = await fetch('/api/it-expense');
      const result = await response.json();
      
      if (result.success) {
        setItExpenseData({
          months: result.months,
          categories: result.categories,
          totals: result.totals,
        });
      }
    } catch (error) {
      console.error('IT수수료 데이터 로드 실패:', error);
    } finally {
      setItExpenseLoading(false);
    }
  };

  // CAPEX (유무형자산) 데이터 로드
  const loadCapexData = async (year: string) => {
    setCapexLoading(true);
    try {
      const response = await fetch(`/api/capex?year=${year}`);
      const result = await response.json();
      
      if (result.success) {
        setCapexData(result);
      }
    } catch (error) {
      console.error('CAPEX 데이터 로드 실패:', error);
    } finally {
      setCapexLoading(false);
    }
  };

  // IT유지보수비 상세 데이터 로드
  const loadItMaintenanceData = async (year: string) => {
    setItMaintenanceLoading(true);
    try {
      const response = await fetch(`/api/it-maintenance?year=${year}`);
      const result = await response.json();
      
      if (result.success) {
        setItMaintenanceData(result);
      }
    } catch (error) {
      console.error('IT유지보수비 데이터 로드 실패:', error);
    } finally {
      setItMaintenanceLoading(false);
    }
  };

  // IT유지보수비 팀별 상세 내역 로드
  const loadTeamMaintenanceDetails = async (year: string, team: string) => {
    setTeamDetailsLoading(true);
    try {
      const response = await fetch(`/api/it-maintenance?year=${year}&team=${encodeURIComponent(team)}`);
      const result = await response.json();
      
      if (result.success) {
        setTeamMaintenanceDetails(result.items || []);
      }
    } catch (error) {
      console.error('팀 상세 내역 로드 실패:', error);
    } finally {
      setTeamDetailsLoading(false);
    }
  };

  // IT유지보수비 모두펼치기
  const expandAllMaintenanceTeams = async () => {
    if (!itMaintenanceData) return;
    setAllMaintenanceExpanded(true);
    const details: { [team: string]: { text: string; monthly: { [m: string]: number }; total: number }[] } = {};
    
    for (const item of itMaintenanceData.items) {
      try {
        const response = await fetch(`/api/it-maintenance?year=${itExpenseYear}&team=${encodeURIComponent(item.text)}`);
        const result = await response.json();
        if (result.success) {
          details[item.text] = result.items || [];
        }
      } catch (error) {
        console.error(`${item.text} 상세 로드 실패:`, error);
      }
    }
    setAllTeamDetails(details);
  };

  // IT유지보수비 모두접기
  const collapseAllMaintenanceTeams = () => {
    setAllMaintenanceExpanded(false);
    setAllTeamDetails({});
    setExpandedMaintenanceTeam(null);
    setTeamMaintenanceDetails([]);
  };

  // IT사용료 데이터 로드
  const loadItUsageData = async (year: string) => {
    setItUsageLoading(true);
    try {
      // laborData가 없으면 먼저 로드 (인원수 데이터 필요)
      if (!laborData) {
        const laborResponse = await fetch(`/api/labor?year=${year}`);
        const laborResult = await laborResponse.json();
        if (laborResult.success) {
          setLaborData({
            months: laborResult.months,
            yearlyTotals: laborResult.yearlyTotals,
            divisions: laborResult.divisions.map((d: { divisionName: string; teams: { deptNm: string; monthly: { [key: string]: number } }[]; subDivisions?: { name: string; teams: { deptNm: string; monthly: { [key: string]: number } }[]; monthly: { [key: string]: number } }[]; monthly: { [key: string]: number } }) => ({
              ...d,
              subDivisions: d.subDivisions || [],
            })),
          });
        }
      }
      
      const response = await fetch(`/api/it-usage?year=${year}`);
      const result = await response.json();
      if (result.success) {
        setItUsageData(result);
      }
    } catch (error) {
      console.error('IT사용료 데이터 로드 실패:', error);
    } finally {
      setItUsageLoading(false);
    }
  };

  // IT사용료 팀별 상세 내역 로드
  const loadTeamUsageDetails = async (year: string, team: string) => {
    setTeamUsageDetailsLoading(true);
    try {
      const response = await fetch(`/api/it-usage?year=${year}&team=${encodeURIComponent(team)}`);
      const result = await response.json();
      if (result.success) {
        setTeamUsageDetails(result.items || []);
      }
    } catch (error) {
      console.error('팀 상세 내역 로드 실패:', error);
    } finally {
      setTeamUsageDetailsLoading(false);
    }
  };

  // IT사용료 모두펼치기
  const expandAllUsageTeams = async () => {
    if (!itUsageData) return;
    setAllUsageExpanded(true);
    const details: { [team: string]: { text: string; monthly: { [m: string]: number }; total: number }[] } = {};
    
    for (const item of itUsageData.items) {
      try {
        const response = await fetch(`/api/it-usage?year=${itExpenseYear}&team=${encodeURIComponent(item.text)}`);
        const result = await response.json();
        if (result.success) {
          details[item.text] = result.items || [];
        }
      } catch (error) {
        console.error(`${item.text} 상세 로드 실패:`, error);
      }
    }
    setAllUsageTeamDetails(details);
  };

  // IT사용료 모두접기
  const collapseAllUsageTeams = () => {
    setAllUsageExpanded(false);
    setAllUsageTeamDetails({});
    setExpandedUsageTeam(null);
    setTeamUsageDetails([]);
  };

  // 부문 접기/펼치기 토글
  const toggleDivision = (divisionName: string) => {
    setExpandedDivisions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(divisionName)) {
        newSet.delete(divisionName);
      } else {
        newSet.add(divisionName);
      }
      return newSet;
    });
  };

  // 하위 부문 접기/펼치기 토글
  const toggleSubDivision = (subDivisionName: string) => {
    setExpandedSubDivisions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subDivisionName)) {
        newSet.delete(subDivisionName);
      } else {
        newSet.add(subDivisionName);
      }
      return newSet;
    });
  };

  // 필터 옵션 로드
  const loadFilterOptions = async () => {
    try {
      // 비용 데이터 기준으로 필터 옵션 가져오기
      const response = await fetch(`/api/filter-options?month=${selectedMonth}`);
      const result = await response.json();
      
      if (result.success) {
        // 코스트센터 목록 (인원이 있는 것 먼저 정렬됨)
        setCostCenterOptions(result.costCenters);
        // 계정 대분류 목록
        setMajorCategoryOptions(result.majorCategories);
      }
    } catch (error) {
      console.error('필터 옵션 로드 실패:', error);
    }
  };
  
  // 필터 초기화
  const resetFilters = () => {
    setSelectedCostCenters([]);
    setSelectedMajorCategories([]);
  };
  
  // Excel 다운로드
  const exportToExcel = () => {
    try {
      const XLSX = require('xlsx');
      
      // 계층형 테이블 데이터를 Excel로 변환
      const wsData: any[] = [];
      
      // 헤더
      wsData.push(['계정명', '당월', '전년', '증감', 'YOY (%)', '설명']);
      
      // 데이터 (필터링된 데이터 사용)
      const dataToExport = selectedMajorCategories.length > 0
        ? hierarchyData.filter((major: any) => major.isTotal || selectedMajorCategories.includes(major.name))
        : hierarchyData;
      
      dataToExport.forEach((major: any) => {
        if (major.isTotal) return;
        
        wsData.push([
          major.name,
          major.current || 0,
          major.previous || 0,
          major.change || 0,
          major.changePercent || 0,
          descriptions[major.id] || ''
        ]);
        
        if (major.children) {
          major.children.forEach((middle: any) => {
            wsData.push([
              `  ${middle.name}`,
              middle.current || 0,
              middle.previous || 0,
              middle.change || 0,
              middle.changePercent || 0,
              descriptions[middle.id] || ''
            ]);
            
            if (middle.children) {
              middle.children.forEach((detail: any) => {
                wsData.push([
                  `    ${detail.name}`,
                  detail.current || 0,
                  detail.previous || 0,
                  detail.change || 0,
                  detail.changePercent || 0,
                  descriptions[detail.id] || ''
                ]);
              });
            }
          });
        }
      });
      
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '비용 분석');
      
      // 파일명 생성
      const fileName = `공통부서_비용분석_${selectedMonth}월_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      alert('Excel 파일이 다운로드되었습니다!');
    } catch (error) {
      console.error('Excel 다운로드 실패:', error);
      alert('Excel 다운로드에 실패했습니다.');
    }
  };
  
  // Redis에서 배부기준 및 인원 시사점 불러오기
  useEffect(() => {
    const loadAllocationCriteria = async () => {
      try {
        const response = await fetch('/api/allocation-criteria');
        const result = await response.json();
        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
          setAllocationCriteria(result.data);
          setCriteriaEditMode(false); // 저장된 데이터가 있으면 읽기 모드로 시작
        }
      } catch (error) {
        console.error('배부기준 불러오기 실패:', error);
      }
    };
    
    const loadLaborInsight = async () => {
      try {
        const response = await fetch('/api/labor-insight');
        const result = await response.json();
        if (result.success && result.data) {
          setLaborInsight(result.data);
        }
      } catch (error) {
        console.error('인원 시사점 불러오기 실패:', error);
      }
    };
    
    loadAllocationCriteria();
    loadLaborInsight();
  }, []);

  useEffect(() => {
    loadDescriptions();
    loadFilterOptions();
  }, [selectedMonth]);

  useEffect(() => {
    loadData();
    loadChartData();
  }, [viewMode, selectedMonth, selectedCostCenters, selectedMajorCategories]);
  
  // 필터 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.filter-dropdown') && !target.closest('[data-filter-button]')) {
        setIsFilterOpen(false);
        const exportMenu = document.getElementById('export-menu');
        if (exportMenu && !target.closest('[data-export-button]')) {
          exportMenu.classList.add('hidden');
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // chartData가 업데이트되면 인사이트 재생성 (현재는 고정 텍스트 사용)
  // useEffect(() => {
  //   if (kpiData.length > 0 && chartData.length > 0) {
  //     generateAIInsight(kpiData);
  //   }
  // }, [chartData]);

  useEffect(() => {
    loadAccountData();
  }, [accountViewMode, selectedMonth, accountLevel, selectedMajorCategory]);
  
  // selectedAccount가 변경되고 accountLevel이 detail이 아닐 때만 코스트센터 로드
  useEffect(() => {
    if (selectedAccount && accountLevel !== 'detail') {
      loadCostCenterData();
    }
  }, [selectedAccount]);
  
  useEffect(() => {
    loadHierarchyData();
  }, [tableViewMode, selectedMonth]);
  
  // descriptions가 변경되면 구조화된 인사이트 업데이트
  useEffect(() => {
    if (hierarchyData.length > 0) {
      extractStructuredInsights(hierarchyData);
    }
  }, [descriptions, hierarchyData]);

  // 사업부 배부 탭 선택 시 데이터 로드
  useEffect(() => {
    if (mainTab === 'allocation' && !allocationData && !allocationLoading) {
      loadAllocationData();
    }
  }, [mainTab]);

  // 월 변경 또는 viewMode 변경 시 사업부 배부 데이터 새로 로드
  useEffect(() => {
    if (mainTab === 'allocation') {
      loadAllocationData();
    }
  }, [selectedMonth, viewMode]);

  // 인건비 탭 진입 시 데이터 로드
  useEffect(() => {
    if (mainTab === 'labor' && !laborData) {
      loadLaborData();
    }
  }, [mainTab]);

  // 인건비 탭에서 인건비 로드 (인당인건비 계산용)
  useEffect(() => {
    if (mainTab !== 'labor' || !laborData) return;
    const fetchLaborCostData = async () => {
      try {
        // 12개월 인건비 병렬 로드
        const promises = [];
        for (let m = 1; m <= 12; m++) {
          promises.push(fetch(`/api/kpi?month=${m.toString().padStart(2, '0')}&mode=monthly`).then(r => r.json()));
        }
        const results = await Promise.all(promises);
        
        const monthlyData: { month: string; cost2024: number; cost2025: number; headcount2024: number; headcount2025: number }[] = [];
        results.forEach((result, idx) => {
          const m = idx + 1;
          const monthStr = m.toString().padStart(2, '0');
          if (result.success && Array.isArray(result.data)) {
            const laborCat = result.data.find((c: any) => c.category === '인건비');
            if (laborCat) {
              monthlyData.push({
                month: `${m}월`,
                cost2024: laborCat.previous,
                cost2025: laborCat.current,
                headcount2024: laborData.yearlyTotals['2024']?.[monthStr] || 0,
                headcount2025: laborData.yearlyTotals['2025']?.[monthStr] || 0,
              });
            }
          }
        });
        setLaborCostMonthly(monthlyData);
        
        // 12월 기준 대분류별/중분류별 인건비 로드
        const catRes = await fetch('/api/labor-cost?month=12');
        const catResult = await catRes.json();
        if (catResult.success && catResult.categories) {
          setLaborCostByCategory(catResult.categories);
        }
        if (catResult.success && catResult.subDivisions) {
          setLaborCostBySubDiv(catResult.subDivisions);
        }
      } catch (e) {
        console.error('인건비 로드 실패:', e);
      }
    };
    fetchLaborCostData();
  }, [mainTab, laborData]);

  // IT수수료 탭 진입 시 데이터 로드
  useEffect(() => {
    if (mainTab === 'it' && !itExpenseData) {
      loadItExpenseData();
    }
  }, [mainTab]);

  // CAPEX 데이터 로드 (IT 탭 진입 또는 연도 변경 시)
  useEffect(() => {
    if (mainTab === 'it') {
      loadCapexData(capexYear);
    }
  }, [mainTab, capexYear]);

  // 입사/퇴사/이동 데이터 자동 저장 (debounce)
  useEffect(() => {
    if (Object.keys(laborMovementData).length === 0) return;
    
    const timer = setTimeout(() => {
      fetch('/api/labor-movement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movement: laborMovementData })
      }).catch(err => console.error('입사/퇴사/이동 저장 실패:', err));
    }, 500);
    
    return () => clearTimeout(timer);
  }, [laborMovementData]);

  // 비고 데이터 자동 저장 (debounce)
  useEffect(() => {
    if (Object.keys(laborRemarkData).length === 0) return;
    
    const timer = setTimeout(() => {
      fetch('/api/labor-movement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remark: laborRemarkData })
      }).catch(err => console.error('비고 저장 실패:', err));
    }, 500);
    
    return () => clearTimeout(timer);
  }, [laborRemarkData]);

  const loadAccountData = async () => {
    try {
      const params = new URLSearchParams({
        mode: accountViewMode,
        month: selectedMonth,
        level: accountLevel,
      });
      
      if (accountLevel === 'middle' && selectedAccount) {
        params.append('category', selectedAccount);
      } else if (accountLevel === 'detail') {
        if (selectedMajorCategory) {
          params.append('majorCategory', selectedMajorCategory);
        } else if (selectedAccount) {
          params.append('category', selectedAccount);
        }
      }
      
      // 필터 파라미터 추가
      if (selectedCostCenters.length > 0) {
        params.append('costCenters', selectedCostCenters.join(','));
      }
      if (selectedMajorCategories.length > 0) {
        params.append('majorCategories', selectedMajorCategories.join(','));
      }
      
      // 계정 차트 데이터 로드
      const response = await fetch(`/api/account-analysis?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setAccountData(result.data);
      }
      
      // 코스트센터 데이터는 별도 useEffect에서 처리
    } catch (error) {
      console.error('계정 데이터 로드 실패:', error);
    }
  };
  
  // 코스트센터 데이터만 로드
  const loadCostCenterData = async () => {
    if (!selectedAccount) {
      setCostCenterData([]);
      return;
    }
    
    try {
      const params = new URLSearchParams({
        mode: accountViewMode,
        month: selectedMonth,
        account: selectedAccount,
      });
      if (selectedCostCenters.length > 0) {
        params.append('costCenters', selectedCostCenters.join(','));
      }
      const ccResponse = await fetch(`/api/costcenter-analysis?${params.toString()}`);
      const ccResult = await ccResponse.json();
      
      if (ccResult.success) {
        setCostCenterData(ccResult.data);
      }
    } catch (error) {
      console.error('코스트센터 데이터 로드 실패:', error);
    }
  };
  
  // 코스트센터 데이터만 로드 (특정 계정명으로)
  const loadCostCenterDataOnly = async (accountName: string) => {
    try {
      const params = new URLSearchParams({
        mode: accountViewMode,
        month: selectedMonth,
        account: accountName,
      });
      if (selectedCostCenters.length > 0) {
        params.append('costCenters', selectedCostCenters.join(','));
      }
      const ccResponse = await fetch(`/api/costcenter-analysis?${params.toString()}`);
      const ccResult = await ccResponse.json();
      
      if (ccResult.success) {
        setCostCenterData(ccResult.data);
      }
    } catch (error) {
      console.error('코스트센터 데이터 로드 실패:', error);
    }
  };

  const handleAccountClick = (accountName: string) => {
    if (accountLevel === 'major') {
      // 대분류 클릭 → 중분류로 드릴다운
      setSelectedAccount(accountName);
      setAccountLevel('middle');
    } else if (accountLevel === 'middle') {
      // 중분류 클릭 → 소분류로 드릴다운
      setSelectedAccount(accountName);
      setAccountLevel('detail');
    } else if (accountLevel === 'detail') {
      // 소분류 클릭 → 해당 소분류의 코스트센터만 업데이트 (월별 추이 차트는 그대로 유지)
      setSelectedAccount(accountName); // 헤더 표시를 위해 업데이트
      loadCostCenterDataOnly(accountName); // 코스트센터 데이터만 로드
      // handleDrilldown은 호출하지 않음 - 위에 월별 추이 차트와 독립적으로 동작
    }
  };

  const handleBackToMajor = () => {
    setAccountLevel('major');
    setSelectedAccount(null);
    setSelectedMajorCategory(null);
    setCostCenterData([]);
  };

  const handleBackToMiddle = () => {
    setAccountLevel('middle');
    setSelectedMajorCategory(null); // 중분류로 돌아가면 대분류 직접 접근 상태 해제
    // 중분류의 부모(대분류)를 찾기
    const middleItem = accountData.find(item => item.name === selectedAccount);
    if (middleItem && middleItem.parent) {
      setSelectedAccount(middleItem.parent);
    }
  };
  
  const loadHierarchyData = async () => {
    try {
      const params = new URLSearchParams({
        mode: tableViewMode,
        month: selectedMonth,
      });
      if (selectedCostCenters.length > 0) {
        params.append('costCenters', selectedCostCenters.join(','));
      }
      if (selectedMajorCategories.length > 0) {
        params.append('majorCategories', selectedMajorCategories.join(','));
      }
      const response = await fetch(`/api/hierarchy?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setHierarchyData(result.data);
        
        // OpenAI 분석 데이터 로드
        loadGLAnalysisData(result.data);
        
        // 구조화된 인사이트 추출
        extractStructuredInsights(result.data);
      }
    } catch (error) {
      console.error('계층 데이터 로드 실패:', error);
    }
  };
  
  // 구조화된 인사이트 추출 함수
  const extractStructuredInsights = (data: any[]) => {
    const insights: InsightItem[] = [];
    
    data.forEach((major: any) => {
      if (major.isTotal) return; // 합계 제외
      
      // 대분류 인사이트
      if (major.changePercent !== undefined && Math.abs(major.changePercent) >= 10) {
        insights.push({
          id: major.id,
          name: major.name,
          category: major.name,
          changePercent: major.changePercent,
          current: major.current || 0,
          previous: major.previous || 0,
          change: major.change || 0,
          description: descriptions[major.id] || '',
          level: 'major'
        });
      }
      
      // 중분류 인사이트
      if (major.children) {
        major.children.forEach((middle: any) => {
          if (middle.changePercent !== undefined && Math.abs(middle.changePercent) >= 15) {
            insights.push({
              id: middle.id,
              name: middle.name,
              category: major.name,
              changePercent: middle.changePercent,
              current: middle.current || 0,
              previous: middle.previous || 0,
              change: middle.change || 0,
              description: descriptions[middle.id] || '',
              level: 'middle'
            });
          }
          
          // 소분류 인사이트 (큰 변동만)
          if (middle.children) {
            middle.children.forEach((detail: any) => {
              if (detail.changePercent !== undefined && Math.abs(detail.changePercent) >= 20) {
                insights.push({
                  id: detail.id,
                  name: detail.name,
                  category: major.name,
                  changePercent: detail.changePercent,
                  current: detail.current || 0,
                  previous: detail.previous || 0,
                  change: detail.change || 0,
                  description: descriptions[detail.id] || '',
                  level: 'detail'
                });
              }
            });
          }
        });
      }
    });
    
    // 변동률 절대값 기준 정렬
    insights.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
    setStructuredInsights(insights);
    console.log('📊 구조화된 인사이트 추출 완료:', insights.length, '개');
  };
  
  // 인사이트 카테고리별 분류
  const getCategorizedInsights = () => {
    const critical: InsightItem[] = []; // 즉시 확인 필요 (±50% 이상)
    const warning: InsightItem[] = [];  // 모니터링 필요 (±20~50%)
    const positive: InsightItem[] = []; // 긍정적 변화 (비용 절감)
    
    structuredInsights.forEach(item => {
      const absChange = Math.abs(item.changePercent);
      
      if (absChange >= 50) {
        critical.push(item);
      } else if (absChange >= 20) {
        if (item.change < 0) {
          positive.push(item); // 비용 감소는 긍정적
        } else {
          warning.push(item);
        }
      } else if (item.change < 0 && absChange >= 10) {
        positive.push(item); // 10% 이상 비용 절감도 긍정적
      }
    });
    
    return { critical, warning, positive };
  };
  
  // 인사이트 내보내기 (텍스트 복사)
  const exportInsights = () => {
    const { critical, warning, positive } = getCategorizedInsights();
    
    let text = `📊 ${selectedMonth}월 비용 분석 인사이트\n\n`;
    
    if (critical.length > 0) {
      text += `🚨 즉시 확인 필요 (YOY ±50% 이상)\n`;
      text += `${'─'.repeat(40)}\n`;
      critical.forEach(item => {
        const sign = item.changePercent >= 0 ? '+' : '';
        text += `• ${item.name}: ${sign}${item.changePercent.toFixed(1)}% (${Math.round(item.previous)} → ${Math.round(item.current)}백만원)\n`;
        if (item.description) text += `  원인: ${item.description}\n`;
      });
      text += `\n`;
    }
    
    if (warning.length > 0) {
      text += `⚠️ 모니터링 필요 (YOY ±20~50%)\n`;
      text += `${'─'.repeat(40)}\n`;
      warning.forEach(item => {
        const sign = item.changePercent >= 0 ? '+' : '';
        text += `• ${item.name}: ${sign}${item.changePercent.toFixed(1)}% (${Math.round(item.previous)} → ${Math.round(item.current)}백만원)\n`;
        if (item.description) text += `  원인: ${item.description}\n`;
      });
      text += `\n`;
    }
    
    if (positive.length > 0) {
      text += `✅ 긍정적 변화 (비용 절감)\n`;
      text += `${'─'.repeat(40)}\n`;
      positive.forEach(item => {
        text += `• ${item.name}: ${item.changePercent.toFixed(1)}% (${Math.round(item.previous)} → ${Math.round(item.current)}백만원)\n`;
        if (item.description) text += `  원인: ${item.description}\n`;
      });
    }
    
    navigator.clipboard.writeText(text).then(() => {
      alert('인사이트가 클립보드에 복사되었습니다!');
    }).catch(err => {
      console.error('복사 실패:', err);
      alert('복사에 실패했습니다.');
    });
  };
  
  const loadGLAnalysisData = async (hierarchyData: any[]) => {
    try {
      // OpenAI로 생성한 GL 분석 데이터 가져오기
      const response = await fetch('/api/gl-analysis');
      const result = await response.json();
      
      if (result.success) {
        const glAnalysisMap = result.data;
        console.log('✅ GL 분석 데이터 로드 완료:', Object.keys(glAnalysisMap).length, '개');
        
        // 모든 계층(대분류, 중분류, 소분류)에 대해 설명 생성
        hierarchyData.forEach((major: any) => {
          // 대분류 설명 생성
          generateDescriptionForLevel(major, glAnalysisMap);
          
          // 중분류 설명 생성
          if (major.children) {
            major.children.forEach((middle: any) => {
              generateDescriptionForLevel(middle, glAnalysisMap);
              
              // 소분류 설명 생성
              if (middle.children) {
                middle.children.forEach((detail: any) => {
                  generateDescriptionForLevel(detail, glAnalysisMap);
                });
              }
            });
          }
        });
      } else {
        console.error('GL 분석 데이터 로드 실패:', result.error);
      }
    } catch (error) {
      console.error('GL 분석 데이터 로드 오류:', error);
    }
  };
  
  const generateDescriptionForLevel = (data: any, glAnalysisMap: Record<string, any>) => {
    const accountName = data.name;
    const accountId = data.id; // 고유 ID 사용 (대분류와 중분류 구분)
    
    // 사용자가 편집한 설명이 있으면 그대로 유지 (ref를 사용하여 최신 서버 데이터 확인)
    const savedDescription = serverDescriptionsRef.current[accountId];
    if (savedDescription) {
      console.log('📝 저장된 설명 사용:', accountName, '→', savedDescription.substring(0, 30) + '...');
      // 서버에서 가져온 설명을 state에도 반영
      setDescriptions(prev => ({
        ...prev,
        [accountId]: savedDescription
      }));
      return; // 저장된 설명이 있으면 자동 생성하지 않음
    }
    
    // OpenAI 분석 결과가 있으면 직접 사용 (소분류)
    if (glAnalysisMap[accountName]) {
      setDescriptions(prev => ({
        ...prev,
        [accountId]: glAnalysisMap[accountName].description
      }));
      return;
    }
    
    // OpenAI 분석 결과가 없으면 자동 생성 (대분류, 중분류, 인건비)
    generateAIDescriptionAuto(accountId, accountName, data, glAnalysisMap);
  };
  
  const generateAIDescriptionAuto = async (accountId: string, accountName: string, data: any, glAnalysisMap: Record<string, any> = {}) => {
    console.log('🔍 설명 생성 시작:', accountId, accountName, data);
    
    const yoyChange = data.yoy - 100;
    const changeDirection = yoyChange > 0 ? '증가' : '감소';
    const changeAmount = Math.abs(data.change);
    
    let description = '';
    
    // 인건비인 경우 인원수 정보 추가
    if (accountName === '인건비') {
      console.log('👥 인건비 분석 시작...');
      
      // ⚠️ 월별 하드코딩 데이터: 새로운 월 추가 시 여기에 데이터를 추가하세요!
      const headcountData: Record<string, { current: number; previous: number; changes: string }> = {
        '10': {
          current: 245,
          previous: 241,
          changes: '해외사업팀+10명, 통합소싱팀+8명, 통합영업팀+4명, 글로벌슈즈팀-10명, 임원-2명, 이비즈-3명, IT/프로세스-3명'
        },
        '11': {
          current: 241,
          previous: 241,
          changes: '해외사업팀+9명, 통합소싱팀+8명, 통합영업팀+5명, 통합인플루언서마케팅팀+5명, 글로벌슈즈팀-10명, e-BIZ팀-5명, 통합마케팅팀-4명, 무역팀-3명, 프로세스팀-3명'
        },
        // 2025년 12월 데이터
        '12': {
          current: 275,
          previous: 243,
          changes: '마케팅본부+32명(통합마케팅/인플루언서 통합), e-BIZ팀-9명, 글로벌슈즈팀-10명, 프로세스팀+3명'
        },
      };
      
      const monthData = headcountData[selectedMonth];
      
      if (monthData) {
        // 하드코딩된 데이터가 있는 경우
        const headcountChange = monthData.current - monthData.previous;
        description = `전년 대비 ${Math.abs(yoyChange).toFixed(1)}% ${changeDirection}. `;
        description += `인원수 전년 ${monthData.previous}명 → 당년 ${monthData.current}명 (${headcountChange >= 0 ? '+' : ''}${headcountChange}명). `;
        description += `주요 변동: ${monthData.changes}.`;
      } else {
        // 하드코딩된 데이터가 없는 경우 API 호출
        try {
          const currentYearMonth = `2025${selectedMonth.padStart(2, '0')}`;
          const previousYearMonth = `2024${selectedMonth.padStart(2, '0')}`;
          
          const response = await fetch(`/api/headcount-comparison?currentMonth=${currentYearMonth}&previousMonth=${previousYearMonth}`);
          const result = await response.json();
          
          if (result.success) {
            const { currentTotal, previousTotal, departments } = result.data;
            const headcountChange = currentTotal - previousTotal;
            
            description = `전년 대비 ${Math.abs(yoyChange).toFixed(1)}% ${changeDirection}. `;
            description += `인원수 전년 ${previousTotal}명 → 당년 ${currentTotal}명 (${headcountChange >= 0 ? '+' : ''}${headcountChange}명). `;
            
            // 부서별 차이가 있는 경우
            if (departments && departments.length > 0) {
              const increases = departments.filter((d: any) => d.change > 0).slice(0, 3);
              const decreases = departments.filter((d: any) => d.change < 0).slice(0, 3);
              
              if (increases.length > 0 || decreases.length > 0) {
                description += `주요 변동: `;
                const changes = [...increases, ...decreases];
                const changeTexts = changes.map((d: any) => 
                  `${d.department}${d.change >= 0 ? '+' : ''}${d.change}명`
                );
                description += changeTexts.join(', ') + '.';
              }
            }
          } else {
            // API 실패 시 기본 설명
            description = `전년 대비 ${Math.abs(yoyChange).toFixed(1)}% ${changeDirection}. `;
            description += `전년 대비 ${changeAmount.toFixed(0)}백만원 ${changeDirection}.`;
          }
        } catch (error) {
          console.error('인원수 데이터 로드 실패:', error);
          description = `전년 대비 ${Math.abs(yoyChange).toFixed(1)}% ${changeDirection}. `;
          description += `전년 대비 ${changeAmount.toFixed(0)}백만원 ${changeDirection}.`;
        }
      }
    } else {
      // 인건비가 아닌 경우 - OpenAI 분석 결과 사용 또는 상세 CSV 분석
      console.log('📊 OpenAI 분석 결과 확인:', accountName);
      
      // 먼저 중분류의 모든 소분류 설명을 수집
      const relatedDescriptions: string[] = [];
      
      if (data.children && data.children.length > 0) {
        // 중분류인 경우: 소분류들의 설명을 모아서 요약
        data.children.forEach((child: any) => {
          if (glAnalysisMap[child.name]) {
            relatedDescriptions.push(glAnalysisMap[child.name].description);
          }
        });
        
        if (relatedDescriptions.length > 0) {
          // 소분류 설명들을 요약하여 중분류 설명 생성
          const totalChange = data.change;
          const changeDirection = totalChange >= 0 ? '증가' : '감소';
          description = `전년 대비 ${Math.abs(totalChange).toFixed(0)}백만원 ${changeDirection}.`;
        } else {
          // OpenAI 분석 결과가 없으면 기본 설명
          description = `전년 대비 ${Math.abs(yoyChange).toFixed(1)}% ${changeDirection}. `;
          description += `전년 대비 ${changeAmount.toFixed(0)}백만원 ${changeDirection}.`;
        }
      } else {
        // 소분류 또는 대분류인 경우: 기본 설명
        description = `전년 대비 ${Math.abs(yoyChange).toFixed(1)}% ${changeDirection}. `;
        description += `전년 대비 ${changeAmount.toFixed(0)}백만원 ${changeDirection}.`;
      }
    }
    
    setDescriptions(prev => ({
      ...prev,
      [accountId]: description
    }));
  };
  
  const toggleRow = (rowId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId);
    } else {
      newExpanded.add(rowId);
    }
    setExpandedRows(newExpanded);
  };
  
  const generateAIDescription = async (accountName: string, data: any) => {
    setIsGeneratingAI(accountName);
    
    try {
      // AI 설명 생성 시뮬레이션 (실제로는 API 호출)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const yoyChange = data.yoy - 100;
      const changeDirection = yoyChange > 0 ? '증가' : '감소';
      const changeAmount = Math.abs(data.change);
      
      let description = `${accountName}은(는) 전년 대비 ${Math.abs(yoyChange).toFixed(1)}% ${changeDirection}했습니다. `;
      description += `절대 금액으로는 ${changeAmount.toFixed(0)}백만원의 ${changeDirection}이 발생했습니다. `;
      
      if (yoyChange > 10) {
        description += `이는 상당한 증가폭으로, 해당 비용 항목에 대한 면밀한 검토가 필요합니다.`;
      } else if (yoyChange < -10) {
        description += `비용 절감 효과가 나타나고 있으며, 긍정적인 추세입니다.`;
      } else {
        description += `전년 대비 안정적인 수준을 유지하고 있습니다.`;
      }
      
      setDescriptions(prev => ({
        ...prev,
        [accountName]: description
      }));
    } catch (error) {
      console.error('AI 설명 생성 실패:', error);
    } finally {
      setIsGeneratingAI(null);
    }
  };
  
  const startEditDescription = (accountId: string, currentDesc: string) => {
    setEditingDescription(accountId);
    setTempDescription(currentDesc);
  };
  
  const saveDescription = async (accountId: string) => {
    // 서버에 저장 - 개별 항목만 전송
    try {
      const response = await fetch('/api/descriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: accountId,
          description: tempDescription
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 기존 설명과 병합 (자동 생성된 설명 유지 + 저장된 설명 추가)
        setDescriptions(prev => ({
          ...prev,
          [accountId]: tempDescription,
          ...(result.data || {})
        }));
        
        console.log('✅ 서버에 설명 저장 완료:', accountId);
        alert('설명이 저장되었습니다!');
      } else {
        console.error('❌ 서버 저장 실패:', result.error);
        alert('설명 저장에 실패했습니다: ' + result.error);
      }
    } catch (error) {
      console.error('❌ 설명 저장 실패:', error);
      alert('설명 저장에 실패했습니다. 네트워크를 확인해주세요.');
    }
    
    setEditingDescription(null);
    setTempDescription('');
  };
  
  const cancelEditDescription = () => {
    setEditingDescription(null);
    setTempDescription('');
  };

  const handleDrilldown = async (category: string, fromLevel: 'major' | 'middle' = 'major') => {
    try {
      const params = new URLSearchParams({
        category,
        month: selectedMonth,
        level: fromLevel,
      });
      if (selectedCostCenters.length > 0) {
        params.append('costCenters', selectedCostCenters.join(','));
      }
      const response = await fetch(`/api/drilldown?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setDrilldownCategory(category);
        setDrilldownData(result.data);
        
        // fromLevel이 major면 중분류 차트, middle이면 소분류 차트
        setDrilldownLevel(fromLevel === 'major' ? 'middle' : 'detail');
      }
    } catch (error) {
      console.error('드릴다운 로드 실패:', error);
    }
  };
  
  const handleDetailDrilldown = async (category: string) => {
    try {
      // 중분류 차트에서 범례를 클릭하면 소분류 차트 생성
      const params = new URLSearchParams({
        category,
        month: selectedMonth,
        level: 'middle',
      });
      if (selectedCostCenters.length > 0) {
        params.append('costCenters', selectedCostCenters.join(','));
      }
      const response = await fetch(`/api/drilldown?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setDetailDrilldownCategory(category);
        setDetailDrilldownData(result.data);
      }
    } catch (error) {
      console.error('소분류 드릴다운 로드 실패:', error);
    }
  };

  const loadChartData = async () => {
    try {
      // 6개월 이동평균 계산을 위해 17개월 데이터 로드 (12개월 + 이전 5개월)
      const selectedMonthNum = parseInt(selectedMonth);
      const selectedYearNum = 2025; // 현재 기준 연도
      const allMonths: any[] = [];
      
      // 17개월 계산 (선택한 월 포함하여 과거 17개월)
      for (let i = 16; i >= 0; i--) {
        let targetMonth = selectedMonthNum - i;
        let targetYear = selectedYearNum;
        
        // 월이 0 이하면 전년도로
        while (targetMonth <= 0) {
          targetMonth += 12;
          targetYear -= 1;
        }
        
        // 필터 파라미터 구성
        const chartParams = new URLSearchParams({
          mode: 'monthly',
          month: targetMonth.toString(),
          year: targetYear.toString(),
        });
        
        if (selectedCostCenters.length > 0) {
          chartParams.append('costCenters', selectedCostCenters.join(','));
        }
        if (selectedMajorCategories.length > 0) {
          chartParams.append('majorCategories', selectedMajorCategories.join(','));
        }
        
        const response = await fetch(`/api/kpi?${chartParams.toString()}`);
        const result = await response.json();
        
        if (result.success) {
          const data = result.data;
          const monthData: any = {
            month: `${targetYear.toString().slice(2)}년${targetMonth}월`,
            monthNum: targetMonth,
            year: targetYear,
          };
          
          let totalCurrent = 0;
          let totalPrevious = 0;
          
          // 각 카테고리별 데이터 추가
          data.forEach((item: any) => {
            monthData[item.category] = item.current;
            totalCurrent += item.current;
            totalPrevious += item.previous;
          });
          
          // YOY 계산 (당년/전년 * 100%)
          monthData['YOY'] = totalPrevious !== 0 ? (totalCurrent / totalPrevious) * 100 : 0;
          monthData['총비용'] = totalCurrent;
          
          console.log(`${targetYear}년 ${targetMonth}월 데이터:`, monthData);
          allMonths.push(monthData);
        }
      }
      
      // 6개월 이동평균 계산 (전체 17개월 데이터 기준)
      if (allMonths.length > 0) {
        const allMonthsWithMA = allMonths.map((month, index) => {
          // 6개월 이동평균 계산 (현재 월 포함 이전 6개월)
          const start = Math.max(0, index - 5);
          const period = allMonths.slice(start, index + 1);
          const ma6 = period.reduce((sum, m) => sum + (m['총비용'] || 0), 0) / period.length;
          
          // 이상치 판단 (±15% 이상 벗어난 경우)
          const deviation = ma6 > 0 ? ((month['총비용'] - ma6) / ma6) * 100 : 0;
          const isOutlier = Math.abs(deviation) >= 15;
          
          return {
            ...month,
            '6개월평균': ma6,
            deviation: deviation,
            isOutlier: isOutlier,
          };
        });
        
        // 차트에는 최근 12개월만 표시 (처음 5개월은 이동평균 계산용)
        const chartMonths = allMonthsWithMA.slice(-12);
        
        console.log('📊 차트 데이터 로드 완료:', chartMonths.length, '개월');
        console.log('📊 마지막 월 데이터:', chartMonths[chartMonths.length - 1]);
        setChartData(chartMonths);
      }
    } catch (error) {
      console.error('차트 데이터 로드 실패:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 필터 파라미터 구성
      const params = new URLSearchParams({
        mode: viewMode,
        month: selectedMonth,
      });
      
      if (selectedCostCenters.length > 0) {
        params.append('costCenters', selectedCostCenters.join(','));
      }
      if (selectedMajorCategories.length > 0) {
        params.append('majorCategories', selectedMajorCategories.join(','));
      }
      
      // API에서 실제 데이터 로드 (필터 적용)
      const response = await fetch(`/api/kpi?${params.toString()}`);
      const result = await response.json();
      
      if (!result.success) {
        console.error('API 오류 상세:', result);
        throw new Error(result.details || result.error || 'API 호출 실패');
      }
      
      const categories = result.data;

      // 총비용 계산
      const totalCurrent = categories.reduce((sum: number, cat: any) => sum + cat.current, 0);
      const totalPrevious = categories.reduce((sum: number, cat: any) => sum + cat.previous, 0);
      const totalPreviousMonth = categories.reduce((sum: number, cat: any) => sum + (cat.previousMonth || 0), 0);
      const totalChange = totalCurrent - totalPrevious;
      const totalChangePercent = totalPrevious !== 0 ? (totalCurrent / totalPrevious) * 100 : 0;  // 당년/전년 * 100%
      
      // 총비용 MoM 계산
      const totalMomChange = totalCurrent - totalPreviousMonth;
      const totalMomPercent = totalPreviousMonth !== 0 ? ((totalCurrent - totalPreviousMonth) / totalPreviousMonth) * 100 : 0;

      // 총비용을 맨 앞에 추가
      const mockData: KpiData[] = [
        {
          category: '총비용',
          current: totalCurrent,
          previous: totalPrevious,
          change: totalChange,
          changePercent: totalChangePercent,
          previousMonth: totalPreviousMonth,
          momChange: totalMomChange,
          momPercent: totalMomPercent,
        },
        ...categories
      ];
      
      setKpiData(mockData);
      
      // 효율성 지표 계산 (비동기로 실행하여 KPI 먼저 표시)
      setTimeout(() => {
        loadEfficiencyMetrics(mockData);
      }, 0);
      
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 효율성 지표 계산 함수
  const loadEfficiencyMetrics = async (kpiData: KpiData[]) => {
    try {
      // 1. 인원수 데이터 가져오기
      const currentYearMonth = `2025${selectedMonth.padStart(2, '0')}`;
      const previousYearMonth = `2024${selectedMonth.padStart(2, '0')}`;
      
      const [headcountResponse, revenueResponse] = await Promise.all([
        fetch(`/api/headcount-comparison?currentMonth=${currentYearMonth}&previousMonth=${previousYearMonth}`),
        fetch(`/api/revenue-comparison?currentMonth=${currentYearMonth}&previousMonth=${previousYearMonth}&mode=${viewMode}`)
      ]);
      
      const headcountResult = await headcountResponse.json();
      const revenueResult = await revenueResponse.json();
      
      let currentHeadcount = 0;
      let previousHeadcount = 0;
      
      if (headcountResult.success) {
        currentHeadcount = headcountResult.data.currentTotal;
        previousHeadcount = headcountResult.data.previousTotal;
      }
      
      // 2. 총비용 데이터 (kpiData[0]이 총비용)
      const totalCurrent = kpiData[0]?.current || 0;
      const totalPrevious = kpiData[0]?.previous || 0;

      // 3. 매출 대비 공통비 비율 계산
      // 매출액(ACT_SALE_AMT)은 부가세 포함, 공통비는 부가세 제외이므로 매출액을 부가세 제외로 변환하여 비교
      let revenueRatioCurrent: number | null = null;
      let revenueRatioPrevious: number | null = null;
      let revenueRatioChange = 0;
      let currentRevenueExclVAT: number | null = null;
      let previousRevenueExclVAT: number | null = null;

      if (revenueResult.success && revenueResult.data.currentTotal !== null) {
        const currentRevenue = revenueResult.data.currentTotal; // 부가세 포함
        const previousRevenue = revenueResult.data.previousTotal; // 부가세 포함
        
        // 매출액을 부가세 제외로 변환
        currentRevenueExclVAT = currentRevenue / 1.1;
        previousRevenueExclVAT = previousRevenue / 1.1;
        
        // 공통비(부가세 제외) / 매출액(부가세 제외) * 100
        if (currentRevenueExclVAT && currentRevenueExclVAT > 0) {
          revenueRatioCurrent = (totalCurrent / currentRevenueExclVAT) * 100;
        }
        if (previousRevenueExclVAT && previousRevenueExclVAT > 0) {
          revenueRatioPrevious = (totalPrevious / previousRevenueExclVAT) * 100;
        }
        
        if (revenueRatioCurrent !== null && revenueRatioPrevious !== null) {
          revenueRatioChange = revenueRatioCurrent - revenueRatioPrevious;
        }
      }
      
      // 4. 인당 공통비 계산
      const costPerHeadCurrent = currentHeadcount > 0 ? totalCurrent / currentHeadcount : 0;
      const costPerHeadPrevious = previousHeadcount > 0 ? totalPrevious / previousHeadcount : 0;
      const costPerHeadChange = costPerHeadCurrent - costPerHeadPrevious;
      const costPerHeadChangePercent = costPerHeadPrevious > 0 
        ? ((costPerHeadCurrent - costPerHeadPrevious) / costPerHeadPrevious) * 100 
        : 0;
      
      // 5. 비용 집중도 계산 (상위 3개 항목)
      const categories = kpiData.slice(1); // 총비용 제외
      const sortedByAmount = [...categories].sort((a, b) => b.current - a.current);
      const top3Items = sortedByAmount.slice(0, 3).map(cat => ({
        name: cat.category,
        amount: cat.current,
        ratio: totalCurrent > 0 ? (cat.current / totalCurrent) * 100 : 0
      }));
      const top3TotalRatio = top3Items.reduce((sum, item) => sum + item.ratio, 0);
      
      setEfficiencyMetrics({
        costPerHead: {
          current: costPerHeadCurrent,
          previous: costPerHeadPrevious,
          change: costPerHeadChange,
          changePercent: costPerHeadChangePercent
        },
        revenueRatio: {
          current: revenueRatioCurrent,
          previous: revenueRatioPrevious,
          change: revenueRatioChange,
          revenueCurrent: revenueResult.success && revenueResult.data.currentTotal !== null ? revenueResult.data.currentTotal : null,
          revenuePrevious: revenueResult.success && revenueResult.data.previousTotal !== null ? revenueResult.data.previousTotal : null,
          revenueCurrentExclVAT: currentRevenueExclVAT,
          revenuePreviousExclVAT: previousRevenueExclVAT
        },
        costConcentration: {
          top3Items,
          totalRatio: top3TotalRatio
        },
        headcount: {
          current: currentHeadcount,
          previous: previousHeadcount
        }
      });
      
      console.log('📊 효율성 지표 계산 완료');
    } catch (error) {
      console.error('효율성 지표 계산 실패:', error);
    }
  };
  
  const generateAIInsight = (kpiData: KpiData[]) => {
    // 총비용 데이터
    const total = kpiData[0];
    const categories = kpiData.slice(1);
    
    // 증가한 항목과 감소한 항목 찾기
    const increased = categories.filter(c => c.change > 0).sort((a, b) => b.change - a.change);
    const decreased = categories.filter(c => c.change < 0).sort((a, b) => a.change - b.change);
    
    // 이미 백만원 단위로 변환된 값이므로 그대로 반올림
    const totalChangeMillion = Math.round(total.change);
    
    // 월별 트렌드 분석 (chartData 활용)
    let trendInsight = '';
    if (chartData && chartData.length > 0) {
      // 최근 3개월 평균과 비교
      const recentMonths = chartData.slice(-3);
      const avgRecent = recentMonths.reduce((sum, m) => sum + m['총비용'], 0) / recentMonths.length;
      const currentMonth = chartData[chartData.length - 1];
      
      if (currentMonth && currentMonth['총비용'] > avgRecent * 1.05) {
        trendInsight = ' 최근 3개월 평균 대비 높은 수준입니다.';
      } else if (currentMonth && currentMonth['총비용'] < avgRecent * 0.95) {
        trendInsight = ' 최근 3개월 평균 대비 낮은 수준입니다.';
      }
      
      // 연속 증가/감소 패턴 찾기
      if (chartData.length >= 3) {
        const last3Months = chartData.slice(-3);
        const isIncreasing = last3Months.every((m, i) => i === 0 || m['총비용'] >= last3Months[i-1]['총비용']);
        const isDecreasing = last3Months.every((m, i) => i === 0 || m['총비용'] <= last3Months[i-1]['총비용']);
        
        if (isIncreasing) {
          trendInsight += ' 3개월 연속 증가 추세입니다.';
        } else if (isDecreasing) {
          trendInsight += ' 3개월 연속 감소 추세입니다.';
        }
      }
    }
    
    // 인사이트 생성
    let insight = `${selectedMonth}월 공통비는 전년 대비 ${totalChangeMillion >= 0 ? '+' : ''}${totalChangeMillion}백만원(${(total.changePercent - 100).toFixed(1)}%) ${total.change >= 0 ? '증가' : '감소'}했습니다.${trendInsight} `;
    
    // 주요 증감 항목
    if (increased.length > 0) {
      const topIncreased = increased.slice(0, 2).map(c => {
        const changeMillion = Math.round(c.change);
        const changePercent = ((c.changePercent - 100)).toFixed(1);
        return `${c.category}(+${changeMillion}백, +${changePercent}%)`;
      }).join(', ');
      insight += `주요 증가: ${topIncreased}. `;
    }
    
    if (decreased.length > 0) {
      const topDecreased = decreased.slice(0, 2).map(c => {
        const changeMillion = Math.round(c.change);
        const changePercent = ((c.changePercent - 100)).toFixed(1);
        return `${c.category}(${changeMillion}백, ${changePercent}%)`;
      }).join(', ');
      insight += `주요 감소: ${topDecreased}.`;
    }
    
    setAiInsight(insight);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(num));
  };

  // 마크다운 **볼드**를 HTML <strong>으로 변환
  const formatMarkdownBold = (text: string) => {
    return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-red-600';
    if (change < 0) return 'text-blue-600';
    return 'text-gray-600';
  };

  const getChangeBgColor = (change: number) => {
    if (change > 0) return 'bg-red-50';
    if (change < 0) return 'bg-blue-50';
    return 'bg-gray-50';
  };
  
  // 필터링된 계층형 데이터
  const filteredHierarchyData = useMemo(() => {
    if (selectedMajorCategories.length === 0) {
      return hierarchyData;
    }
    
    return hierarchyData.filter((major: any) => {
      if (major.isTotal) return true;
      return selectedMajorCategories.includes(major.name);
    });
  }, [hierarchyData, selectedMajorCategories]);
  
  // Waterfall 차트 데이터 준비
  const waterfallData = useMemo(() => {
    if (kpiData.length === 0) return [];
    
    const total = kpiData[0]; // 총비용
    const categories = kpiData.slice(1); // 개별 항목들
    
    // 각 항목의 증감 계산 (절대값 기준)
    const items = categories
      .filter(item => item.category !== '총비용')
      .map(item => ({
        name: item.category,
        previous: item.previous || 0,
        current: item.current || 0,
        change: item.change || 0,
        changePercent: item.changePercent || 0,
        absChange: Math.abs(item.change || 0)
      }))
      .filter(item => item.absChange > 0); // 변동이 있는 항목만
    
    // 절대값 기준으로 정렬
    items.sort((a, b) => b.absChange - a.absChange);
    
    // 상위 5개와 나머지 분리
    const topItems = showAllWaterfallItems ? items : items.slice(0, 5);
    const otherItems = showAllWaterfallItems ? [] : items.slice(5);
    
    // "기타" 항목 계산
    let otherChange = 0;
    let otherPrevious = 0;
    let otherCurrent = 0;
    if (otherItems.length > 0) {
      otherChange = otherItems.reduce((sum, item) => sum + item.change, 0);
      otherPrevious = otherItems.reduce((sum, item) => sum + item.previous, 0);
      otherCurrent = otherItems.reduce((sum, item) => sum + item.current, 0);
    }
    
    // 변동폭의 최대값 계산 (Y축 도메인 조정용)
    const maxChange = Math.max(...items.map(item => Math.abs(item.change)));
    const maxTotal = Math.max(total.previous || 0, total.current || 0);
    
    // 변동폭을 더 직관적으로 보이도록 스케일 조정
    // 가장 큰 변동폭을 기준으로 다른 변동폭들의 상대적 비율을 강조
    const maxAbsChange = Math.max(...items.map(item => Math.abs(item.change)));
    
    // Waterfall 차트 데이터 구성
    const chartData: any[] = [];
    let runningTotal = total.previous || 0;
    
    // 시작점: 전년 총비용
    chartData.push({
      name: '전년 총비용',
      value: runningTotal,
      start: 0,
      end: runningTotal,
      type: 'start',
      previous: runningTotal,
      current: runningTotal,
      change: 0,
      changePercent: 0,
      displayValue: runningTotal, // 표시용 값
      labelText: `${Math.round(runningTotal).toLocaleString()}` // 라벨 텍스트
    });
    
    // 각 항목 추가
    topItems.forEach(item => {
      const start = runningTotal;
      const end = runningTotal + item.change;
      // 변동폭을 더 직관적으로 보이도록 높이 조정
      // 각 바의 높이가 변동량에 비례하도록 설정
      const changeMagnitude = Math.abs(item.change);
      // 변동폭이 큰 항목은 더 높게, 작은 항목은 더 낮게 보이도록
      chartData.push({
        name: item.name,
        value: changeMagnitude, // 절대값으로 높이 표시 (변동폭이 직관적으로 보이도록)
        start: start,
        end: end,
        type: item.change > 0 ? 'increase' : 'decrease',
        previous: item.previous,
        current: item.current,
        change: item.change,
        changePercent: item.changePercent,
        isPositive: item.change > 0,
        displayValue: item.change, // 막대 위에 표시할 값
        labelText: `${item.change > 0 ? '+' : ''}${Math.round(item.change).toLocaleString()}` // 라벨 텍스트
      });
      runningTotal = end;
    });
    
    // "기타" 항목 추가
    if (otherItems.length > 0) {
      const start = runningTotal;
      const end = runningTotal + otherChange;
      const changeMagnitude = Math.abs(otherChange);
      chartData.push({
        name: `기타 (${otherItems.length}개)`,
        value: changeMagnitude, // 절대값으로 높이 표시
        start: start,
        end: end,
        type: otherChange > 0 ? 'increase' : 'decrease',
        previous: otherPrevious,
        current: otherCurrent,
        change: otherChange,
        changePercent: otherPrevious > 0 ? ((otherCurrent / otherPrevious - 1) * 100) : 0,
        isPositive: otherChange > 0,
        displayValue: otherChange, // 막대 위에 표시할 값
        labelText: `${otherChange > 0 ? '+' : ''}${Math.round(otherChange).toLocaleString()}` // 라벨 텍스트
      });
      runningTotal = end;
    }
    
    // 끝점: 당월 총비용 (0에서 시작)
    chartData.push({
      name: '당월 총비용',
      value: total.current || 0,
      start: 0,
      end: total.current || 0,
      type: 'end',
      previous: total.previous || 0,
      current: total.current || 0,
      change: total.change || 0,
      changePercent: total.changePercent || 0,
      displayValue: total.current || 0, // 표시용 값
      labelText: `${Math.round(total.current || 0).toLocaleString()}` // 라벨 텍스트
    });
    
    return chartData;
  }, [kpiData, showAllWaterfallItems]);
  
  // Bubble Chart 데이터 준비
  const bubbleChartData = useMemo(() => {
    if (costCenterData.length === 0) return { data: [], avgHeadcount: 0, avgCostPerHead: 0 };
    
    // 유효한 데이터만 필터링 (인원수와 비용이 모두 있는 경우)
    const validData = costCenterData.filter(cc => 
      cc.currentHeadcount !== null && 
      cc.currentHeadcount > 0 && 
      cc.current > 0
    );
    
    if (validData.length === 0) return { data: [], avgHeadcount: 0, avgCostPerHead: 0 };
    
    // Bubble Chart 데이터 생성
    const bubbleData: any[] = validData.map(cc => {
      const costPerHead = cc.current / cc.currentHeadcount;
      return {
        name: cc.name,
        code: cc.code,
        headcount: cc.currentHeadcount,
        costPerHead: costPerHead,
        totalCost: cc.current,
        yoy: cc.yoy,
        previous: cc.previous,
        current: cc.current,
        change: cc.change,
        previousHeadcount: cc.previousHeadcount,
        z: 0 // 초기값, 아래에서 계산됨
      };
    });
    
    // 버블 크기 정규화 (z 값 계산)
    const maxCost = Math.max(...bubbleData.map(d => d.totalCost));
    const minCost = Math.min(...bubbleData.map(d => d.totalCost));
    const sizeRange = maxCost - minCost;
    
    bubbleData.forEach(d => {
      // z 값: 총 비용에 비례 (최소 10, 최대 50)
      d.z = sizeRange > 0 
        ? 10 + ((d.totalCost - minCost) / sizeRange) * 40
        : 25;
    });
    
    // 전체 평균 계산
    const totalHeadcount = bubbleData.reduce((sum, d) => sum + d.headcount, 0);
    const totalCost = bubbleData.reduce((sum, d) => sum + d.totalCost, 0);
    const avgHeadcount = totalHeadcount / bubbleData.length;
    const avgCostPerHead = totalCost / totalHeadcount;
    
    return {
      data: bubbleData,
      avgHeadcount,
      avgCostPerHead
    };
  }, [costCenterData]);

  if (loading) {
  return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 md:p-6">
      {/* 헤더 */}
      <div className="max-w-7xl mx-auto mb-6 md:mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg md:text-xl">
              G
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">공통부서 비용 분석</h1>
              <p className="text-xs md:text-sm text-gray-600">2025년 {selectedMonth}월 기준</p>
            </div>
          </div>
          
          {/* 월 선택 & 필터 & 내보내기 */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 월 선택 버튼 */}
            <div className="relative">
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="appearance-none pl-10 pr-10 py-2.5 border-2 border-blue-500 rounded-lg bg-white text-sm font-medium text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-blue-50 transition-colors"
              >
                <option value="1">2025년 1월</option>
                <option value="2">2025년 2월</option>
                <option value="3">2025년 3월</option>
                <option value="4">2025년 4월</option>
                <option value="5">2025년 5월</option>
                <option value="6">2025년 6월</option>
                <option value="7">2025년 7월</option>
                <option value="8">2025년 8월</option>
                <option value="9">2025년 9월</option>
                <option value="10">2025년 10월</option>
                <option value="11">2025년 11월</option>
                <option value="12">2025년 12월</option>
              </select>
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600 pointer-events-none" />
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            
            {/* 필터 버튼 */}
            <div className="relative filter-dropdown">
              <button
                data-filter-button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`px-4 py-2.5 border-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  (selectedCostCenters.length > 0 || selectedMajorCategories.length > 0)
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                필터
                {(selectedCostCenters.length > 0 || selectedMajorCategories.length > 0) && (
                  <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {selectedCostCenters.length + selectedMajorCategories.length}
                  </span>
                )}
              </button>
              
              {/* 필터 드롭다운 */}
              {isFilterOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border-2 border-gray-200 rounded-lg shadow-xl z-50 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900">필터</h3>
                    <button
                      onClick={() => setIsFilterOpen(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* 코스트센터 필터 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">코스트센터</label>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {costCenterOptions.length > 0 ? (
                        <>
                          {/* 인원이 있는 코스트센터 */}
                          {costCenterOptions.filter(cc => cc.hasHeadcount).length > 0 && (
                            <div className="mb-2">
                              <div className="text-xs text-gray-500 font-medium mb-1 px-1">인원 있음</div>
                              {costCenterOptions.filter(cc => cc.hasHeadcount).map((cc) => (
                                <label key={cc.name} className="flex items-center gap-2 p-1 hover:bg-gray-50 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedCostCenters.includes(cc.name)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedCostCenters([...selectedCostCenters, cc.name]);
                                      } else {
                                        setSelectedCostCenters(selectedCostCenters.filter(c => c !== cc.name));
                                      }
                                    }}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-gray-700">{cc.name}</span>
                                  <span className="text-xs text-gray-400">({cc.headcount}명)</span>
                                </label>
                              ))}
                            </div>
                          )}
                          {/* 인원이 없는 코스트센터 (접기/펼치기) */}
                          {costCenterOptions.filter(cc => !cc.hasHeadcount).length > 0 && (
                            <div className="border-t pt-2">
                              <button
                                type="button"
                                onClick={() => setIsNoHeadcountExpanded(!isNoHeadcountExpanded)}
                                className="flex items-center gap-1 text-xs text-gray-400 font-medium mb-1 px-1 hover:text-gray-600 w-full"
                              >
                                <svg 
                                  className={`w-3 h-3 transition-transform ${isNoHeadcountExpanded ? 'rotate-90' : ''}`} 
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                인원 없음 (비용만) ({costCenterOptions.filter(cc => !cc.hasHeadcount).length}개)
                              </button>
                              {isNoHeadcountExpanded && costCenterOptions.filter(cc => !cc.hasHeadcount).map((cc) => (
                                <label key={cc.name} className="flex items-center gap-2 p-1 hover:bg-gray-50 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedCostCenters.includes(cc.name)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedCostCenters([...selectedCostCenters, cc.name]);
                                      } else {
                                        setSelectedCostCenters(selectedCostCenters.filter(c => c !== cc.name));
                                      }
                                    }}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-gray-500">{cc.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-xs text-gray-400 p-2">로딩 중...</div>
                      )}
                    </div>
                  </div>
                  
                  {/* 계정 대분류 필터 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">계정 대분류</label>
                    <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {majorCategoryOptions.length > 0 ? (
                        majorCategoryOptions.map((category) => (
                          <label key={category} className="flex items-center gap-2 p-1 hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedMajorCategories.includes(category)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMajorCategories([...selectedMajorCategories, category]);
                                } else {
                                  setSelectedMajorCategories(selectedMajorCategories.filter(c => c !== category));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{category}</span>
                          </label>
                        ))
                      ) : (
                        <div className="text-xs text-gray-400 p-2">로딩 중...</div>
                      )}
                    </div>
                  </div>
                  
                  {/* 필터 초기화 버튼 */}
                  <button
                    onClick={resetFilters}
                    className="w-full px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    필터 초기화
                  </button>
                </div>
              )}
            </div>
            
            {/* 내보내기 버튼 */}
            <div className="relative">
              <button
                data-export-button
                onClick={() => {
                  const menu = document.getElementById('export-menu');
                  if (menu) {
                    menu.classList.toggle('hidden');
                  }
                }}
                className="px-4 py-2.5 border-2 border-green-500 rounded-lg bg-white text-sm font-medium text-green-700 hover:bg-green-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                내보내기
              </button>
              
              {/* 내보내기 메뉴 */}
              <div id="export-menu" className="hidden absolute right-0 top-full mt-2 w-48 bg-white border-2 border-gray-200 rounded-lg shadow-xl z-50">
                <button
                  onClick={() => {
                    exportToExcel();
                    document.getElementById('export-menu')?.classList.add('hidden');
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Excel 다운로드
                </button>
                <button
                  onClick={() => {
                    exportInsights();
                    document.getElementById('export-menu')?.classList.add('hidden');
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 border-t"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  인사이트 복사
                </button>
              </div>
            </div>
            
            {/* 편집 버튼 */}
            <button 
              onClick={() => {
                if (isEditMode) {
                  // 저장 로직
                  alert('변경사항이 저장되었습니다.');
                }
                setIsEditMode(!isEditMode);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 border-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 ${
                isEditMode 
                  ? 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-400' 
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-400'
              }`}
            >
              <PencilIcon className="w-4 h-4" />
              <span>{isEditMode ? '저장' : '편집'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 메인 탭 네비게이션 */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex gap-1 overflow-x-auto">
            <button
              onClick={() => setMainTab('summary')}
              className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                mainTab === 'summary'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setMainTab('allocation')}
              className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                mainTab === 'allocation'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              사업부배부
            </button>
            <button
              onClick={() => setMainTab('labor')}
              className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                mainTab === 'labor'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              인건비
            </button>
            <button
              onClick={() => setMainTab('it')}
              className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                mainTab === 'it'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              IT수수료
            </button>
            <button
              onClick={() => setMainTab('commission')}
              className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                mainTab === 'commission'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              지급수수료
            </button>
          </nav>
        </div>
      </div>

      {/* Summary 탭 콘텐츠 */}
      {mainTab === 'summary' && (
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 md:mb-6">
          <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Summary</h2>
          <div className="flex gap-2 mb-4">
            <button 
              onClick={() => setViewMode('monthly')}
              className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                viewMode === 'monthly' 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              당월
            </button>
            <button 
              onClick={() => setViewMode('ytd')}
              className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                viewMode === 'ytd' 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              누적 (YTD)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          {kpiData.map((kpi, index) => (
            <Card 
              key={kpi.category}
              onClick={() => !isEditMode && handleKpiCardClick(kpi.category)}
              className={`overflow-hidden transition-all duration-200 cursor-pointer
                hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1
                ${index === 0 ? 'sm:col-span-2 lg:col-span-3 xl:col-span-1 ring-2 ring-primary' : ''}
              `}
              title="클릭하여 상세보기"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {kpi.category}
                  </CardTitle>
                  {/* 상세보기 힌트 아이콘 */}
                  <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* 금액 */}
                <div className={`${index === 0 ? 'text-3xl md:text-4xl' : 'text-2xl md:text-4xl'} font-bold tracking-tight leading-tight`}>
                  {isEditMode ? (
                    <input
                      type="number"
                      value={editedData[kpi.category]?.amount ?? kpi.current}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        setEditedData({
                          ...editedData,
                          [kpi.category]: {
                            ...editedData[kpi.category],
                            amount: parseFloat(e.target.value) || 0
                          }
                        });
                      }}
                      className="w-full px-2 py-1 border-2 border-blue-500 rounded text-2xl md:text-3xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  ) : (
                    <>
                      {formatNumber(editedData[kpi.category]?.amount ?? kpi.current)}
                      <span className="text-[10px] md:text-xs font-normal text-muted-foreground ml-0.5">
                        백만원
                      </span>
                    </>
                  )}
                </div>

                {/* YOY 배지 & 전월대비 배지 */}
                <div className="flex items-center gap-1 flex-wrap -mx-0.5 min-h-[44px] content-start">
                  {/* YOY 배지 */}
                  <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${
                    kpi.change > 0 
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    <span>YOY {formatNumber(kpi.changePercent)}%</span>
                  </div>
                  
                  {/* 전월대비 배지 */}
                  {kpi.momPercent !== undefined && viewMode === 'monthly' && (
                    <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${
                      (kpi.momChange ?? 0) > 0 
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                        : (kpi.momChange ?? 0) < 0
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      <span>전월 {(kpi.momPercent ?? 0) > 0 ? '+' : ''}{(kpi.momPercent ?? 0).toFixed(1)}%</span>
                    </div>
                  )}
                  
                  {/* 비중 배지 (총비용 제외) */}
                  {index !== 0 && (() => {
                    const totalCurrent = kpiData[0].current;
                    const ratio = totalCurrent > 0 ? (kpi.current / totalCurrent) * 100 : 0;
                    return (
                      <div className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        <span>비중 {formatNumber(ratio)}%</span>
                      </div>
                    );
                  })()}
                </div>

                {/* 전년 금액 */}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate">
                      <span className="text-xs text-muted-foreground">전년 </span>
                      <span className="text-sm md:text-base font-bold text-foreground">{formatNumber(kpi.previous)}</span>
                    </div>
                    <span className={`text-sm md:text-base font-bold whitespace-nowrap ${
                      kpi.change > 0 ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {kpi.change > 0 ? '+' : ''}{formatNumber(kpi.change)}
                    </span>
                  </div>
                </div>

                {/* 코멘트 (편집 모드) */}
                {isEditMode && (
                  <div className="pt-2" onClick={(e) => e.stopPropagation()}>
                    <textarea
                      placeholder="코멘트를 입력하세요..."
                      value={editedData[kpi.category]?.comment ?? ''}
                      onChange={(e) => {
                        setEditedData({
                          ...editedData,
                          [kpi.category]: {
                            ...editedData[kpi.category],
                            comment: e.target.value
                          }
                        });
                      }}
                      className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                      rows={2}
                    />
                  </div>
                )}

                {/* 저장된 코멘트 표시 (읽기 모드) */}
                {!isEditMode && editedData[kpi.category]?.comment && (
                  <div className="pt-2 px-3 py-2 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-700">{editedData[kpi.category].comment}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* AI 인사이트 요약 - 구조화된 형태 */}
        <Card className="mb-8 border-2 border-purple-200">
          <CardHeader className="pb-2 bg-gradient-to-r from-purple-50 to-blue-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-purple-900">AI 인사이트</h3>
                  <p className="text-xs text-gray-500">우선순위별 액션 가이드</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportInsights}
                  className="px-3 py-1.5 text-xs bg-white border border-purple-300 text-purple-700 hover:bg-purple-50 rounded-lg transition-colors flex items-center gap-1"
                  title="인사이트 텍스트로 복사"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  내보내기
                </button>
                <button
                  onClick={startEditAiInsight}
                  className="p-1.5 rounded-md hover:bg-purple-200 text-purple-600 transition-colors"
                  title="AI 인사이트 편집"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {(() => {
              const { critical, warning, positive } = getCategorizedInsights();
              
              // 인사이트가 없는 경우 기존 텍스트 표시
              if (critical.length === 0 && warning.length === 0 && positive.length === 0) {
                return (
                  <p 
                    className="text-sm text-gray-700 leading-relaxed whitespace-pre-line"
                    dangerouslySetInnerHTML={{ __html: formatMarkdownBold(aiInsight) }}
                  />
                );
              }
              
              return (
                <div className="space-y-4">
                  {/* 즉시 확인 필요 */}
                  {critical.length > 0 && (
                    <div className="border border-red-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedInsightCategories(prev => ({ ...prev, critical: !prev.critical }))}
                        className="w-full flex items-center justify-between p-3 bg-red-50 hover:bg-red-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🚨</span>
                          <span className="font-bold text-red-800">즉시 확인 필요</span>
                          <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full">YOY ±50% 이상</span>
                          <span className="text-sm text-red-600 font-semibold">{critical.length}건</span>
                        </div>
                        <ChevronDownIcon className={`w-5 h-5 text-red-600 transition-transform ${expandedInsightCategories.critical ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedInsightCategories.critical && (
                        <div className="p-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                          {critical.map((item) => (
                            <div
                              key={item.id}
                              className="p-3 bg-white border border-red-100 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                              onClick={() => setSelectedInsightItem(item)}
                            >
                              <div className="flex items-start justify-between mb-1">
                                <span className="font-semibold text-sm text-gray-800 truncate">{item.name}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${item.changePercent >= 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {item.level === 'major' ? '대분류' : item.level === 'middle' ? '중분류' : '소분류'}
                                </span>
                              </div>
                              <div className={`text-lg font-bold ${item.changePercent >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(1)}%
                              </div>
                              <div className="text-xs text-gray-500">
                                {Math.round(item.previous)} → {Math.round(item.current)}백만원
                              </div>
                              {item.description && (
                                <div className="mt-2 text-xs text-gray-600 line-clamp-2">
                                  원인: {item.description}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 모니터링 필요 */}
                  {warning.length > 0 && (
                    <div className="border border-amber-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedInsightCategories(prev => ({ ...prev, warning: !prev.warning }))}
                        className="w-full flex items-center justify-between p-3 bg-amber-50 hover:bg-amber-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">⚠️</span>
                          <span className="font-bold text-amber-800">모니터링 필요</span>
                          <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">YOY ±20~50%</span>
                          <span className="text-sm text-amber-600 font-semibold">{warning.length}건</span>
                        </div>
                        <ChevronDownIcon className={`w-5 h-5 text-amber-600 transition-transform ${expandedInsightCategories.warning ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedInsightCategories.warning && (
                        <div className="p-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                          {warning.map((item) => (
                            <div
                              key={item.id}
                              className="p-3 bg-white border border-amber-100 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                              onClick={() => setSelectedInsightItem(item)}
                            >
                              <div className="flex items-start justify-between mb-1">
                                <span className="font-semibold text-sm text-gray-800 truncate">{item.name}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                                  {item.level === 'major' ? '대분류' : item.level === 'middle' ? '중분류' : '소분류'}
                                </span>
                              </div>
                              <div className="text-lg font-bold text-amber-600">
                                {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(1)}%
                              </div>
                              <div className="text-xs text-gray-500">
                                {Math.round(item.previous)} → {Math.round(item.current)}백만원
                              </div>
                              {item.description && (
                                <div className="mt-2 text-xs text-gray-600 line-clamp-2">
                                  원인: {item.description}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 긍정적 변화 */}
                  {positive.length > 0 && (
                    <div className="border border-green-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedInsightCategories(prev => ({ ...prev, positive: !prev.positive }))}
                        className="w-full flex items-center justify-between p-3 bg-green-50 hover:bg-green-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">✅</span>
                          <span className="font-bold text-green-800">긍정적 변화</span>
                          <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">비용 절감</span>
                          <span className="text-sm text-green-600 font-semibold">{positive.length}건</span>
                        </div>
                        <ChevronDownIcon className={`w-5 h-5 text-green-600 transition-transform ${expandedInsightCategories.positive ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedInsightCategories.positive && (
                        <div className="p-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                          {positive.map((item) => (
                            <div
                              key={item.id}
                              className="p-3 bg-white border border-green-100 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                              onClick={() => setSelectedInsightItem(item)}
                            >
                              <div className="flex items-start justify-between mb-1">
                                <span className="font-semibold text-sm text-gray-800 truncate">{item.name}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                                  {item.level === 'major' ? '대분류' : item.level === 'middle' ? '중분류' : '소분류'}
                                </span>
                              </div>
                              <div className="text-lg font-bold text-green-600">
                                {item.changePercent.toFixed(1)}%
                              </div>
                              <div className="text-xs text-gray-500">
                                {Math.round(item.previous)} → {Math.round(item.current)}백만원
                              </div>
                              {item.description && (
                                <div className="mt-2 text-xs text-gray-600 line-clamp-2">
                                  원인: {item.description}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
        
        {/* 인사이트 상세 모달 */}
        {selectedInsightItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedInsightItem(null)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
              <div className={`p-4 rounded-t-xl ${
                Math.abs(selectedInsightItem.changePercent) >= 50 ? 'bg-red-50' :
                selectedInsightItem.change < 0 ? 'bg-green-50' : 'bg-amber-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {Math.abs(selectedInsightItem.changePercent) >= 50 ? '🚨' :
                       selectedInsightItem.change < 0 ? '✅' : '⚠️'}
                    </span>
                    <h3 className="text-lg font-bold text-gray-800">{selectedInsightItem.name}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedInsightItem(null)}
                    className="p-2 hover:bg-white/50 rounded-full transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">YOY 변동률</div>
                    <div className={`text-2xl font-bold ${selectedInsightItem.changePercent >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      {selectedInsightItem.changePercent >= 0 ? '+' : ''}{selectedInsightItem.changePercent.toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">금액 변화</div>
                    <div className={`text-2xl font-bold ${selectedInsightItem.change >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      {selectedInsightItem.change >= 0 ? '+' : ''}{Math.round(selectedInsightItem.change)}백만원
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">금액 비교</div>
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="text-xs text-gray-400">전년</div>
                      <div className="text-lg font-semibold">{Math.round(selectedInsightItem.previous).toLocaleString()}백만원</div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <div>
                      <div className="text-xs text-gray-400">당월</div>
                      <div className="text-lg font-semibold">{Math.round(selectedInsightItem.current).toLocaleString()}백만원</div>
                    </div>
                  </div>
                </div>
                {selectedInsightItem.description && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-xs text-blue-600 mb-1 font-semibold">원인 분석</div>
                    <div className="text-sm text-gray-700">{selectedInsightItem.description}</div>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className={`px-2 py-1 rounded ${
                    selectedInsightItem.level === 'major' ? 'bg-purple-100 text-purple-700' :
                    selectedInsightItem.level === 'middle' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {selectedInsightItem.level === 'major' ? '대분류' : selectedInsightItem.level === 'middle' ? '중분류' : '소분류'}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 rounded">{selectedInsightItem.category}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI 인사이트 편집 다이얼로그 */}
        {editingAiInsight && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-bold text-gray-800">💡 AI 인사이트 편집</h3>
                <button
                  onClick={cancelEditAiInsight}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 flex-1 overflow-auto">
                <textarea
                  value={tempAiInsight}
                  onChange={(e) => setTempAiInsight(e.target.value)}
                  className="w-full h-80 p-4 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="AI 인사이트 내용을 입력하세요..."
                />
              </div>
              <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
                <button
                  onClick={cancelEditAiInsight}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={saveAiInsight}
                  className="px-4 py-2 text-sm bg-purple-600 text-white hover:bg-purple-700 rounded-lg transition-colors"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 월별 비용 추이 및 YOY 비교 차트 */}
        <Card className="mb-8" ref={chartSectionRef}>
          <CardHeader 
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setIsChartExpanded(!isChartExpanded)}
          >
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">월별 비용 추이 및 YOY 비교</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">카테고리별 비용 구성 및 전년 대비 증감률</p>
              </div>
              <ChevronUpIcon className={`w-5 h-5 transition-transform ${isChartExpanded ? '' : 'rotate-180'}`} />
            </div>
          </CardHeader>
          
          {isChartExpanded && (
            <CardContent>
              {/* 차트 요약 텍스트 */}
              {chartData.length > 0 && chartData[chartData.length - 1]?.['6개월평균'] > 0 && (() => {
                const latestMonth = chartData[chartData.length - 1];
                const ma6 = latestMonth['6개월평균'];
                const total = latestMonth['총비용'] || 0;
                const deviation = latestMonth.deviation || 0;
                const monthLabel = latestMonth.month || '';
                const deviationText = deviation >= 0 ? '높은' : '낮은';
                const deviationColor = deviation >= 0 ? 'text-red-600' : 'text-green-600';
                
                return (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">{monthLabel}</span> 비용은 
                      <span className="font-bold text-blue-600"> {Math.round(total).toLocaleString()}백만원</span>으로, 
                      6개월 평균(<span className="font-semibold">{Math.round(ma6).toLocaleString()}백만원</span>) 대비 
                      <span className={`font-bold ${deviationColor}`}> {Math.abs(deviation).toFixed(1)}% {deviationText}</span> 수준입니다.
                      {latestMonth.isOutlier && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          ⚠️ 이상치
                        </span>
                      )}
                    </p>
                  </div>
                );
              })()}
              
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 20, right: 80, bottom: 20, left: 20 }}
                    onClick={(data) => {
                      if (data && data.activeLabel) {
                        setSelectedChartMonth(data.activeLabel);
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                    />
                    <YAxis 
                      yAxisId="left"
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                      tickFormatter={(value) => value.toLocaleString()}
                      label={{ value: '비용 (백만원)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                      tickFormatter={(value) => Math.round(value).toString()}
                      label={{ value: 'YOY (%)', angle: 90, position: 'insideRight', style: { fontSize: 12 } }}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                      wrapperStyle={{ outline: 'none' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = chartData.find(d => d.month === label);
                          const deviation = data?.deviation || 0;
                          const isOutlier = data?.isOutlier || false;
                          
                          return (
                            <div className={`bg-white p-3 border-2 rounded-lg shadow-lg min-w-[220px] ${isOutlier ? 'border-red-400' : 'border-gray-200'}`} style={{ backgroundColor: '#ffffff', opacity: 1 }}>
                              <div className="flex items-center justify-between mb-3 pb-2 border-b">
                                <p className="font-bold text-gray-900">{label}</p>
                                {isOutlier && (
                                  <span className="text-red-500 text-lg">⚠️</span>
                                )}
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">총비용:</span>
                                  <span className="text-sm font-bold text-blue-600">{Math.round(data?.총비용 || 0).toLocaleString()}백만원</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">6개월 평균:</span>
                                  <span className="text-sm font-semibold text-gray-700">{Math.round(data?.['6개월평균'] || 0).toLocaleString()}백만원</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">평균 대비:</span>
                                  <span className={`text-sm font-bold ${deviation >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {deviation >= 0 ? '+' : ''}{deviation.toFixed(1)}% {deviation >= 0 ? '상회' : '하회'}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">YOY:</span>
                                  <span className="text-sm font-bold text-red-600">{Math.round(data?.YOY || 0).toLocaleString()}%</span>
                                </div>
                                <div className="pt-2 border-t">
                                  <p className="text-xs font-semibold text-gray-700 mb-2">대분류별 비중</p>
                                  {[
                                    { name: '인건비', color: '#a7c7e7' },
                                    { name: 'IT수수료', color: '#f4a6c3' },
                                    { name: '지급수수료', color: '#b4e7ce' },
                                    { name: '직원경비', color: '#ffd4a3' },
                                    { name: '기타비용', color: '#e0b0ff' }
                                  ].map((cat) => (
                                    <div key={cat.name} className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-1.5">
                                        <div 
                                          className="w-2.5 h-2.5 rounded-full" 
                                          style={{ backgroundColor: cat.color }}
                                        />
                                        <span className="text-xs text-gray-600">{cat.name}:</span>
                                      </div>
                                      <span className="text-xs font-semibold text-gray-900">{Math.round(data?.[cat.name] || 0).toLocaleString()}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {/* 스택 막대 그래프 - 하이라이트 기능 적용 */}
                    {[
                      { key: '인건비', color: '#a7c7e7' },
                      { key: 'IT수수료', color: '#f4a6c3' },
                      { key: '지급수수료', color: '#b4e7ce' },
                      { key: '직원경비', color: '#ffd4a3' },
                      { key: '기타비용', color: '#e0b0ff' }
                    ].map((cat) => (
                      <Bar 
                        key={cat.key}
                        yAxisId="left" 
                        dataKey={cat.key} 
                        stackId="a" 
                        fill={cat.color} 
                        name={cat.key}
                        fillOpacity={highlightedCategory === null || highlightedCategory === cat.key ? 1 : 0.3}
                        stroke={highlightedCategory === cat.key ? '#000' : 'none'}
                        strokeWidth={highlightedCategory === cat.key ? 2 : 0}
                      />
                    ))}
                    
                    {/* 6개월 이동평균선 */}
                    <Line 
                      yAxisId="left" 
                      type="monotone" 
                      dataKey="6개월평균" 
                      stroke="#888888" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name="6개월 평균"
                    />
                    
                    {/* YOY 꺾은선 그래프 */}
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="YOY" 
                      stroke="#ef4444" 
                      strokeWidth={3}
                      dot={{ fill: '#ef4444', r: 5 }}
                      name="YOY"
                    />
                    
                    <Legend 
                      wrapperStyle={{ 
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                      iconType="circle"
                      formatter={(value) => {
                        const isHighlighted = highlightedCategory === value;
                        const isDimmed = highlightedCategory !== null && highlightedCategory !== value && value !== 'YOY' && value !== '6개월 평균';
                        
                        return (
                          <span 
                            style={{ 
                              color: isDimmed ? '#ccc' : (isHighlighted ? '#000' : '#6b7280'),
                              fontWeight: isHighlighted ? 'bold' : 'normal',
                              cursor: value !== 'YOY' && value !== '6개월 평균' ? 'pointer' : 'default',
                              transition: 'all 0.2s'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (value !== 'YOY' && value !== '6개월 평균') {
                                // 클릭 시 바로 드릴다운 + 하이라이트
                                setHighlightedCategory(value);
                                handleDrilldown(value);
                              }
                            }}
                            title={value !== 'YOY' && value !== '6개월 평균' ? '클릭: 세부 계정별 차트 보기' : ''}
                          >
                            {value}
                          </span>
                        );
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              {/* 6개월 평균 점선 설명 */}
              <p className="text-xs text-gray-500 mt-2 text-center">
                ※ 회색 점선은 해당 월 기준 과거 6개월간 총비용의 이동평균을 나타냅니다.
              </p>
            </CardContent>
          )}
        </Card>

        {/* 드릴다운 차트 */}
        {drilldownCategory && drilldownData.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">
                    {drilldownCategory} - {drilldownLevel === 'detail' ? '소분류' : '중분류'} 월별 추이 (2025년)
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {drilldownLevel === 'detail' ? '계정 소분류별 상세 분석' : '계정 중분류별 상세 분석'}
          </p>
        </div>
                <button
                  onClick={() => {
                    setDrilldownCategory(null);
                    setDrilldownData([]);
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                >
                  접기
                  <ChevronUpIcon className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={drilldownData}
                    margin={{ top: 20, right: 80, bottom: 20, left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                    />
                    <YAxis 
                      yAxisId="left"
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                      tickFormatter={(value) => value.toLocaleString()}
                      label={{ value: '비용 (백만원)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                      tickFormatter={(value) => Math.round(value).toString()}
                      label={{ value: 'YOY (%)', angle: 90, position: 'insideRight', style: { fontSize: 12 } }}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                      wrapperStyle={{ outline: 'none', zIndex: 9999 }}
                      contentStyle={{ backgroundColor: 'white', opacity: 1, border: 'none' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = drilldownData.find(d => d.month === label);
                          const subcategories = Object.keys(data || {}).filter(key => key !== 'month' && key !== 'monthNum' && key !== 'YOY');
                          
                          // 총비용 계산
                          const totalCost = subcategories.reduce((sum, cat) => sum + (data?.[cat] || 0), 0);
                          const prevTotal = totalCost / (data?.YOY || 100) * 100;
                          
                          return (
                            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg min-w-[200px]" style={{ backgroundColor: '#ffffff', opacity: 1 }}>
                              <p className="font-bold text-gray-900 mb-3 pb-2 border-b">{label}</p>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">총비용:</span>
                                  <span className="text-sm font-bold text-blue-600">{Math.round(totalCost).toLocaleString()}백만원</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">전년:</span>
                                  <span className="text-sm font-semibold text-gray-700">{Math.round(prevTotal).toLocaleString()}백만원</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">YOY:</span>
                                  <span className="text-sm font-bold text-red-600">{Math.round(data?.YOY || 0).toLocaleString()}%</span>
                                </div>
                                <div className="pt-2 border-t">
                                  <p className="text-xs font-semibold text-gray-700 mb-2">중분류별 비중</p>
                                  {subcategories.map((cat, idx) => (
                                    <div key={cat} className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-1.5">
                                        <div 
                                          className="w-2.5 h-2.5 rounded-full" 
                                          style={{ backgroundColor: getColorForAccount(cat) }}
                                        />
                                        <span className="text-xs text-gray-600">{cat}:</span>
                                      </div>
                                      <span className="text-xs font-semibold text-gray-900">{Math.round(data?.[cat] || 0).toLocaleString()}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    
                    {/* 100% 기준선 */}
                    <ReferenceLine 
                      yAxisId="right" 
                      y={100} 
                      stroke="#9ca3af" 
                      strokeDasharray="5 5" 
                      strokeWidth={2}
                      label={{ value: '100%', position: 'right', fill: '#6b7280', fontSize: 11 }}
                    />
                    
                    {/* 동적으로 Bar 생성 */}
                    {drilldownData.length > 0 && Object.keys(drilldownData[0])
                      .filter(key => key !== 'month' && key !== 'monthNum' && key !== 'YOY')
                      .map((subcategory, index) => {
                        return (
                          <Bar 
                            key={subcategory}
                            yAxisId="left" 
                            dataKey={subcategory} 
                            stackId="a" 
                            fill={getColorForAccount(subcategory)} 
                            name={subcategory}
                          />
                        );
                      })}
                    
                    {/* YOY 꺾은선 */}
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="YOY" 
                      stroke="#ef4444" 
                      strokeWidth={3}
                      dot={{ fill: '#ef4444', r: 5 }}
                      name="YOY"
                    />
                    
                    <Legend 
                      wrapperStyle={{ 
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                      iconType="circle"
                      formatter={(value) => (
                        <span 
                          style={{ 
                            color: '#6b7280',
                            cursor: value !== 'YOY' ? 'pointer' : 'default',
                            transition: 'all 0.2s'
                          }}
                          onClick={() => {
                            if (value !== 'YOY') {
                              handleDetailDrilldown(value);
                            }
                          }}
                          onMouseEnter={(e) => {
                            if (value !== 'YOY') {
                              e.currentTarget.style.color = '#000000';
                              e.currentTarget.style.fontWeight = 'bold';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#6b7280';
                            e.currentTarget.style.fontWeight = 'normal';
                          }}
                        >
                          {value}
                        </span>
                      )}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
        </div>
            </CardContent>
          </Card>
        )}
        
        {/* 소분류 드릴다운 차트 (새로 추가) */}
        {detailDrilldownCategory && detailDrilldownData.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">
                    {detailDrilldownCategory} - 소분류 월별 추이 (2025년)
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">계정 소분류별 상세 분석</p>
                </div>
                <button
                  onClick={() => {
                    setDetailDrilldownCategory(null);
                    setDetailDrilldownData([]);
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                >
                  접기
                  <ChevronUpIcon className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={detailDrilldownData}
                    margin={{ top: 20, right: 80, bottom: 20, left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="month" 
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      yAxisId="left"
                      stroke="#6b7280"
                      style={{ fontSize: '12px', fill: '#6b7280' }}
                      tickFormatter={(value) => `${value.toLocaleString()}`}
                      label={{ value: '비용 (백만원)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6b7280' } }}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      stroke="#6b7280"
                      style={{ fontSize: '12px', fill: '#6b7280' }}
                      tickFormatter={(value) => Math.round(value).toString()}
                      domain={[0, 200]}
                      label={{ value: 'YOY (%)', angle: 90, position: 'insideRight', style: { fontSize: 12, fill: '#6b7280' } }}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                      wrapperStyle={{ outline: 'none', zIndex: 9999 }}
                      contentStyle={{ backgroundColor: 'white', opacity: 1, border: 'none' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = detailDrilldownData.find(d => d.month === label);
                          const subcategories = Object.keys(data || {}).filter(key => key !== 'month' && key !== 'monthNum' && key !== 'YOY');
                          
                          const totalCost = subcategories.reduce((sum, cat) => sum + (data?.[cat] || 0), 0);
                          const prevTotal = totalCost / (data?.YOY || 100) * 100;
                          
                          return (
                            <div className="p-3 border border-gray-200 rounded-lg shadow-xl min-w-[200px]" style={{ backgroundColor: 'rgb(255, 255, 255)', opacity: 1 }}>
                              <p className="font-bold text-gray-900 mb-3 pb-2 border-b">{label}</p>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">총비용:</span>
                                  <span className="text-sm font-bold text-blue-600">
                                    {Math.round(totalCost).toLocaleString()}백만원
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">전년:</span>
                                  <span className="text-sm font-semibold text-gray-700">{Math.round(prevTotal).toLocaleString()}백만원</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">YOY:</span>
                                  <span className="text-sm font-bold text-red-600">{Math.round(data?.YOY || 0).toLocaleString()}%</span>
                                </div>
                                <div className="pt-2 border-t">
                                  <p className="text-xs font-semibold text-gray-700 mb-2">중분류별 비중</p>
                                  {subcategories.map((cat, idx) => (
                                    <div key={cat} className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-1.5">
                                        <div 
                                          className="w-2.5 h-2.5 rounded-full" 
                                          style={{ backgroundColor: getColorForAccount(cat) }}
                                        />
                                        <span className="text-xs text-gray-600">{cat}:</span>
                                      </div>
                                      <span className="text-xs font-semibold text-gray-900">{Math.round(data?.[cat] || 0).toLocaleString()}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
    </div>
                          );
                        }
                        return null;
                      }}
                    />
                    
                    <ReferenceLine 
                      yAxisId="right"
                      y={100} 
                      stroke="#9ca3af" 
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      label={{ value: '100%', position: 'right', fill: '#6b7280', fontSize: 11 }}
                    />
                    
                    {detailDrilldownData.length > 0 && Object.keys(detailDrilldownData[0])
                      .filter(key => key !== 'month' && key !== 'monthNum' && key !== 'YOY')
                      .map((subcategory, index) => {
                        return (
                          <Bar
                            key={subcategory}
                            yAxisId="left"
                            dataKey={subcategory}
                            stackId="a"
                            fill={getColorForAccount(subcategory)}
                            name={subcategory}
                          />
                        );
                      })
                    }
                    
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="YOY" 
                      stroke="#ef4444" 
                      strokeWidth={3}
                      dot={{ fill: '#ef4444', r: 5 }}
                      name="YOY"
                    />
                    
                    <Legend 
                      wrapperStyle={{ 
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                      iconType="circle"
                      formatter={(value) => (
                        <span style={{ color: '#6b7280' }}>
                          {value}
                        </span>
                      )}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* 계정별 / 코스트센터별 YOY 비교 분석 */}
        <Card className="mt-6" ref={accountSectionRef}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <CardTitle className="text-lg font-bold">비용 대분류별 YOY 비교</CardTitle>
              
              {/* Breadcrumb */}
              {(accountLevel !== 'major' || selectedAccount) && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <button 
                    onClick={handleBackToMajor}
                    className="hover:text-blue-600 hover:underline"
                  >
                    계정대분류
                  </button>
                  {accountLevel !== 'major' && selectedAccount && (
                    <>
                      <span>→</span>
                      {accountLevel === 'detail' ? (
                        <button 
                          onClick={handleBackToMiddle}
                          className="hover:text-blue-600 hover:underline"
                        >
                          계정중분류
                        </button>
                      ) : (
                        <span className="font-semibold text-gray-800">{selectedAccount}</span>
                      )}
                      {accountLevel === 'detail' && (
                        <>
                          <span>→</span>
                          <span className="font-semibold text-gray-800">계정소분류</span>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {/* 당월/누적 토글 */}
              <div className="flex gap-2">
                <button
                  onClick={() => setAccountViewMode('monthly')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    accountViewMode === 'monthly'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  당월
                </button>
                <button
                  onClick={() => setAccountViewMode('ytd')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    accountViewMode === 'ytd'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  누적
                </button>
              </div>
              
              {/* 접기/펼치기 */}
              <button
                onClick={() => setIsAccountExpanded(!isAccountExpanded)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {isAccountExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
              </button>
            </div>
          </CardHeader>
          
          {isAccountExpanded && (
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 왼쪽: 계정별 분석 (50%) */}
                <div className="lg:pr-2">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    {accountLevel === 'major' && '계정 대분류'}
                    {accountLevel === 'middle' && '계정 중분류'}
                    {accountLevel === 'detail' && '계정 소분류 (상세)'}
                  </h3>
                  
                  <div className="h-[500px] overflow-y-auto pr-2">
                    <ResponsiveContainer width="100%" height={Math.max(500, accountData.length * 50)}>
                      <BarChart
                        data={accountData}
                        layout="vertical"
                        margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis 
                          type="number"
                          tick={{ fontSize: 12 }}
                          stroke="#6b7280"
                          tickFormatter={(value) => value.toLocaleString()}
                          label={{ value: '비용 (백만원)', position: 'insideBottom', offset: -10, style: { fontSize: 12 } }}
                        />
                        <YAxis 
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          stroke="#6b7280"
                          width={120}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                          wrapperStyle={{ outline: 'none' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200 min-w-[220px]" style={{ backgroundColor: '#ffffff', opacity: 1 }}>
                                  <p className="font-bold text-sm mb-2">{data.name}</p>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-blue-600 font-semibold">당년:</span>
                                      <span className="font-bold">{formatNumber(data.current)}백만원</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">전년:</span>
                                      <span className="font-medium">{formatNumber(data.previous)}백만원</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-1 border-t">
                                      <span className="font-semibold">YOY:</span>
                                      <span className={`font-bold ${data.yoy >= 100 ? 'text-red-600' : 'text-green-600'}`}>
                                        {formatNumber(data.yoy)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar 
                          dataKey="current" 
                          fill="#93c5fd"
                          radius={[0, 4, 4, 0]}
                          cursor="pointer"
                          onClick={(data) => {
                            if (data.name) {
                              handleAccountClick(data.name);
                            }
                          }}
                        >
                          {accountData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`}
                              fill={hoveredAccount === entry.name ? '#3b82f6' : '#93c5fd'}
                              onMouseEnter={() => setHoveredAccount(entry.name)}
                              onMouseLeave={() => setHoveredAccount(null)}
                            />
                          ))}
                        </Bar>
                        <Bar 
                          dataKey="previous" 
                          fill="#9ca3af"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                {/* 오른쪽: 코스트센터별 TOP 10 (50%) */}
                <div className="border-l pl-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    코스트센터별 (공통 선택 필요)
                  </h3>
                  
                  {selectedAccount ? (
                    <>
                      <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs text-gray-600">선택된 계정</p>
                        <p className="text-sm font-bold text-blue-600">{selectedAccount}</p>
                      </div>
                      
                      {costCenterData.length > 0 ? (
                        <div>
                          {/* Bubble Chart */}
                          {bubbleChartData.data.length > 0 && (
                            <div className="mb-6">
                              <h4 className="text-xs font-semibold text-gray-700 mb-2">
                                코스트센터 효율성 분석 (Bubble Chart)
                                <span className="text-gray-500 font-normal ml-2">X축: 인원수(명), Y축: 인당비용(백만원)</span>
                              </h4>
                              <div className="h-[400px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <ScatterChart
                                    data={bubbleChartData.data}
                                    margin={{ top: 20, right: 20, bottom: 60, left: 30 }}
                                  >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis 
                                      type="number"
                                      dataKey="headcount"
                                      name="인원수"
                                      unit="명"
                                      domain={['dataMin - 5', 'dataMax + 5']}
                                      tick={{ fontSize: 11 }}
                                      tickFormatter={(value) => Math.round(value).toString()}
                                    />
                                    <YAxis 
                                      type="number"
                                      dataKey="costPerHead"
                                      name="인당 비용"
                                      unit="백만원"
                                      domain={['dataMin - 0.5', 'dataMax + 0.5']}
                                      tick={{ fontSize: 11 }}
                                      tickFormatter={(value) => `${Math.round(value)}`}
                                    />
                                    <ZAxis 
                                      type="number"
                                      dataKey="z"
                                      range={[10, 50]}
                                      name="총 비용"
                                    />
                                    <Tooltip
                                      cursor={{ strokeDasharray: '3 3' }}
                                      content={({ active, payload }) => {
                                        if (active && payload && payload.length > 0) {
                                          const data = payload[0].payload;
                                          return (
                                            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                              <p className="font-semibold text-gray-900 mb-2">{data.name}</p>
                                              <div className="space-y-1 text-sm">
                                                <p className="text-gray-600">
                                                  인원수: <span className="font-semibold">{data.headcount}명</span>
                                                </p>
                                                <p className="text-gray-600">
                                                  인당 비용: <span className="font-semibold">{data.costPerHead.toFixed(2)}백만원</span>
                                                </p>
                                                <p className="text-gray-600">
                                                  총 비용: <span className="font-semibold">{data.totalCost.toFixed(1)}백만원</span>
                                                </p>
                                                <p className={`font-semibold ${data.yoy >= 100 ? 'text-red-600' : 'text-green-600'}`}>
                                                  YOY: {data.yoy.toFixed(1)}%
                                                </p>
                                              </div>
                                            </div>
                                          );
                                        }
                                        return null;
                                      }}
                                    />
                                    {/* 평균 인원수 세로선 */}
                                    <ReferenceLine 
                                      x={bubbleChartData.avgHeadcount} 
                                      stroke="#9ca3af" 
                                      strokeDasharray="5 5"
                                      label={{ value: `평균 인원수: ${Math.round(bubbleChartData.avgHeadcount)}명`, position: 'top', style: { fontSize: '10px' } }}
                                    />
                                    {/* 평균 인당 비용 가로선 */}
                                    <ReferenceLine 
                                      y={bubbleChartData.avgCostPerHead} 
                                      stroke="#9ca3af" 
                                      strokeDasharray="5 5"
                                      label={{ value: `평균: ${Math.round(bubbleChartData.avgCostPerHead)}백만원`, position: 'right', offset: 10, style: { fontSize: '10px' } }}
                                    />
                                    {/* 사분면 라벨 */}
                                    <ReferenceArea
                                      x1={bubbleChartData.avgHeadcount}
                                      x2="dataMax + 10"
                                      y1={bubbleChartData.avgCostPerHead}
                                      y2="dataMax + 1"
                                      fill="#fee2e2"
                                      fillOpacity={0.2}
                                    />
                                    <ReferenceArea
                                      x1="dataMin - 5"
                                      x2={bubbleChartData.avgHeadcount}
                                      y1="dataMin - 0.5"
                                      y2={bubbleChartData.avgCostPerHead}
                                      fill="#dcfce7"
                                      fillOpacity={0.2}
                                    />
                                    <Scatter
                                      name="코스트센터"
                                      data={bubbleChartData.data}
                                      fill="#8884d8"
                                      onClick={(data) => {
                                        if (data && data.payload) {
                                          setSelectedCostCenterDetail(data.payload);
                                        }
                                      }}
                                    >
                                      {bubbleChartData.data.map((entry, index) => {
                                        // YOY 증감률에 따라 색상 결정 (초록~빨강 그라데이션)
                                        const yoyValue = entry.yoy;
                                        let color = '#10b981'; // 기본 초록
                                        
                                        if (yoyValue >= 120) {
                                          color = '#dc2626'; // 빨강 (120% 이상)
                                        } else if (yoyValue >= 110) {
                                          color = '#f87171'; // 연한 빨강 (110-120%)
                                        } else if (yoyValue >= 105) {
                                          color = '#fb923c'; // 주황 (105-110%)
                                        } else if (yoyValue >= 100) {
                                          color = '#fbbf24'; // 노랑 (100-105%)
                                        } else if (yoyValue >= 95) {
                                          color = '#84cc16'; // 연한 초록 (95-100%)
                                        } else {
                                          color = '#10b981'; // 초록 (95% 미만)
                                        }
                                        
                                        return (
                                          <Cell 
                                            key={`cell-${index}`} 
                                            fill={color}
                                            style={{ cursor: 'pointer' }}
                                          />
                                        );
                                      })}
                                    </Scatter>
                                  </ScatterChart>
                                </ResponsiveContainer>
                              </div>
                              
                              {/* 범례 및 설명 */}
                              <div className="mt-4 space-y-2">
                                <div className="flex flex-wrap items-center gap-4 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-700">버블 크기:</span>
                                    <span className="text-gray-600">총 비용</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-700">버블 색상:</span>
                                    <span className="text-gray-600">YOY 증감률</span>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-600"></div>
                                    <span className="text-gray-600">120% 이상 (증가)</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                                    <span className="text-gray-600">105-120%</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                    <span className="text-gray-600">100-105%</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    <span className="text-gray-600">100% 미만 (감소)</span>
                                  </div>
                                </div>
                                <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                                  <p className="font-semibold mb-1">사분면 가이드:</p>
                                  <p>• <span className="text-red-600 font-semibold">우상단 (빨강 영역)</span>: 인원 多, 비용 高 - 효율화 검토 필요</p>
                                  <p>• <span className="text-green-600 font-semibold">좌하단 (초록 영역)</span>: 인원 少, 비용 低 - 효율적 운영</p>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* 기존 테이블 */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 mb-2">
                              코스트센터 상세 (TOP {costCenterData.length})
                            </h4>
                            {/* 헤더 */}
                            <div className="flex items-center justify-between text-xs font-semibold text-gray-600 mb-2 pb-2 border-b">
                              <span className="flex-1 min-w-0 pr-2 truncate">코스트센터</span>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <span className="w-14 text-center">당년</span>
                                <span className="w-14 text-center">전년</span>
                                <span className="w-14 text-center">YOY</span>
                              </div>
                            </div>
                            
                            {/* 데이터 */}
                            <div className="space-y-1.5">
                              {costCenterData.map((cc, index) => (
                                <div 
                                  key={cc.code}
                                  className={`p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer ${
                                    selectedCostCenterDetail && selectedCostCenterDetail.code === cc.code ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                                  }`}
                                  onClick={() => {
                                    const bubbleData = bubbleChartData.data.find(d => d.code === cc.code);
                                    if (bubbleData) {
                                      setSelectedCostCenterDetail(bubbleData);
                                    }
                                  }}
                                >
                                  <div className="flex items-center justify-between text-xs gap-2">
                                    <span className="font-semibold text-gray-800 flex-1 min-w-0 truncate">
                                      {cc.name}
                                      {cc.currentHeadcount !== null && (
                                        <span className="text-gray-500 ml-1">({cc.currentHeadcount}명)</span>
                                      )}
                                    </span>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                      <span className="w-14 text-right font-bold text-gray-900">{formatNumber(cc.current)}</span>
                                      <span className="w-14 text-right font-medium text-blue-600">{formatNumber(cc.previous)}</span>
                                      <span className={`w-14 text-right font-bold ${cc.yoy >= 100 ? 'text-red-600' : 'text-green-600'}`}>
                                        {formatNumber(cc.yoy)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500 text-sm">
                          코스트센터 데이터가 없습니다
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 text-gray-400 text-sm">
                      👈 왼쪽에서 계정을 선택하면<br />코스트센터별 TOP 10이 표시됩니다
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
        
        {/* 코스트센터 상세 정보 모달 */}
        {selectedCostCenterDetail && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedCostCenterDetail(null)}>
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">{selectedCostCenterDetail.name}</h3>
                <button
                  onClick={() => setSelectedCostCenterDetail(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">인원수</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedCostCenterDetail.headcount}명
                      {selectedCostCenterDetail.previousHeadcount && (
                        <span className="text-gray-500 ml-1">
                          (전년: {selectedCostCenterDetail.previousHeadcount}명)
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">인당 비용</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedCostCenterDetail.costPerHead.toFixed(2)}백만원
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">당년 총 비용</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedCostCenterDetail.current.toFixed(1)}백만원
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">전년 총 비용</p>
                    <p className="text-sm font-semibold text-blue-600">
                      {selectedCostCenterDetail.previous.toFixed(1)}백만원
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">증감</p>
                    <p className={`text-sm font-semibold ${selectedCostCenterDetail.change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {selectedCostCenterDetail.change >= 0 ? '+' : ''}{selectedCostCenterDetail.change.toFixed(1)}백만원
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">YOY 증감률</p>
                    <p className={`text-sm font-semibold ${selectedCostCenterDetail.yoy >= 100 ? 'text-red-600' : 'text-green-600'}`}>
                      {selectedCostCenterDetail.yoy.toFixed(1)}%
                    </p>
                  </div>
                </div>
                
                {/* 사분면 분석 */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-semibold text-gray-700 mb-2">효율성 분석</p>
                  {selectedCostCenterDetail.headcount > bubbleChartData.avgHeadcount && 
                   selectedCostCenterDetail.costPerHead > bubbleChartData.avgCostPerHead ? (
                    <p className="text-xs text-red-600">
                      ⚠️ 우상단 사분면: 인원 多, 비용 高 - 효율화 검토 필요
                    </p>
                  ) : selectedCostCenterDetail.headcount < bubbleChartData.avgHeadcount && 
                        selectedCostCenterDetail.costPerHead < bubbleChartData.avgCostPerHead ? (
                    <p className="text-xs text-green-600">
                      ✅ 좌하단 사분면: 인원 少, 비용 低 - 효율적 운영
                    </p>
                  ) : selectedCostCenterDetail.headcount > bubbleChartData.avgHeadcount ? (
                    <p className="text-xs text-orange-600">
                      📊 인원수는 평균보다 많지만, 인당 비용은 평균 수준
                    </p>
                  ) : (
                    <p className="text-xs text-blue-600">
                      📊 인원수는 평균보다 적지만, 인당 비용은 평균보다 높음
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 구조화된 테이블 (계층형) */}
        <Card className="shadow-lg mt-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-gray-800">비용 계정 상세 분석 (계층형)</CardTitle>
              
              <div className="flex items-center gap-3">
                {/* 당월/누적 토글 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setTableViewMode('monthly')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      tableViewMode === 'monthly'
                        ? 'bg-purple-600 text-white font-semibold'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    당월
                  </button>
                  <button
                    onClick={() => setTableViewMode('ytd')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      tableViewMode === 'ytd'
                        ? 'bg-purple-600 text-white font-semibold'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    누적
                  </button>
                </div>
                
                {/* 모두 접기/펼치기 */}
                <button
                  onClick={() => {
                    if (expandedRows.size > 0) {
                      setExpandedRows(new Set());
                    } else {
                      const allIds = new Set<string>();
                      hierarchyData.forEach(major => {
                        if (!major.isTotal) {
                          allIds.add(major.id);
                          major.children?.forEach((middle: any) => {
                            allIds.add(middle.id);
                          });
                        }
                      });
                      setExpandedRows(allIds);
                    }
                  }}
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {expandedRows.size > 0 ? '모두 접기' : '모두 펼치기'}
                </button>
                
                {/* 접기/펼치기 */}
                <button
                  onClick={() => setIsTableExpanded(!isTableExpanded)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {isTableExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </CardHeader>
          
          {isTableExpanded && (
            <CardContent className="p-6">
              {/* 데이터 테이블 */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-[25%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[35%]" />
                  </colgroup>
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="border-b-2 border-gray-200">
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">계정(백만원)</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">전년</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">당년</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">차이</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">YOY</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">설명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHierarchyData.map((major) => (
                      <HierarchyRow
                        key={major.id}
                        data={major}
                        level={0}
                        expandedRows={expandedRows}
                        toggleRow={toggleRow}
                        descriptions={descriptions}
                        generateAIDescription={generateAIDescription}
                        isGeneratingAI={isGeneratingAI}
                        editingDescription={editingDescription}
                        tempDescription={tempDescription}
                        setTempDescription={setTempDescription}
                        onStartEdit={startEditDescription}
                        onSaveEdit={saveDescription}
                        onCancelEdit={cancelEditDescription}
                      />
                    ))}
                  </tbody>
                </table>
                
                {filteredHierarchyData.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    데이터를 불러오는 중...
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
        </div>
      )}

      {/* 사업부배부 탭 콘텐츠 */}
      {mainTab === 'allocation' && (
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold">사업부별 공통비 배부 현황</CardTitle>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setViewMode('monthly')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      viewMode === 'monthly' 
                        ? 'text-blue-600 bg-blue-50' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    당월
                  </button>
                  <button 
                    onClick={() => setViewMode('ytd')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      viewMode === 'ytd' 
                        ? 'text-blue-600 bg-blue-50' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    누적 (YTD)
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {allocationLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <svg className="w-8 h-8 animate-spin mb-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <p className="text-sm font-medium">데이터를 불러오는 중...</p>
                </div>
              ) : allocationData ? (
                <>
                {/* 테이블에는 SUPRA, STRETCH ANGELS 제외 (공통비 합계에는 포함됨) */}
                {(() => {
                  const HIDDEN_ALLOCATION_BRANDS = ['SUPRA', 'STRETCH ANGELS'];
                  const visibleBrands = allocationData.brands.filter(
                    (b) => !HIDDEN_ALLOCATION_BRANDS.includes(b.name)
                  );
                  return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="px-3 py-2.5 text-left text-sm font-bold text-gray-900 bg-gray-50 whitespace-nowrap w-[48px]">구분</th>
                        <th className="px-3 py-2.5 text-center text-sm font-bold text-gray-900 bg-gray-50 whitespace-nowrap w-[100px]" colSpan={2}>공통비</th>
                        {visibleBrands.map((brand) => (
                          <th key={brand.name} className="px-3 py-2.5 text-center text-sm font-bold text-gray-900 bg-gray-50 w-[100px]" colSpan={2}>
                            {brand.name.includes(' ') && brand.name !== 'MLB KIDS' ? (
                              <span className="whitespace-pre-line leading-tight">{brand.name.replace(' ', '\n')}</span>
                            ) : (
                              brand.name
                            )}
                          </th>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-3 py-1.5 text-left text-xs text-gray-500"></th>
                        <th className="px-3 py-1.5 text-center text-xs text-gray-500">금액</th>
                        <th className="px-3 py-1.5 text-center text-xs text-gray-500">비중</th>
                        {visibleBrands.map((brand) => (
                          <React.Fragment key={`header-${brand.name}`}>
                            <th className="px-3 py-1.5 text-center text-xs text-gray-500">금액</th>
                            <th className="px-3 py-1.5 text-center text-xs text-gray-500">비중</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* 24년 행 */}
                      <tr className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-sm font-medium text-gray-700 whitespace-nowrap">24년</td>
                        <td className="px-3 py-2.5 text-right text-base text-gray-900 font-semibold">
                          {allocationData.total.previous.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm text-gray-500">100%</td>
                        {visibleBrands.map((brand) => (
                          <React.Fragment key={`prev-${brand.name}`}>
                            <td className="px-3 py-2.5 text-right text-base text-gray-900">
                              {brand.previous.toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-right text-sm text-gray-500">
                              {brand.previousRatio.toFixed(1)}%
                            </td>
                          </React.Fragment>
                        ))}
                      </tr>
                      {/* 25년 행 */}
                      <tr className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-sm font-medium text-gray-700 whitespace-nowrap">25년</td>
                        <td className="px-3 py-2.5 text-right text-base text-blue-600 font-bold">
                          {allocationData.total.current.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm text-gray-500">100%</td>
                        {visibleBrands.map((brand) => (
                          <React.Fragment key={`cur-${brand.name}`}>
                            <td className="px-3 py-2.5 text-right text-base text-blue-600 font-semibold">
                              {brand.current.toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-right text-sm text-gray-500">
                              {brand.currentRatio.toFixed(1)}%
                            </td>
                          </React.Fragment>
                        ))}
                      </tr>
                      {/* 차이 행 */}
                      <tr className="bg-gray-50 border-t-2 border-gray-200">
                        <td className="px-3 py-2.5 text-sm font-bold text-gray-900 whitespace-nowrap">차이</td>
                        <td className={`px-3 py-2.5 text-right text-base font-bold ${allocationData.total.change >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                          {allocationData.total.change >= 0 ? '+' : ''}{allocationData.total.change.toLocaleString()}
                        </td>
                        <td className={`px-3 py-2.5 text-right text-sm font-semibold ${allocationData.total.changePercent >= 100 ? 'text-red-600' : 'text-blue-600'}`}>
                          {allocationData.total.changePercent.toFixed(1)}%
                        </td>
                        {visibleBrands.map((brand) => (
                          <React.Fragment key={`diff-${brand.name}`}>
                            <td className={`px-3 py-2.5 text-right text-base font-semibold ${brand.change >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                              {brand.change >= 0 ? '+' : ''}{brand.change.toLocaleString()}
                            </td>
                            <td className={`px-3 py-2.5 text-right text-sm font-semibold ${brand.changePercent >= 100 ? 'text-red-600' : 'text-blue-600'}`}>
                              {brand.changePercent.toFixed(1)}%
                            </td>
                          </React.Fragment>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                  );
                })()}
                
                {/* 배부기준 입력 영역 */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 
                    onClick={() => setCriteriaEditMode(!criteriaEditMode)}
                    className="text-base font-bold text-gray-700 flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    공통비 배부기준
                  </h4>
                  
                  {criteriaEditMode ? (
                    /* 편집 모드 */
                    <div className="space-y-2 mt-3">
                      {allocationCriteria.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="text-blue-600 font-bold">•</span>
                          <input
                            type="text"
                            className="flex-1 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="배부기준 입력 (**굵게**)"
                            value={item}
                            onChange={(e) => {
                              const newCriteria = [...allocationCriteria];
                              newCriteria[index] = e.target.value;
                              setAllocationCriteria(newCriteria);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const newCriteria = [...allocationCriteria];
                                newCriteria.splice(index + 1, 0, '');
                                setAllocationCriteria(newCriteria);
                              } else if (e.key === 'Backspace' && item === '' && allocationCriteria.length > 1) {
                                e.preventDefault();
                                const newCriteria = allocationCriteria.filter((_, i) => i !== index);
                                setAllocationCriteria(newCriteria);
                              }
                            }}
                          />
                          {allocationCriteria.length > 1 && (
                            <button
                              onClick={() => {
                                const newCriteria = allocationCriteria.filter((_, i) => i !== index);
                                setAllocationCriteria(newCriteria);
                              }}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => setAllocationCriteria([...allocationCriteria, ''])}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          항목 추가
                        </button>
                        <button
                          onClick={async () => {
                            const filteredCriteria = allocationCriteria.filter(c => c.trim() !== '');
                            try {
                              const response = await fetch('/api/allocation-criteria', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ criteria: filteredCriteria })
                              });
                              const result = await response.json();
                              if (result.success) {
                                setAllocationCriteria(filteredCriteria.length > 0 ? filteredCriteria : ['']);
                                setCriteriaEditMode(false);
                              } else {
                                alert('저장에 실패했습니다.');
                              }
                            } catch (error) {
                              console.error('배부기준 저장 실패:', error);
                              alert('저장 중 오류가 발생했습니다.');
                            }
                          }}
                          className="ml-auto px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 읽기 모드 */
                    <div className="mt-3 space-y-1">
                      {allocationCriteria.filter(c => c.trim() !== '').length > 0 ? (
                        allocationCriteria.filter(c => c.trim() !== '').map((item, index) => (
                          <div key={index} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-blue-600 font-bold">•</span>
                            <span dangerouslySetInnerHTML={{ 
                              __html: item.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') 
                            }} />
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-400 italic">배부기준을 입력하려면 제목을 클릭하세요</p>
                      )}
                    </div>
                  )}
                </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <p className="text-lg font-medium mb-2">데이터를 불러올 수 없습니다</p>
                  <button
                    onClick={loadAllocationData}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    다시 시도
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 인건비 탭 콘텐츠 */}
      {mainTab === 'labor' && (
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold">월별 인원 현황</CardTitle>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setLaborYear('2024')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      laborYear === '2024' 
                        ? 'text-blue-600 bg-blue-50' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    2024년
                  </button>
                  <button 
                    onClick={() => setLaborYear('2025')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      laborYear === '2025' 
                        ? 'text-blue-600 bg-blue-50' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    2025년
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {laborLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <svg className="w-8 h-8 animate-spin mb-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <p className="text-sm font-medium">데이터를 불러오는 중...</p>
                </div>
              ) : laborData ? (
                <>
                {/* 과거 월 접기/펼치기 버튼 */}
                <div className="mb-3 flex items-center gap-2">
                  <button
                    onClick={() => setLaborMonthsExpanded(!laborMonthsExpanded)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <svg 
                      className={`w-4 h-4 transition-transform ${laborMonthsExpanded ? 'rotate-90' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {laborMonthsExpanded ? '과거 월 접기 (1~10월)' : '과거 월 펼치기 (1~10월)'}
                  </button>
                  <button
                    onClick={() => {
                      if (expandedDivisions.size > 0) {
                        setExpandedDivisions(new Set());
                        setExpandedSubDivisions(new Set());
                      } else {
                        const allDivisions = new Set(laborData?.divisions.map(d => d.divisionName) || []);
                        setExpandedDivisions(allDivisions);
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <svg 
                      className={`w-4 h-4 transition-transform ${expandedDivisions.size > 0 ? 'rotate-90' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {expandedDivisions.size > 0 ? '전체 부문 접기' : '전체 부문 펼치기'}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-900 bg-gray-50 whitespace-nowrap sticky left-0">부문/팀</th>
                        {/* 25년 선택 시 24말 컬럼 */}
                        {laborYear === '2025' && (
                          <th className="px-2 py-2 text-center text-xs font-bold text-gray-900 bg-gray-50 whitespace-nowrap w-[45px]">
                            24말
                          </th>
                        )}
                        {/* 1~10월: 펼침 상태에 따라 표시 */}
                        {laborMonthsExpanded && laborData.months.filter(m => parseInt(m) <= 10).map((month) => (
                          <th key={month} className="px-2 py-2 text-center text-xs font-bold text-gray-900 bg-gray-50 whitespace-nowrap min-w-[45px]">
                            {parseInt(month)}월
                          </th>
                        ))}
                        {/* 11월: 항상 표시 */}
                        <th className="px-2 py-2 text-center text-xs font-bold text-gray-900 bg-gray-50 whitespace-nowrap w-[45px]">
                          11월
                        </th>
                        {/* 12월 입사/퇴사/이동 헤더 - 클릭하면 펼침 */}
                        {laborDecemberExpanded && (
                          <>
                            <th className="px-2 py-2 text-center text-xs font-bold text-gray-900 bg-gray-50 whitespace-nowrap w-[45px]">
                              입사
                            </th>
                            <th className="px-2 py-2 text-center text-xs font-bold text-gray-900 bg-gray-50 whitespace-nowrap w-[45px]">
                              퇴사
                            </th>
                            <th className="px-2 py-2 text-center text-xs font-bold text-gray-900 bg-gray-50 whitespace-nowrap w-[45px]">
                              이동
                            </th>
                          </>
                        )}
                        {/* 12월: 클릭 가능 */}
                        <th 
                          className="px-2 py-2 text-center text-xs font-bold text-gray-900 bg-gray-50 whitespace-nowrap w-[45px] cursor-pointer hover:bg-blue-100 transition-colors"
                          onClick={() => setLaborDecemberExpanded(!laborDecemberExpanded)}
                        >
                          <div className="flex items-center justify-center gap-1">
                            12월
                            <svg 
                              className={`w-3 h-3 transition-transform ${laborDecemberExpanded ? 'rotate-180' : ''}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </th>
                        {/* 전월비 컬럼 */}
                        <th className="px-2 py-2 text-center text-xs font-bold text-gray-900 bg-gray-50 whitespace-nowrap w-[45px]">
                          전월비
                        </th>
                        {/* 전년비 컬럼 */}
                        <th className="px-2 py-2 text-center text-xs font-bold text-gray-900 bg-gray-50 whitespace-nowrap w-[45px]">
                          전년비
                        </th>
                        {/* 비고 컬럼 */}
                        <th className="px-2 py-2 text-center text-xs font-bold text-gray-900 bg-gray-50 whitespace-nowrap min-w-[100px]">
                          비고 (전월대비)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 25년 전체 합계 행 */}
                      <tr className="border-b border-gray-200 bg-blue-50 font-bold">
                        <td className="px-3 py-2 text-sm text-blue-700 sticky left-0 bg-blue-50">2025년</td>
                        {/* 25년 선택 시 24년 12월 값 */}
                        {laborYear === '2025' && (
                          <td className="px-2 py-2 text-center text-sm text-blue-700">
                            {laborData.yearlyTotals['2024']?.['12'] || 0}
                          </td>
                        )}
                        {/* 1~10월 */}
                        {laborMonthsExpanded && laborData.months.filter(m => parseInt(m) <= 10).map((month) => (
                          <td key={month} className="px-2 py-2 text-center text-sm text-blue-700">
                            {laborData.yearlyTotals['2025']?.[month] || 0}
                          </td>
                        ))}
                        {/* 11월 */}
                        <td className="px-2 py-2 text-center text-sm text-blue-700">
                          {laborData.yearlyTotals['2025']?.['11'] || 0}
                        </td>
                        {/* 입사/퇴사/이동 - 자동 합계 */}
                        {laborDecemberExpanded && (() => {
                          const allKeys = getAllTeamKeys();
                          const hireSum = calculateMovementSum(allKeys, 'hire');
                          const resignSum = calculateMovementSum(allKeys, 'resign');
                          const transferSum = calculateMovementSum(allKeys, 'transfer');
                          return (
                            <>
                              <td className="px-2 py-2 text-center text-sm text-blue-700 font-bold">
                                {hireSum || '-'}
                              </td>
                              <td className="px-2 py-2 text-center text-sm text-blue-700 font-bold">
                                {resignSum || '-'}
                              </td>
                              <td className="px-2 py-2 text-center text-sm text-blue-700 font-bold">
                                {transferSum || '-'}
                              </td>
                            </>
                          );
                        })()}
                        {/* 12월 */}
                        <td className="px-2 py-2 text-center text-sm text-blue-700">
                          {laborData.yearlyTotals['2025']?.['12'] || 0}
                        </td>
                        {/* 전월비 (12월 - 11월) */}
                        {(() => {
                          const dec = laborData.yearlyTotals['2025']?.['12'] || 0;
                          const nov = laborData.yearlyTotals['2025']?.['11'] || 0;
                          const momDiff = dec - nov;
                          return (
                            <td className={`px-2 py-2 text-center text-sm font-semibold ${momDiff > 0 ? 'text-red-600' : momDiff < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                              {momDiff > 0 ? `+${momDiff}` : momDiff}
                            </td>
                          );
                        })()}
                        {/* 전년비 (25년 12월 - 24년 12월) */}
                        {(() => {
                          const dec25 = laborData.yearlyTotals['2025']?.['12'] || 0;
                          const dec24 = laborData.yearlyTotals['2024']?.['12'] || 0;
                          const yoyDiff = dec25 - dec24;
                          return (
                            <td className={`px-2 py-2 text-center text-sm font-semibold ${yoyDiff > 0 ? 'text-red-600' : yoyDiff < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                              {yoyDiff > 0 ? `+${yoyDiff}` : yoyDiff}
                            </td>
                          );
                        })()}
                        {/* 비고 */}
                        <td className="px-2 py-2 text-center text-sm text-blue-700">
                          <input
                            type="text"
                            value={laborRemarkData['total'] || ''}
                            onChange={(e) => setLaborRemarkData(prev => ({ ...prev, total: e.target.value }))}
                            className="w-full text-left bg-transparent focus:outline-none text-xs text-blue-700"
                            placeholder=""
                          />
                        </td>
                      </tr>
                      {/* 24년 전체 합계 행 */}
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-600 sticky left-0 bg-gray-50">2024년</td>
                        {/* 25년 선택 시 빈 셀 */}
                        {laborYear === '2025' && (
                          <td className="px-2 py-2 text-center text-sm text-gray-600">-</td>
                        )}
                        {/* 1~10월 */}
                        {laborMonthsExpanded && laborData.months.filter(m => parseInt(m) <= 10).map((month) => (
                          <td key={month} className="px-2 py-2 text-center text-sm text-gray-600">
                            {laborData.yearlyTotals['2024']?.[month] || 0}
                          </td>
                        ))}
                        {/* 11월 */}
                        <td className="px-2 py-2 text-center text-sm text-gray-600">
                          {laborData.yearlyTotals['2024']?.['11'] || 0}
                        </td>
                        {/* 입사/퇴사/이동 빈 셀 */}
                        {laborDecemberExpanded && (
                          <>
                            <td className="px-2 py-2 text-center text-sm text-gray-600">-</td>
                            <td className="px-2 py-2 text-center text-sm text-gray-600">-</td>
                            <td className="px-2 py-2 text-center text-sm text-gray-600">-</td>
                          </>
                        )}
                        {/* 12월 */}
                        <td className="px-2 py-2 text-center text-sm text-gray-600">
                          {laborData.yearlyTotals['2024']?.['12'] || 0}
                        </td>
                        {/* 빈 전월비 셀 */}
                        <td className="px-2 py-2 text-center text-sm text-gray-600">-</td>
                        {/* 빈 전년비 셀 */}
                        <td className="px-2 py-2 text-center text-sm text-gray-600">-</td>
                        {/* 빈 비고 셀 */}
                        <td className="px-2 py-2 text-center text-sm text-gray-600">-</td>
                      </tr>
                      {/* YOY 증감 행 */}
                      <tr className="border-b-2 border-gray-300 bg-gray-100">
                        <td className="px-3 py-2 text-sm font-semibold text-gray-700 sticky left-0 bg-gray-100">YOY 증감</td>
                        {/* 25년 선택 시 빈 셀 */}
                        {laborYear === '2025' && (
                          <td className="px-2 py-2 text-center text-sm text-gray-600">-</td>
                        )}
                        {/* 1~10월 */}
                        {laborMonthsExpanded && laborData.months.filter(m => parseInt(m) <= 10).map((month) => {
                          const current = laborData.yearlyTotals['2025']?.[month] || 0;
                          const previous = laborData.yearlyTotals['2024']?.[month] || 0;
                          const diff = current - previous;
                          return (
                            <td key={month} className={`px-2 py-2 text-center text-sm font-semibold ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                              {diff > 0 ? `+${diff}` : diff}
                            </td>
                          );
                        })}
                        {/* 11월 */}
                        {(() => {
                          const current = laborData.yearlyTotals['2025']?.['11'] || 0;
                          const previous = laborData.yearlyTotals['2024']?.['11'] || 0;
                          const diff = current - previous;
                          return (
                            <td className={`px-2 py-2 text-center text-sm font-semibold ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                              {diff > 0 ? `+${diff}` : diff}
                            </td>
                          );
                        })()}
                        {/* 입사/퇴사/이동 빈 셀 */}
                        {laborDecemberExpanded && (
                          <>
                            <td className="px-2 py-2 text-center text-sm text-gray-600">-</td>
                            <td className="px-2 py-2 text-center text-sm text-gray-600">-</td>
                            <td className="px-2 py-2 text-center text-sm text-gray-600">-</td>
                          </>
                        )}
                        {/* 12월 */}
                        {(() => {
                          const current = laborData.yearlyTotals['2025']?.['12'] || 0;
                          const previous = laborData.yearlyTotals['2024']?.['12'] || 0;
                          const diff = current - previous;
                          return (
                            <td className={`px-2 py-2 text-center text-sm font-semibold ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                              {diff > 0 ? `+${diff}` : diff}
                            </td>
                          );
                        })()}
                        {/* 빈 전월비 셀 */}
                        <td className="px-2 py-2 text-center text-sm text-gray-600">-</td>
                        {/* 빈 전년비 셀 */}
                        <td className="px-2 py-2 text-center text-sm text-gray-600">-</td>
                        {/* 빈 비고 셀 */}
                        <td className="px-2 py-2 text-center text-sm text-gray-600">-</td>
                      </tr>
                      {/* 부문별 행 */}
                      {laborData.divisions.map((division) => (
                        <React.Fragment key={division.divisionName}>
                          {/* 부문 헤더 행 */}
                          <tr 
                            className="border-b border-gray-200 bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
                            onClick={() => toggleDivision(division.divisionName)}
                          >
                            <td className="px-3 py-2 text-sm font-bold text-gray-800 sticky left-0 bg-gray-100 hover:bg-gray-200 transition-colors">
                              <div className="flex items-center gap-2">
                                <svg 
                                  className={`w-4 h-4 transition-transform ${expandedDivisions.has(division.divisionName) ? 'rotate-90' : ''}`} 
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                {division.divisionName}
                              </div>
                            </td>
                            {/* 25년 선택 시 24년 12월 값 */}
                            {laborYear === '2025' && (
                              <td className="px-2 py-2 text-center text-sm font-bold text-gray-800">
                                {division.monthly['202412'] || '-'}
                              </td>
                            )}
                            {/* 1~10월 */}
                            {laborMonthsExpanded && laborData.months.filter(m => parseInt(m) <= 10).map((month) => {
                              const key = `${laborYear}${month}`;
                              const value = division.monthly[key] || 0;
                              return (
                                <td key={month} className="px-2 py-2 text-center text-sm font-bold text-gray-800">
                                  {value > 0 ? value : '-'}
                                </td>
                              );
                            })}
                            {/* 11월 */}
                            <td className="px-2 py-2 text-center text-sm font-bold text-gray-800">
                              {division.monthly[`${laborYear}11`] || '-'}
                            </td>
                            {/* 입사/퇴사/이동 입력 */}
                            {laborDecemberExpanded && (
                              <>
                                {/* 부문 자동 합계 */}
                                {(() => {
                                  const divisionKeys = getTeamKeysForDivision(division);
                                  const hireSum = calculateMovementSum(divisionKeys, 'hire');
                                  const resignSum = calculateMovementSum(divisionKeys, 'resign');
                                  const transferSum = calculateMovementSum(divisionKeys, 'transfer');
                                  return (
                                    <>
                                      <td className="px-2 py-2 text-center text-sm font-bold text-gray-800">
                                        {hireSum || '-'}
                                      </td>
                                      <td className="px-2 py-2 text-center text-sm font-bold text-gray-800">
                                        {resignSum || '-'}
                                      </td>
                                      <td className="px-2 py-2 text-center text-sm font-bold text-gray-800">
                                        {transferSum || '-'}
                                      </td>
                                    </>
                                  );
                                })()}
                              </>
                            )}
                            {/* 12월 */}
                            <td className="px-2 py-2 text-center text-sm font-bold text-gray-800">
                              {division.monthly[`${laborYear}12`] || '-'}
                            </td>
                            {/* 전월비 (12월 - 11월) */}
                            {(() => {
                              const dec = division.monthly[`${laborYear}12`] || 0;
                              const nov = division.monthly[`${laborYear}11`] || 0;
                              const momDiff = dec - nov;
                              return (
                                <td className={`px-2 py-2 text-center text-sm font-semibold ${momDiff > 0 ? 'text-red-600' : momDiff < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                                  {momDiff > 0 ? `+${momDiff}` : momDiff === 0 ? '0' : momDiff}
                                </td>
                              );
                            })()}
                            {/* 전년비 (25년 12월 - 24년 12월) */}
                            {(() => {
                              const dec25 = division.monthly['202512'] || 0;
                              const dec24 = division.monthly['202412'] || 0;
                              const yoyDiff = dec25 - dec24;
                              return (
                                <td className={`px-2 py-2 text-center text-sm font-semibold ${yoyDiff > 0 ? 'text-red-600' : yoyDiff < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                                  {yoyDiff > 0 ? `+${yoyDiff}` : yoyDiff === 0 ? '0' : yoyDiff}
                                </td>
                              );
                            })()}
                            {/* 비고 */}
                            <td className="px-2 py-2 text-center text-sm text-gray-800">
                              <input
                                type="text"
                                value={laborRemarkData[division.divisionName] || ''}
                                onChange={(e) => setLaborRemarkData(prev => ({ ...prev, [division.divisionName]: e.target.value }))}
                                className="w-full text-left bg-transparent focus:outline-none text-xs text-gray-800"
                                placeholder=""
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                          </tr>
                          {/* 팀별 행 (펼쳤을 때만 표시) */}
                          {expandedDivisions.has(division.divisionName) && (
                            <>
                              {/* 직속 팀 */}
                              {division.teams.map((team, teamIndex) => {
                                const teamKey = `${division.divisionName}-${team.deptNm}`;
                                return (
                                <tr key={`${division.divisionName}-${team.deptNm}-${teamIndex}`} className="border-b border-gray-100 hover:bg-gray-50">
                                  <td className="px-3 py-1.5 text-xs text-gray-600 sticky left-0 bg-white pl-8">
                                    {team.deptNm}
                                  </td>
                                  {/* 25년 선택 시 24년 12월 값 */}
                                  {laborYear === '2025' && (
                                    <td className="px-2 py-1.5 text-center text-xs text-gray-600">
                                      {team.monthly['202412'] || '-'}
                                    </td>
                                  )}
                                  {/* 1~10월 */}
                                  {laborMonthsExpanded && laborData.months.filter(m => parseInt(m) <= 10).map((month) => {
                                    const key = `${laborYear}${month}`;
                                    const value = team.monthly[key] || 0;
                                    return (
                                      <td key={month} className="px-2 py-1.5 text-center text-xs text-gray-600">
                                        {value > 0 ? value : '-'}
                                      </td>
                                    );
                                  })}
                                  {/* 11월 */}
                                  <td className="px-2 py-1.5 text-center text-xs text-gray-600">
                                    {team.monthly[`${laborYear}11`] || '-'}
                                  </td>
                                  {/* 입사/퇴사/이동 입력 */}
                                  {laborDecemberExpanded && (
                                    <>
                                      <td className="px-2 py-1.5 text-center text-xs text-gray-600">
                                        <input
                                          type="number"
                                          value={laborMovementData[teamKey]?.hire || ''}
                                          onChange={(e) => setLaborMovementData(prev => ({
                                            ...prev,
                                            [teamKey]: { hire: e.target.value.replace(/[^0-9-]/g, ''), resign: prev[teamKey]?.resign || '', transfer: prev[teamKey]?.transfer || '' }
                                          }))}
                                          className="w-full text-center bg-transparent focus:outline-none text-xs text-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          placeholder="-"
                                        />
                                      </td>
                                      <td className="px-2 py-1.5 text-center text-xs text-gray-600">
                                        <input
                                          type="number"
                                          value={laborMovementData[teamKey]?.resign || ''}
                                          onChange={(e) => setLaborMovementData(prev => ({
                                            ...prev,
                                            [teamKey]: { hire: prev[teamKey]?.hire || '', resign: e.target.value.replace(/[^0-9-]/g, ''), transfer: prev[teamKey]?.transfer || '' }
                                          }))}
                                          className="w-full text-center bg-transparent focus:outline-none text-xs text-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          placeholder="-"
                                        />
                                      </td>
                                      <td className="px-2 py-1.5 text-center text-xs text-gray-600">
                                        <input
                                          type="number"
                                          value={laborMovementData[teamKey]?.transfer || ''}
                                          onChange={(e) => setLaborMovementData(prev => ({
                                            ...prev,
                                            [teamKey]: { hire: prev[teamKey]?.hire || '', resign: prev[teamKey]?.resign || '', transfer: e.target.value.replace(/[^0-9-]/g, '') }
                                          }))}
                                          className="w-full text-center bg-transparent focus:outline-none text-xs text-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          placeholder="-"
                                        />
                                      </td>
                                    </>
                                  )}
                                  {/* 12월 */}
                                  <td className="px-2 py-1.5 text-center text-xs text-gray-600">
                                    {team.monthly[`${laborYear}12`] || '-'}
                                  </td>
                                  {/* 전월비 (12월 - 11월) */}
                                  {(() => {
                                    const dec = team.monthly[`${laborYear}12`] || 0;
                                    const nov = team.monthly[`${laborYear}11`] || 0;
                                    const momDiff = dec - nov;
                                    return (
                                      <td className={`px-2 py-1.5 text-center text-xs ${momDiff > 0 ? 'text-red-600' : momDiff < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                                        {momDiff > 0 ? `+${momDiff}` : momDiff === 0 ? '0' : momDiff}
                                      </td>
                                    );
                                  })()}
                                  {/* 전년비 */}
                                  {(() => {
                                    const dec25 = team.monthly['202512'] || 0;
                                    const dec24 = team.monthly['202412'] || 0;
                                    const yoyDiff = dec25 - dec24;
                                    return (
                                      <td className={`px-2 py-1.5 text-center text-xs ${yoyDiff > 0 ? 'text-red-600' : yoyDiff < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                                        {yoyDiff > 0 ? `+${yoyDiff}` : yoyDiff === 0 ? '0' : yoyDiff}
                                      </td>
                                    );
                                  })()}
                                  {/* 비고 */}
                                  <td className="px-2 py-1.5 text-center text-xs text-gray-600">
                                    <input
                                      type="text"
                                      value={laborRemarkData[teamKey] || ''}
                                      onChange={(e) => setLaborRemarkData(prev => ({ ...prev, [teamKey]: e.target.value }))}
                                      className="w-full text-left bg-transparent focus:outline-none text-xs text-gray-600"
                                      placeholder=""
                                    />
                                  </td>
                                </tr>
                              );})}
                              {/* 하위 부문 */}
                              {division.subDivisions?.map((subDiv) => {
                                const subDivKey = subDiv.name;
                                return (
                                <React.Fragment key={`${division.divisionName}-sub-${subDiv.name}`}>
                                  {/* 하위 부문 헤더 */}
                                  <tr 
                                    className="border-b border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={(e) => { e.stopPropagation(); toggleSubDivision(subDiv.name); }}
                                  >
                                    <td className="px-3 py-1.5 text-xs font-semibold text-gray-700 sticky left-0 bg-gray-50 hover:bg-gray-100 transition-colors pl-6">
                                      <div className="flex items-center gap-2">
                                        <svg 
                                          className={`w-3 h-3 transition-transform ${expandedSubDivisions.has(subDiv.name) ? 'rotate-90' : ''}`} 
                                          fill="none" 
                                          stroke="currentColor" 
                                          viewBox="0 0 24 24"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                        {subDiv.name}
                                      </div>
                                    </td>
                                    {/* 25년 선택 시 24년 12월 값 */}
                                    {laborYear === '2025' && (
                                      <td className="px-2 py-1.5 text-center text-xs font-semibold text-gray-700">
                                        {subDiv.monthly['202412'] || '-'}
                                      </td>
                                    )}
                                    {/* 1~10월 */}
                                    {laborMonthsExpanded && laborData.months.filter(m => parseInt(m) <= 10).map((month) => {
                                      const key = `${laborYear}${month}`;
                                      const value = subDiv.monthly[key] || 0;
                                      return (
                                        <td key={month} className="px-2 py-1.5 text-center text-xs font-semibold text-gray-700">
                                          {value > 0 ? value : '-'}
                                        </td>
                                      );
                                    })}
                                    {/* 11월 */}
                                    <td className="px-2 py-1.5 text-center text-xs font-semibold text-gray-700">
                                      {subDiv.monthly[`${laborYear}11`] || '-'}
                                    </td>
                                    {/* 입사/퇴사/이동 - 하위 부문 자동 합계 */}
                                    {laborDecemberExpanded && (() => {
                                      const subDivKeys = getTeamKeysForSubDivision(subDiv);
                                      const hireSum = calculateMovementSum(subDivKeys, 'hire');
                                      const resignSum = calculateMovementSum(subDivKeys, 'resign');
                                      const transferSum = calculateMovementSum(subDivKeys, 'transfer');
                                      return (
                                        <>
                                          <td className="px-2 py-1.5 text-center text-xs font-semibold text-gray-700">
                                            {hireSum || '-'}
                                          </td>
                                          <td className="px-2 py-1.5 text-center text-xs font-semibold text-gray-700">
                                            {resignSum || '-'}
                                          </td>
                                          <td className="px-2 py-1.5 text-center text-xs font-semibold text-gray-700">
                                            {transferSum || '-'}
                                          </td>
                                        </>
                                      );
                                    })()}
                                    {/* 12월 */}
                                    <td className="px-2 py-1.5 text-center text-xs font-semibold text-gray-700">
                                      {subDiv.monthly[`${laborYear}12`] || '-'}
                                    </td>
                                    {/* 전월비 (12월 - 11월) */}
                                    {(() => {
                                      const dec = subDiv.monthly[`${laborYear}12`] || 0;
                                      const nov = subDiv.monthly[`${laborYear}11`] || 0;
                                      const momDiff = dec - nov;
                                      return (
                                        <td className={`px-2 py-1.5 text-center text-xs font-semibold ${momDiff > 0 ? 'text-red-600' : momDiff < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                                          {momDiff > 0 ? `+${momDiff}` : momDiff === 0 ? '0' : momDiff}
                                        </td>
                                      );
                                    })()}
                                    {/* 전년비 */}
                                    {(() => {
                                      const dec25 = subDiv.monthly['202512'] || 0;
                                      const dec24 = subDiv.monthly['202412'] || 0;
                                      const yoyDiff = dec25 - dec24;
                                      return (
                                        <td className={`px-2 py-1.5 text-center text-xs font-semibold ${yoyDiff > 0 ? 'text-red-600' : yoyDiff < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                                          {yoyDiff > 0 ? `+${yoyDiff}` : yoyDiff === 0 ? '0' : yoyDiff}
                                        </td>
                                      );
                                    })()}
                                    {/* 비고 */}
                                    <td className="px-2 py-1.5 text-center text-xs text-gray-700">
                                      <input
                                        type="text"
                                        value={laborRemarkData[subDivKey] || ''}
                                        onChange={(e) => setLaborRemarkData(prev => ({ ...prev, [subDivKey]: e.target.value }))}
                                        className="w-full text-left bg-transparent focus:outline-none text-xs text-gray-700"
                                        placeholder=""
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </td>
                                  </tr>
                                  {/* 하위 부문의 팀들 */}
                                  {expandedSubDivisions.has(subDiv.name) && subDiv.teams.map((team, teamIndex) => {
                                    const subTeamKey = `${subDiv.name}-${team.deptNm}`;
                                    return (
                                    <tr key={`${subDiv.name}-${team.deptNm}-${teamIndex}`} className="border-b border-gray-100 hover:bg-gray-50">
                                      <td className="px-3 py-1.5 text-xs text-gray-500 sticky left-0 bg-white pl-12">
                                        {team.deptNm}
                                      </td>
                                      {/* 25년 선택 시 24년 12월 값 */}
                                      {laborYear === '2025' && (
                                        <td className="px-2 py-1.5 text-center text-xs text-gray-500">
                                          {team.monthly['202412'] || '-'}
                                        </td>
                                      )}
                                      {/* 1~10월 */}
                                      {laborMonthsExpanded && laborData.months.filter(m => parseInt(m) <= 10).map((month) => {
                                        const key = `${laborYear}${month}`;
                                        const value = team.monthly[key] || 0;
                                        return (
                                          <td key={month} className="px-2 py-1.5 text-center text-xs text-gray-500">
                                            {value > 0 ? value : '-'}
                                          </td>
                                        );
                                      })}
                                      {/* 11월 */}
                                      <td className="px-2 py-1.5 text-center text-xs text-gray-500">
                                        {team.monthly[`${laborYear}11`] || '-'}
                                      </td>
                                      {/* 입사/퇴사/이동 입력 */}
                                      {laborDecemberExpanded && (
                                        <>
                                          <td className="px-2 py-1.5 text-center text-xs text-gray-500">
                                            <input
                                              type="number"
                                              value={laborMovementData[subTeamKey]?.hire || ''}
                                              onChange={(e) => setLaborMovementData(prev => ({
                                                ...prev,
                                                [subTeamKey]: { hire: e.target.value.replace(/[^0-9-]/g, ''), resign: prev[subTeamKey]?.resign || '', transfer: prev[subTeamKey]?.transfer || '' }
                                              }))}
                                              className="w-full text-center bg-transparent focus:outline-none text-xs text-gray-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                              placeholder="-"
                                            />
                                          </td>
                                          <td className="px-2 py-1.5 text-center text-xs text-gray-500">
                                            <input
                                              type="number"
                                              value={laborMovementData[subTeamKey]?.resign || ''}
                                              onChange={(e) => setLaborMovementData(prev => ({
                                                ...prev,
                                                [subTeamKey]: { hire: prev[subTeamKey]?.hire || '', resign: e.target.value.replace(/[^0-9-]/g, ''), transfer: prev[subTeamKey]?.transfer || '' }
                                              }))}
                                              className="w-full text-center bg-transparent focus:outline-none text-xs text-gray-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                              placeholder="-"
                                            />
                                          </td>
                                          <td className="px-2 py-1.5 text-center text-xs text-gray-500">
                                            <input
                                              type="number"
                                              value={laborMovementData[subTeamKey]?.transfer || ''}
                                              onChange={(e) => setLaborMovementData(prev => ({
                                                ...prev,
                                                [subTeamKey]: { hire: prev[subTeamKey]?.hire || '', resign: prev[subTeamKey]?.resign || '', transfer: e.target.value.replace(/[^0-9-]/g, '') }
                                              }))}
                                              className="w-full text-center bg-transparent focus:outline-none text-xs text-gray-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                              placeholder="-"
                                            />
                                          </td>
                                        </>
                                      )}
                                      {/* 12월 */}
                                      <td className="px-2 py-1.5 text-center text-xs text-gray-500">
                                        {team.monthly[`${laborYear}12`] || '-'}
                                      </td>
                                      {/* 전월비 (12월 - 11월) */}
                                      {(() => {
                                        const dec = team.monthly[`${laborYear}12`] || 0;
                                        const nov = team.monthly[`${laborYear}11`] || 0;
                                        const momDiff = dec - nov;
                                        return (
                                          <td className={`px-2 py-1.5 text-center text-xs ${momDiff > 0 ? 'text-red-600' : momDiff < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                                            {momDiff > 0 ? `+${momDiff}` : momDiff === 0 ? '0' : momDiff}
                                          </td>
                                        );
                                      })()}
                                      {/* 전년비 */}
                                      {(() => {
                                        const dec25 = team.monthly['202512'] || 0;
                                        const dec24 = team.monthly['202412'] || 0;
                                        const yoyDiff = dec25 - dec24;
                                        return (
                                          <td className={`px-2 py-1.5 text-center text-xs ${yoyDiff > 0 ? 'text-red-600' : yoyDiff < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                                            {yoyDiff > 0 ? `+${yoyDiff}` : yoyDiff === 0 ? '0' : yoyDiff}
                                          </td>
                                        );
                                      })()}
                                      {/* 비고 */}
                                      <td className="px-2 py-1.5 text-center text-xs text-gray-500">
                                        <input
                                          type="text"
                                          value={laborRemarkData[subTeamKey] || ''}
                                          onChange={(e) => setLaborRemarkData(prev => ({ ...prev, [subTeamKey]: e.target.value }))}
                                          className="w-full text-left bg-transparent focus:outline-none text-xs text-gray-500"
                                          placeholder=""
                                        />
                                      </td>
                                    </tr>
                                  );})}
                                </React.Fragment>
                              );})}
                            </>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* 인원 현황 코멘트 */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-bold text-blue-700 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    인원 현황 분석
                  </h4>
                  <div className="text-sm text-gray-700 space-y-2">
                    {(() => {
                      const dec2024 = laborData.yearlyTotals['2024']?.['12'] || 0;
                      const dec2025 = laborData.yearlyTotals['2025']?.['12'] || 0;
                      const diff = dec2025 - dec2024;
                      const diffPercent = dec2024 > 0 ? ((diff / dec2024) * 100).toFixed(1) : 0;
                      
                      // 대분류별 증감 계산
                      const categoryChanges = laborData.divisions.map(div => {
                        const prev = div.monthly['202412'] || 0;
                        const curr = div.monthly['202512'] || 0;
                        return { name: div.divisionName, prev, curr, diff: curr - prev };
                      });
                      
                      // 하위 부문별 상세 증감 계산
                      const subDivisionChanges: { name: string; prev: number; curr: number; diff: number; parent: string }[] = [];
                      laborData.divisions.forEach(div => {
                        div.subDivisions?.forEach(subDiv => {
                          const prev = subDiv.monthly['202412'] || 0;
                          const curr = subDiv.monthly['202512'] || 0;
                          if (prev > 0 || curr > 0) {
                            subDivisionChanges.push({ 
                              name: subDiv.name, 
                              prev, 
                              curr, 
                              diff: curr - prev,
                              parent: div.divisionName
                            });
                          }
                        });
                      });
                      
                      const increasedSubs = subDivisionChanges.filter(d => d.diff > 0).sort((a, b) => b.diff - a.diff);
                      const decreasedSubs = subDivisionChanges.filter(d => d.diff < 0).sort((a, b) => a.diff - b.diff);
                      
                      return (
                        <>
                          <div className="mb-3">
                            <strong>📊 연간 비교:</strong> 2024년 12월({dec2024}명) 대비 2025년 12월({dec2025}명) 기준, 
                            전체 인원이 <span className={diff >= 0 ? 'text-red-600 font-semibold' : 'text-blue-600 font-semibold'}>
                              {diff >= 0 ? `+${diff}명 (${diffPercent}% 증가)` : `${diff}명 (${Math.abs(Number(diffPercent))}% 감소)`}
                            </span> 했습니다.
                          </div>
                          
                          {/* 대분류 요약 - 클릭하면 아래에 펼침 */}
                          <div className="mb-3 p-2 bg-white rounded border">
                            <strong>부문별 현황</strong>
                            <div className="mt-2 space-y-2">
                              {categoryChanges.map(d => {
                                const division = laborData.divisions.find(div => div.divisionName === d.name);
                                const isExpanded = laborDetailPopup?.divisionName === d.name;
                                
                                // 하위 부문 증감 계산
                                const subDivChanges: { name: string; prev: number; curr: number; diff: number }[] = [];
                                if (division) {
                                  division.teams?.forEach(team => {
                                    const prev = team.monthly['202412'] || 0;
                                    const curr = team.monthly['202512'] || 0;
                                    if (prev > 0 || curr > 0) {
                                      subDivChanges.push({ name: team.deptNm, prev, curr, diff: curr - prev });
                                    }
                                  });
                                  division.subDivisions?.forEach(subDiv => {
                                    const subPrev = subDiv.monthly['202412'] || 0;
                                    const subCurr = subDiv.monthly['202512'] || 0;
                                    if (subPrev > 0 || subCurr > 0) {
                                      subDivChanges.push({ name: subDiv.name, prev: subPrev, curr: subCurr, diff: subCurr - subPrev });
                                    }
                                  });
                                }
                                const increased = subDivChanges.filter(t => t.diff > 0).sort((a, b) => b.diff - a.diff);
                                const decreased = subDivChanges.filter(t => t.diff < 0).sort((a, b) => a.diff - b.diff);
                                
                                return (
                                  <div key={d.name}>
                                    {/* 대분류 헤더 */}
                                    <div 
                                      className={`flex items-center justify-between p-2 rounded cursor-pointer transition-all ${isExpanded ? 'bg-blue-100' : 'bg-gray-50 hover:bg-gray-100'}`}
                                      onClick={() => {
                                        if (isExpanded) {
                                          setLaborDetailPopup(null);
                                        } else {
                                          setLaborDetailPopup({ divisionName: d.name, data: { prev: d.prev, curr: d.curr, diff: d.diff, increased, decreased } });
                                        }
                                      }}
                                    >
                                      <div className="flex items-center gap-2">
                                        <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                        <span className="font-medium text-gray-800">{d.name}</span>
                                        <span className="text-xs text-gray-500">{d.prev}명 → {d.curr}명</span>
                                      </div>
                                      <span className={`text-sm font-bold ${d.diff > 0 ? 'text-red-600' : d.diff < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                                        {d.diff > 0 ? `+${d.diff}` : d.diff === 0 ? '±0' : d.diff}
                                      </span>
                                    </div>
                                    
                                    {/* 펼침 상세 */}
                                    {isExpanded && (
                                      <div className="ml-5 mt-1 p-2 bg-gray-50 rounded text-xs space-y-0.5">
                                        {increased.map((t, i) => (
                                          <div key={`inc-${i}`} className="text-red-600">
                                            • {t.name}: {t.prev}명 → {t.curr}명 <strong>(+{t.diff})</strong>
                                          </div>
                                        ))}
                                        {decreased.map((t, i) => (
                                          <div key={`dec-${i}`} className="text-blue-600">
                                            • {t.name}: {t.prev}명 → {t.curr}명 <strong>({t.diff})</strong>
                                          </div>
                                        ))}
                                        {increased.length === 0 && decreased.length === 0 && (
                                          <div className="text-gray-400">변동 없음</div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          
                        </>
                      );
                    })()}
                  </div>
                  
                  {/* 주요 시사점 (AI 분석 + 편집 가능) */}
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <h5 
                        className={`text-sm font-bold cursor-pointer transition-colors ${laborInsightEditMode ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'}`}
                        onClick={async () => {
                          if (laborInsightEditMode) {
                            // 저장 모드 - Redis에 저장
                            try {
                              await fetch('/api/labor-insight', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ insight: laborInsight })
                              });
                              setLaborInsightEditMode(false);
                            } catch (error) {
                              console.error('시사점 저장 실패:', error);
                            }
                          } else {
                            // 편집 모드
                            setLaborInsightEditMode(true);
                          }
                        }}
                      >
                        주요 시사점
                      </h5>
                      
                      {!laborInsightEditMode && (
                        <button
                          onClick={async () => {
                            setLaborInsightLoading(true);
                            try {
                              // AI 분석을 위한 데이터 준비
                              const analysisData = {
                                year2024: laborData.yearlyTotals['2024'],
                                year2025: laborData.yearlyTotals['2025'],
                                divisions: laborData.divisions.map(div => ({
                                  name: div.divisionName,
                                  prev: div.monthly['202412'] || 0,
                                  curr: div.monthly['202512'] || 0,
                                  diff: (div.monthly['202512'] || 0) - (div.monthly['202412'] || 0)
                                }))
                              };
                              
                              const response = await fetch('/api/ai-insight', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  type: 'labor',
                                  data: analysisData
                                })
                              });
                              
                              if (response.ok) {
                                const result = await response.json();
                                setLaborInsight(result.insight);
                                // Redis에 저장
                                await fetch('/api/labor-insight', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ insight: result.insight })
                                });
                              } else {
                                alert('AI 분석 요청에 실패했습니다.');
                              }
                            } catch (error) {
                              console.error('AI insight error:', error);
                              alert('AI 분석 중 오류가 발생했습니다.');
                            } finally {
                              setLaborInsightLoading(false);
                            }
                          }}
                          disabled={laborInsightLoading}
                          className="px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          {laborInsightLoading ? (
                            <>
                              <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              분석 중...
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              🤖 AI 분석 요청
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    
                    {laborInsightEditMode ? (
                      <div className="space-y-2">
                        <textarea
                          value={laborInsight}
                          onChange={(e) => setLaborInsight(e.target.value)}
                          placeholder="주요 시사점을 작성하세요...&#10;&#10;예시:&#10;• 마케팅본부 인원 증가는 신규 브랜드 런칭 대응&#10;• 해외사업 확대에 따른 인력 충원&#10;• 경영지원 부문은 업무 효율화로 인력 최적화 진행 중"
                          className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={6}
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={async () => {
                              setLaborInsightEditMode(false);
                              // Redis에서 다시 불러오기
                              try {
                                const response = await fetch('/api/labor-insight');
                                const result = await response.json();
                                if (result.success && result.data) {
                                  setLaborInsight(result.data);
                                }
                              } catch (error) {
                                console.error('시사점 불러오기 실패:', error);
                              }
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            취소
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await fetch('/api/labor-insight', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ insight: laborInsight })
                                });
                                setLaborInsightEditMode(false);
                              } catch (error) {
                                console.error('시사점 저장 실패:', error);
                              }
                            }}
                            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="p-3 bg-white rounded-lg border border-gray-200 min-h-[80px] cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setLaborInsightEditMode(true)}
                      >
                        {laborInsight ? (
                          <div 
                            className="text-sm text-gray-700 whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{ __html: formatMarkdownBold(laborInsight) }}
                          />
                        ) : (
                          <div className="text-sm text-gray-400 italic">
                            <p>🤖 AI 분석 요청 버튼을 클릭하여 자동 분석을 받거나,</p>
                            <p>이 영역을 클릭하여 직접 시사점을 작성하세요.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* 인당인건비 섹션 */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-bold text-blue-700 mb-2">인당인건비</h4>
                  <div className="text-[10px] text-gray-500 mb-3">
                    * 인건비 = 급료와임금 + 제수당 + 잡급 + 퇴직급여충당금전입액 + 복리후생비(의료/고용/산재보험) + 국민연금
                  </div>
                  
                  {laborCostMonthly.length > 0 ? (() => {
                    const chartData = laborCostMonthly.map(d => ({
                      month: d.month,
                      '24년': d.headcount2024 > 0 ? Math.round((d.cost2024 / d.headcount2024) * 10) / 10 : 0,
                      '25년': d.headcount2025 > 0 ? Math.round((d.cost2025 / d.headcount2025) * 10) / 10 : 0,
                    }));
                    const dec = laborCostMonthly.find(d => d.month === '12월');
                    const perPerson24 = dec && dec.headcount2024 > 0 ? dec.cost2024 / dec.headcount2024 : 0;
                    const perPerson25 = dec && dec.headcount2025 > 0 ? dec.cost2025 / dec.headcount2025 : 0;
                    const diff = perPerson25 - perPerson24;
                    const diffPct = perPerson24 > 0 ? (diff / perPerson24 * 100).toFixed(1) : '0';
                    
                    return (
                      <>
                        {/* 12월 기준 요약 */}
                        <div className="mb-3 text-sm text-gray-700">
                          <span className="text-gray-500">12월 기준 전체:</span>{' '}
                          <span className="text-gray-600">24년 <strong>{perPerson24.toFixed(1)}</strong></span>
                          <span className="text-gray-400 mx-1">→</span>
                          <span className="text-gray-600">25년 <strong>{perPerson25.toFixed(1)}</strong></span>
                          <span className={`ml-2 font-semibold ${diff >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                            {diff >= 0 ? '+' : ''}{diff.toFixed(1)} ({diffPct}%)
                          </span>
                          <span className="text-gray-400 text-xs ml-1">백만원/명</span>
                        </div>
                        
                        {/* 그래프 */}
                        <div className="h-36 bg-white rounded border p-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 15, left: -10, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={['dataMin - 0.5', 'dataMax + 0.5']} width={35} />
                              <Tooltip 
                                contentStyle={{ fontSize: 11, padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                                formatter={(value: number, name: string) => [`${value.toFixed(1)} 백만원/명`, name]}
                              />
                              <Line type="monotone" dataKey="24년" stroke="#9ca3af" strokeWidth={1.5} dot={{ r: 2, fill: '#9ca3af' }} activeDot={{ r: 3 }} />
                              <Line type="monotone" dataKey="25년" stroke="#2563eb" strokeWidth={2} dot={{ r: 2, fill: '#2563eb' }} activeDot={{ r: 4 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        
                        {/* 범례 */}
                        <div className="mt-1.5 flex justify-center gap-6 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-gray-400 inline-block"></span> 24년</span>
                          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-600 inline-block"></span> 25년</span>
                        </div>
                        
                        {/* 부문별 인당인건비 (12월 기준) - 클릭하여 펼치기 */}
                        {laborCostByCategory.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-blue-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-gray-600">부문별 인당인건비 (12월 기준)</span>
                              <span className="text-[10px] text-gray-400">전월비 / 전년비</span>
                            </div>
                            <div className="p-2 bg-white rounded border space-y-1">
                              {laborCostByCategory.map(cat => {
                                // 해당 부문의 인원수 찾기
                                const divData = laborData.divisions.find(d => d.divisionName === cat.name);
                                const hc24 = divData?.monthly['202412'] || 0;
                                const hc25 = divData?.monthly['202512'] || 0;
                                const hcPrev = divData?.monthly['202511'] || 0; // 전월 인원수
                                const pp24 = hc24 > 0 ? cat.cost2024 / hc24 : 0;
                                const pp25 = hc25 > 0 ? cat.cost2025 / hc25 : 0;
                                const ppPrev = hcPrev > 0 ? (cat.costPrev || 0) / hcPrev : 0; // 전월 인당인건비
                                const yoyDiff = pp25 - pp24; // 전년비
                                const momDiff = pp25 - ppPrev; // 전월비
                                const isExpanded = laborDetailPopup?.divisionName === `cost-${cat.name}`;
                                
                                return (
                                  <div key={cat.name}>
                                    <div 
                                      className="flex items-center justify-between py-1 cursor-pointer hover:bg-gray-50 px-1 rounded"
                                      onClick={() => setLaborDetailPopup(isExpanded ? null : { divisionName: `cost-${cat.name}`, data: divData?.subDivisions || [] })}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-400">{isExpanded ? '∨' : '>'}</span>
                                        <span className="text-xs font-medium text-gray-700">{cat.name}</span>
                                        <span className="text-xs text-gray-400">{hc24}명 → {hc25}명</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="text-gray-500">{pp24.toFixed(1)} → {pp25.toFixed(1)}</span>
                                        <span className={`font-semibold ${momDiff >= 0 ? 'text-red-500' : 'text-blue-500'}`} title="전월비">
                                          {momDiff >= 0 ? '+' : ''}{momDiff.toFixed(1)}
                                        </span>
                                        <span className="text-gray-300">/</span>
                                        <span className={`font-semibold ${yoyDiff >= 0 ? 'text-red-500' : 'text-blue-500'}`} title="전년비">
                                          {yoyDiff >= 0 ? '+' : ''}{yoyDiff.toFixed(1)}
                                        </span>
                                      </div>
                                    </div>
                                    {/* 중분류 펼침 */}
                                    {isExpanded && divData?.subDivisions && (
                                      <div className="ml-6 pl-2 border-l border-gray-200 mt-1 space-y-0.5">
                                        {divData.subDivisions.map(subDiv => {
                                          const subHc24 = subDiv.monthly['202412'] || 0;
                                          const subHc25 = subDiv.monthly['202512'] || 0;
                                          const subHcPrev = subDiv.monthly['202511'] || 0; // 전월 인원수
                                          // 실제 중분류 인건비 데이터 사용 (대분류+중분류로 매칭)
                                          const actualSubCost = laborCostBySubDiv.find(s => s.name === subDiv.name && s.category === cat.name);
                                          const subCost24 = actualSubCost?.cost2024 || 0;
                                          const subCost25 = actualSubCost?.cost2025 || 0;
                                          const subCostPrev = actualSubCost?.costPrev || 0; // 전월 인건비
                                          
                                          const subPp24 = subHc24 > 0 ? subCost24 / subHc24 : 0;
                                          const subPp25 = subHc25 > 0 ? subCost25 / subHc25 : 0;
                                          const subPpPrev = subHcPrev > 0 ? subCostPrev / subHcPrev : 0; // 전월 인당인건비
                                          
                                          const yoyDiff = subPp25 - subPp24; // 전년비 (YoY)
                                          const momDiff = subPp25 - subPpPrev; // 전월비 (MoM)
                                          const hcChange = subHc25 - subHc24;
                                          
                                          const hasTeams = subDiv.teams && subDiv.teams.length > 0;
                                          const isSubExpanded = laborDetailPopup?.divisionName === `team-${cat.name}-${subDiv.name}`;
                                          
                                          return (
                                            <div key={subDiv.name}>
                                              <div 
                                                className={`flex items-center justify-between py-0.5 text-xs ${hasTeams ? 'cursor-pointer hover:bg-gray-50 rounded px-1' : ''}`}
                                                onClick={() => hasTeams && setLaborDetailPopup(isSubExpanded ? null : { divisionName: `team-${cat.name}-${subDiv.name}`, data: subDiv.teams })}
                                              >
                                                <div className="flex items-center gap-2">
                                                  {hasTeams && <span className="text-gray-400 text-[10px]">{isSubExpanded ? '∨' : '>'}</span>}
                                                  <span className="text-gray-600">{subDiv.name}</span>
                                                  <span className="text-gray-400">{subHc24}명 → {subHc25}명</span>
                                                  {hcChange !== 0 && (
                                                    <span className={`${hcChange > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                      ({hcChange > 0 ? '+' : ''}{hcChange})
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-gray-500">{subPp24.toFixed(1)} → {subPp25.toFixed(1)}</span>
                                                  <span className={`font-medium ${momDiff >= 0 ? 'text-red-500' : 'text-blue-500'}`} title="전월비">
                                                    {momDiff >= 0 ? '+' : ''}{momDiff.toFixed(1)}
                                                  </span>
                                                  <span className="text-gray-300">/</span>
                                                  <span className={`font-medium ${yoyDiff >= 0 ? 'text-red-500' : 'text-blue-500'}`} title="전년비">
                                                    {yoyDiff >= 0 ? '+' : ''}{yoyDiff.toFixed(1)}
                                                  </span>
                                                </div>
                                              </div>
                                              {/* 팀 레벨 펼침 */}
                                              {isSubExpanded && hasTeams && (
                                                <div className="ml-4 pl-2 border-l border-gray-100 mt-0.5 space-y-0.5">
                                                  {subDiv.teams.map((team: any) => {
                                                    const teamHc24 = team.monthly?.['202412'] || 0;
                                                    const teamHc25 = team.monthly?.['202512'] || 0;
                                                    const teamHcChange = teamHc25 - teamHc24;
                                                    // 팀 레벨 인당인건비는 중분류 인당인건비와 동일하게 표시 (개별 팀 인건비 데이터 없음)
                                                    return (
                                                      <div key={team.deptNm} className="flex items-center justify-between py-0.5 text-[11px]">
                                                        <div className="flex items-center gap-2">
                                                          <span className="text-gray-500">{team.deptNm}</span>
                                                          <span className="text-gray-400">{teamHc24}명 → {teamHc25}명</span>
                                                          {teamHcChange !== 0 && (
                                                            <span className={`${teamHcChange > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                              ({teamHcChange > 0 ? '+' : ''}{teamHcChange})
                                                            </span>
                                                          )}
                                                        </div>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })() : (
                    <div className="text-gray-500 text-sm py-4 text-center">데이터 로딩 중...</div>
                  )}
                </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-lg font-medium mb-2">데이터를 불러올 수 없습니다</p>
                  <button
                    onClick={loadLaborData}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    다시 시도
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* IT수수료 탭 콘텐츠 */}
      {mainTab === 'it' && (
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">월별 IT수수료 현황</CardTitle>
                  <p className="text-sm text-muted-foreground">계정별 월별 IT수수료 (단위: 백만원)</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setItExpenseYear('2024'); if (itMaintenanceExpanded) loadItMaintenanceData('2024'); }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      itExpenseYear === '2024'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    2024년
                  </button>
                  <button
                    onClick={() => { setItExpenseYear('2025'); if (itMaintenanceExpanded) loadItMaintenanceData('2025'); }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      itExpenseYear === '2025'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    2025년
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {itExpenseLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <svg className="w-8 h-8 animate-spin mb-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <p className="text-sm font-medium">데이터를 불러오는 중...</p>
                </div>
              ) : itExpenseData ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="px-2 py-2 text-left text-xs font-bold text-gray-900 bg-gray-100 sticky left-0 min-w-[200px]">계정</th>
                        {itExpenseData.months.map(month => (
                          <th key={month} className="px-2 py-2 text-center text-xs font-bold text-gray-900 bg-gray-100 min-w-[60px]">
                            {parseInt(month)}월
                          </th>
                        ))}
                        <th className="px-2 py-2 text-center text-xs font-bold text-gray-900 bg-gray-100 min-w-[70px]">합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 전체 합계 - 25년 */}
                      <tr className="border-b border-gray-200 bg-blue-50 font-bold">
                        <td className="px-2 py-2 text-sm font-bold text-gray-900 sticky left-0 bg-blue-50">IT수수료 합계 (25년)</td>
                        {itExpenseData.months.map(month => {
                          const val = itExpenseData.totals.monthly2025[month] || 0;
                          return (
                            <td key={month} className="px-2 py-2 text-right text-sm font-bold text-blue-600">
                              {val.toLocaleString()}
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-right text-sm font-bold text-blue-600">
                          {Object.values(itExpenseData.totals.monthly2025).reduce((a, b) => a + b, 0).toLocaleString()}
                        </td>
                      </tr>
                      
                      {/* 전체 합계 - 24년 */}
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <td className="px-2 py-2 text-sm font-medium text-gray-600 sticky left-0 bg-gray-50">IT수수료 합계 (24년)</td>
                        {itExpenseData.months.map(month => {
                          const val = itExpenseData.totals.monthly2024[month] || 0;
                          return (
                            <td key={month} className="px-2 py-2 text-right text-sm text-gray-600">
                              {val.toLocaleString()}
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-right text-sm font-medium text-gray-600">
                          {Object.values(itExpenseData.totals.monthly2024).reduce((a, b) => a + b, 0).toLocaleString()}
                        </td>
                      </tr>
                      
                      {/* 전체 합계 - YOY */}
                      <tr className="border-b-2 border-gray-300 bg-blue-100">
                        <td className="px-2 py-2 text-sm font-bold text-gray-900 sticky left-0 bg-blue-100">YOY</td>
                        {itExpenseData.months.map(month => {
                          const val2024 = itExpenseData.totals.monthly2024[month] || 0;
                          const val2025 = itExpenseData.totals.monthly2025[month] || 0;
                          const yoy = val2024 > 0 ? (val2025 / val2024 * 100) : 0;
                          return (
                            <td key={month} className="px-2 py-2 text-right text-sm font-bold">
                              <span className={yoy >= 100 ? 'text-red-600' : 'text-blue-600'}>
                                {yoy.toFixed(1)}%
                              </span>
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-right text-sm font-bold">
                          {(() => {
                            const total2024 = Object.values(itExpenseData.totals.monthly2024).reduce((a, b) => a + b, 0);
                            const total2025 = Object.values(itExpenseData.totals.monthly2025).reduce((a, b) => a + b, 0);
                            const yoy = total2024 > 0 ? (total2025 / total2024 * 100) : 0;
                            return (
                              <span className={yoy >= 100 ? 'text-red-600' : 'text-blue-600'}>
                                {yoy.toFixed(1)}%
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                      
                      {/* 중분류별 */}
                      {itExpenseData.categories.map(category => (
                        <React.Fragment key={category.id}>
                          {/* 중분류 헤더 */}
                          <tr 
                            className="border-b border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100"
                            onClick={() => {
                              setExpandedItCategories(prev => {
                                const next = new Set(prev);
                                if (next.has(category.id)) {
                                  next.delete(category.id);
                                } else {
                                  next.add(category.id);
                                }
                                return next;
                              });
                              // SW상각비 클릭 시 유무형자산 섹션 토글
                              if (category.name === 'SW상각비') {
                                setSwCapexExpanded(prev => !prev);
                              }
                            }}
                          >
                            <td className="px-2 py-2 text-sm font-semibold text-gray-800 sticky left-0 bg-gray-50">
                              <span className="mr-2">
                                {category.name === 'SW상각비' 
                                  ? (expandedItCategories.has(category.id) || swCapexExpanded ? '▼' : '▶')
                                  : (expandedItCategories.has(category.id) ? '▼' : '▶')}
                              </span>
                              {category.name}
                            </td>
                            {itExpenseData.months.map(month => {
                              const val = itExpenseYear === '2024' 
                                ? category.monthly2024[month] || 0
                                : category.monthly2025[month] || 0;
                              return (
                                <td key={month} className="px-2 py-2 text-right text-sm font-semibold text-gray-700">
                                  {val.toLocaleString()}
                                </td>
                              );
                            })}
                            <td className="px-2 py-2 text-right text-sm font-semibold text-blue-600">
                              {Object.values(itExpenseYear === '2024' ? category.monthly2024 : category.monthly2025)
                                .reduce((a, b) => a + b, 0).toLocaleString()}
                            </td>
                          </tr>
                          
                          {/* 계정 상세 */}
                          {expandedItCategories.has(category.id) && category.accounts.map(account => {
                            const isMaintenanceAccount = account.accountName === '지급수수료_IT유지보수비';
                            const isUsageAccount = account.accountName === '지급수수료_IT사용료';
                            const isClickable = isMaintenanceAccount || isUsageAccount;
                            return (
                              <tr 
                                key={account.id} 
                                className={`border-b border-gray-100 hover:bg-gray-50 ${isClickable ? 'cursor-pointer' : ''}`}
                                onClick={() => {
                                  if (isMaintenanceAccount) {
                                    setItMaintenanceExpanded(prev => !prev);
                                    if (!itMaintenanceData) {
                                      loadItMaintenanceData(itExpenseYear);
                                    }
                                  }
                                  if (isUsageAccount) {
                                    setItUsageExpanded(prev => !prev);
                                    if (!itUsageData) {
                                      loadItUsageData(itExpenseYear);
                                    }
                                  }
                                }}
                              >
                                <td className="px-2 py-1.5 text-xs text-gray-600 sticky left-0 bg-white pl-8">
                                  {isMaintenanceAccount && (
                                    <span className="mr-1 text-gray-400">{itMaintenanceExpanded ? '▼' : '▶'}</span>
                                  )}
                                  {isUsageAccount && (
                                    <span className="mr-1 text-gray-400">{itUsageExpanded ? '▼' : '▶'}</span>
                                  )}
                                  {account.accountName}
                                </td>
                                {itExpenseData.months.map(month => {
                                  const val = itExpenseYear === '2024' 
                                    ? account.monthly2024[month] || 0
                                    : account.monthly2025[month] || 0;
                                  return (
                                    <td key={month} className="px-2 py-1.5 text-right text-xs text-gray-600">
                                      {val.toLocaleString()}
                                    </td>
                                  );
                                })}
                                <td className="px-2 py-1.5 text-right text-xs font-medium text-blue-600">
                                  {Object.values(itExpenseYear === '2024' ? account.monthly2024 : account.monthly2025)
                                    .reduce((a, b) => a + b, 0).toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <p className="text-sm">데이터를 불러올 수 없습니다.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* IT사용료 상세 - 지급수수료_IT사용료 클릭 시에만 표시 */}
          {itUsageExpanded && (
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">IT사용료 상세 분석</CardTitle>
                  <p className="text-sm text-muted-foreground">부서별 월별 IT사용료 현황 (단위: 백만원)</p>
                </div>
                <div className="flex gap-2">
                  {allUsageExpanded ? (
                    <button
                      onClick={collapseAllUsageTeams}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200"
                    >
                      모두접기
                    </button>
                  ) : (
                    <button
                      onClick={expandAllUsageTeams}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200"
                    >
                      모두펼치기
                    </button>
                  )}
                  <button
                    onClick={() => { setItUsageExpanded(false); collapseAllUsageTeams(); }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    접기
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {itUsageLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : itUsageData ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="px-2 py-2 text-left text-xs font-bold text-gray-900 bg-gray-50 sticky left-0 min-w-[150px]">부서</th>
                        {itUsageData.months.map(m => (
                          <th key={m} className="px-2 py-2 text-right text-xs font-bold text-gray-900 bg-gray-50 min-w-[50px]">
                            {parseInt(m)}월
                          </th>
                        ))}
                        <th className="px-2 py-2 text-right text-xs font-bold text-blue-600 bg-gray-50 min-w-[60px]">연합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 25년 합계 */}
                      <tr className="border-b border-gray-200 bg-blue-50 font-bold">
                        <td className="px-2 py-2 text-xs font-bold text-blue-700 sticky left-0 bg-blue-50">
                          IT사용료 합계 (25년)
                        </td>
                        {itUsageData.months.map(m => (
                          <td key={m} className="px-2 py-2 text-right text-xs font-bold text-blue-700">
                            {(itUsageData.monthlyTotals[m] || 0).toLocaleString()}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-right text-xs font-bold text-blue-700">
                          {Object.values(itUsageData.monthlyTotals).reduce((a, b) => a + b, 0).toLocaleString()}
                        </td>
                      </tr>
                      {/* 24년 합계 */}
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <td className="px-2 py-2 text-xs font-medium text-gray-600 sticky left-0 bg-gray-50">
                          IT사용료 합계 (24년)
                        </td>
                        {itUsageData.months.map(m => (
                          <td key={m} className="px-2 py-2 text-right text-xs text-gray-600">
                            {(itUsageData.monthlyTotals2024?.[m] || 0).toLocaleString()}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-right text-xs font-medium text-gray-600">
                          {Object.values(itUsageData.monthlyTotals2024 || {}).reduce((a, b) => a + b, 0).toLocaleString()}
                        </td>
                      </tr>
                      {/* YOY */}
                      <tr className="border-b-2 border-gray-300 bg-gray-50">
                        <td className="px-2 py-2 text-xs font-medium text-gray-600 sticky left-0 bg-gray-50">
                          YOY
                        </td>
                        {itUsageData.months.map(m => {
                          const val25 = itUsageData.monthlyTotals[m] || 0;
                          const val24 = itUsageData.monthlyTotals2024?.[m] || 0;
                          const yoy = val24 > 0 ? (val25 / val24 * 100) : 0;
                          const isOver100 = yoy > 100;
                          return (
                            <td key={m} className={`px-2 py-2 text-right text-xs font-medium ${isOver100 ? 'text-red-500' : 'text-blue-500'}`}>
                              {val24 > 0 ? `${yoy.toFixed(1)}%` : '-'}
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-right text-xs font-medium text-gray-600">
                          {(() => {
                            const total25 = Object.values(itUsageData.monthlyTotals).reduce((a, b) => a + b, 0);
                            const total24 = Object.values(itUsageData.monthlyTotals2024 || {}).reduce((a, b) => a + b, 0);
                            const yoy = total24 > 0 ? (total25 / total24 * 100) : 0;
                            return total24 > 0 ? `${yoy.toFixed(1)}%` : '-';
                          })()}
                        </td>
                      </tr>
                      {/* 부서별 상세 */}
                      {itUsageData.items.map((item, idx) => {
                        const isAiUsage = item.text === '임직원 AI사용료';
                        
                        return (
                        <React.Fragment key={idx}>
                          {isAiUsage ? (
                            <>
                              {/* 임직원 AI사용료 행 - 접기 기능 없음 */}
                              <tr className="border-b border-gray-200 bg-yellow-50">
                                <td className="px-2 py-1.5 text-xs font-medium text-yellow-800 sticky left-0 bg-yellow-50">
                                  {item.text}
                                </td>
                                {itUsageData.months.map(m => (
                                  <td key={m} className="px-2 py-1.5 text-right text-xs font-medium text-yellow-800">
                                    {item.monthly[m] && item.monthly[m] > 0 ? item.monthly[m].toLocaleString() : '-'}
                                  </td>
                                ))}
                                <td className="px-2 py-1.5 text-right text-xs font-bold text-yellow-800">
                                  {item.total.toLocaleString()}
                                </td>
                              </tr>
                              {/* 임직원 수 행 - laborData에서 가져옴 */}
                              <tr className="border-b border-gray-100 bg-yellow-50/50">
                                <td className="px-2 py-1 text-xs text-gray-500 sticky left-0 bg-yellow-50/50 pl-4">
                                  공통사업부 인원수
                                </td>
                                {itUsageData.months.map(m => {
                                  // laborData.yearlyTotals는 '01', '02' 형식
                                  const headcount = laborData?.yearlyTotals?.['2025']?.[m] || 0;
                                  return (
                                    <td key={m} className="px-2 py-1 text-right text-xs text-gray-500">
                                      {headcount > 0 ? `${headcount}명` : '-'}
                                    </td>
                                  );
                                })}
                                <td className="px-2 py-1 text-right text-xs font-medium text-gray-600">
                                  {(() => {
                                    // 월별 인원수 합계 / 월 수 = 평균 인원수
                                    const yearlyTotals = laborData?.yearlyTotals?.['2025'] || {};
                                    const headcountValues = Object.values(yearlyTotals) as number[];
                                    const totalHeadcount = headcountValues.reduce((a, b) => a + b, 0);
                                    const monthCount = headcountValues.length || 12;
                                    const avgHeadcount = Math.round(totalHeadcount / monthCount);
                                    return avgHeadcount > 0 ? `${avgHeadcount}명` : '-';
                                  })()}
                                </td>
                              </tr>
                              {/* 인당 사용료 행 (만원 단위) */}
                              <tr className="border-b-2 border-yellow-200 bg-yellow-50/50">
                                <td className="px-2 py-1 text-xs text-gray-500 sticky left-0 bg-yellow-50/50 pl-4">
                                  인당 사용료 (만원)
                                </td>
                                {itUsageData.months.map(m => {
                                  const headcount = laborData?.yearlyTotals?.['2025']?.[m] || 0;
                                  const perPerson = item.monthly[m] && item.monthly[m] > 0 && headcount > 0
                                    ? Math.round((item.monthly[m] * 100) / headcount)  // 백만원 -> 만원 (x100), /인원
                                    : 0;
                                  return (
                                    <td key={m} className="px-2 py-1 text-right text-xs text-gray-500">
                                      {perPerson > 0 ? perPerson.toLocaleString() : '-'}
                                    </td>
                                  );
                                })}
                                <td className="px-2 py-1 text-right text-xs font-medium text-gray-600">
                                  {(() => {
                                    // 연합계 인당 사용료 = (연합계 금액 / 평균 인원수 * 100) / 12 = 월평균 인당 사용료
                                    const yearlyTotals = laborData?.yearlyTotals?.['2025'] || {};
                                    const headcountValues = Object.values(yearlyTotals) as number[];
                                    const totalHeadcount = headcountValues.reduce((a, b) => a + b, 0);
                                    const monthCount = headcountValues.length || 12;
                                    const avgHeadcount = totalHeadcount / monthCount;
                                    return avgHeadcount > 0 ? Math.round((item.total * 100) / avgHeadcount / 12).toLocaleString() : '-';
                                  })()}
                                </td>
                              </tr>
                            </>
                          ) : (
                          <tr 
                            className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                            onClick={() => {
                              if (expandedUsageTeam === item.text) {
                                setExpandedUsageTeam(null);
                                setTeamUsageDetails([]);
                              } else {
                                setExpandedUsageTeam(item.text);
                                loadTeamUsageDetails(itExpenseYear, item.text);
                              }
                            }}
                          >
                            <td className="px-2 py-1.5 text-xs text-gray-700 sticky left-0 bg-white" title={item.text}>
                              <span className="mr-1 text-gray-400">{(expandedUsageTeam === item.text || allUsageExpanded) ? '▼' : '▶'}</span>
                              {item.text}
                            </td>
                            {itUsageData.months.map(m => (
                              <td key={m} className="px-2 py-1.5 text-right text-xs text-gray-600">
                                {item.monthly[m] && item.monthly[m] > 0 ? item.monthly[m].toLocaleString() : '-'}
                              </td>
                            ))}
                            <td className="px-2 py-1.5 text-right text-xs font-medium text-blue-600">
                              {item.total.toLocaleString()}
                            </td>
                          </tr>
                          )}
                          {/* 팀 상세 내역 드릴다운 - 임직원 AI사용료 제외 */}
                          {!isAiUsage && (expandedUsageTeam === item.text || allUsageExpanded) && (
                            (expandedUsageTeam === item.text && teamUsageDetailsLoading) ? (
                              <tr>
                                <td colSpan={14} className="bg-gray-50 py-3 text-center">
                                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                </td>
                              </tr>
                            ) : (
                              (allUsageExpanded ? allUsageTeamDetails[item.text] : teamUsageDetails)?.length > 0 ? (
                                (allUsageExpanded ? allUsageTeamDetails[item.text] : teamUsageDetails).map((detail, dIdx) => (
                                  <tr key={`detail-${dIdx}`} className="border-b border-gray-100 bg-gray-50">
                                    <td className="px-2 py-1 text-xs text-gray-500 sticky left-0 bg-gray-50 pl-6" title={detail.text}>
                                      {detail.text.length > 20 ? detail.text.slice(0, 20) + '...' : detail.text}
                                    </td>
                                    {itUsageData?.months.map(m => (
                                      <td key={m} className="px-2 py-1 text-right text-xs text-gray-500">
                                        {detail.monthly && detail.monthly[m] && detail.monthly[m] > 0 ? detail.monthly[m].toLocaleString() : '-'}
                                      </td>
                                    ))}
                                    <td className="px-2 py-1 text-right text-xs text-blue-500 font-medium">
                                      {detail.total.toLocaleString()}
                                    </td>
                                  </tr>
                                ))
                              ) : null
                            )
                          )}
                        </React.Fragment>
                      );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <p className="text-sm">데이터를 불러올 수 없습니다.</p>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* IT유지보수비 상세 - 지급수수료_IT유지보수비 클릭 시에만 표시 */}
          {itMaintenanceExpanded && (
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">IT유지보수비 상세 분석</CardTitle>
                  <p className="text-sm text-muted-foreground">부서별 월별 유지보수비 현황 (단위: 백만원)</p>
                </div>
                <div className="flex gap-2">
                  {allMaintenanceExpanded ? (
                    <button
                      onClick={collapseAllMaintenanceTeams}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200"
                    >
                      모두접기
                    </button>
                  ) : (
                    <button
                      onClick={expandAllMaintenanceTeams}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200"
                    >
                      모두펼치기
                    </button>
                  )}
                  <button
                    onClick={() => { setItMaintenanceExpanded(false); collapseAllMaintenanceTeams(); }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    접기
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {itMaintenanceLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : itMaintenanceData ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="px-2 py-2 text-left text-xs font-bold text-gray-900 bg-gray-50 sticky left-0 min-w-[150px]">부서</th>
                        {itMaintenanceData.months.map(m => (
                          <th key={m} className="px-2 py-2 text-right text-xs font-bold text-gray-900 bg-gray-50 min-w-[50px]">
                            {parseInt(m)}월
                          </th>
                        ))}
                        <th className="px-2 py-2 text-right text-xs font-bold text-blue-600 bg-gray-50 min-w-[60px]">연합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 25년 합계 */}
                      <tr className="border-b border-gray-200 bg-blue-50 font-bold">
                        <td className="px-2 py-2 text-xs font-bold text-blue-700 sticky left-0 bg-blue-50">
                          IT유지보수비 합계 (25년)
                        </td>
                        {itMaintenanceData.months.map(m => (
                          <td key={m} className="px-2 py-2 text-right text-xs font-bold text-blue-700">
                            {(itMaintenanceData.monthlyTotals[m] || 0).toLocaleString()}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-right text-xs font-bold text-blue-700">
                          {Object.values(itMaintenanceData.monthlyTotals).reduce((a, b) => a + b, 0).toLocaleString()}
                        </td>
                      </tr>
                      {/* 24년 합계 */}
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <td className="px-2 py-2 text-xs font-medium text-gray-600 sticky left-0 bg-gray-50">
                          IT유지보수비 합계 (24년)
                        </td>
                        {itMaintenanceData.months.map(m => (
                          <td key={m} className="px-2 py-2 text-right text-xs text-gray-600">
                            {(itMaintenanceData.monthlyTotals2024?.[m] || 0).toLocaleString()}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-right text-xs font-medium text-gray-600">
                          {Object.values(itMaintenanceData.monthlyTotals2024 || {}).reduce((a, b) => a + b, 0).toLocaleString()}
                        </td>
                      </tr>
                      {/* YOY */}
                      <tr className="border-b-2 border-gray-300 bg-gray-50">
                        <td className="px-2 py-2 text-xs font-medium text-gray-600 sticky left-0 bg-gray-50">
                          YOY
                        </td>
                        {itMaintenanceData.months.map(m => {
                          const val25 = itMaintenanceData.monthlyTotals[m] || 0;
                          const val24 = itMaintenanceData.monthlyTotals2024?.[m] || 0;
                          const yoy = val24 > 0 ? (val25 / val24 * 100) : 0;
                          const isOver100 = yoy > 100;
                          return (
                            <td key={m} className={`px-2 py-2 text-right text-xs font-medium ${isOver100 ? 'text-red-500' : 'text-blue-500'}`}>
                              {val24 > 0 ? `${yoy.toFixed(1)}%` : '-'}
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-right text-xs font-medium text-gray-600">
                          {(() => {
                            const total25 = Object.values(itMaintenanceData.monthlyTotals).reduce((a, b) => a + b, 0);
                            const total24 = Object.values(itMaintenanceData.monthlyTotals2024 || {}).reduce((a, b) => a + b, 0);
                            const yoy = total24 > 0 ? (total25 / total24 * 100) : 0;
                            return total24 > 0 ? `${yoy.toFixed(1)}%` : '-';
                          })()}
                        </td>
                      </tr>
                      {/* 부서별 상세 */}
                      {itMaintenanceData.items.map((item, idx) => (
                        <React.Fragment key={idx}>
                          <tr 
                            className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                            onClick={() => {
                              if (expandedMaintenanceTeam === item.text) {
                                setExpandedMaintenanceTeam(null);
                                setTeamMaintenanceDetails([]);
                              } else {
                                setExpandedMaintenanceTeam(item.text);
                                loadTeamMaintenanceDetails(itExpenseYear, item.text);
                              }
                            }}
                          >
                            <td className="px-2 py-1.5 text-xs text-gray-700 sticky left-0 bg-white" title={item.text}>
                              <span className="mr-1 text-gray-400">{(expandedMaintenanceTeam === item.text || allMaintenanceExpanded) ? '▼' : '▶'}</span>
                              {item.text}
                            </td>
                            {itMaintenanceData.months.map(m => (
                              <td key={m} className="px-2 py-1.5 text-right text-xs text-gray-600">
                                {item.monthly[m] && item.monthly[m] > 0 ? item.monthly[m].toLocaleString() : '-'}
                              </td>
                            ))}
                            <td className="px-2 py-1.5 text-right text-xs font-medium text-blue-600">
                              {item.total.toLocaleString()}
                            </td>
                          </tr>
                          {/* 팀 상세 내역 드릴다운 - 텍스트별 월별 금액 */}
                          {(expandedMaintenanceTeam === item.text || allMaintenanceExpanded) && (
                            (expandedMaintenanceTeam === item.text && teamDetailsLoading) ? (
                              <tr>
                                <td colSpan={14} className="bg-gray-50 py-3 text-center">
                                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                </td>
                              </tr>
                            ) : (
                              (allMaintenanceExpanded ? allTeamDetails[item.text] : teamMaintenanceDetails)?.length > 0 ? (
                                (allMaintenanceExpanded ? allTeamDetails[item.text] : teamMaintenanceDetails).map((detail, dIdx) => (
                                  <tr key={`detail-${dIdx}`} className="border-b border-gray-100 bg-gray-50">
                                    <td className="px-2 py-1 text-xs text-gray-500 sticky left-0 bg-gray-50 pl-6" title={detail.text}>
                                      {detail.text.length > 20 ? detail.text.slice(0, 20) + '...' : detail.text}
                                    </td>
                                    {itMaintenanceData?.months.map(m => (
                                      <td key={m} className="px-2 py-1 text-right text-xs text-gray-500">
                                        {detail.monthly && detail.monthly[m] && detail.monthly[m] > 0 ? detail.monthly[m].toLocaleString() : '-'}
                                      </td>
                                    ))}
                                    <td className="px-2 py-1 text-right text-xs text-blue-500 font-medium">
                                      {detail.total.toLocaleString()}
                                    </td>
                                  </tr>
                                ))
                              ) : null
                            )
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <p className="text-sm">데이터를 불러올 수 없습니다.</p>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* CAPEX (유무형자산 취득/이관) - SW상각비 행 클릭 시에만 표시 */}
          {swCapexExpanded && (
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">유무형자산 신규취득 및 이관</CardTitle>
                  <p className="text-sm text-muted-foreground">소프트웨어 자산 월별 취득 현황 (단위: 백만원)</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCapexYear('2024')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      capexYear === '2024'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    2024년
                  </button>
                  <button
                    onClick={() => setCapexYear('2025')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      capexYear === '2025'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    2025년
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {capexLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <svg className="w-8 h-8 animate-spin mb-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <p className="text-sm font-medium">데이터를 불러오는 중...</p>
                </div>
              ) : capexData ? (
                <div className="space-y-6">
                  {/* 월별 합계 테이블 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b-2 border-gray-300">
                          <th className="px-2 py-2 text-left text-xs font-bold text-gray-900 bg-gray-100 min-w-[120px]">구분</th>
                          {capexData.months.map(month => (
                            <th key={month} className="px-2 py-2 text-center text-xs font-bold text-gray-900 bg-gray-100 min-w-[60px]">
                              {parseInt(month)}월
                            </th>
                          ))}
                          <th className="px-2 py-2 text-center text-xs font-bold text-gray-900 bg-gray-100 min-w-[70px]">합계</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* 신규취득 */}
                        <tr className="border-b border-gray-200 bg-green-50">
                          <td className="px-2 py-2 text-sm font-bold text-gray-900 bg-green-50">신규취득</td>
                          {capexData.months.map(month => (
                            <td key={month} className="px-2 py-2 text-right text-sm font-medium text-green-700">
                              {(capexData.monthlyAcquisitions[month] || 0).toLocaleString() || '-'}
                            </td>
                          ))}
                          <td className="px-2 py-2 text-right text-sm font-bold text-green-700">
                            {capexData.totals.acquisitions.toLocaleString()}
                          </td>
                        </tr>
                        {/* 이관 */}
                        <tr className="border-b border-gray-200 bg-blue-50">
                          <td className="px-2 py-2 text-sm font-bold text-gray-900 bg-blue-50">이관</td>
                          {capexData.months.map(month => (
                            <td key={month} className="px-2 py-2 text-right text-sm font-medium text-blue-700">
                              {(capexData.monthlyTransfers[month] || 0).toLocaleString() || '-'}
                            </td>
                          ))}
                          <td className="px-2 py-2 text-right text-sm font-bold text-blue-700">
                            {capexData.totals.transfers.toLocaleString()}
                          </td>
                        </tr>
                        {/* 처분 */}
                        <tr className="border-b border-gray-200 bg-red-50">
                          <td className="px-2 py-2 text-sm font-bold text-gray-900 bg-red-50">처분</td>
                          {capexData.months.map(month => {
                            const val = capexData.monthlyDisposals?.[month] || 0;
                            return (
                              <td key={month} className="px-2 py-2 text-right text-sm font-medium text-red-600">
                                {val > 0 ? `-${val.toLocaleString()}` : '-'}
                              </td>
                            );
                          })}
                          <td className="px-2 py-2 text-right text-sm font-bold text-red-600">
                            {capexData.totals.disposals > 0 ? `-${capexData.totals.disposals.toLocaleString()}` : '-'}
                          </td>
                        </tr>
                        {/* 합계 */}
                        <tr className="border-b-2 border-gray-300 bg-gray-100">
                          <td className="px-2 py-2 text-sm font-bold text-gray-900 bg-gray-100">순증감</td>
                          {capexData.months.map(month => {
                            const acq = capexData.monthlyAcquisitions[month] || 0;
                            const trans = capexData.monthlyTransfers[month] || 0;
                            const disp = capexData.monthlyDisposals?.[month] || 0;
                            const net = acq + trans - disp;
                            return (
                              <td key={month} className={`px-2 py-2 text-right text-sm font-bold ${net >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                                {net !== 0 ? net.toLocaleString() : '-'}
                              </td>
                            );
                          })}
                          <td className={`px-2 py-2 text-right text-sm font-bold ${(capexData.totals.acquisitions + capexData.totals.transfers - capexData.totals.disposals) >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                            {(capexData.totals.acquisitions + capexData.totals.transfers - capexData.totals.disposals).toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 신규취득 상세 리스트 */}
                  {capexData.acquisitions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                        신규취득 자산 ({capexData.acquisitions.length}건)
                      </h4>
                      <div className="bg-green-50 rounded-lg p-3">
                        <table className="w-full text-xs table-fixed">
                          <thead>
                            <tr className="border-b border-green-200">
                              <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-700 w-[100px]">취득일</th>
                              <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-700">자산명</th>
                              <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700 w-[100px]">취득가액</th>
                            </tr>
                          </thead>
                          <tbody>
                            {capexData.acquisitions.map((item, idx) => (
                              <tr key={idx} className="border-b border-green-100 last:border-b-0">
                                <td className="px-2 py-1.5 text-xs text-gray-600 whitespace-nowrap w-[100px]">{item.acquisitionDate}</td>
                                <td className="px-2 py-1.5 text-xs text-gray-900 truncate">{item.assetName}</td>
                                <td className="px-2 py-1.5 text-right text-xs font-medium text-green-700 w-[100px]">{item.amount.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 이관 상세 리스트 */}
                  {capexData.transfers.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                        이관 자산 ({capexData.transfers.length}건)
                      </h4>
                      <div className="bg-blue-50 rounded-lg p-3">
                        <table className="w-full text-xs table-fixed">
                          <thead>
                            <tr className="border-b border-blue-200">
                              <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-700 w-[100px]">취득일</th>
                              <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-700">자산명</th>
                              <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700 w-[100px]">이관금액</th>
                            </tr>
                          </thead>
                          <tbody>
                            {capexData.transfers.map((item, idx) => (
                              <tr key={idx} className="border-b border-blue-100 last:border-b-0">
                                <td className="px-2 py-1.5 text-xs text-gray-600 whitespace-nowrap w-[100px]">{item.acquisitionDate}</td>
                                <td className="px-2 py-1.5 text-xs text-gray-900 truncate">{item.assetName}</td>
                                <td className="px-2 py-1.5 text-right text-xs font-medium text-blue-700 w-[100px]">{item.amount.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 처분 상세 리스트 */}
                  {capexData.disposals && capexData.disposals.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                        처분 자산 ({capexData.disposals.length}건)
                      </h4>
                      <div className="bg-red-50 rounded-lg p-3">
                        <table className="w-full text-xs table-fixed">
                          <thead>
                            <tr className="border-b border-red-200">
                              <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-700 w-[100px]">취득일</th>
                              <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-700">자산명</th>
                              <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700 w-[100px]">처분금액</th>
                            </tr>
                          </thead>
                          <tbody>
                            {capexData.disposals.map((item, idx) => (
                              <tr key={idx} className="border-b border-red-100 last:border-b-0">
                                <td className="px-2 py-1.5 text-xs text-gray-600 whitespace-nowrap w-[100px]">{item.acquisitionDate}</td>
                                <td className="px-2 py-1.5 text-xs text-gray-900 truncate">{item.assetName}</td>
                                <td className="px-2 py-1.5 text-right text-xs font-medium text-red-600 w-[100px]">-{item.amount.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {capexData.acquisitions.length === 0 && capexData.transfers.length === 0 && (!capexData.disposals || capexData.disposals.length === 0) && (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-sm">{capexYear}년에 신규 취득, 이관 또는 처분된 자산이 없습니다.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <p className="text-sm">데이터를 불러올 수 없습니다.</p>
                </div>
              )}
            </CardContent>
          </Card>
          )}
        </div>
      )}

      {/* 지급수수료 탭 콘텐츠 */}
      {mainTab === 'commission' && (
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold">지급수수료</CardTitle>
              <p className="text-sm text-muted-foreground">지급수수료 상세 분석</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-lg font-medium mb-2">지급수수료 분석 기능 준비 중</p>
                <p className="text-sm">지급용역비, 법률자문료, 인사채용 등 지급수수료 상세 분석을 확인할 수 있습니다.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// 계층형 행 컴포넌트
interface HierarchyRowProps {
  data: any;
  level: number;
  expandedRows: Set<string>;
  toggleRow: (id: string) => void;
  descriptions: Record<string, string>;
  generateAIDescription: (name: string, data: any) => void;
  isGeneratingAI: string | null;
  editingDescription: string | null;
  tempDescription: string;
  setTempDescription: (value: string) => void;
  onStartEdit: (id: string, currentDesc: string) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
}

function HierarchyRow({ 
  data, 
  level, 
  expandedRows, 
  toggleRow,
  descriptions,
  generateAIDescription,
  isGeneratingAI,
  editingDescription,
  tempDescription,
  setTempDescription,
  onStartEdit,
  onSaveEdit,
  onCancelEdit
}: HierarchyRowProps) {
  const isExpanded = expandedRows.has(data.id);
  const hasChildren = data.children && data.children.length > 0;
  const indent = level * 24;
  const isTotal = data.isTotal === true;
  const isEditing = editingDescription === data.id;
  
  const formatNumber = (num: number) => {
    return Math.round(num).toLocaleString();
  };
  
  return (
    <>
      <tr 
        className={`transition-colors ${
          isTotal ? 'bg-purple-100 font-bold border-b-2 border-purple-300' : 
          'border-b ' + (level === 0 ? 'bg-blue-50 font-semibold hover:bg-gray-50' : 
          level === 1 ? 'bg-white hover:bg-gray-50' : 
          'bg-gray-50 hover:bg-gray-50')
        }`}
      >
        <td className="px-4 py-3">
          <div className="flex items-center" style={{ paddingLeft: `${indent}px` }}>
            {!isTotal && hasChildren ? (
              <button
                onClick={() => toggleRow(data.id)}
                className="mr-2 p-1 hover:bg-gray-200 rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronDownIcon className="w-4 h-4 text-gray-600" />
                ) : (
                  <ChevronRightIcon className="w-4 h-4 text-gray-600" />
                )}
              </button>
            ) : (
              <span className="mr-2 w-6"></span>
            )}
            <span className={isTotal ? 'font-bold text-purple-900 text-base' : level === 0 ? 'font-bold text-gray-900' : 'text-gray-700'}>
              {data.name}
            </span>
          </div>
        </td>
        <td className={`px-4 py-3 text-right ${isTotal ? 'text-purple-700 font-bold' : 'text-blue-600 font-medium'}`}>
          {formatNumber(data.previous)}
        </td>
        <td className={`px-4 py-3 text-right font-bold ${isTotal ? 'text-purple-900' : 'text-gray-900'}`}>
          {formatNumber(data.current)}
        </td>
        <td className={`px-4 py-3 text-right font-semibold ${
          isTotal ? (data.change >= 0 ? 'text-red-700' : 'text-green-700') :
          (data.change >= 0 ? 'text-red-600' : 'text-green-600')
        }`}>
          {data.change >= 0 ? '+' : ''}{formatNumber(data.change)}
        </td>
        <td className={`px-4 py-3 text-right font-bold ${
          isTotal ? (data.yoy >= 100 ? 'text-red-700' : 'text-green-700') :
          (data.yoy >= 100 ? 'text-red-600' : 'text-green-600')
        }`}>
          {formatNumber(data.yoy)}%
        </td>
        <td className="px-4 py-3">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <textarea
                value={tempDescription}
                onChange={(e) => setTempDescription(e.target.value)}
                className="flex-1 text-xs p-2 border border-blue-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSaveEdit(data.id);
                  } else if (e.key === 'Escape') {
                    onCancelEdit();
                  }
                }}
              />
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => onSaveEdit(data.id)}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  저장
                </button>
                <button
                  onClick={onCancelEdit}
                  className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <span 
                className={`text-xs flex-1 cursor-pointer hover:text-blue-600 ${isTotal ? 'text-purple-700 font-semibold' : 'text-gray-600'}`}
                onClick={() => onStartEdit(data.id, descriptions[data.id] || '')}
                title="클릭하여 편집"
              >
                {descriptions[data.id] || (isTotal ? '공통비 합계 설명을 입력하세요...' : '설명을 불러오는 중...')}
              </span>
              <button
                onClick={() => onStartEdit(data.id, descriptions[data.id] || '')}
                className={`p-1 hover:bg-blue-100 rounded transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 ${isTotal ? 'text-purple-600' : 'text-blue-600'}`}
                title="편집"
              >
                <PencilIcon className="w-3 h-3" />
              </button>
            </div>
          )}
        </td>
      </tr>
      
      {isExpanded && hasChildren && data.children.map((child: any) => (
        <HierarchyRow
          key={child.id}
          data={child}
          level={level + 1}
          expandedRows={expandedRows}
          toggleRow={toggleRow}
          descriptions={descriptions}
          generateAIDescription={generateAIDescription}
          isGeneratingAI={isGeneratingAI}
          editingDescription={editingDescription}
          tempDescription={tempDescription}
          setTempDescription={setTempDescription}
          onStartEdit={onStartEdit}
          onSaveEdit={onSaveEdit}
          onCancelEdit={onCancelEdit}
        />
      ))}
    </>
  );
}
