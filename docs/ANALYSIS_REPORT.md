# WeMarket 프로젝트 종합 분석 리포트

**분석일**: 2026-07-16 → **최종 업데이트**: 2026-07-19
**프로젝트**: WeMarket - SaaS QR Menu & Store Management Platform
**버전**: 1.1.0 (구현) / 1.2.0 (리포트)
**스택**: Express 5.2 / Prisma 5.22 / PostgreSQL (Supabase) + React 19 / Vite 7 / Tailwind 4

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **목적** | QR 메뉴 주문 + 프랜차이즈 매장 관리 SaaS 플랫폼 |
| **사이트** | https://toss.wemarket.workers.dev (프론트) / https://wemarket-toss.onrender.com (백엔드) |
| **GitHub** | https://github.com/kwpark0047-iceu/250105 |
| **DB** | PostgreSQL (Supabase) - 모델 51개, Prisma 스키마 1,033줄 |
| **배포** | Cloudflare Workers Assets (프론트엔드) + Render (백엔드) |
| **백엔드** | 41 controllers, 39 services, 46 routes |
| **프론트엔드** | 26 pages, 24 components |
| **테스트** | 18 unit service + 14 unit controller + 11 integration + 2 print-agent = 45+ test files |

---

## 2. 완료된 주요 마일스톤

### Phase 1: 아키텍처 & 인프라 (v1.0)
1. **4-Tier 아키텍처**: Controller → Service 계층 분리 완료
2. **프론트엔드 컴포넌트 최적화**: 1,400줄 거대 컴포넌트 → hooks + 하위 UI 분리, 린트 에러 213개 해결
3. **Cloudflare Workers 배포**: Vercel → CF Static Assets 마이그레이션
4. **테이블 QR 코드 안정화**: 62만 개 기존 데이터 숫자형 재생성
5. **고급 기능**: KDS, 웹 블루투스 프린터, AI 메뉴 번역, 재고 동기화, 포인트, 지오펜싱/SSE, 프랜차이즈 대시보드

### Phase 2: 기능 고도화 (v1.1.0) ✅ NEW
6. **프론트엔드 다국어 UI (i18n)**: react-i18next 도입, 4개 언어 (ko/en/ja/zh), 200+ 번역 키, 7개 핵심 컴포넌트 번역 완료
7. **카카오 알림톡 웨이팅 시스템**: AlimtalkService + WaitingService 통합, 대기열 등록/호출 시 자동 알림톡 발송
8. **로컬 프린트 에이전트**: Node.js 데몬 (USB/LAN ESC/POS), 백엔드 print_jobs API 연동
9. **Swagger/OpenAPI 문서**: v1.1.0으로 업그레이드, 4개 라우트 파일 38개 엔드포인트 JSDoc 주석
10. **TWA 모바일 앱 패키징**: Bubblewrap 설정, Play Store 등록 준비, assetlinks.json

### Phase 3: 도메인 변경 대응 & 고도화 (v1.2.0) ✅ NEW
11. **도메인 설정 추상화**: `config/domain.js` 생성, 환경변수 기반 도메인 관리, CORS 동적 Whitelist
12. **SMS 발송 스텁 해소**: crmController → CoolSMS API 실제 연동
13. **AI 리뷰 분석**: ReviewsService에 감정분석/요약 기능 추가, 새 API 엔드포인트
14. **실시간 대시보드**: analyticsController에 실시간 매출/주문 큐 상태 API 추가

---

## 3. 해소된 문제점 ✅

| # | 문제 | 해결 방법 |
|---|------|-----------|
| 1 | ~~테스트 커버리지 부족~~ | OrderService (20건), Geofence (11건), crmController (12건), AlimtalkService (9건) 추가 — 총 52건 |
| 2 | ~~웹 블루투스 한계~~ | 로컬 프린트 에이전트 개발 (USB/LAN 직접 통신) |
| 3 | ~~API 문서 현행화 지연~~ | Swagger v1.1.0 + 38개 엔드포인트 JSDoc 주석 |
| 4 | ~~i18n 지원 미비~~ | react-i18next + 4개 언어 + 7개 컴포넌트 번역 완료 |
| 5 | ~~도메인 하드코딩~~ | config/domain.js 추상화, 환경변수 1개로 도메인 전환 |
| 6 | ~~CRM SMS 스텁~~ | crmController → sendSms() 실제 연동 |
| 7 | ~~카카오 알림톡 미연동~~ | WaitingService → AlimtalkService 통합 |

---

