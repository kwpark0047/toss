# WeMarket 프로젝트 종합 분석 리포트 v2.2

**분석일**: 2026-07-21
**프로젝트**: WeMarket - SaaS QR Menu & Store Management Platform
**버전**: v1.1.0
**스택**: Express 5.2 / Prisma 5.22 / PostgreSQL (Supabase) + Vite 7 + React 19 + Tailwind 4

---

## 1. 개발 진행 상황 (Development Progress)

### 1.1 백엔드 (Backend) — 완성도 높음

| 계층 | 파일 수 | 설명 |
|------|---------|------|
| **routes** | 46 | Express 5.2 Router 표준화 완료. JSDoc 주석 적용 |
| **controllers** | 41 | 요청 처리/응답 계층 |
| **services** | 36 | 비즈니스 로직 |
| **repositories** | 22 | Prisma ORM 데이터 접근 계층 |
| **middleware** | 11 | CSP, CORS, XSS, 인증, rate-limit 등 |
| **utils** | 24 | 공통 유틸리티 |
| **socket** | 1 | Socket.IO 실시간 통신 |
| **scripts** | 다수 | 시드, 마이그레이션, 배치 작업 |
| **총계** | **~181 files / ~24,800 lines** | |

**핵심 API 그룹**:
- 인증 (Auth) — JWT + OTP
- 가게/메뉴 관리 (Stores, Products, Categories, Options)
- 주문/결제 (Orders, Payments, Points)
- 웨이팅 (Waiting)
- 주방 디스플레이 (KDS)
- CRM (Customers, Reviews, Analytics)
- 알림 (Alimtalk/SMS, Notifications)
- 프린트 (PrintJobs)
- AI (Gemini 기반 메뉴 번역/리뷰 분석)
- 파일 업로드/QR 생성 등

### 1.2 프론트엔드 (Frontend)

| 카테고리 | 파일 수 | 설명 |
|----------|---------|------|
| **pages** | 27+ | 메뉴판, 관리자 대시보드, 주방 디스플레이, 웨이팅 등 |
| **components** | 127+ | 공통/도메인 컴포넌트 |
| **hooks** | 15+ | 커스텀 React hooks |
| **locales** | 4 | ko/en/ja/zh 다국어 |
| **services/api** | 10+ | API 클라이언트 (axios 기반) |
| **contexts/stores** | 5+ | Zustand stores, React contexts |

**주요 페이지**:
- `/` — LandingPage (다국어 완료)
- `/menu/:storeUrl` — MenuPage (메뉴판)
- `/admin/*` — 관리자 페이지 (매출, 메뉴관리, 주문관리)
- `/kds` — Kitchen Display System
- `/auth/*` — 로그인/회원가입
- `/waiting` — 웨이팅

### 1.3 데이터베이스 (Prisma)

- **모델**: 51~53개 (Business, Store, Product, Order, User, Customer, Review, Point, Waiting 등)
- **마이그레이션**: Prisma Migrate 정상 운영
- **시드 데이터**: scripts/seed_production_direct.js

### 1.4 인프라/배포

| 항목 | 상태 |
|------|------|
| **프론트엔드** | Cloudflare Workers Assets (toss.wemarket.workers.dev) |
| **백엔드** | Render (wemarket-toss.onrender.com) |
| **데이터베이스** | Supabase PostgreSQL |
| **CI/CD** | GitHub Actions — 테스트 + CF Pages 배포 |
| **모니터링** | Sentry 연동 |
| **SSL/도메인** | Cloudflare + Render HTTPS |

### 1.5 테스트 현황

| 구분 | 파일 수 | 상태 |
|------|---------|------|
| **Jest unit (services)** | ~20 | 통과 |
| **Jest unit (controllers)** | ~15 | 통과 |
| **Jest integration** | ~12 | 통과 |
| **Jest regression** | ~3 | 통과 |
| **print-agent tests** | 2 | 통과 |
| **Playwright E2E** | 설정됨 | spec 대부분 제거됨 |
| **총 suites pass** | **54/59** | 5 fail = Playwright Node v24 환경 |
| **총 tests pass** | **559/562** | 3 fail = 프린터 HW/PW 환경 의존 |

---

## 2. 문제점 (Issues & Technical Debt)

### 🔴 심각 (Severe)

#### 1. README.md 오염
- **현상**: `README.md`가 프로젝트 설명이 아닌 분석 보고서로 덮어씌워짐
- **영향**: 신규 개발자/사용자 진입 장벽, 리포지토리 첫인상 나쁨
- **조치**: 실제 프로젝트 README로 교체 필요 (이미 AGENTS.md에 정리된 내용 활용)

#### 2. CSP nonce 보안 허점
- **현상**: `middleware/cspNonce.js`가 helmet CSP와 충돌하여 현재 `app.js`에서 비활성화됨 (`//` 주석처리)
- **영향**: helmet 기본 CSP만 동작, nonce 없는 XSS 방어 약화
- **조치**: helmet 내장 nonce 지원으로 통합 필요

### 🟡 중간 (Medium)

