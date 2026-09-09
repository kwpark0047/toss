# WeMarket QR 메뉴 플랫폼

식당·카페 운영자가 QR 코드 기반 디지털 메뉴, 주문, 결제(Toss Payments), 재고, CRM을
통합 관리하는 SaaS 서비스. 백엔드(Express + Prisma/PostgreSQL)와 프론트엔드(React + Vite)가
단일 레포에 공존한다.

- **버전**: `1.3.0` (`package.json`)
- **Node 요구사항**: `>=22.22.0`
- **백엔드 진입점**: `index.mts` (ESM)
- **배포 토폴로지**: 백엔드 API는 Render(`https://wemarket.onrender.com`), 프론트엔드는
  Cloudflare Workers Static Assets(`https://toss.wemarket.workers.dev`)에서 제공한다.
  Cloudflare Worker가 `/api/*`를 백엔드로 프록시한다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 백엔드 | Express 5 + Socket.io (Node 22, ESM) |
| DB | Prisma ORM + PostgreSQL (Supabase) |
| 프론트엔드 | React 19 + Vite 7 + Tailwind CSS 4 |
| 상태 관리 | TanStack Query v5 (서버 상태), React Context (인증) |
| 라우팅 | React Router v7 (`App.jsx`에서 Admin은 `lazy()` 코드 스플리팅) |
| 실시간 | Socket.io-client (주문/채팅/대기열 동기화) |
| PWA | `vite-plugin-pwa` (Service Worker, 오프라인 폴백 `public/offline.html`) |
| 외부 연동 | Toss Payments, Google Gemini(AI), Firebase(메시징), Naver/Kakao 등 |
| 모니터링 | Prometheus + Grafana + Loki + Promtail + Alertmanager (`monitoring/`) |

스키마에는 **86개의 Prisma 모델**, 백엔드에는 **60+개의 Express 라우터**가 등록되어 있다.

---

## 시작하기

### 1. 환경 변수

백엔드 실행 전에 `.env` 파일을 구성한다. 필수 변수:

```bash
# DB
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...   # Supabase pooler 우회용
REPLICA_URL=postgresql://...  # (선택) 읽기 복제본

# 인증
JWT_SECRET=...                # access token (16자 이상)
JWT_REFRESH_SECRET=...
PHONE_ENC_KEY=...             # 휴대폰 번호 AES-256-CBC 암호화 키 (>=16자)
TOKEN_ENC_KEY=...

# 결제 (Toss)
TOSS_SECRET_KEY=...
TOSS_CLIENT_KEY=...
TOSS_WEBHOOK_SECRET=...
TOSS_WEBHOOK_SIGNING_SECRET=
TOSS_WEBHOOK_IPS=

# Firebase 메시징
FIREBASE_SERVICE_ACCOUNT_JSON=
FIREBASE_SERVICE_ACCOUNT_PATH=

# CORS
CORS_ORIGIN=https://toss.wemarket.workers.dev
FRONTEND_URL=
BACKEND_URL=

# (선택) AI/지도/SMS 등
GEMINI_API_KEY=...
KAKAO_REST_API_KEY=...
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
SMS_API_KEY=...
SMS_API_SECRET=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=...
```

### 2. 의존성 및 DB 준비

```bash
npm install
npx prisma generate      # Prisma 클라이언트 생성 (postinstall에도 포함)
npm run db:push          # DB 스키마 동기화 (스테이징 전용, --accept-data-loss 포함)
npm run seed             # 시드 데이터 투입
```

### 3. 백엔드 실행

```bash
node index.mts           # 서버 실행
# 또는
npm start
```

기본 API 베이스: `http://localhost:3000/api`, 헬스체크: `http://localhost:3000/api/health`