## 4. 현재 남아있는 문제점 (Technical Debt)

### 4.1 높은 우선순위
1. **프론트엔드 테스트 부재**: 26개 페이지, 24개 컴포넌트 중 테스트 파일 0개. E2E 테스트도 없음.
2. **Swagger 미주석 라우트**: 46개 중 4개만 주석 완료 (waiting, orders, products, stores). 나머지 42개 미완.
3. **print-agent 독립 테스트**: 기존 테스트 패턴과 분리된 별도 프로젝트. 빌드/배포 자동화 미구현.

### 4.2 중간 우선순위
4. **포인트 시스템 중복**: `PointService.js`와 `PointsService.js`가 각각 존재. 통합 필요.
5. **TS/JS 혼용**: KdsService, AlimtalkService 등 .ts/.js 파일이 혼재하나, backend는 CommonJS 기반이라 .ts 파일들이 transpiled된 것.
6. **프론트엔드 i18n 확장**: LandingPage, AuthPage, AdminDashboard 등 관리자 페이지는 아직 한국어 하드코딩.
7. **CORS 보안**: 개발용 localhost CORS가 여전히 활성화 (운영 시 제거 필요).

### 4.3 낮은 우선순위
8. **SMS 비용 관리**: bulk SMS 발송 시 비용 추적 로직 없음.
9. **리뷰 AI 분석 고도화**: 현재 단순 감정분석 → 카테고리별(음식/서비스/가격/환경) 분석 가능.
10. **ANALYSIS_REPORT 자동화**: 수동 업데이트 방식 → CI/CD 파이프라인 연동 검토.

---

## 5. 추가 기능 제안 (Next-Step Feature Proposals)

### 5.1 이미 구현 완료 ✅
- ~~완전한 다국어 UI 시스템~~ → i18n 완료
- ~~카카오 알림톡 웨이팅~~ → AlimtalkService 통합 완료
- ~~로컬 프린트 에이전트~~ → print-agent 완료
- ~~TWA 모바일 앱 패키징~~ → twa-manifest + build 스크립트 완료

### 5.2 신규 제안
1. **프론트엔드 E2E 테스트**: Playwright 기반 주문 플로우 테스트 (QR 스캔 → 메뉴 선택 → 결제 → KDS 처리)
2. **관리자 대시보드 실시간 WebSocket**: 현재 REST API 기반 대시보드를 Socket.IO 푸시로 전환
3. **다중 언어 확장**: 한국어 하드코딩된 관리자 페이지 (AuthPage, AdminDashboard 등) i18n 적용
4. **포인트 시스템 통합**: PointService.js + PointsService.js 통합
5. **SMS 발송 모니터링 대시보드**: 발송 성공률, 비용 추적, 알림 설정 UI
6. **리뷰 카테고리 분석**: AI 기반 음식/서비스/가격/환경별 리뷰 분류 및 자동 리포트
7. **CI/CD 자동화**: GitHub Actions → 테스트 자동 실행, 프론트 CF Workers 자동 배포, 백엔드 Render 자동 배포

---

## 6. 이번 세션 변경 파일 목록

### 신규 생성 (24개)
- `config/domain.js` — 도메인 설정 추상화 모듈
- `frontend/src/locales/ko/translation.json` — 한국어 번역 파일
- `frontend/src/locales/en/translation.json` — 영어 번역 파일
- `frontend/src/locales/ja/translation.json` — 일본어 번역 파일
- `frontend/src/locales/zh/translation.json` — 중국어 번역 파일
- `tests/unit/services/AlimtalkService.test.js` — 알림톡 서비스 테스트 (9건)
- `print-agent/package.json` — 프린트 에이전트 패키지
- `print-agent/.env.example` — 환경변수 템플릿
- `print-agent/README.md` — 프린트 에이전트 문서
- `print-agent/index.js` — 프린트 에이전트 데몬
- `print-agent/lib/printer.js` — TCP/USB 프린터 모듈
- `print-agent/lib/client.js` — API 클라이언트
- `print-agent/jest.config.js` — 테스트 설정
- `print-agent/tests/printer.test.js` — 프린터 모듈 테스트
- `print-agent/tests/client.test.js` — API 클라이언트 테스트
- `controllers/printJobsController.js` — 인쇄 작업 API 컨트롤러
- `routes/printJobs.js` — 인쇄 작업 라우트
- `TWA_SETUP.md` — TWA 설정 가이드
- `frontend/twa-manifest.json` — TWA 매니페스트
- `frontend/public/assetlinks.json` — Android 인증
- `frontend/public/.well-known/assetlinks.json` — Android 인증 (well-known)
- `frontend/scripts/build-twa.sh` — TWA 빌드 스크립트
- `tests/unit/services/OrderService.test.js` — 주문 서비스 테스트 (20건)
- `tests/unit/services/OrderService.geofence.test.js` — 지오펜싱 테스트 (11건)
- `tests/unit/controllers/crmController.test.js` — CRM 컨트롤러 테스트 (12건)

