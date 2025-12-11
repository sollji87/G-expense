# Vercel KV (Redis) 설정 가이드

## 1단계: Vercel에서 KV 데이터베이스 생성

1. [Vercel 대시보드](https://vercel.com/dashboard)에 로그인
2. 프로젝트 선택 → **Storage** 탭 클릭
3. **Create Database** → **KV** 선택
4. 데이터베이스 이름 입력 (예: `expense-insights`)
5. 리전 선택 (Asia - Tokyo 추천)
6. **Create** 버튼 클릭

## 2단계: 환경 변수 복사

KV 데이터베이스가 생성되면:
1. **Storage** → 생성한 KV 클릭
2. **Quickstart** 또는 **Settings** 탭에서 환경 변수 확인
3. 다음 4개의 환경 변수를 `.env.local` 파일에 복사:

```env
# .env.local 파일 내용
KV_URL=redis://...
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...
```

## 3단계: Vercel 프로젝트에 환경 변수 연결

1. **Storage** → KV 데이터베이스 선택
2. **Connect to Project** 클릭
3. 프로젝트 선택 후 연결

> ⚠️ **중요**: Vercel에 배포할 때는 환경 변수가 자동으로 연결됩니다.
> 로컬 개발 시에만 `.env.local` 파일이 필요합니다.

## 4단계: 기존 데이터 마이그레이션

기존 `account_descriptions.json` 파일의 데이터를 Redis로 이전:

### 방법 1: API를 통한 마이그레이션

```bash
# 기존 JSON 파일 내용을 읽어서 마이그레이션 API에 전송
curl -X POST http://localhost:3000/api/insights/migrate \
  -H "Content-Type: application/json" \
  -d '{
    "descriptions": {
      "IT수수료_IT수수료_지급수수료_IT사용료": "전년 대비 16백만원 증가",
      "IT수수료_SW상각비_감가상각비_소프트웨어": "전년 대비 86백만원 감소",
      "IT수수료_IT수수료_지급수수료_IT유지보수비": "전년 대비 20백만원 증가"
    }
  }'
```

### 방법 2: 브라우저 콘솔에서 마이그레이션

```javascript
// 기존 데이터
const oldData = {
  "IT수수료_IT수수료_지급수수료_IT사용료": "전년 대비 16백만원 증가",
  "IT수수료_SW상각비_감가상각비_소프트웨어": "전년 대비 86백만원 감소",
  "IT수수료_IT수수료_지급수수료_IT유지보수비": "전년 대비 20백만원 증가"
};

// 마이그레이션 실행
fetch('/api/insights/migrate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ descriptions: oldData })
}).then(r => r.json()).then(console.log);
```

## API 사용법

### 설명 저장 (POST /api/descriptions)
```javascript
fetch('/api/descriptions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    accountId: 'IT수수료_IT수수료_지급수수료_IT사용료',
    description: '전년 대비 16백만원 증가'
  })
});
```

### 설명 조회 (GET /api/descriptions)
```javascript
fetch('/api/descriptions').then(r => r.json()).then(console.log);
```

### 설명 삭제 (DELETE /api/descriptions)
```javascript
fetch('/api/descriptions', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    accountId: 'IT수수료_IT수수료_지급수수료_IT사용료'
  })
});
```

## 프로젝트 구조

```
app/
├── lib/
│   └── redis.ts              # Redis 클라이언트 및 유틸리티 함수
├── app/api/
│   ├── descriptions/
│   │   └── route.ts          # 기존 설명 API (Redis 기반으로 업데이트됨)
│   └── insights/
│       ├── save/route.ts     # 저장 API
│       ├── get/route.ts      # 조회 API
│       └── migrate/route.ts  # 마이그레이션 API
└── ENV_SETUP.md              # 이 파일
```

## 장점

✅ **여러 명이 동시에 수정 가능** - Redis가 중앙 저장소 역할  
✅ **Vercel 서버리스 환경 호환** - 파일 시스템 의존 없음  
✅ **실시간 동기화** - 수정 즉시 모든 사용자에게 반영  
✅ **데이터 영구 보존** - 배포해도 데이터 유지  

## 트러블슈팅

### "Redis 연결 실패" 오류
- `.env.local` 파일에 환경 변수가 올바르게 설정되어 있는지 확인
- Vercel 대시보드에서 KV가 프로젝트에 연결되어 있는지 확인

### "401 Unauthorized" 오류
- `KV_REST_API_TOKEN` 값이 올바른지 확인
- 토큰에 공백이나 줄바꿈이 포함되지 않았는지 확인


