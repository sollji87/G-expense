'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpIcon, ArrowDownIcon, TrendingUpIcon, CalendarIcon, PencilIcon, ChevronUpIcon, ChevronDownIcon, ChevronRightIcon, SaveIcon, XIcon, SparklesIcon } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, BarChart, Cell } from 'recharts';

// 비용 카테고리 정의
const COST_CATEGORIES = {
  인건비: '인건비',
  IT수수료: 'IT수수료',
  지급수수료: '지급수수료',
  직원경비: '직원경비',
  기타비용: '기타비용'
};

interface KpiData {
  category: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

export default function Dashboard() {
  const [kpiData, setKpiData] = useState<KpiData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'monthly' | 'ytd'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState('10');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedData, setEditedData] = useState<Record<string, { amount?: number; comment?: string }>>({});
  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedChartMonth, setSelectedChartMonth] = useState<string | null>(null);
  const [isChartExpanded, setIsChartExpanded] = useState(true);
  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(null);
  const [drilldownData, setDrilldownData] = useState<any[]>([]);
  const [detailDrilldownCategory, setDetailDrilldownCategory] = useState<string | null>(null);
  const [detailDrilldownData, setDetailDrilldownData] = useState<any[]>([]);
  
  // 계정별/코스트센터별 분석
  const [accountViewMode, setAccountViewMode] = useState<'monthly' | 'ytd'>('monthly');
  const [isAccountExpanded, setIsAccountExpanded] = useState(true);
  const [accountLevel, setAccountLevel] = useState<'major' | 'middle' | 'detail'>('major');
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [accountData, setAccountData] = useState<any[]>([]);
  const [costCenterData, setCostCenterData] = useState<any[]>([]);
  const [hoveredAccount, setHoveredAccount] = useState<string | null>(null);
  
  // 구조화된 테이블 (계층형)
  const [tableViewMode, setTableViewMode] = useState<'monthly' | 'ytd'>('monthly');
  const [isTableExpanded, setIsTableExpanded] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [hierarchyData, setHierarchyData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'data' | 'description'>('data');
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [editingDescription, setEditingDescription] = useState<string | null>(null);
  const [tempDescription, setTempDescription] = useState<string>('');
  const [isGeneratingAI, setIsGeneratingAI] = useState<string | null>(null);
  
  // 로컬 스토리지에서 저장된 설명 불러오기
  useEffect(() => {
    const savedDescriptions = localStorage.getItem('account_descriptions');
    if (savedDescriptions) {
      try {
        const parsed = JSON.parse(savedDescriptions);
        setDescriptions(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('저장된 설명 로드 실패:', error);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
    loadChartData();
  }, [viewMode, selectedMonth]);

  useEffect(() => {
    loadAccountData();
  }, [accountViewMode, selectedMonth, accountLevel]);
  
  // selectedAccount가 변경되고 accountLevel이 detail이 아닐 때만 코스트센터 로드
  useEffect(() => {
    if (selectedAccount && accountLevel !== 'detail') {
      loadCostCenterData();
    }
  }, [selectedAccount]);
  
  useEffect(() => {
    loadHierarchyData();
  }, [tableViewMode, selectedMonth]);

  const loadAccountData = async () => {
    try {
      let url = `/api/account-analysis?mode=${accountViewMode}&month=${selectedMonth}&level=${accountLevel}`;
      
      if (accountLevel === 'middle' && selectedAccount) {
        url += `&category=${encodeURIComponent(selectedAccount)}`;
      } else if (accountLevel === 'detail' && selectedAccount) {
        url += `&category=${encodeURIComponent(selectedAccount)}`;
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
      // 소분류 클릭 → 해당 소분류의 코스트센터 + 월별 추이 업데이트
      setSelectedAccount(accountName); // 헤더 표시를 위해 업데이트
      loadCostCenterDataOnly(accountName); // 코스트센터 데이터만 로드
      handleDrilldown(accountName); // 소분류 월별 추이도 로드
    }
  };

  const handleBackToMajor = () => {
    setAccountLevel('major');
    setSelectedAccount(null);
    setCostCenterData([]);
  };

  const handleBackToMiddle = () => {
    setAccountLevel('middle');
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
      }
    } catch (error) {
      console.error('계층 데이터 로드 실패:', error);
    }
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
    
    // 사용자가 편집한 설명이 있으면 그대로 유지
    const savedDescriptions = localStorage.getItem('account_descriptions');
    if (savedDescriptions) {
      try {
        const parsed = JSON.parse(savedDescriptions);
        if (parsed[accountName]) {
          console.log('📝 저장된 설명 사용:', accountName);
          return; // 저장된 설명이 있으면 자동 생성하지 않음
        }
      } catch (error) {
        console.error('저장된 설명 확인 실패:', error);
      }
    }
    
    // OpenAI 분석 결과가 있으면 직접 사용 (소분류)
    if (glAnalysisMap[accountName]) {
      setDescriptions(prev => ({
        ...prev,
        [accountName]: glAnalysisMap[accountName].description
      }));
      return;
    }
    
    // OpenAI 분석 결과가 없으면 자동 생성 (대분류, 중분류, 인건비)
    generateAIDescriptionAuto(accountName, data, glAnalysisMap);
  };
  
  const generateAIDescriptionAuto = async (accountName: string, data: any, glAnalysisMap: Record<string, any> = {}) => {
    console.log('🔍 설명 생성 시작:', accountName, data);
    
    const yoyChange = data.yoy - 100;
    const changeDirection = yoyChange > 0 ? '증가' : '감소';
    const changeAmount = Math.abs(data.change);
    
    let description = '';
    
    // 인건비인 경우 인원수 정보 추가
    if (accountName === '인건비') {
      console.log('👥 인건비 분석 시작...');
      try {
        // 인원수 데이터 가져오기
        const currentYearMonth = `2025${selectedMonth.padStart(2, '0')}`;
        const previousYearMonth = `2024${selectedMonth.padStart(2, '0')}`;
        
        const response = await fetch(`/api/headcount-comparison?currentMonth=${currentYearMonth}&previousMonth=${previousYearMonth}`);
        const result = await response.json();
        
        if (result.success) {
          const { currentTotal, previousTotal, departments } = result.data;
          const headcountChange = currentTotal - previousTotal;
          const headcountDirection = headcountChange > 0 ? '증가' : '감소';
          
          description = `전년 대비 ${Math.abs(yoyChange).toFixed(1)}% ${changeDirection}. `;
          description += `인원수 전년 ${previousTotal}명 → 당년 ${currentTotal}명 (${headcountChange >= 0 ? '+' : ''}${headcountChange}명). `;
          
          // 부서별 차이가 있는 경우 (상위 5개만)
          if (departments && departments.length > 0) {
            const increases = departments.filter((d: any) => d.change > 0).slice(0, 3);
            const decreases = departments.filter((d: any) => d.change < 0).slice(0, 3);
            
            if (increases.length > 0 || decreases.length > 0) {
              description += `주요 변동: `;
              
              const changes = [...increases, ...decreases];
              const changeTexts = changes.map((d: any) => 
                `${d.department}(${d.change >= 0 ? '+' : ''}${d.change}명)`
              );
              description += changeTexts.join(', ') + '.';
            }
          }
        } else {
          // 인원수 데이터가 없는 경우 기본 설명
          description = `전년 대비 ${Math.abs(yoyChange).toFixed(1)}% ${changeDirection}. `;
          description += `전년 대비 ${changeAmount.toFixed(0)}백만원 ${changeDirection}.`;
        }
      } catch (error) {
        console.error('인원수 데이터 로드 실패:', error);
        description = `전년 대비 ${Math.abs(yoyChange).toFixed(1)}% ${changeDirection}. `;
        description += `전년 대비 ${changeAmount.toFixed(0)}백만원 ${changeDirection}.`;
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
          description = `전년 대비 ${Math.abs(totalChange).toFixed(0)}백만원 ${changeDirection}. `;
          
          // 주요 소분류 변동 (상위 3개)
          const sortedChildren = [...data.children].sort((a: any, b: any) => Math.abs(b.change) - Math.abs(a.change));
          const topChildren = sortedChildren.slice(0, 3).filter((c: any) => Math.abs(c.change) >= 1);
          
          if (topChildren.length > 0) {
            description += `주요 변동: `;
            const childTexts = topChildren.map((c: any) => {
              const sign = c.change >= 0 ? '+' : '';
              return `${c.name}(${sign}${c.change.toFixed(0)}백만원)`;
            });
            description += childTexts.join(', ') + '.';
          }
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
      [accountName]: description
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
  
  const startEditDescription = (accountName: string) => {
    setEditingDescription(accountName);
    setTempDescription(descriptions[accountName] || '');
  };
  
  const saveDescription = (accountName: string) => {
    const newDescriptions = {
      ...descriptions,
      [accountName]: tempDescription
    };
    
    setDescriptions(newDescriptions);
    
    // 로컬 스토리지에 저장
    try {
      localStorage.setItem('account_descriptions', JSON.stringify(newDescriptions));
      console.log('✅ 설명 저장 완료:', accountName);
    } catch (error) {
      console.error('❌ 설명 저장 실패:', error);
    }
    
    setEditingDescription(null);
    setTempDescription('');
  };
  
  const cancelEditDescription = () => {
    setEditingDescription(null);
    setTempDescription('');
  };

  const handleDrilldown = async (category: string) => {
    try {
      const response = await fetch(`/api/drilldown?category=${category}&month=${selectedMonth}`);
      const result = await response.json();
      
      if (result.success) {
        setDrilldownCategory(category);
        setDrilldownData(result.data);
      }
    } catch (error) {
      console.error('드릴다운 로드 실패:', error);
    }
  };
  
  const handleDetailDrilldown = async (category: string) => {
    try {
      const response = await fetch(`/api/drilldown?category=${category}&month=${selectedMonth}`);
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
      // 선택한 월까지의 데이터 로드
      const monthNum = parseInt(selectedMonth);
      const months = [];
      
      for (let m = 1; m <= monthNum; m++) {
        const response = await fetch(`/api/kpi?mode=monthly&month=${m}`);
        const result = await response.json();
        
        if (result.success) {
          const data = result.data;
          const monthData: any = {
            month: `${m}월`,
            monthNum: m,
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
          
          console.log(`${m}월 데이터:`, monthData);
          months.push(monthData);
        }
      }
      
      setChartData(months);
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
      const totalChange = totalCurrent - totalPrevious;
      const totalChangePercent = totalPrevious !== 0 ? (totalCurrent / totalPrevious) * 100 : 0;  // 당년/전년 * 100%

      // 총비용을 맨 앞에 추가
      const mockData: KpiData[] = [
        {
          category: '총비용',
          current: totalCurrent,
          previous: totalPrevious,
          change: totalChange,
          changePercent: totalChangePercent
        },
        ...categories
      ];
      
      setKpiData(mockData);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
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
          
          {/* 월 선택 & 편집 버튼 */}
          <div className="flex items-center gap-2">
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
              </select>
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600 pointer-events-none" />
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
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
              className={`overflow-hidden transition-all hover:shadow-lg ${
                index === 0 ? 'sm:col-span-2 lg:col-span-3 xl:col-span-1 ring-2 ring-primary' : ''
              }`}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.category}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* 금액 */}
                <div className={`${index === 0 ? 'text-3xl md:text-4xl' : 'text-2xl md:text-4xl'} font-bold tracking-tight leading-tight`}>
                  {isEditMode ? (
                    <input
                      type="number"
                      value={editedData[kpi.category]?.amount ?? kpi.current}
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

                {/* YOY 배지 & 비중 배지 */}
                <div className="flex items-center gap-1.5 -mx-1">
                  {/* YOY 배지 */}
                  <div className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap ${
                    kpi.change > 0 
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    <span>YOY {formatNumber(kpi.changePercent)}%</span>
                  </div>
                  
                  {/* 비중 배지 (총비용 제외) */}
                  {index !== 0 && (() => {
                    const totalCurrent = kpiData[0].current;
                    const ratio = totalCurrent > 0 ? (kpi.current / totalCurrent) * 100 : 0;
                    return (
                      <div className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400">
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
                  <div className="pt-2">
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


        {/* 월별 비용 추이 및 YOY 비교 차트 */}
        <Card className="mb-8">
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
                      label={{ value: 'YOY (%)', angle: 90, position: 'insideRight', style: { fontSize: 12 } }}
                    />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = chartData.find(d => d.month === label);
                          return (
                            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg min-w-[200px]">
                              <p className="font-bold text-gray-900 mb-3 pb-2 border-b">{viewMode === 'monthly' ? '25년' : '25년 누적'} {label}</p>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">총비용:</span>
                                  <span className="text-sm font-bold text-blue-600">{Math.round(data?.총비용 || 0)}백만원</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">전년:</span>
                                  <span className="text-sm font-semibold text-gray-700">{Math.round((data?.총비용 || 0) / (data?.YOY || 100) * 100)}백만원</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">YOY:</span>
                                  <span className="text-sm font-bold text-red-600">{Math.round(data?.YOY || 0)}%</span>
                                </div>
                                <div className="pt-2 border-t">
                                  <p className="text-xs font-semibold text-gray-700 mb-2">중분류별 비중</p>
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
                                      <span className="text-xs font-semibold text-gray-900">{Math.round(data?.[cat.name] || 0)}</span>
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
                    
                    {/* 스택 막대 그래프 - 범례 순서대로 */}
                    <Bar yAxisId="left" dataKey="인건비" stackId="a" fill="#a7c7e7" name="인건비" />
                    <Bar yAxisId="left" dataKey="IT수수료" stackId="a" fill="#f4a6c3" name="IT수수료" />
                    <Bar yAxisId="left" dataKey="지급수수료" stackId="a" fill="#b4e7ce" name="지급수수료" />
                    <Bar yAxisId="left" dataKey="직원경비" stackId="a" fill="#ffd4a3" name="직원경비" />
                    <Bar yAxisId="left" dataKey="기타비용" stackId="a" fill="#e0b0ff" name="기타비용" />
                    
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
                      formatter={(value) => (
                        <span 
                          style={{ 
                            color: '#6b7280',
                            cursor: value !== 'YOY' ? 'pointer' : 'default',
                            transition: 'all 0.2s'
                          }}
                          onClick={() => {
                            if (value !== 'YOY') {
                              handleDrilldown(value);
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
          )}
        </Card>

        {/* 드릴다운 차트 */}
        {drilldownCategory && drilldownData.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">
                    {drilldownCategory} - {accountLevel === 'detail' ? '소분류' : '중분류'} 월별 추이 (2025년)
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {accountLevel === 'detail' ? '계정 소분류별 상세 분석' : '계정 중분류별 상세 분석'}
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
                      label={{ value: 'YOY (%)', angle: 90, position: 'insideRight', style: { fontSize: 12 } }}
                    />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = drilldownData.find(d => d.month === label);
                          const subcategories = Object.keys(data || {}).filter(key => key !== 'month' && key !== 'monthNum' && key !== 'YOY');
                          const colors = ['#a7c7e7', '#f4a6c3', '#b4e7ce', '#ffd4a3', '#e0b0ff', '#c9b7eb', '#ffc9c9', '#b5e7a0'];
                          
                          // 총비용 계산
                          const totalCost = subcategories.reduce((sum, cat) => sum + (data?.[cat] || 0), 0);
                          const prevTotal = totalCost / (data?.YOY || 100) * 100;
                          
                          return (
                            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg min-w-[200px]">
                              <p className="font-bold text-gray-900 mb-3 pb-2 border-b">25년 {label}</p>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">총비용:</span>
                                  <span className="text-sm font-bold text-blue-600">{Math.round(totalCost)}백만원</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">전년:</span>
                                  <span className="text-sm font-semibold text-gray-700">{Math.round(prevTotal)}백만원</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">YOY:</span>
                                  <span className="text-sm font-bold text-red-600">{Math.round(data?.YOY || 0)}%</span>
                                </div>
                                <div className="pt-2 border-t">
                                  <p className="text-xs font-semibold text-gray-700 mb-2">중분류별 비중</p>
                                  {subcategories.map((cat, idx) => (
                                    <div key={cat} className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-1.5">
                                        <div 
                                          className="w-2.5 h-2.5 rounded-full" 
                                          style={{ backgroundColor: colors[idx % colors.length] }}
                                        />
                                        <span className="text-xs text-gray-600">{cat}:</span>
                                      </div>
                                      <span className="text-xs font-semibold text-gray-900">{Math.round(data?.[cat] || 0)}</span>
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
                        const colors = ['#a7c7e7', '#f4a6c3', '#b4e7ce', '#ffd4a3', '#e0b0ff', '#c9b7eb', '#ffc9c9', '#b5e7a0'];
                        return (
                          <Bar 
                            key={subcategory}
                            yAxisId="left" 
                            dataKey={subcategory} 
                            stackId="a" 
                            fill={colors[index % colors.length]} 
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
                      domain={[0, 200]}
                      label={{ value: 'YOY (%)', angle: 90, position: 'insideRight', style: { fontSize: 12, fill: '#6b7280' } }}
                    />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = detailDrilldownData.find(d => d.month === label);
                          const subcategories = Object.keys(data || {}).filter(key => key !== 'month' && key !== 'monthNum' && key !== 'YOY');
                          const colors = ['#a7c7e7', '#f4a6c3', '#b4e7ce', '#ffd4a3', '#e0b0ff', '#c9b7eb', '#ffc9c9', '#b5e7a0'];
                          
                          return (
                            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg min-w-[200px]">
                              <p className="font-bold text-gray-900 mb-3 pb-2 border-b">{label}</p>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">총비용:</span>
                                  <span className="text-sm font-bold text-blue-600">
                                    {subcategories.reduce((sum, cat) => sum + (data?.[cat] || 0), 0).toFixed(0)}백만원
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">전년:</span>
                                  <span className="text-sm font-semibold text-gray-700">264백만원</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">YOY:</span>
                                  <span className="text-sm font-bold text-red-600">{Math.round(data?.YOY || 0)}%</span>
                                </div>
                                <div className="pt-2 border-t">
                                  <p className="text-xs font-semibold text-gray-700 mb-2">중분류별 비중</p>
                                  {subcategories.map((cat, idx) => (
                                    <div key={cat} className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-1.5">
                                        <div 
                                          className="w-2.5 h-2.5 rounded-full" 
                                          style={{ backgroundColor: colors[idx % colors.length] }}
                                        />
                                        <span className="text-xs text-gray-600">{cat}:</span>
                                      </div>
                                      <span className="text-xs font-semibold text-gray-900">{data?.[cat]?.toFixed(0)}</span>
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
                        const colors = ['#a7c7e7', '#f4a6c3', '#b4e7ce', '#ffd4a3', '#e0b0ff', '#c9b7eb', '#ffc9c9', '#b5e7a0'];
                        return (
                          <Bar
                            key={subcategory}
                            yAxisId="left"
                            dataKey={subcategory}
                            stackId="a"
                            fill={colors[index % colors.length]}
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
        <Card className="mt-6">
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 왼쪽: 계정별 분석 (2/3) */}
                <div className="lg:col-span-2">
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
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
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
                          width={150}
                        />
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200 min-w-[220px]">
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
                
                {/* 오른쪽: 코스트센터별 TOP 10 (1/3) */}
                <div className="lg:col-span-1 border-l pl-6">
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
                          {/* 헤더 */}
                          <div className="flex items-center justify-between text-xs font-semibold text-gray-600 mb-2 pb-2 border-b">
                            <span className="flex-1">코스트센터 (TOP {costCenterData.length})</span>
                            <div className="flex items-center gap-4">
                              <span className="w-16 text-center">당년</span>
                              <span className="w-16 text-center">전년</span>
                              <span className="w-16 text-center">YOY</span>
                            </div>
                          </div>
                          
                          {/* 데이터 */}
                          <div className="space-y-1.5">
                            {costCenterData.map((cc, index) => (
                              <div 
                                key={cc.code}
                                className="p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-gray-800 flex-1 truncate">
                                    {cc.name}
                                    {cc.currentHeadcount !== null && (
                                      <span className="text-gray-500 ml-1">({cc.currentHeadcount}명)</span>
                                    )}
                                  </span>
                                  <div className="flex items-center gap-4">
                                    <span className="w-16 text-right font-bold text-gray-900">{formatNumber(cc.current)}</span>
                                    <span className="w-16 text-right font-medium text-blue-600">{formatNumber(cc.previous)}</span>
                                    <span className={`w-16 text-right font-bold ${cc.yoy >= 100 ? 'text-red-600' : 'text-green-600'}`}>
                                      {formatNumber(cc.yoy)}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
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
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">당월 설명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hierarchyData.map((major) => (
                      <HierarchyRow
                        key={major.id}
                        data={major}
                        level={0}
                        expandedRows={expandedRows}
                        toggleRow={toggleRow}
                        descriptions={descriptions}
                        generateAIDescription={generateAIDescription}
                        startEditDescription={startEditDescription}
                        isGeneratingAI={isGeneratingAI}
                      />
                    ))}
                  </tbody>
                </table>
                
                {hierarchyData.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    데이터를 불러오는 중...
                  </div>
                )}
              </div>
              
              {/* 설명 편집 모달 */}
              {editingDescription && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-800">{editingDescription} - 설명 편집</h3>
                      <button
                        onClick={cancelEditDescription}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        <XIcon className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                    <textarea
                      value={tempDescription}
                      onChange={(e) => setTempDescription(e.target.value)}
                      className="w-full p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows={6}
                      placeholder="설명을 입력하세요..."
                      autoFocus
                    />
                    <div className="flex justify-end gap-2 mt-4">
                      <button
                        onClick={cancelEditDescription}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => saveDescription(editingDescription)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
  startEditDescription: (name: string) => void;
  isGeneratingAI: string | null;
}

function HierarchyRow({ 
  data, 
  level, 
  expandedRows, 
  toggleRow,
  descriptions,
  generateAIDescription,
  startEditDescription,
  isGeneratingAI
}: HierarchyRowProps) {
  const isExpanded = expandedRows.has(data.id);
  const hasChildren = data.children && data.children.length > 0;
  const indent = level * 24;
  
  const formatNumber = (num: number) => {
    return Math.round(num).toLocaleString();
  };
  
  return (
    <>
      <tr 
        className={`border-b hover:bg-gray-50 transition-colors ${
          level === 0 ? 'bg-blue-50 font-semibold' : 
          level === 1 ? 'bg-white' : 
          'bg-gray-50'
        }`}
      >
        <td className="px-4 py-3">
          <div className="flex items-center" style={{ paddingLeft: `${indent}px` }}>
            {hasChildren ? (
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
            <span className={level === 0 ? 'font-bold text-gray-900' : 'text-gray-700'}>
              {data.name}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-right text-blue-600 font-medium">
          {formatNumber(data.previous)}
        </td>
        <td className="px-4 py-3 text-right text-gray-900 font-bold">
          {formatNumber(data.current)}
        </td>
        <td className={`px-4 py-3 text-right font-semibold ${
          data.change >= 0 ? 'text-red-600' : 'text-green-600'
        }`}>
          {data.change >= 0 ? '+' : ''}{formatNumber(data.change)}
        </td>
        <td className={`px-4 py-3 text-right font-bold ${
          data.yoy >= 100 ? 'text-red-600' : 'text-green-600'
        }`}>
          {formatNumber(data.yoy)}%
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 flex-1">
              {descriptions[data.name] || '설명을 불러오는 중...'}
            </span>
            <button
              onClick={() => startEditDescription(data.name)}
              className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors flex-shrink-0"
              title="편집"
            >
              <PencilIcon className="w-3 h-3" />
            </button>
          </div>
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
          startEditDescription={startEditDescription}
          isGeneratingAI={isGeneratingAI}
        />
      ))}
    </>
  );
}