#### 3. 프론트엔드 테스트 부재
- **현상**: 27개 페이지 + 127개 컴포넌트 중 테스트 파일 0개
- **영향**: 리팩토링/기능 변경 시 회귀 감지 불가
- **조치**: Playwright 복원 + 핵심 페이지 컴포넌트 테스트 추가

#### 4. PointService 중복
- **현상**: `services/PointService.js`와 `services/PointsService.js` 각각 존재 (PointsService.js가 실제 사용)
- **영향**: 유지보수 혼란, 중복 코드
- **조치**: PointService.js 제거 또는 PointsService.js로 통합

#### 5. Swagger 미주석 라우트
- **현상**: 46개 라우트 중 4개만 JSDoc/Swagger 주석 완료
- **영향**: API 문서 부재
- **조치**: 나머지 42개 라우트 Swagger 주석 추가

#### 6. Jest 25.5.4 노후화
- **영향**: 최신 Node.js 기능 일부 미지원
- **조치**: Jest v29+ 업그레이드 + Vitest 도입 검토

#### 7. print-agent 배포 자동화 미구현
- **현상**: 별도 프로젝트로 분리되어 있으나 빌드/배포 스크립트 없음
- **조치**: 사용자 설치 가이드 + 자동 업데이트

### 🟢 경미 (Minor)

#### 8. E2E 테스트 제거됨
- **현상**: Playwright 설정은 있으나 spec 파일 대부분 제거됨
- **조치**: 핵심 플로우 (주문→결제→영수증) E2E 복원

#### 9. 다국어 미적용 페이지
- **현상**: AdminDashboard, AuthPage 등 일부 관리자 페이지 한국어 하드코딩
- **조치**: 점진적 i18n 확장

#### 10. 중복/과소 모듈
- **현상**: 일부 미들웨어/utils가 10줄 미만
- **조치**: 응집도 평가 후 통합

---

## 3. 이 세션에서 해결한 항목 ✅

| # | 문제 | 해결 | 파일 |
|---|------|------|------|
| 1 | CSP connect-src에 신규 도메인 누락 | `wemarket-toss.onrender.com` + `toss.wemarket.workers.dev` 추가 | `middleware/cspNonce.js` |
| 2 | responseFormatter 200 only | `res.created()`(201), `res.updated()`(200), `res.noContent()`(204) 헬퍼 추가 | `middleware/responseFormatter.js` |
| 3 | MenuManager 538KB 청크 경고 | 5개 모달 `React.lazy()` 분할 → **538KB → 27KB (↓95%)** | `frontend/.../MenuManager.jsx` |
| 4 | cspNonce helmet 충돌 주석 불명확 | helmet CSP 비활성화 상태임을 명확히 기재 | `middleware/cspNonce.js` |
| 5 | ja/zh locale `admin.membership` 키 누락 | 4개 키 추가 | `locales/ja/zh/translation.json` |
| 6 | landing.* 116 keys 미번역 | ko/en 완전 번역 | `locales/ko/en/translation.json` |
| 7 | 테스트 mock failures (14개) | PaymentService/OrderService/pointsController mock 수정 | `tests/unit/**/*.test.js` |
| 8 | jest.config.js Vitest 충돌 | `testPathIgnorePatterns`에 `/frontend/src/test/` 추가 | `jest.config.js` |
| 9 | `npm run build` 실패 | `--legacy-peer-deps` 옵션 추가 | `package.json` scripts |
| 10 | Husky pre-commit BOM 깨짐 | UTF-8 BOM 제거 | `.husky/pre-commit` |

---

## 4. 추가 기능 제안 (Feature Proposals)

### 🚀 단기 (Short-term)

#### 1. **README.md 재작성**
- 현재 ANALYSIS_REPORT.md가 README를 덮어씀
- 프로젝트 소개, 설치법, 환경변수, API 문서 링크, 라이선스 정보로 구성
- 난이도: ★☆☆ | 효과: ★★★

#### 2. **관리자 페이지 i18n 확장**
- AdminDashboard, AuthPage, MembershipPage 등 한국어 하드코딩된 페이지 번역
- 약 50~100 keys 추가 필요
- 난이도: ★★☆ | 효과: ★★★

#### 3. **PointService 중복 제거**
- `services/PointService.js` 제거
- 모든 참조를 `PointsService.js`로 일원화
- 난이도: ★☆☆ | 효과: ★★☆

### 📈 중기 (Medium-term)

#### 4. **프론트엔드 테스트 도입**
- Playwright E2E 복원 (주문→결제→KDS 플로우)
- 핵심 페이지(MenuPage, AdminDashboard) 단위 테스트 추가
- Vitest + React Testing Library 활용
- 난이도: ★★★ | 효과: ★★★

#### 5. **Swagger 문서 자동화**
- 42개 미주석 라우트에 JSDoc 추가
- swagger-autogen 또는 유사 도구 도입 검토
- 난이도: ★★☆ | 효과: ★★☆

