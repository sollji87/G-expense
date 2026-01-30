'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpIcon, ArrowDownIcon, TrendingUpIcon, CalendarIcon, PencilIcon, ChevronUpIcon, ChevronDownIcon, ChevronRightIcon, SaveIcon, XIcon, SparklesIcon } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, BarChart, Cell, ScatterChart, Scatter, ReferenceArea, LabelList } from 'recharts';

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
  const [selectedCostCenters, setSelectedCostCenters] = useState<string[]>([]);
  const [selectedMajorCategories, setSelectedMajorCategories] = useState<string[]>([]);
  const [costCenterOptions, setCostCenterOptions] = useState<string[]>([]);
  const [majorCategoryOptions, setMajorCategoryOptions] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
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

  // 필터 옵션 로드
  const loadFilterOptions = async () => {
    try {
      // 계정 대분류 옵션 가져오기 (hierarchy API에서)
      const hierarchyResponse = await fetch(`/api/hierarchy?mode=monthly&month=${selectedMonth}`);
      const hierarchyResult = await hierarchyResponse.json();
      
      if (hierarchyResult.success) {
        const majorCategories = hierarchyResult.data
          .filter((item: any) => !item.isTotal)
          .map((item: any) => item.name);
        setMajorCategoryOptions(majorCategories);
      }
      
      // 코스트센터 옵션 가져오기 (headcount 데이터에서)
      const headcountResponse = await fetch(`/api/headcount-comparison?currentMonth=2025${selectedMonth.padStart(2, '0')}&previousMonth=2024${selectedMonth.padStart(2, '0')}`);
      const headcountResult = await headcountResponse.json();
      
      if (headcountResult.success && headcountResult.data.departments) {
        const costCenters = headcountResult.data.departments.map((dept: any) => dept.department as string);
        setCostCenterOptions([...new Set(costCenters)].sort() as string[]);
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

  const loadAccountData = async () => {
    try {
      let url = `/api/account-analysis?mode=${accountViewMode}&month=${selectedMonth}&level=${accountLevel}`;
      
      if (accountLevel === 'middle' && selectedAccount) {
        url += `&category=${encodeURIComponent(selectedAccount)}`;
      } else if (accountLevel === 'detail') {
        // 대분류에서 바로 소분류로 접근한 경우 majorCategory 사용
        if (selectedMajorCategory) {
          url += `&majorCategory=${encodeURIComponent(selectedMajorCategory)}`;
        } else if (selectedAccount) {
          url += `&category=${encodeURIComponent(selectedAccount)}`;
        }
      }
      
      // 계정 차트 데이터 로드
      const response = await fetch(url);
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
      const ccResponse = await fetch(`/api/costcenter-analysis?mode=${accountViewMode}&month=${selectedMonth}&account=${encodeURIComponent(selectedAccount)}`);
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
      const ccResponse = await fetch(`/api/costcenter-analysis?mode=${accountViewMode}&month=${selectedMonth}&account=${encodeURIComponent(accountName)}`);
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
      const response = await fetch(`/api/hierarchy?mode=${tableViewMode}&month=${selectedMonth}`);
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
      const response = await fetch(`/api/drilldown?category=${category}&month=${selectedMonth}&level=${fromLevel}`);
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
      const response = await fetch(`/api/drilldown?category=${category}&month=${selectedMonth}&level=middle`);
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
        
        const response = await fetch(`/api/kpi?mode=monthly&month=${targetMonth}&year=${targetYear}`);
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
      // API에서 실제 데이터 로드
      const response = await fetch(`/api/kpi?mode=${viewMode}&month=${selectedMonth}`);
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
                    <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {costCenterOptions.length > 0 ? (
                        costCenterOptions.map((cc) => (
                          <label key={cc} className="flex items-center gap-2 p-1 hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedCostCenters.includes(cc)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCostCenters([...selectedCostCenters, cc]);
                                } else {
                                  setSelectedCostCenters(selectedCostCenters.filter(c => c !== cc));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{cc}</span>
                          </label>
                        ))
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

      {/* KPI 카드 */}
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 md:mb-6">
          <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">주요 지표 (KPI)</h2>
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
                      <span className="text-xs md:text-sm font-normal text-muted-foreground ml-1">
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

        {/* 효율성 지표 섹션 */}
        <Card className="mb-8">
          <CardHeader 
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setIsEfficiencyExpanded(!isEfficiencyExpanded)}
          >
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  효율성 지표
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">비용 효율성 핵심 지표</p>
              </div>
              <ChevronUpIcon className={`w-5 h-5 transition-transform ${isEfficiencyExpanded ? '' : 'rotate-180'}`} />
            </div>
          </CardHeader>
          
          {isEfficiencyExpanded && (
            <CardContent>
              {!efficiencyMetrics ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <svg className="w-8 h-8 animate-spin mb-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <p className="text-sm font-medium">효율성 지표를 계산하고 있습니다...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 인당 공통비 카드 */}
                  <div className="relative p-4 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 group">
                    <div className="absolute top-2 right-2">
                      <div className="relative">
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="absolute right-0 top-6 w-48 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                          총 공통비용 ÷ 전사 인원수로 계산합니다. 인원당 평균 비용 부담을 나타냅니다.
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-gray-600">인당 공통비</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {efficiencyMetrics.costPerHead.current.toFixed(1)}
                      <span className="text-sm font-normal text-gray-500 ml-1">백만원/인</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold flex items-center gap-1 ${
                        efficiencyMetrics.costPerHead.changePercent > 0 ? 'text-red-600' : 
                        efficiencyMetrics.costPerHead.changePercent < 0 ? 'text-blue-600' : 'text-gray-500'
                      }`}>
                        {efficiencyMetrics.costPerHead.changePercent > 0 ? (
                          <ArrowUpIcon className="w-3 h-3" />
                        ) : efficiencyMetrics.costPerHead.changePercent < 0 ? (
                          <ArrowDownIcon className="w-3 h-3" />
                        ) : (
                          <span>→</span>
                        )}
                        {efficiencyMetrics.costPerHead.changePercent >= 0 ? '+' : ''}
                        {efficiencyMetrics.costPerHead.changePercent.toFixed(1)}%
                      </span>
                      <span className="text-xs text-gray-400">vs 전년</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      전년 {efficiencyMetrics.costPerHead.previous.toFixed(1)}백만원/인
                      <span className="mx-1">|</span>
                      인원 {efficiencyMetrics.headcount.current}명 (전년 {efficiencyMetrics.headcount.previous}명)
                    </div>
                  </div>
                  
                  {/* 매출 대비 공통비 비율 카드 */}
                  <div className="relative p-4 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-200 group">
                    <div className="absolute top-2 right-2">
                      <div className="relative">
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="absolute right-0 top-6 w-56 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                          (공통비 ÷ 매출액_부가세제외) × 100으로 계산합니다. 공통비와 매출액 모두 부가세 제외 기준으로 비교합니다.
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-gray-600">매출 대비 공통비</span>
                    </div>
                  {efficiencyMetrics.revenueRatio.current !== null ? (
                    <>
                      <div className="text-2xl font-bold text-gray-900 mb-1">
                        {efficiencyMetrics.revenueRatio.current.toFixed(2)}
                        <span className="text-sm font-normal text-gray-500 ml-1">%</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-sm font-semibold flex items-center gap-1 ${
                          (efficiencyMetrics.revenueRatio.change || 0) > 0 ? 'text-red-600' : 
                          (efficiencyMetrics.revenueRatio.change || 0) < 0 ? 'text-blue-600' : 'text-gray-500'
                        }`}>
                          {(efficiencyMetrics.revenueRatio.change || 0) > 0 ? (
                            <ArrowUpIcon className="w-3 h-3" />
                          ) : (efficiencyMetrics.revenueRatio.change || 0) < 0 ? (
                            <ArrowDownIcon className="w-3 h-3" />
                          ) : (
                            <span>→</span>
                          )}
                          {Math.abs(efficiencyMetrics.revenueRatio.change || 0).toFixed(2)}%p
                        </span>
                        <span className="text-xs text-gray-400">vs 전년</span>
                      </div>
                      <div className="mt-2 space-y-1">
                        <div className="text-xs text-gray-500">
                          매출액: {efficiencyMetrics.revenueRatio.revenueCurrentExclVAT ? Math.round(efficiencyMetrics.revenueRatio.revenueCurrentExclVAT).toLocaleString() : '0'}백만원
                          {viewMode === 'ytd' && ' (누적)'}
                        </div>
                        <div className="text-xs text-gray-500">
                          전년: {efficiencyMetrics.revenueRatio.revenuePreviousExclVAT ? Math.round(efficiencyMetrics.revenueRatio.revenuePreviousExclVAT).toLocaleString() : '0'}백만원
                          {viewMode === 'ytd' && ' (누적)'}
                        </div>
                        <div className="text-xs text-gray-400 pt-1">
                          비율: 전년 {efficiencyMetrics.revenueRatio.previous?.toFixed(2)}%
                        </div>
                      </div>
                    </>
                  ) : (
                      <div className="flex flex-col items-center justify-center py-2">
                        <div className="text-lg font-semibold text-gray-400 mb-1">데이터 연동 필요</div>
                        <div className="text-xs text-gray-400">매출 데이터가 연동되면 자동 계산됩니다</div>
                      </div>
                    )}
                  </div>
                  
                  {/* 비용 집중도 카드 */}
                  <div className="relative p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100 group">
                    <div className="absolute top-2 right-2">
                      <div className="relative">
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="absolute right-0 top-6 w-48 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                          상위 3개 비용 항목이 전체 공통비에서 차지하는 비율입니다. 비용 집중도가 높을수록 특정 항목 관리가 중요합니다.
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-gray-600">비용 집중도</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {efficiencyMetrics.costConcentration.totalRatio.toFixed(1)}
                      <span className="text-sm font-normal text-gray-500 ml-1">%</span>
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      상위 3개 항목이 전체의 {efficiencyMetrics.costConcentration.totalRatio.toFixed(0)}% 차지
                    </div>
                    {/* 미니 파이차트 시각화 */}
                    <div className="flex items-center gap-2">
                      <div className="relative w-10 h-10">
                        <svg viewBox="0 0 36 36" className="w-10 h-10 transform -rotate-90">
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                          <circle 
                            cx="18" cy="18" r="15.9" fill="none" 
                            stroke="#f59e0b" strokeWidth="3"
                            strokeDasharray={`${efficiencyMetrics.costConcentration.totalRatio} ${100 - efficiencyMetrics.costConcentration.totalRatio}`}
                          />
                        </svg>
                      </div>
                      <div className="flex-1 space-y-1">
                        {efficiencyMetrics.costConcentration.top3Items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="text-gray-600 truncate max-w-[80px]">{item.name}</span>
                            <span className="font-medium text-gray-900">{item.ratio.toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

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
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {aiInsight}
                  </p>
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
                                // 하이라이트 토글
                                if (highlightedCategory === value) {
                                  setHighlightedCategory(null);
                                } else {
                                  setHighlightedCategory(value);
                                }
                              }
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (value !== 'YOY' && value !== '6개월 평균') {
                                handleDrilldown(value);
                              }
                            }}
                            title={value !== 'YOY' && value !== '6개월 평균' ? '클릭: 하이라이트 / 더블클릭: 드릴다운' : ''}
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

        {/* 비용 변동 요인 Waterfall 차트 */}
        {kpiData.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">비용 변동 요인 분석</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    전년 대비 비용 변동을 항목별로 시각화한 Waterfall 차트
                  </p>
                </div>
                <button
                  onClick={() => setShowAllWaterfallItems(!showAllWaterfallItems)}
                  className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors"
                >
                  {showAllWaterfallItems ? '주요 항목만 보기' : '전체 보기'}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[500px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={waterfallData}
                    margin={{ top: 20, right: 30, bottom: 60, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="name"
                      angle={0}
                      textAnchor="middle"
                      height={40}
                      interval={0}
                      tick={{ fontSize: 11 }}
                      width={100}
                    />
                    <YAxis 
                      hide={true}
                      domain={[0, (dataMax: number) => {
                        // 각 바의 높이가 변동량에 비례하도록 Y축 도메인 조정
                        // 시작/끝 바와 중간 변동 바의 최대값을 모두 고려
                        const startEndMax = Math.max(
                          ...waterfallData
                            .filter(d => d.type === 'start' || d.type === 'end')
                            .map(d => d.value)
                        );
                        
                        // 중간 변동 바들의 최대 높이 (변동량 절대값)
                        const changeMax = Math.max(
                          ...waterfallData
                            .filter(d => d.type !== 'start' && d.type !== 'end')
                            .map(d => d.value)
                        );
                        
                        // 전체 최대값 (시작/끝 바와 변동 바 중 큰 값)
                        const overallMax = Math.max(startEndMax, changeMax);
                        
                        // 변동폭이 직관적으로 보이도록 여유 공간 추가
                        return overallMax * 1.2;
                      }]}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length > 0) {
                          const data = payload[0].payload;
                          if (data.type === 'start' || data.type === 'end') {
                            return (
                              <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                <p className="font-semibold text-gray-900">{data.name}</p>
                                <p className="text-sm text-gray-600">
                                  금액: {Math.round(data.value).toLocaleString()}백만원
                                </p>
                              </div>
                            );
                          }
                          return (
                            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                              <p className="font-semibold text-gray-900">{data.name}</p>
                              <p className="text-sm text-gray-600">
                                전년: {Math.round(data.previous).toLocaleString()}백만원
                              </p>
                              <p className="text-sm text-gray-600">
                                당년: {Math.round(data.current).toLocaleString()}백만원
                              </p>
                              <p className={`text-sm font-semibold ${data.change > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                변동: {data.change > 0 ? '+' : ''}{Math.round(data.change).toLocaleString()}백만원
                                ({data.changePercent > 0 ? '+' : ''}{data.changePercent.toFixed(1)}%)
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {/* 시작점 바 (투명) */}
                    <Bar
                      dataKey="start"
                      stackId="waterfall"
                      fill="transparent"
                    />
                    {/* 변동값 바 - 각 바의 높이가 변동량에 비례하도록 */}
                    <Bar
                      dataKey="value"
                      stackId="waterfall"
                      radius={[0, 0, 0, 0]}
                    >
                      {waterfallData.map((entry, index) => {
                        let color = '#9ca3af'; // 기본 회색
                        
                        if (entry.type === 'start' || entry.type === 'end') {
                          color = '#a5b4fc'; // 시작/끝은 파스텔 보라색
                        } else if (entry.type === 'increase') {
                          color = '#fca5a5'; // 증가는 파스텔 빨강
                        } else if (entry.type === 'decrease') {
                          color = '#86efac'; // 감소는 파스텔 초록
                        }
                        
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                      <LabelList 
                        dataKey="labelText"
                        position="top"
                        style={{ 
                          fontSize: '14px', 
                          fill: '#111827', 
                          fontWeight: 'bold',
                          fontFamily: 'inherit',
                          letterSpacing: '-0.02em'
                        }}
                      />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

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
