# Changelog

> WeMarket QR Menu Platform — SaaS for Small Business
> 최신 버전: v1.3.0 (2026-08-18)

---

## v1.3.0 (2026-08-18)

### 푸드트럭 디자인 쇼케이스 · 운영/정산 개선

#### 🎨 푸드트럭 디자인 테마 (Food Truck Design Showcase)
- **`food_trucks.design_theme` 컬럼 추가**: `concept1`~`concept5` 중 고객 노출용 디자인 콘셉트 선택 저장 (`prisma/migrations/20260818070000_add_food_truck_design_theme`)
- **`GET/PUT /api/stores/:storeId/design`**: `FoodTruckService.getDesignTheme`(기본 `concept1`)/`updateDesignTheme`(허용 목록 검증 + 소켓 브로드캐스트)
- **FoodTruckDesignShowcase**: 콘셉트 미리보기 UI + `/admin/stores/:storeId/foodtruck/design` 라우트

#### 💳 정산(Settlement) 강화
- **CSV 다운로드**: `GET /api/admin/stores/:storeId/settlements/:id?format=csv` — BOM 포함 `text/csv` 첨부
- **정산 삭제**: `DELETE /api/admin/stores/:storeId/settlements/:id` (PENDING 상태만, 기간 겹침 검증)
- **기간 검증 강화**: 시작≤종료, 미래 날짜 불가, 중복 기간 오류 메시지

#### 🛡️ 운영/권한 개선
- **공개 플랜 API**: `GET /api/plans` (활성 플랜만), 관리자용 `findAll()` — PlanUpgrade가 활성 플랜만 표시
- **상품/카테고리 권한 강화**: `checkStoreAccess` 적용 (owner 항상 허용)
- **사업자등록번호(체크 디지트)·계좌번호 형식 검증** (StoreService)
- **영수증 설정**: 저장 필드 화이트리스트 + Boolean 변환 + 기본값 병합
- **다이나믹 프라이싱 config 검증**: rule_type별 구조 검증 + 프론트 템플릿 자동 삽입/JSON 검증
- **알림톡 발송 이력 로깅** (AlimtalkService)
- **웨이팅/예약 취소 capability 헤더**: `x-waiting-capability` / `x-reservation-capability`

---


## v1.2.0 (2026-08-07)

### 매장 테마 설정 저장 · 메뉴판 적용 (Store Theme Settings)

#### 🎨 테마 저장/조회 파이프라인
- **Store 저장소/서비스에 theme 지원 추가**: `findBusinessInfo`가 `theme`(theme_settings)를 포함 조회, `updateBusinessInfo`가 theme_settings를 JSON으로 저장
- **BusinessSettingsWithTheme**: 로컬 프리셋을 공용 모듈로 분리 — `frontend/src/lib/themePresets.js` 신규 (THEME_PRESETS 6종, DEFAULT_THEME_SETTINGS, resolveThemeStyle, formatPriceWithOptions)
- **MenuPage 테마 적용**: `store.theme`에서 프리셋 색상/폰트, `menu_layout`(그리드), `ui_size`(카드 패딩), `menu_options`(배지/가격 포맷/단위 표시)를 파싱해 CSS 변수로 반영
- **MenuItemCard 옵션 지원**: `showBadge`, `priceFormat`, `showPriceUnit` prop 적용
- **themePresets 단위 테스트 추가** (`frontend/src/test/themePresets.test.js`)

