# -*- coding: utf-8 -*-
import json
import re

def normalize_detail_text(text):
    normalized = text
    # 날짜/월 정보 제거
    normalized = re.sub(r'^\d{2}\.\d{2}월?_?\s*', '', normalized)
    normalized = re.sub(r'^\d{2}\.\d{1,2}\s+', '', normalized)
    normalized = re.sub(r'\d{2}년\s*\d{1,2}월', '', normalized)
    normalized = re.sub(r'\d{4}\.\d{1,2}월?', '', normalized)
    normalized = re.sub(r'\(\d{2}년?\s*\d{1,2}월?\)', '', normalized)
    normalized = re.sub(r'\(\d{2}\.\d{1,2}\)', '', normalized)
    # 연도 정보 제거
    normalized = re.sub(r'\d{4}년도?\s*', '', normalized)
    # 공통 접두사 제거
    normalized = re.sub(r'^공통\s*[A-Za-z가-힣]+팀?\s*', '', normalized)
    normalized = re.sub(r'^[A-Za-z]+팀\s*', '', normalized)
    # 접미사 제거
    normalized = re.sub(r'\s*정산의?\s*건?\s*$', '', normalized)
    normalized = re.sub(r'\s*계약\s*정산\s*$', '', normalized)
    normalized = re.sub(r'\s*계약\s*$', '', normalized)
    normalized = re.sub(r'\s*비용\s*$', '', normalized)
    normalized = re.sub(r'\s*의\s*건\s*$', '', normalized)
    normalized = re.sub(r'\s*갱신\s*$', '', normalized)
    normalized = re.sub(r'\s*연간\s*$', '', normalized)
    # 특수문자 정리
    normalized = re.sub(r'[_]+', ' ', normalized)
    normalized = re.sub(r'\s+', ' ', normalized)
    normalized = normalized.strip()
    
    # 특정 패턴 통합
    if 'MERP' in normalized or 'OMS' in normalized or 'GOMS' in normalized:
        return 'MERP/OMS 시스템 유지보수'
    if 'RFID' in normalized and '고도화' in normalized:
        return 'RFID 고도화'
    if 'RFID' in normalized and ('유지보수' in normalized or 'S/W' in normalized):
        return 'RFID S/W 유지보수'
    if '물류' in normalized and 'RFID' in normalized:
        return '물류 RFID 유지보수'
    if 'PLM' in normalized:
        return 'PLM 유지보수'
    if '인플루언서' in normalized:
        return '인플루언서시스템 유지보수'
    if '웹플랫폼' in normalized and '인프라' in normalized:
        return '웹플랫폼 인프라 운영'
    if '웹플랫폼' in normalized and 'FE' in normalized:
        return '웹플랫폼 FE 개발/운영'
    if 'WP팀' in normalized and '인프라' in normalized:
        return '웹플랫폼 인프라 운영'
    if 'WP팀' in normalized:
        return '웹플랫폼 인프라 운영'
    if 'AWS' in normalized and 'MSP' in normalized:
        return 'AWS MSP'
    if 'OCI' in normalized:
        return 'OCI 클라우드 인프라'
    if 'AWS' in normalized or '클라우드' in normalized:
        return 'AWS 클라우드'
    if '크롤링' in normalized:
        return '크롤링 유지보수'
    if 'VLM' in normalized:
        return 'VLM 모델 파인튜닝'
    if '네트워크' in normalized and '유지보수' in normalized:
        return '네트워크 유지보수'
    if '네트워크' in normalized and '접근제어' in normalized:
        return '네트워크 접근제어 솔루션'
    if '방화벽' in normalized:
        if '웹' in normalized:
            return '웹방화벽 유지보수'
        return '방화벽 유지보수'
    if '스토리지' in normalized:
        return '스토리지 장비 유지보수'
    if 'Github' in normalized:
        return 'Github SW 라이선스'
    if '오라클' in normalized or ('DB' in normalized and '라이선스' in normalized):
        return '오라클 DB 라이선스'
    if 'SAP' in normalized and 'DB' in normalized:
        return 'SAP DB 암호화 솔루션'
    if 'WMS' in normalized:
        return 'WMS 라이선스 유지보수'
    if 'OZ' in normalized:
        return 'OZ Report 유지보수'
    if 'POS' in normalized:
        return 'POS 결제 솔루션'
    if 'HR' in normalized and '대시보드' in normalized:
        return 'HR 대시보드 유지보수'
    if '연결솔루션' in normalized:
        return '연결솔루션 유지보수'
    if '개인정보' in normalized:
        return '개인정보 검색 솔루션'
    if '망연계' in normalized:
        return '망연계솔루션 유지보수'
    if 'IDC' in normalized:
        return 'IDC 보안 관제'
    if '도메인' in normalized:
        return '도메인 연장'
    if '메가존' in normalized:
        return '메가존 운영 인력 용역'
    if 'ERP' in normalized:
        return 'ERP 유지보수'
    if 'PC유지보수' in normalized or 'PC 유지보수' in normalized:
        return 'PC 유지보수'
    if '랜유지보수' in normalized or '랜 유지보수' in normalized:
        return '랜 유지보수'
    if '푸셔' in normalized or 'Pusher' in normalized.lower():
        return '실시간 통신 솔루션(푸셔)'
    
    return normalized if normalized else text

# IT팀 데이터 테스트
with open('out/it_maintenance_details.json', encoding='utf-8') as f:
    data = json.load(f)

it_data = [r for r in data['2025'] if r['cctr'] == 'IT팀' and r['amount'] > 0]

print(f"=== IT팀 2025년 데이터 ({len(it_data)}건) ===\n")
normalized_map = {}
for r in it_data:
    original = r['text']
    normalized = normalize_detail_text(original)
    if normalized not in normalized_map:
        normalized_map[normalized] = []
    normalized_map[normalized].append({'month': r['month'], 'amount': r['amount'], 'original': original})

print(f"정규화 후 항목 수: {len(normalized_map)}개\n")

for norm_text, items in sorted(normalized_map.items(), key=lambda x: -sum(i['amount'] for i in x[1]))[:15]:
    total = sum(i['amount'] for i in items)
    months = sorted(set(i['month'] for i in items))
    print(f"{norm_text}")
    print(f"  합계: {total}백만원, 월: {', '.join(months)}")
    # 원본 텍스트 샘플
    originals = list(set(i['original'][:40] for i in items))[:3]
    for o in originals:
        print(f"  - {o}...")
    print()
