import fs from 'fs';
import path from 'path';

function parseCSV(content: string): any[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const record: any = {};
    headers.forEach((header, index) => {
      record[header] = values[index]?.trim() || '';
    });
    records.push(record);
  }
  
  return records;
}

export interface CostCenterMappingEntry {
  costCenterCode: string;
  originalName: string;
  displayName: string;
  hasHeadcount: boolean;
}

// 매핑 데이터 캐시 (개발 모드에서는 매번 새로 로드)
let mappingCache: CostCenterMappingEntry[] | null = null;
let lastLoadTime = 0;
const CACHE_TTL = 5000; // 5초 캐시

// 매핑 파일 로드
export function loadCostCenterMapping(): CostCenterMappingEntry[] {
  const now = Date.now();
  if (mappingCache && (now - lastLoadTime) < CACHE_TTL) return mappingCache;
  
  const entries: CostCenterMappingEntry[] = [];
  
  // 매핑 파일 경로
  let mappingPath = path.join(process.cwd(), '..', 'myvenv', 'out', 'costcenter_mapping.csv');
  if (!fs.existsSync(mappingPath)) {
    mappingPath = path.join(process.cwd(), '..', '..', 'myvenv', 'out', 'costcenter_mapping.csv');
  }
  
  if (fs.existsSync(mappingPath)) {
    const content = fs.readFileSync(mappingPath, 'utf-8');
    const records = parseCSV(content);
    
    records.forEach((record: any) => {
      const costCenterCode = record['코스트센터'] || '';
      const originalName = record['비용_코스트센터명'] || '';
      const displayName = record['표시명'] || originalName;
      const hasHeadcount = record['인원수'] !== '없음';
      
      if (originalName) {
        entries.push({
          costCenterCode,
          originalName,
          displayName,
          hasHeadcount,
        });
      }
    });
  }
  
  mappingCache = entries;
  lastLoadTime = Date.now();
  return entries;
}

// 원본 이름 → 표시명 변환
export function getDisplayName(originalName: string): string {
  const mapping = loadCostCenterMapping();
  const entry = mapping.find(e => e.originalName === originalName);
  return entry?.displayName || originalName.replace('공통_', '');
}

// 표시명 → 원본 이름들 변환 (여러 개일 수 있음)
export function getOriginalNames(displayName: string): string[] {
  const mapping = loadCostCenterMapping();
  const entries = mapping.filter(e => e.displayName === displayName);
  return entries.map(e => e.originalName);
}

// 표시명 목록 → 원본 이름들 변환
export function getOriginalNamesFromDisplayNames(displayNames: string[]): string[] {
  const allOriginalNames: string[] = [];
  displayNames.forEach(displayName => {
    const originals = getOriginalNames(displayName);
    allOriginalNames.push(...originals);
  });
  return allOriginalNames;
}

// 레코드의 코스트센터명이 필터에 해당하는지 확인
export function matchesCostCenterFilter(recordCostCenterName: string, selectedDisplayNames: string[]): boolean {
  if (selectedDisplayNames.length === 0) return true;
  
  // 선택된 표시명들의 원본 이름들 가져오기
  const originalNames = getOriginalNamesFromDisplayNames(selectedDisplayNames);
  
  // 레코드의 코스트센터명이 원본 이름들 중 하나와 일치하는지 확인
  return originalNames.some(original => 
    recordCostCenterName === original || 
    recordCostCenterName.includes(original) || 
    original.includes(recordCostCenterName)
  );
}