#### 🔧 배포 인프라 정상화 (Deployment Pipeline)
- **Cloudflare Worker `/api` 프록시**: `frontend/worker.js`가 `/api/*` 요청을 백엔드(`https://wemarket.onrender.com`)로 프록시 — 배포본에서 `/api`가 SPA HTML로 응답되던 문제 해결
- **worker 스크립트 실행 보장**: 루트 `wrangler.json`(assets-only, main 없음)이 `frontend/wrangler.toml`보다 우선 로드되어 no-op worker + SPA 폴백만 동작하던 원인 제거, `run_worker_first = true` 추가
- **wrangler devDependency 고정**: wrangler-action@v3의 npx 비대화형 설치 실패(`no YES option`) 해결 위해 `wrangler@4.119.0` 고정 + 워크플로 `wranglerVersion` 지정
- **CI deploy job 최초 통과**: Render 재배포(hook) + frontend 빌드 + Cloudflare Workers 배포 전 단계 성공
- **통합 테스트 계약 정합**: 주문 API 페이지네이션 계약 및 OrderService 선행조회에 맞게 `orders.test.js`, `phase4.test.js` 수정

#### 🚀 배포 결과
- 백엔드: `https://wemarket.onrender.com` — `/api/health` 200 (v1.2.0)
- 프론트: `https://toss.wemarket.workers.dev` — SPA + `/api` 프록시 동작 확인

---

## v1.1.1 (2026-07-25)

### 성능 최적화 고도화 (Performance Optimization)

#### ⚡ 프론트엔드 성능 최적화
- **이미지 최적화**: `vite-imagetools` 도입 — AVIF/WebP/JPEG 자동 변환, `picture` 엘리먼트 생성으로 반응형 이미지 지원
- **번들 크기 분석**: `rollup-plugin-visualizer` 추가 — `bundle-analysis.html` 생성, gzip/brotli 크기 자동 계산
- **Critical CSS 인라인화**: `vite-plugin-critical-css` 적용 — index.html/offline.html above-the-fold CSS 인라인화로 FCP/LCP 개선
- **성능 예산 CI 통합**: `performance-budget.json` + `perf:budget` 스크립트 — script 4000KB, stylesheet 350KB, total 8500KB 게이트 설정
- **Web Vitals 모니터링**: `web-vitals` 라이브러리 통합 — LCP/FID/CLS/FCP/TTFB/INP 실시간 측정, `navigator.sendBeacon` 분석 엔드포인트 전송 지원
- **Preload/Preconnect 힌트**: `index.html`에 critical font preload, third-party(Unsplash, Kakao Maps, Solapi) preconnect/dns-prefetch 추가

#### 🔧 Service Worker 캐시 전략 강화
- **API 계층**: `NetworkFirst`(3s timeout) + `StaleWhileRevalidate`(비중요 GET) 하이브리드 전략 — perceived performance 향상
- **이미지/업로드/외부 리소스**: `CacheFirst` 전략 유지 (7일~1년 TTL)
- **Supabase Storage/Unsplash/Google Fonts**: 개별 캐시 전략 유지

#### 🏗 빌드/테스트 인프라
- **vite-imagetools**: AVIF/WebP/JPEG 자동 변환, `picture` 엘리먼트 생성
- **rollup-plugin-visualizer**: `bundle-analysis.html` 자동 생성 (gzip/brotli 크기 표시)
- **vite-plugin-critical-css**: Critical CSS 추출/인라인화 (index.html, offline.html)
- **performance-budget.json + perf:budget**: CI 게이트용 성능 예산 스크립트
- **web-vitals**: LCP/FID/CLS/FCP/TTFB/INP 측정, `navigator.sendBeacon` 분석 전송
- **vite.config.js**: `imagetools`, `visualizer`, `criticalCss` 플러그인 체인 추가

---

## v1.1.0 (2026-07-20)

### 대규모 리팩토링 및 i18n 다국어 지원

