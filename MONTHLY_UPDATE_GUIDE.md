# 📅 월별 데이터 업데이트 가이드

## 🔄 매월 업데이트 필요 항목

### 1. **인건비 설명 (하드코딩)**

**파일 위치:** `app/app/page.tsx` (약 275-283번째 줄)

**수정 방법:**
```typescript
// ⚠️ 매월 업데이트 필요: 인원수 및 부서별 변동 내역을 수동으로 업데이트하세요!
// 현재 데이터: 2025년 10월 기준
description = `전년 대비 ${Math.abs(yoyChange).toFixed(1)}% ${changeDirection}. `;
description += `인원수 전년 241명 → 당년 245명 (+4명). `;
description += `주요 변동: 해외사업팀+10명, 통합소싱팀+8명, 통합영업팀+4명, 글로벌슈즈팀-10명, 임원-2명, 이비즈-3명, IT/프로세스-3명.`;
```

**업데이트 예시 (11월 데이터로 변경 시):**
```typescript
// 현재 데이터: 2025년 11월 기준
description = `전년 대비 ${Math.abs(yoyChange).toFixed(1)}% ${changeDirection}. `;
description += `인원수 전년 250명 → 당년 255명 (+5명). `;
description += `주요 변동: 영업팀+8명, 마케팅팀+5명, 디자인팀-3명.`;
```

---

### 2. **OpenAI 분석 CSV 재생성**

**파일 위치:** `myvenv/create_account_analysis_with_ai.py`

**실행 방법:**
```bash
cd myvenv
python create_account_analysis_with_ai.py
```

**생성 파일:** `myvenv/out/gl_account_analysis_ai.csv`

**주의사항:**
- OpenAI API 키가 스크립트에 입력되어 있어야 함
- 새로운 월의 상세 CSV 파일이 `out/details/{YYYYMM}/` 폴더에 있어야 함

---

### 3. **CSV 데이터 업데이트**

**필요한 CSV 파일:**
1. `out/pivot_by_gl_cctr_yyyymm_combined.csv` - 계정별/코스트센터별 데이터
2. `out/pivot_by_gl_yyyymm_combined.csv` - 계정별 데이터 (드릴다운용)
3. `out/headcount_monthly_latest.csv` - 인원수 데이터
4. `out/details/{YYYYMM}/` - 계정별 상세 CSV 파일들

---

## 🚀 배포 프로세스

### 1. 로컬에서 수정
```bash
# 1. 인건비 설명 수정 (app/app/page.tsx)
# 2. OpenAI 분석 재생성 (선택사항)
cd myvenv
python create_account_analysis_with_ai.py

# 3. 변경사항 확인
cd ..
npm run dev
```

### 2. Git 커밋 & 푸시
```bash
git add .
git commit -m "feat: Update monthly data for YYYY-MM"
git push origin main
```

### 3. Vercel 자동 배포
- GitHub에 푸시하면 Vercel이 자동으로 배포
- 배포 상태: https://vercel.com/dashboard

---

## 📝 체크리스트

매월 업데이트 시 확인:

- [ ] CSV 파일 업데이트 완료
- [ ] 인건비 설명 하드코딩 수정 (page.tsx)
- [ ] OpenAI 분석 CSV 재생성 (선택)
- [ ] 로컬에서 테스트 완료
- [ ] Git 커밋 & 푸시
- [ ] Vercel 배포 확인

---

## ⚠️ 주의사항

1. **인건비 설명은 자동 생성되지 않음** - 반드시 수동으로 코드 수정 필요
2. **로컬 스토리지 편집은 개인 브라우저에만 저장됨** - 모든 사용자에게 적용하려면 코드 수정 필요
3. **OpenAI API 키는 절대 GitHub에 커밋하지 말 것** - 로컬에서만 사용

---

## 🆘 문제 해결

### 인건비 설명이 업데이트 안 됨
→ 브라우저 로컬 스토리지 초기화: F12 → Application → Local Storage → 삭제

### 배포 후에도 이전 데이터가 보임
→ 브라우저 캐시 삭제: Ctrl + Shift + R (강력 새로고침)

### OpenAI 분석 실패
→ API 키 확인 및 CSV 파일 경로 확인