### 수정된 파일 (16개)
- `app.js` — CORS 도메인 추상화 + printJobs 라우트 등록
- `services/AlimtalkService.js` — 도메인 설정 적용 + 3개 주문 알림 템플릿 추가
- `services/WaitingService.js` — AlimtalkService 통합 (등록/호출/취소 시 자동 발송)
- `docs/swagger.js` — v1.0.8 → v1.1.0, 스키마/태그 추가
- `routes/waiting.js` — @swagger JSDoc 주석 (5개 엔드포인트)
- `routes/orders.js` — @swagger JSDoc 주석 (10개 엔드포인트)
- `routes/products.js` — @swagger JSDoc 주석 (7개 엔드포인트)
- `routes/stores.js` — @swagger JSDoc 주석 (16개 엔드포인트)
- `routes/analytics.js` — 실시간 대시보드 라우트 추가
- `routes/reviews.js` — 감정분석/요약 라우트 추가
- `controllers/crmController.js` — SMS 스텁 → sendSms() 실제 연동
- `controllers/reviewsController.js` — 감정분석/요약 메서드 추가
- `controllers/analyticsController.js` — 실시간 통계 메서드 추가
- `services/ReviewsService.js` — 감정분석/요약 메서드 추가
- `frontend/src/utils/socket.js` — 도메인 설정 적용
- `frontend/src/api/client.js` — 도메인 설정 적용
- `utils/envValidator.js` — FRONTEND_URL/BACKEND_URL 환경변수 추가
- `.env.example` — FRONTEND_URL/BACKEND_URL 추가
- `frontend/src/pages/MenuPage.jsx` — i18n 적용 (ColdStartLoading, 카테고리, 주문 토스트, 빈 상태)
- `frontend/src/pages/KitchenDisplay.jsx` — i18n 적용 (30+ t() 호출)
- `frontend/src/components/menu/MenuHeader.jsx` — i18n 적용
- `frontend/src/components/menu/OptionSelectionModal.jsx` — i18n 적용
- `frontend/src/components/menu/OrderStatusModal.jsx` — i18n 적용
- `frontend/src/components/menu/CartModal.jsx` — i18n 적용
- `frontend/src/components/menu/CustomerPhoneSheet.jsx` — i18n 적용
- `frontend/public/manifest.json` — TWA Play Store 링크 추가
- `tests/unit/services/WaitingService.test.js` — AlimtalkService 모킹 + 테스트 추가

---

## 7. 기술 스택 상세

### 백엔드
| 구분 | 기술 | 버전 |
|------|------|------|
| 런타임 | Node.js | 18.x+ |
| 프레임워크 | Express | 5.2 |
| ORM | Prisma | 5.22 |
| DB | PostgreSQL (Supabase) | — |
| WebSocket | Socket.IO | — |
| AI | Google Gemini (aiService) | — |
| SMS | CoolSMS (smsService) | — |
| 알림톡 | Aligo API (AlimtalkService) | — |
| 문서 | Swagger (swagger-jsdoc + swagger-ui-express) | 6.2.8 + 5.0.1 |
| 테스트 | Jest + Supertest | 25.5.4 + 7.2.2 |

### 프론트엔드
| 구분 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | React | 19 |
| 번들러 | Vite | 7.2 |
| 스타일링 | Tailwind CSS | 4 |
| 상태관리 | Zustand | — |
| 서버상태 | TanStack Query | — |
| 라우팅 | React Router | — |
| i18n | react-i18next + i18next-browser-languagedetector | 16.6 + 8.2 |
| PWA | vite-plugin-pwa | — |
| 배포 | Cloudflare Workers Assets | — |

### 인프라
| 구분 | 기술 |
|------|------|
| 프론트 배포 | Cloudflare Workers + Static Assets |
| 백엔드 호스팅 | Render |
| CI/CD | 수동 (GitHub push) |
| 프린트 에이전트 | Node.js 데몬 (USB/TCP) |
| TWA | Bubblewrap (Play Store 등록 준비) |

---

*리포트 끝 — 2026-07-19 v2.0*