#### ✨ i18n 다국어 지원 (프론트엔드)
- **Login.jsx**: `useTranslation('auth')` 적용 — 로그인/OTP/회원가입 전면 번역
- **LandingPage.jsx**: 200+ 한국어 문자열 `useTranslation('landing')` 적용
- **MenuPage.jsx**: 메뉴판 페이지 i18n 변환
- **KitchenDisplay.jsx**: 주방 디스플레이 i18n 적용
- **메뉴 컴포넌트 7개 i18n 적용**: CartModal, CustomerPhoneSheet, MenuHeader, OptionSelectionModal, OrderStatusModal 외
- **locales/ko, en, ja, zh** 4개 언어 번역 파일 추가 (~350+ 키)
- **LanguageSwitcher**: i18n 연동 개선
- **i18n.js**: 언어 감지 및 localStorage 캐싱 로직 개선

#### 🏗 백엔드 라우트 구조 표준화
- 46개 라우트 파일 Express 5.2 Router 패턴으로 전면 재구성
- 모든 라우트 표준화된 JSDoc 주석 적용
- **신규 라우트 분리**: `auth.js`, `ai.js`, `payments.js`, `news.js`
- `app.js` 라우트 등록 체계 정리 (46개 모듈로 분할)

#### 🖨 print-agent 통합
- 프린터 인쇄 에이전트 신규 구축 (`print-agent/`)
  - `index.js`, `lib/client.js`, `lib/printer.js`
  - Jest 기반 단위 테스트 2개 (client, printer)
  - `printJobsController` + `routes/printJobs.js` 연동
  - `usePrinter` 훅 수정 및 통합

#### 🔒 보안 및 미들웨어 강화
- **CSP nonce 미들웨어** 추가 (`middleware/cspNonce.js`)
- **XSS sanitizer 미들웨어** 추가 (`middleware/xssSanitizer.js`)
- **CORS 도메인 설정** `config/domain.js`로 분리 (환경별 격리)
- `envValidator` 강화 — 필수 환경변수 누락 시 시작 차단

#### 🧪 테스트 인프라 확충
- **신규 테스트 파일**:
  - `tests/unit/services/OrderService.test.js`
  - `tests/unit/services/OrderService.geofence.test.js`
  - `tests/unit/services/AlimtalkService.test.js`
  - `tests/unit/controllers/crmController.test.js`
- **기존 테스트 보강**:
  - `PointsService.test.js`, `WaitingService.test.js`
  - `foodTruck.test.js`, `phase4.test.js`
- **E2E 테스트 정리**: Playwright 설정 유지, 불필요한 spec 제거
- **`__tests__/core.test.js`** 추가

#### 📦 의존성 관리 및 CI/CD
- **프론트엔드 npm → pnpm 마이그레이션** (package-lock.json → pnpm-lock.yaml)
- **GitHub Actions CI 워크플로우** 추가 (`.github/workflows/ci.yml`)
  - 4개 테스트 잡 (backend, frontend, e2e, lint)
  - Cloudflare Pages 배포 파이프라인
- **TWA 설정** 추가 (twa-manifest.json, build-twa.sh, assetlinks.json)

#### 🔧 코드 정리
- **PointService.js → PointsService.js** 통합 (중복 제거)
- `test.js`, `y/example.spec.ts` 제거
- 환경변수 템플릿 업데이트 (`.env.example`)
- **README.md 대폭 개선** — 설치/설정/개발 가이드

---

## v1.1.0 (2026-07-20)

### Cloudflare 마이그레이션 및 알림톡 연동