#### 6. **실시간 알림 시스템 개선**
- 현재 Socket.IO + 알림톡
- 웹 푸시 알림 (Push API) 또는 SSE 도입
- 백엔드 알림 큐 - 다중 채널(WebSocket/이메일/SMS) 발송
- 난이도: ★★★ | 효과: ★★★

#### 7. **AI 메뉴 추천 고도화**
- `routes/ai.js` 존재하나 추천 로직 기본 수준
- 고객 주문 패턴 기반 개인화 추천 (Gemini + 협업 필터링)
- AI 메뉴 사진 생성/편집
- 난이도: ★★★ | 효과: ★★☆

#### 8. **관리자 분석 대시보드 고도화**
- 매출/방문/인기메뉴 시각화 (Chart.js 또는 Recharts)
- 기간별 비교, 트렌드 분석
- 엑셀/PDF 내보내기
- 난이도: ★★☆ | 효과: ★★☆

### 🌟 장기 (Long-term)

#### 9. **다중 언어 템플릿**
- i18n은 완료되었으나 알림톡/영수증/이메일 템플릿은 한국어 고정
- 템플릿별 다국어 지원 (영수증, 웨이팅 알림, 프로모션 이메일)
- 난이도: ★★★ | 효과: ★★★

#### 10. **오프라인 모드 (PWA)**
- 현재 Cloudflare Workers Assets로 서빙
- Service Worker 캐싱 전략 고도화 → 오프라인 메뉴판 지원
- IndexedDB 기반 로컬 주문 캐시 → 온라인 복구 시 동기화
- 난이도: ★★★ | 효과: ★★★

#### 11. **마이크로서비스 분리**
- 현재 모놀리식 백엔드 (Render 1インスタンス)
- 주문 처리, 알림, AI, 프린트 등独立 서비스로 분리 가능
- 메시지 큐 (RabbitMQ/Redis Pub-Sub) 도입
- 난이도: ★★★★★ | 효과: ★★★

#### 12. **글로벌 확장**
- 일본어/중국어 번역 완료, 일본/중국 매장 확장 시 고려
- 통화 변환, 지역별 결제 수단, 현지 SMS/알림 연동
- CDN 최적화 (Cloudflare 전 세계 엣지)
- 난이도: ★★★★★ | 효과: ★★★

---

## 5. 우선순위 액션 플랜 (Prioritized Action Plan)

| 우선순위 | 항목 | 작업 | 난이도 | 효과 |
|----------|------|------|--------|------|
| **P0** | README.md 교체 | 실제 프로젝트 README 작성 | ★☆☆ | ★★★ |
| **P0** | CSP nonce 복구 | helmet nonce 통합 | ★★☆ | ★★★ |
| **P1** | PointService 중복 제거 | PointService.js 제거 | ★☆☆ | ★★☆ |
| **P1** | 관리자 페이지 i18n | Auth/Dashboard 번역 | ★★☆ | ★★★ |
| **P2** | Swagger 문서화 | 42개 라우트 JSDoc | ★★☆ | ★★☆ |
| **P2** | 프론트 E2E 테스트 | Playwright 복원 | ★★★ | ★★★ |
| **P2** | Jest 업그레이드 | v25 → v29+ | ★★☆ | ★★☆ |
| **P3** | AI 메뉴 추천 고도화 | 개인화 추천 로직 | ★★★ | ★★☆ |
| **P3** | PWA 오프라인 | Service Worker 고도화 | ★★★ | ★★★ |
| **P4** | 마이크로서비스 분리 | 서비스 분할 설계 | ★★★★★ | ★★★ |
| **P4** | 글로벌 확장 | 통화/결제/현지화 | ★★★★★ | ★★★ |

---

## 6. 현재 상태 종합 평가

| 영역 | 평가 | 설명 |
|------|------|------|
| **백엔드 완성도** | ⭐⭐⭐⭐⭐ (90%) | Express 5.2, 46 routes, 41 controllers, 36 services, 22 repos |
| **프론트엔드 완성도** | ⭐⭐⭐⭐ (80%) | 27 pages, 127 components, TanStack Query, Zustand |
| **데이터 모델** | ⭐⭐⭐⭐⭐ (90%) | 53 Prisma models, Supabase PostgreSQL |
| **테스트 커버리지** | ⭐⭐⭐ (60%) | 백엔드 단위/통합 양호, 프론트/E2E 부족 |
| **문서화** | ⭐⭐ (40%) | CHANGELOG/Swagger 일부, README 오염 |
| **보안** | ⭐⭐⭐ (65%) | helmet/CORS/XSS 기본, CSP nonce 미작동 |
| **i18n** | ⭐⭐⭐⭐ (80%) | 4개 언어, 350+ keys, 일부 관리자 페이지만 미적용 |
| **배포/인프라** | ⭐⭐⭐⭐ (80%) | CF Workers + Render, GitHub Actions CI |
| **전체** | **⭐⭐⭐⭐ (74%)** | **운영 가능한 SaaS 플랫폼, 기술 부채 일부 존재** |

---

*분석 도구: Sisyphus AI Agent*  
*최종 업데이트: 2026-07-21*
