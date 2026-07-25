# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WeMarket QR 메뉴 플랫폼 — 식당/카페 운영자가 QR 코드 기반 디지털 메뉴, 주문, 결제(Toss Payments), 재고, CRM을 통합 관리하는 SaaS 서비스. 백엔드(Express + Prisma/PostgreSQL)와 프론트엔드(React + Vite)가 단일 레포에 공존한다.

**배포 토폴로지**: Vercel은 프론트엔드 정적 파일만 서빙. 백엔드 API는 Render(`https://wemarket.onrender.com`)에서 별도 운영. 프론트엔드는 `localhost`가 아닌 모든 환경에서 Render API를 호출하도록 하드코딩되어 있다(`frontend/src/api/index.js`의 `getApiUrl()`).

## Commands

### 백엔드

```bash
node index.js                         # 서버 실행
npm run db:push                        # DB 스키마 동기화 (스테이징 전용, --accept-data-loss 포함)
npm run seed                           # 시드 데이터 투입

npm test                               # 전체 테스트 (커버리지 포함)
npm run test:watch                     # 감시 모드
npx jest tests/unit/auth               # 단일 파일/디렉토리 실행
npm run lint:backend                   # ESLint
```

### 프론트엔드

```bash
cd frontend
npm run dev        # Vite 개발 서버 (localhost:5173)
npm run build      # 프로덕션 빌드 → frontend/dist/
npm run lint       # ESLint
```

### 전체 빌드 (Vercel / 배포)

```bash
npm run build          # Prisma 클라이언트 생성 + 프론트엔드 빌드
npm run vercel-build   # 프론트엔드만 (Vercel 환경)
```

## Architecture

### 백엔드 (`/`)

- **진입점**: `index.js` → `app.js`
- **프레임워크**: Express 5 + Socket.io
- **DB**: Prisma ORM + PostgreSQL (Supabase). `config/prisma.js`에서 싱글턴 클라이언트 생성
- **라우팅**: `app.js`에서 `/api/<리소스>` 형태로 30개 라우터를 일괄 등록. 라우터 파일은 `routes/`에 위치
- **SPA 폴백**: API 경로(`/api/*`)가 아닌 모든 GET 요청은 `frontend/dist/index.html`로 폴백

### 프론트엔드 (`/frontend`)

- **프레임워크**: React 19 + Vite 7 + Tailwind CSS 4
- **상태 관리**: TanStack Query v5 (서버 상태), React Context (인증)
- **라우팅**: React Router v7. `App.jsx`에서 Admin 컴포넌트는 `lazy()`로 코드 스플리팅
- **실시간**: Socket.io-client로 주문/채팅/대기열 동기화
- **PWA**: `vite-plugin-pwa` — Service Worker, 오프라인 폴백(`public/offline.html`)
- **경로 별칭**: `@` → `frontend/src/`

### 주요 디렉토리

```
routes/       Express 라우터 (30개 리소스)
controllers/  비즈니스 로직 (라우터에서 분리된 경우)
services/     외부 연동 (notificationService, PaymentService/Toss, aiService/Gemini, CampaignService)
middleware/   auth.js, storeAuth.js, validate.js, responseFormatter.js, performanceMonitor.js
utils/        errorHandler.js, i18n.js, logger.js (Winston)
prisma/       schema.prisma — 단일 진실 소스
frontend/src/
  pages/      라우트 단위 페이지 컴포넌트
  components/ admin/, common/ 등 재사용 컴포넌트
  hooks/      커스텀 훅
  contexts/   AuthContext.jsx (JWT + localStorage 기반)
  api/        Axios 기반 API 클라이언트 함수
tests/
  unit/       Jest 단위 테스트
  integration/ 통합 테스트
  e2e/        Playwright E2E
```

### 인증 흐름

1. `/api/auth/login` → JWT(2h) + refreshToken(7d) 발급
2. 1차 인증 수단: **핸드폰 번호**(숫자만 정규화), 레거시 호환: 이메일
3. `identifier` 필드가 핸드폰 번호 또는 이메일을 모두 수용
4. 클라이언트: `localStorage`에 `token`/`refreshToken` 저장, `Authorization: Bearer <token>` 헤더 첨부
5. `middleware/auth.js`가 토큰 검증 후 `req.user` 주입 (`optionalAuth` 변형도 존재)
6. 매장별 작업은 `middleware/storeAuth.js`(`checkStorePermission`)로 추가 권한 확인

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

`middleware/responseFormatter.js`가 `res.success(data, message, status)` 헬퍼를 주입. 성공 응답은 `{ success: true, data, message }` 형태.

에러는 `utils/errorHandler.js`의 `AppError(message, statusCode)` 클래스를 `throw`하거나 `next()`에 전달. Prisma P2002(unique 위반) 등 DB 에러는 errorHandler에서 일관되게 처리.

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

### Prisma 스키마 변경 절차

1. `prisma/schema.prisma` 수정
2. `npm run db:push` (개발/스테이징) 또는 SQL 마이그레이션 파일 생성
3. `npx prisma generate`로 클라이언트 재생성 (빌드 스크립트에 포함됨)

### 배포

- **플랫폼**: Vercel (프론트엔드 정적 파일) + Render (백엔드 API 서버)
- **설정**: `vercel.json` — `buildCommand`, `outputDirectory: "frontend/dist"`, SPA 라우팅 폴백
- **필수 환경 변수**: `DATABASE_URL`, `DIRECT_URL` (Supabase), `JWT_SECRET`, `TOSS_SECRET_KEY`, `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, `CORS_ORIGIN`
- Firebase Messaging Service Worker는 `/firebase-messaging-sw.js` 엔드포인트에서 환경변수 기반으로 동적 생성됨
