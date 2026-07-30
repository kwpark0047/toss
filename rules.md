# WeMarket — Rules

## Architecture

### Backend 레이어 (Express 5)
```
routes/  →  controllers/  →  services/  →  repositories/  →  Prisma
middleware/  (auth, validation, rate-limit, error handler)
socket/  (Socket.IO 이벤트 핸들러)
app/  (DDD 스타일: application/ → domain/ → infrastructure/ → interfaces/http/)
```
- `routes/`: HTTP 라우팅만 (validation + controller 위임)
- `controllers/`: 요청 파싱, 응답 형식화 (`responseFormatter`)
- `services/`: 비즈니스 로직 (트랜잭션, 외부 API 호출)
- `repositories/`: DB 접근 (Prisma 쿼리, skipDuplicates: true)
- `app/application/`: DDD Use Case (신규 기능은 여기에 우선)
- `app/domain/`: 도메인 모델 + 인터페이스
- `app/infrastructure/`: 구현체 (Prisma Repository, DI container)

### 프론트엔드 레이어 (React 19 + Vite 7)
```
pages/  →  components/  (상태 + 렌더링)
hooks/  (TanStack Query + 커스텀 훅)
contexts/  (AuthContext: JWT localStorage)
api/  (HTTP 클라이언트 모듈)
lib/  (유틸리티)
utils/  (webVitals 등)
locales/  (i18n: ko/en/ja/zh)
```
- `react-router-dom` v7 lazy loading (`React.lazy` + `Suspense`)
- `@tanstack/react-query` v5 (서버 상태, staleTime 5분 기본)
- Zustand v4 (클라이언트 상태, 필요시)
- Tailwind CSS v4 (스타일링 전담)

## 코딩 컨벤션

### 명명
- 파일: `kebab-case.js` (라우트/컨트롤러/서비스/컴포넌트)
- 함수/변수: `camelCase`
- 클래스/컴포넌트: `PascalCase`
- DB 컬럼: `snake_case` (Prisma schema는 자동 매핑)
- 상수: `UPPER_SNAKE_CASE`

### API 설계
- RESTful, `/api/v1/` prefix
- 복수형 명사 (`/orders`, `/products`)
- 응답 형식: `{ success: true/false, data: {}, meta: {}, requestId: "uuid" }`
- 에러: HTTP 상태 코드 + 메시지
- 페이지네이션: `?page=1&limit=20` → `{ items: [], total, page, limit }`

### 인증
- JWT accessToken (2시간) + refreshToken (7일)
- `identifier` 필드 (phone/email 겸용)
- 권한 체크: `checkStorePermission('permission:name')` (middleware)
- Role: `owner` > `manager` > `staff`/`kitchen` > `super_admin`

### Socket.IO
- Room: `store-{storeId}`, `kitchen-{storeId}`, `order-{orderId}`
- Room: `table-cart-{tableId}`, `customer-orders-{phone}`
- Room: `store-waiting-{storeId}`, `customer-waiting-{phone}`

### DB 접근 (Prisma)
- `prisma.$transaction()` 으로 복수 연산 보호
- `skipDuplicates: true` 벌크 upsert
- Native enum: `OrderStatus`, `OrderPaymentStatus`, `PaymentTxStatus`
- Partial unique index는 ALTER TYPE 전 DROP 필요 (migration.sql)

### 로깅
- Winston + Loki (Grafana)
- 구조화된 JSON 로그: `{ timestamp, level, message, requestId, ...context }`
- 에러 로그는 `logger.error({ err, reqContext })`

### 테스트
- **Backend**: Jest + Supertest (unit, integration)
- **Frontend**: Vitest + React Testing Library
- **E2E**: Playwright
- 파일 패턴: `*.test.js`, `*.spec.js`

### Git 브랜치
- `main` ← `develop` ← `feature/*`
- Conventional Commits: `type(scope): description`
- Type: `feat`/`fix`/`chore`/`refactor`/`test`/`docs`/`ci`/`perf`

## 배포
- **Backend**: Render (`https://wemarket.onrender.com`) — Express + Socket.IO
- **Frontend**: Cloudflare Workers (`https://toss.wemarket.workers.dev`) — Vite static SPA
- **CI**: GitHub Actions (main 브랜치 push 시 자동)
- **DB**: Supabase PostgreSQL (Supavisor connection pool)

## 배포 시 특이사항
- Render는 Prisma Migrate를 자동 실행하지 않음 → 수동 또는 `npm start` 스크립트에 포함
- `008_add_status_enums` migration.sql에 partial index DROP/RECREATE 포함됨
- Frontend 빌드: `npm run cloudflare-build` (wrangler.json 적용)
- `.env` 필수값: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `JWT_SECRET`, `TOSS_SECRET_KEY`, `DATA_GO_KR_SERVICE_KEY`, `KAKAO_REST_API_KEY`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `FIREBASE_*`, `SLACK_WEBHOOK_URL`, `LOG_LEVEL`

## 응급 대응
- Prisma schema drift: `ADD COLUMN IF NOT EXISTS` migration 생성
- Enum migration 실패: partial index 확인 후 DROP → ALTER → RECREATE
- API가 HTML 반환 = Prisma 에러 (schema drift) → DB 확인 우선