#### ✨ 신규 기능
- **카카오 알림톡 대기 순번 연동** — 대기 알림 자동 발송 (#16f184b)
- **로컬 프린트 에이전트** — iOS Safari 폴백 지원 (#4925f02)
- **포인트 적립** — 주문 완료 시 자동 적립 (#3f09007)
- **ESC/POS 프린터** — Web Bluetooth 통합 (#2c51056)

#### 🚀 배포 인프라
- **Vercel → Cloudflare Pages** 프론트엔드 마이그레이션 (#e9c8631)
- Node 22 업데이트 (wrangler/vite 호환) (#1a583d5)
- SPA 라우팅 wrangler.json 설정 (#c7e5ed9)
- SITE_ORIGIN/CORS Cloudflare Pages 도메인 적용 (#c309b67)

#### 🐛 버그 수정
- MasterDashboard 대기 건수 버그 수정 (#d229e7d)
- 레거시 QR 코드 '번' 접미사 처리 (#678abad)
- lucide-react 잘못된 import 수정 (#67acd0e)

---

## v1.0.8 (2026-05 ~ 2026-07-13)

### 안정화 및 기능 고도화 (대규모)

> 200+ 커밋 — 주요 변경사항만 요약

#### ✨ 핵심 기능
- **AI 팅커벨 도우미** — 음성 인식 KDS 비서, 메뉴 추천, 온보딩 마법사
- **실시간 결제/주문 파이프라인** — Toss Payments 연동, KDS WebSocket
- **푸드트럭 모듈** — GPS 트래커, 플래시 세일, IndexedDB 동기화
- **ESC/POS 주방 프린팅** + 웹훅 SSRF 방어
- **리뷰 시스템** — 사진 업로드/압축, AI 답글, 좋아요
- **커뮤니티 게시판** — 지역별 게시판, 댓글, 태그, 인기글
- **알림톡 대시보드** — 실시간 전송 콘솔 + 비용 집계

#### 🎨 UI/UX
- **TDS 디자인 시스템** — 토큰 기반 시맨틱 컬러/타이포그래피
- **관리자 5-테마 시스템** (라이트/다크/아틱/옵시디언/세피아)
- **모바일 최적화** — 480px 미니앱 프레임, safe-area 대응
- **QR 코드 프리미엄 디자인** — A4 인쇄, 로고/전화번호 포함

#### 🔒 보안 강화
- **전화번호 AES-256-CBC 암호화** + HMAC 검증
- **IDOR 취약점 전면 수정** — 주문, 리뷰, 테이블, 스태프
- **CORS/CSP 프로덕션 강화** — localhost 오리진 제거
- **Rate limiting** — 인증/결제/주문별 제한

#### 🧪 테스트
- 백엔드 단위 테스트 45+ 파일
- Prisma 쿼리 캐싱 + DB 성능 모니터링

#### 📦 배포
- Render.com 안정화 (render.yaml IaC)
- Supabase PostgreSQL 마이그레이션
- PWA 오프라인 캐싱 + 백그라운드 동기화
- Vercel → Cloudflare Pages 전환 준비

---

## v1.0.7 ~ v1.0.0 (2024 ~ 2026-04)

### 초기 구축 및 MVP

#### ✨ 초기 기능
- QR 메뉴판 플랫폼 MVP (#e2e18ce)
- CRM 고객 관리 (#17e55b8)
- 5계층 권한 시스템 (super_admin → user) (#537d8a9)
- 매장 분석 대시보드 (#9a69491)
- 테이블별 QR코드 자동 생성 (#9b8b3dc)

#### 🏗 인프라
- Express + Prisma + PostgreSQL (Supabase) 기반
- Vite + React 18 프론트엔드
- WebSocket 실시간 통신 (Socket.io)
- Vercel 배포 파이프라인

---

## Releases

| Version | Date | 주요 변경 |
|---------|------|----------|
| v1.1.0 | 2026-07-20 | i18n 다국어 지원, 라우트 표준화, print-agent, CI/CD |
| v1.0.9 | 2026-07-19 | Cloudflare 마이그레이션, 알림톡, 포인트 |
| v1.0.8 | 2026-07-13 | 안정화, AI, TDS, 보안, 200+ 커밋 |
| v1.0.7 | 2026-04 | QR/결제/알림 고도화 |
| v1.0.0+ | 2024-2025 | MVP, CRM, 권한, 분석 |

---

## Git Commit Convention

```
<type>(<scope>): <description>

Types: feat | fix | docs | style | refactor | perf | test | chore | security
Scopes: admin | ai | api | auth | cart | kds | landing | menu | order | payment | review | store | ui | etc.
```
