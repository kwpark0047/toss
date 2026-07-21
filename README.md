# WeMarket

SaaS QR Menu & Small Business Platform — QR 코드 기반 매장 운영(메뉴, 주문, 결제, 키칭 디스플레이, 알림)을 지원하는 풀스택 플랫폼.

## 기술 스택

- **Backend**: Node.js + Express 5 (`express@^5.2.1`), Socket.IO (`^4.8.3`), Helmet (`^8.1.0`), CORS
- **Database**: PostgreSQL + Prisma ORM (`^5.22.0`)
- **Frontend**: React (Vite SPA), `react-i18next` (ko/en/ja/zh 4개 locale)
- **Infra**: Cloudflare Pages / Workers, Vercel (빌드), Render (`render.yaml`) 배포 지원
- **Test**: Jest (`^25.5.4`), Playwright (E2E), React Testing Library
- **Security**: helmet 보안 헤더 + CSP nonce (`middleware/cspNonce.js`), XSS sanitizer, domain 기반 CORS 화이트리스트 (`config/domain.js`)

## 디렉토리 구조

```
app.js                 Express 앱 + 미들웨어 체인 (helmet → cors → cspNonce → ...)
index.js               HTTP 서버 기동 + Socket.IO + Graceful Shutdown + 크론
routes/                Express 5 Router (46개 도메인 라우트)
controllers/           요청 핸들러 (41개)
services/              비즈니스 로직 (36개)
repositories/          Prisma 데이터 접근 계층 (22개)
middleware/            인증/보안/검증 미들웨어 (11개)
socket/                Socket.IO 핸들러 (주문/채팅/웨이팅 실시간)
utils/                 공통 유틸 (로깅, 검증 스키마, 에러)
config/                domain/CORS, env 설정
frontend/              React SPA (pages 32, components 127)
prisma/                schema.prisma (53개 모델) + 마이그레이션/시드
tests/                 backend 통합/회귀/단위 테스트 (52개 .test.js)
docs/                  Swagger 수동 정의
```

## 시작하기

### 요구사항

- Node.js 18+ (`.nvmrc` 참고)
- PostgreSQL (또는 호환 DB) + `DATABASE_URL`
- 패키지 매니저: npm (또는 pnpm)

### 설치 및 실행

```bash
# 1. 의존성 설치 (postinstall 가 prisma generate 자동 실행)
npm install

# 2. 환경변수 설정
cp .env.example .env
# DATABASE_URL, JWT_SECRET, 세션 키 등 필수 값 입력

# 3. DB 마이그레이션 + 시드
npx prisma migrate dev
npm run seed

# 4. 개발 서버 (백엔드 :3000, 프론트 별도)
npm start
```

### 프론트엔드 개발

```bash
cd frontend
npm install
npm run dev
```

## 주요 스크립트

| 스크립트 | 설명 |
|---|---|
| `npm start` | 프로덕션 서버 기동 (`node index.js`) |
| `npm run build` | Prisma generate + 프론트엔드 빌드 |
| `npm test` | Jest 전체 (coverage, `--forceExit --detectOpenHandles`) |
| `npm run test:unit` | 단위 테스트 |
| `npm run test:integration` | 통합 테스트 (`tests/integration`) |
| `npm run test:regression` | 회귀 테스트 |
| `npm run test:e2e` | Playwright E2E |
| `npm run db:migrate` | Prisma 마이그레이션(dev) |
| `npm run db:migrate:prod` | Prisma 마이그레이션(deploy) |
| `npm run seed` | 운영 시드 데이터 |
| `npm run lint:backend` | ESLint |
| `npm run security:scan` | semgrep 보안 스캔 (backend) |
| `npm run security:scan:frontend` | semgrep 보안 스캔 (frontend) |

## API 개요

모든 API는 `/api` 프리픽스. 주요 도메인: `auth`, `stores`, `products`, `orders`, `tables`, `payments`, `notifications`, `categories`, `admin`, `points`, `reviews`, `analytics`, `chat`, `cart`, `coupons`, `kds`(주방 디스플레이), `alimtalk`(카카오 알림톡), `sse`, `print-jobs`(로컬 프린트 에이전트) 등.

응답 형식은 `responseFormatter`(`utils/responseFormatter.js`)가 표준화: `res.success(data, msg, statusCode=200)`, `res.paginated(...)`.

실시간 기능은 Socket.IO로 제공 (주문 상태, 키칭 디스플레이, 채팅, 웨이팅).

## 보안

- **CSP + nonce**: `helmet`이 비-CSP 보안 헤더(HSTS, X-Frame-Options 등)를 담당하고, `middleware/cspNonce.js`가 요청별 CSP nonce를 생성해 `Content-Security-Policy` 헤더를 단독 소유 (helmet `contentSecurityPolicy: false` 로 충돌 회피).
- **CORS**: `config/domain.js` 화이트리스트 기반 origin 검증.
- **XSS**: 요청 본문 sanitizer(`middleware/xss*`) + 응답 포맷터.
- 보안 스캔: `npm run security:scan` (semgrep).

## 문서

- `CHANGELOG.md` — 실제 진행 이력 (최신 v1.1.0)
- `PROJECT_ANALYSIS.md` — 아키텍처/기술부채/추가기능 제안 분석 보고서
- `CLAUDE.md` — 개발 가이드
- `ANALYSIS_REPORT.md`, `ANALYSIS_REPORT.md v2.1.md` — i18n 구현 프로젝트 보고서 (별도 문서, 본 README와 무관)
- `docs/` — Swagger API 정의

## 알려진 기술 부채 (요약)

- `jest@^25.5.4` 낡음 + `express@^5.2.1` 조합, 테스트 스크립트가 `--forceExit --detectOpenHandles` 사용
- `responseFormatter` 기본 200 (생성 API 201 미사용)
- 테스트 커버리지가 backend 일부 라우트에 편중, E2E spec 대부분 제거됨
- 일부 미들웨어/utils가 10줄 미만으로 분산
- 자세한 내용은 `PROJECT_ANALYSIS.md` 참고