### 4. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev              # Vite 개발 서버 (localhost:5173)
```

---

## 테스트

```bash
npm test                  # 전체 테스트 (유닛 + 라우트, 커버리지 포함)
npm run test:unit         # 유닛/라우트
npm run test:routes       # 라우트 전용
npm run test:integration  # 통합 (jest.config.integration.js)
npm run test:regression   # 회귀 테스트
npm run test:watch        # 감시 모드
npx jest tests/unit/auth  # 단일 파일/디렉토리 실행
```

E2E (Playwright):

```bash
npm run test:e2e                      # chromium
npm run test:e2e:mobile               # mobile-chrome / mobile-safari
npm run test:e2e:headed               # headed 모드
npm run test:e2e:report               # report 열기
```

검증·린트:

```bash
npm run lint                # ESLint (backend 전체)
npm run validate:routes     # 라우트 배선 검증
npm run validate:api        # API 계약 검증
npm run validate:jsx        # 프론트엔드 JSX 참조 검증
npm run security:scan       # Semgrep (backend)
npm run security:scan:frontend
```

---

## 전체 빌드 (배포)

```bash
npm run build             # Prisma 클라이언트 생성 + 프론트엔드 빌드
npm run cloudflare-build  # 프론트엔드만 (Cloudflare Workers Static Assets)
```

---

## 아키텍처

### 백엔드 (`/`)

- **진입점**: `index.mts` → `app.js`
- **프레임워크**: Express 5 + Socket.io
- **DB**: Prisma ORM + PostgreSQL (Supabase). `config/prisma.js`에서 싱글턴 생성
- **라우팅**: `app.js`에서 `/api/<리소스>` 형태로 라우터 일괄 등록. 라우터 파일은 `routes/`에 위치
- **계층 구조**: `routes/`(HTTP 바운더리) → `controllers/`(진입 로직) → `services/`(비즈니스 로직) → `repositories/`(데이터 접근), `app/`에 clean-arch(domain/application/infrastructure/interfaces) 레이어도 존재
- **SPA 폴백**: `/api/*`가 아닌 모든 GET은 `frontend/dist/index.html`로 폴백

### 프론트엔드 (`/frontend`)

- **진입점**: `frontend/src/main.jsx`, 라우트는 `frontend/src/App.jsx`
- **경로 별칭**: `@` → `frontend/src/`

### 주요 디렉토리

```
routes/        Express 라우터
controllers/   라우터 진입 로직 / 비즈니스 일부
services/      외부 연동·핵심 비즈니스 (PaymentService/Toss, aiService/Gemini, CampaignService, CommunityService, StaffService 등)
repositories/  데이터 접근 계층
middleware/    auth.js, storeAuth.js, validate.js, responseFormatter.js, performanceMonitor.js
utils/         errorHandler.js, i18n.js, logger.js(Winston), phoneEncryption.js(AES-256-CBC)
config/        설정 (prisma.js 등)
prisma/        schema.prisma — 단일 진실 원천 (86 모델)
app/           clean-arch 레이어 (domain/application/infrastructure/interfaces)
scripts/       유틸리티/백필 (mask_card_numbers.js, validate-*.js, seed_*.js 등)
monitoring/    Prometheus/Grafana/Loki/Promtail/Alertmanager 설정
metrics/       PrometheusMetrics.mts, metricsRouter.mts
tests/         unit/ · routes/ · integration/ · regression/ · e2e/(Playwright)
frontend/src/  pages/ · components/ · hooks/ · contexts/ · api/ · lib/
```

### 인증 흐름

1. `/api/auth/login` → JWT(2h) + refreshToken(7d) 발급
2. 1차 인증 수단: **핸드폰 번호**(숫자만 정규화), 레거시 호환: 이메일
3. `identifier` 필드가 핸드폰 번호 또는 이메일을 모두 수용
4. 클라이언트: `localStorage`에 `token`/`refreshToken` 저장, `Authorization: Bearer <token>` 헤더 첨부
   (선택: `USE_HTTPONLY_COOKIE`로 HttpOnly 쿠키 모드 전환)
5. `middleware/auth.js`가 토큰 검증 후 `req.user` 주입 (`optionalAuth` 변형도 존재)
6. 매장별 작업은 `middleware/storeAuth.js`(`checkStorePermission`)로 추가 권한 확인
7. 관리자 2FA: **TOTP 기반 2단계 인증** (`services/TwoFactorService.js`) + 매니저 SMS OTP
   (`controllers/admin2faController.js`)

### 역할 및 권한 (storeAuth.js)

| 역할 | 주요 권한 |
|------|-----------|
| `owner` | 모든 권한 (store:update, store:delete, staff:manage 포함) |
| `manager` | store:update, items:manage, orders:manage, staff:manage, stats:read |
| `staff` | orders:manage, order:read |
| `kitchen` | orders:manage, order:read |
| `super_admin` | 모든 매장 무조건 통과 |

`checkStorePermission('permission:name')` 형태로 라우터에서 사용.

### API 응답 형식

`middleware/responseFormatter.js`가 `res.success(data, message, status)` 헬퍼를 주입.
성공 응답은 `{ success: true, data, message }` 형태.

에러는 `utils/errorHandler.js`의 `AppError(message, statusCode)` 클래스를 `throw`하거나
`next()`에 전달. Prisma P2002(unique 위반) 등 DB 에러는 errorHandler에서 일관 처리.

### Socket.io 룸 명명 규칙

```
store - {storeId}             매장 전체 이벤트 (주문, 매니저 호출)
kitchen - {storeId}           주방 전용
order - {orderId}             주문 상태 추적
table - cart - {tableId}      공유 장바구니
customer-orders-{phone}       고객 주문 상태 (숫자만 정규화된 번호)
store - waiting - {storeId}   대기 관리 (관리자)
customer - waiting - {phone}  대기 상태 추적 (고객)
```

---

## 보안 정책 (요약)

- **전화번호**: `utils/phoneEncryption.js`에서 AES-256-CBC **결정론적 암호화**(동일 입력→동일
  암호문)로 DB 검색 가능하게 저장. 형식 `enc:<iv_hex>:<cipher_hex>`. 안전한 무작위 대체 참고:
  `docs/` 내 보안 검토 문서.
- **결제 카드번호**: Toss 승인 응답의 카드번호는 저장 전 즉시 마스킹한다. 전방 6자리와 후방
  4자리만 유지하는 `123456******1234` 형식을 사용한다(정책 상세는 아래와 `services/PaymentService.js`,
  `scripts/mask_card_numbers.js` 참조). 운영 DB의 과거 레코드는 `npm run backfill:mask-card-numbers`로
  백필할 수 있다.
- **OTP 만료**: 전화번호/매니저 OTP 유효시간은 기본 5분(`5 * 60 * 1000`)이며 여러 코드 경로
  (`controllers/authController.js`, `controllers/admin2faController.js`,
  `services/TwoFactorService.js`)에 걸쳐 있다. 통합 설정 리팩터링은 `docs/` 로드맵 참조.
- **민감 필드 로깅**: `services/AuditLogService.js`가 `card_number` 등 민감 필드를 감사 로그에서
  제외·마스킹 처리.

---

## 배포

| 플랫폼 | 대상 | 방식 |
|--------|------|------|
| Render | 백엔드 API 서버 | GitHub Actions `deploy` 잡이 `RENDER_DEPLOY_HOOK_URL`로 트리거 |
| Cloudflare Workers Static Assets | 프론트엔드 정적 파일 | `wrangler-action` (wrangler v4) |
| GitHub Actions | CI/CD | `.github/workflows/ci.yml` 등 (아래 참조) |

GitHub Actions 워크플로우 (`.github/workflows/`):

- `ci.yml` — push/PR 시 **필수**: lint, Prisma validate, 유닛/라우트 테스트, 라우트·API 계약 검증.
  통합/E2E/보안/Docker/번들/Lighthouse는 `workflow_dispatch` 또는 주간 스케줄로만 실행.
- `test.yml` — 통합 테스트 (수동/스케줄)
- `playwright.yml` — E2E 테스트 (주의 새벽 3시 스케줄)
- `security.yml` — Semgrep, npm audit, TruffleHog, dependency-review (주간/수동)

> ⚠️ CI 빌링(무료 티어 소진) 관련 진단·개선 가이드는 `docs/ci-billing-guide.md`를 참조한다.

---

## CI/빌링 현황 및 진단

GitHub Actions 무료 티어(월 2,000분)를 초과해 CI가 차단된 이력이 있다. 원인·진단·개선 가이드를
`docs/ci-billing-guide.md`에 정리했다. 핵심:

- 필수 잡(유닛/라우트/린트)은 push마다 실행되고, 무거운 잡(통합/E2E/Docker/보안/플레이오토)은
  이미 `workflow_dispatch` + 주간 스케줄로 제한되어 있다.
- 남은 개선 여지: 캐시 최적화, 테스트 병렬화·분할, 주간 스케줄 중복 제거, 외부 플랫폼(Render/
  Cloudflare) 배포 잡 부하 최소화 등. 상세는 문서 참조.

---

## 로드맵 및 알려진 개선 사항

상세 로드맵은 `docs/` 아래 문서를 참조한다. 주요 항목:

- **OTP 5분 하드코딩 통합**: 여러 파일에 흩어진 OTP 만료 상수를 단일 설정으로 통합
- **중복 모델 정리(코드 레벨)**: `posts`/`community_posts`, `staff` 계열 등 유사 모델의 코드
  사용을 정리 (스키마·DB 변경 없음, 코드 레벨만)
- **모니터링/배포**: Prometheus 지표, Grafana 대시보드, Render 벤더 락인 완화
- **결제 보안**: 마스킹 정책(앞6-뒤4) 확산 및 저장 값 감사

> 로드맵·보안·모니터링·배포 상세: `docs/ROADMAP.md`, `docs/ci-billing-guide.md`,
> `docs/security-otp-phone.md`
