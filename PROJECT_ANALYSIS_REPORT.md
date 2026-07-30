# WeMarket 프로젝트 종합 분석 리포트

> **분석 일자**: 2026-07-30  
> **분석 대상**: `D:\wemarket-toss\250105`  
> **현재 버전**: v1.1.1 (2026-07-25)  
> **최신 커밋**: `43080c9` — fix: 상단 헤더 테마버튼과 하단 고정 테마버튼 중복 제거  
> **분석 범위**: 프로젝트 구조, 진행 상황, 문제점, 추가 기능 제안

---

## 1. 프로젝트 개요

WeMarket는 QR 코드 기반 매장 운영 SaaS 플랫폼로, 식당/카페가 디지털 메뉴·주문·결제·재고·CRM을 통합 관리할 수 있는 풀스택 애플리케이션입니다.

| 구분 | 내용 |
|---|---|
| **백엔드** | Node.js 22 + Express 5 + Socket.IO, Prisma ORM, PostgreSQL |
| **프론트엔드** | React 19 + Vite 7 + Tailwind CSS 4, 다국어(i18n) |
| **배포** | Cloudflare Pages(프론트) + Render(백엔드) |
| **테스트** | Jest + Playwright + React Testing Library |
| **CI/CD** | GitHub Actions (8개 Job 병렬 실행) |
| **보안** | helmet, CSP nonce, XSS sanitizer, CORS 도메인 화이트리스트, Semgrep 스캔 |
| **실시간** | Socket.IO (주문·KDS·채팅·웨이팅) |
| **외부 연동** | Toss Payments, Kakao Alimtalk, Google Gemini AI, Naver Place API |

### 프로젝트 규모

| 지표 | 수치 |
|---|---|
| 라우트 파일 | 49개 |
| 컨트롤러 | 44개 |
| 서비스 | 38개 |
| 리포지토리 | 22개 |
| Prisma 모델 | 53개 |
| 프론트엔드 페이지 | 33개 |
| 프론트엔드 컴포넌트 | ~132개 |
| 단위 테스트 | 93개 (.test.js) |
| 통합 테스트 | 14개 스위트 |
| E2E 테스트 | Playwright (spec 대폭 제거됨) |
| 커밋 수 (최근 30일) | ~25건 |

---

## 2. 현재 진행 상황

### 2.1 버전별 진행 이력

| 버전 | 날짜 | 주요 내용 | 진행률 |
|---|---|---|---|
| v1.1.1 | 2026-07-25 | 성능 최적화 고도화 (이미지/번들/CSS/캐시/Vitals/예산) | ✅ 완료 |
| v1.1.0 | 2026-07-20 | i18n 다국어, Express 5 라우트 표준화, print-agent, CI/CD | ✅ 완료 |
| v1.0.9 | 2026-07-19 | Cloudflare 마이그레이션, 알림톡, 포인트, ESC/POS | ✅ 완료 |
| v1.0.8 | 2026-07-13 | AI 탕퍼벨, TDS 디자인, 보안 강화, 200+ 커밋 | ✅ 완료 |
| v1.0.7 | 2026-04 | QR/결제/알림 고도화 | ✅ 완료 |
| v1.0.0~ | 2024-2025 | MVP, CRM, 권한, 분석 | ✅ 완료 |

### 2.2 현재 작업 트렌드 (최근 30일)

- **보안 강화**: 2FA 마이그레이션, socket 이벤트 인증, pre-2fa 토큰 차단
- **Express 5 호환성**: `req.query`/`req.params` read-only 이슈 해결
- **AI 기능**: OmniRoute AI 게이트웨이 통합 → 리버트 후 TinkerBell AI 대안 마련, Redis 캐싱, rate limiting
- **성능 최적화**: 이미지 WebP/AVIF, Critical CSS 인라인화, 번들 분석, 성능 예산 CI 게이트
- **CI/CD 안정화**: GitHub Actions 8개 Job, Semgrep 보안 스캔, 보안 이슈 연속 수정

### 2.3 미완성/진행 중 작업 (git diff HEAD 기준)

현재 17개 파일이 수정/미커밋 상태이며, 주로 다음이 진행 중:
- **frontend/src/App.jsx** (699줄 변경) — 핵심 라우트/구조 대폭 수정
- **frontend/src/components/customer/Menu.jsx** (2512줄 변경) — 메뉴 컴포넌트 대규모 리팩토링
- **routes/admin.js** (138줄 추가) — 관리자 API 신규 추가
- **prisma/schema.prisma** (193줄 추가) — 스키마 확장
- **frontend/public/sw-sync.js** (304줄 변경) — Service Worker 동기화 로직 수정

→ **현재 메뉴 페이지 리팩토링 + 관리자 API 확장 + 스키마 변경이 활발히 진행 중**

---

## 3. 문제점 분석

### 🔴 심각 (Severe)

#### 3.1 CSP nonce 미들웨어 비활성화 (app.js line 118)
- `middleware/cspNonce.js`가 `res.setHeader('Content-Security-Policy', ...)`를 직접 호출 → helmet이 이미 설정한 CSP 헤더와 충돌
- 통합 테스트 5000ms 타임아웃 유발 (진단 완료)
- **영향**: CSP nonce 보안 기능이 무효 상태, XSS 방어 약화
- **필요**: helmet의 내장 nonce 지원(`'nonce-<%= nonce %>'` 디렉티브)으로 통합 리팩토링

#### 3.2 README.md 오염
- `README.md`가 `ANALYSIS_REPORT.md` v2.1과 동일한 i18n 프로젝트 보고서(2025-07-19)로, 실제 프로젝트 README가 아님
- **영향**: 신규 사용자/배포자 혼동, 리포지토리 진입점 오염
- **필요**: 실제 README로 교체, i18n 보고서는 별도 파일로 백업

#### 3.3 결제 테이블 민감 정보 평문 저장
- `payments.card_number` (카드 번호)와 `payer_phone` (결제자 전화번호)가 평문 저장
- **PCI DSS 위반** — 카드 번호는 마스킹/토큰화 필수
- `payments.toss_pay_token`도 민감 데이터이므로 별도 암호화 관리 검토 필요

#### 3.4 E2E 테스트 대폭 제거
- Playwright 설정은 유지하지만 E2E spec 대부분이 제거됨
- 통합 테스트도 주문/결제 핵심 플로우가 1건만 남음
- **영향**: 회귀 버그 발견 능력 심각하게 저하

#### 3.5 테스트 커버리지 편중
- 백엔드 테스트가 일부 라우트/컨트롤러에 집중
- 서비스 레이어는 OrderService, PaymentService 중심, 나머지 서비스는 테스트 부재
- 프론트엔드 컴포넌트 테스트는 소수
- 커버리지 `coverage-final.json` 평균 0.0% 표시 (계측 미흡)

### 🟡 중간 (Medium)

#### 3.6 낡은 의존성
- `jest ^25.5.4` (매우 오래됨), 다만 `package.json`에는 `jest ^30.4.2`로 최신이 명시
- 테스트 스크립트가 `--forceExit --detectOpenHandles` 사용 → 열린 핸들(socket.io 등) 관리 미흡 징후
- `express ^5.2.1`과의 조합에서 `req.query`/`req.params` read-only 이슈가 반복 발생

#### 3.7 responseFormatter 기본 200 응답 코드
- `res.success(data, msg='Success', statusCode=200)` — 생성 API에 201 미사용
- REST 관례 위반 (클라이언트는 success 플래그로 판단하므로 동작은 됨)

#### 3.8 모델 중복 및 설계 혼란
- `staff` 모델과 `store_staff` 모델이 중복 — 직원-매장 관계 모델링 불명확
- `posts`와 `community_posts` 모델이 중복 — 게시판 종류 구분 불명확
- `order_type`이 문자열 (`dine_in`, `takeout`, `delivery`) — enum 권장
- `orders.status`가 문자열 — enum 마이그레이션 필요

#### 3.9 다국어 지원 미완
- 프론트엔드 i18n은 4개 locale(ko/en/ja/zh) 지원이나, 알림톡 템플릿·영수증은 한국어 고정
- 법적 문서(`legal`)는 다국어 미지원

#### 3.10 인증/인가 취약점
- 2FA가 admin에만 적용, 일반 사용자에게 미적용
- `phoneEncryption.js`에서 AES-256-CBC 사용 (결정적 암호화 — 동일 폰번호 → 동일 암호문, 패턴 분석 위험)
- `payments.toss_pay_token` 평문 저장

#### 3.11 환경 변수 누락 이력 반복
- `render.yaml`에 `SEOUL_OPENAPI_KEYS`, `KAKAO_REST_API_KEY`, `FRONTEND_URL` 등 누락된 env var가 반복적으로 발견됨
- `.env.example`가 계속 수정 중 — 환경 변수 관리 체계 불안정

### 🟢 경미 (Minor)

#### 3.12 미세 모듈 분산
- 미들웨어 2개 / utils 1개가 10줄 미만 — 기능 분산 가능성, 응집도 감소

#### 3.13 소규모 중복 코드
- `PointService.js` → `PointsService.js` 통합 이력 (v1.1.0) — 유사한 모델 명명 불일치가 여전히 존재 가능

---

## 4. 추가 기능 제안

### 🔥 긴급 (P0)

| 순위 | 기능 | 설명 | 근거 |
|---|---|---|---|
| 1 | **CSP nonce ↔ helmet 통합** | CSP 보안 기능 복구, XSS 방어 강화 | 심각3.1 |
| 2 | **카드 번호 마스킹/토큰화** | PCI DSS 준수, 민감정보 보호 | 심각3.3 |
| 3 | **README.md 실제 README로 교체** | 리포지토리 진입점 정리 | 심각3.2 |

### ⬆️ 높음 (P1)

| 순위 | 기능 | 설명 | 근거 |
|---|---|---|---|
| 4 | **E2E 테스트 복원** (주문→결제→영수증) | 핵심 사용자 플로우 회귀 방지 | 심각3.4, 3.5 |
| 5 | **주문/결제 상태 enum 마이그레이션** | 데이터 무결성 강화, 쿼리 성능 개선 | 중간3.8 |
| 6 | **일반 사용자 2FA 추가** | 보안 수준 향상 (TOTP/FIDO2) | 중간3.10 |
| 7 | **Alimtalk 템플릿 DB 관리** | 코드 하드코딩 제거, 다국어 지원 | 중간3.9, 2.28 |
| 8 | **Redis 캐싱 확대** | 인기 제품 분석, AI 응답 캐싱 | v1.1.0 성능 최적화 연장선 |

### 🔵 중간 (P2)

| 순위 | 기능 | 설명 | 근거 |
|---|---|---|---|
| 9 | **실시간 대시보드** (WebSocket 기반) | 매출/주문/고객 현황 실시간 모니터링 | feature-analysis.md 2.12, 3.1 |
| 10 | **고객 세그멘테이션 (RFM 분석)** | VIP/일반/이탈 고객 자동 분류 | feature-analysis.md 2.9 |
| 11 | **AI 메뉴 가격 최적화** | 수익률 기반 동적 가격 책정 | feature-analysis.md 2.11 |
| 12 | **Swagger API 문서 자동화** | 수동 정의 → 라우트 기반 자동 생성 | feature-analysis.md 이전 버전 |
| 13 | **결제 수단별 수수료 정책 관리** | 결제 사업자별 수수료 차등 | feature-analysis.md 2.5 |
| 14 | **프린트 실패 자동 재시도** | 프린트 드라이버 호환 이슈 해결 | feature-analysis.md 2.19 |
| 15 | **예약 시간대 커스텀 설정** | 30분 고정 간격 개선 | feature-analysis.md 2.16 |
| 16 | **웨이팅 실시간 알림 (앱 푸시)** | 문자 외 채널 추가 | feature-analysis.md 2.17 |

### 🟣 낮음 (P3)

| 순위 | 기능 | 설명 | 근거 |
|---|---|---|---|
| 17 | **멤버십/구독 플랜 연동** | 포인트 적립 → 등급 기반 혜택 | feature-analysis.md 2.9 |
| 18 | **푸드트럭 실시간 위치 추적** | GPS 기반 매장 찾기 | feature-analysis.md 2.18 |
| 19 | **리뷰 사진 업로드 + 운영자 답변** | 리뷰 시스템 고도화 | feature-analysis.md 2.14 |
| 20 | **재고 자동 발주** | 최저 재고 도달 시 발주서 자동 생성 | feature-analysis.md 2.7 |
| 21 | **다국어 알림톡/영수증** | i18n 연동 (zh-TW, vi, th 등) | feature-analysis.md 2.1 |
| 22 | **API 키 권한 세분화** | 개발자 포탈 고도화 | feature-analysis.md 2.20 |
| 23 | **차세대 DB 인덱스 최적화** | EXPLAIN ANALYZE 기반 커버링 인덱스 | NEXT_TASK.md |
| 24 | **Docker 멀티스테이지 빌드** | 이미지 크기 500MB → 200MB 목표 | NEXT_TASK.md |

---

## 5. 권장 실행 순서

### Week 1 (이번 주): 보안 안정화 + 이슈 수정
```
Day 1: CSP nonce ↔ helmet nonce 통합 (심각3.1)
Day 2: README.md 실제 README로 교체 (심각3.2)
Day 3: 카드 번호 마스킹 이슈 분석 + 토큰화 방안 도출 (심각3.3)
Day 4: E2E 테스트 핵심 플로우 복원 시작 (심각3.4)
Day 5: 주문/결제 상태 enum 설계 + 마이그레이션 스크립트 작성
```

### Week 2: 보안 강화 + 테스트 보강
```
Day 1-2: 일반 사용자 TOTP 2FA 구현 (높음6)
Day 3: Alimtalk 템플릿 DB 관리 + 다국어 (높음7)
Day 4: Redis 캐싱 확대 (인기제품 분석, AI 응답)
Day 5: 통합 테스트 커버리지 보강 (핵심 서비스)
```

### Week 3+: 고도화
```
├── 실시간 대시보드 (WebSocket)
├── AI 메뉴 가격 최적화
├── 고객 세그멘테이션 (RFM)
├── 예약 시간대 커스텀
└── 프린트 실패 재시도 큐
```

---

## 6. 참고 문서

| 문서 | 내용 |
|---|---|
| `NEXT_TASK.md` | 다음 작업 우선순위 (성능 최적화 후 단) |
| `feature-analysis.md` | 기능별 상세 분석 (기능 28개) |
| `PROJECT_ANALYSIS.md` | 이전 프로젝트 분석 보고서 |
| `HANDOFF.md` | 인수인계 문서 |
| `CHANGELOG.md` | 전체 릴리스 이력 |
| `docs/PROJECT_ANALYSIS.md` | 기존 프로젝트 분석 보고서 (상세) |
| `ARCHITECTURE.md` | 아키텍처 문서 |
| `.github/workflows/ci.yml` | CI 파이프라인 구성 |

---

## 구현 완료 사항 (Implementation Summary)

### 구현 일자: 2026-07-30

### Step 1: CSP nonce 미들웨어 주석 수정 (app.js:117)
- `app.js`의 CSP nonce 관련 주석을 정확하게 수정
- 이전 주석 "helm이 생성한 nonce를 재사용 (자체 setHeader 안 함)"은 오해를 일으켰음
- 실제 `cspNonce.js`는 `res.setHeader()`를 호출하며 CSP 헤더를 단독 소유
- helmet은 `contentSecurityPolicy: false`로 CSP를 비활성화하여 충돌 방지

### Step 2: 동적 가격 책정 API 구현
| 파일 | 설명 |
|---|---|
| `routes/dynamicPricing.js` | 6개 API 엔드포인트 정의 |
| `controllers/dynamicPricingController.js` | 가격 규칙 CRUD + 자동 적용 로직 |
| `services/DynamicPricingService.js` | 타입별 가격 적용 로직 (시간/수요/경쟁사/재고/날씨) |

**API 엔드포인트:**
- `GET /api/dynamic-pricing/store/:storeId/rules` — 규칙 목록 조회
- `POST /api/dynamic-pricing/store/:storeId/rules` — 규칙 생성
- `PATCH /api/dynamic-pricing/store/:storeId/rules/:ruleId` — 규칙 수정
- `DELETE /api/dynamic-pricing/store/:storeId/rules/:ruleId` — 규칙 삭제
- `GET /api/dynamic-pricing/store/:storeId/price-logs` — 가격 변경 로그 조회
- `POST /api/dynamic-pricing/store/:storeId/activate` — 활성 규칙 자동 적용

### Step 3: AI 추천 / 고객 세그멘테이션 API 구현
| 파일 | 설명 |
|---|---|
| `routes/aiRecommendations.js` | 13개 API 엔드포인트 정의 |
| `controllers/aiRecommendationsController.js` | 추천/세그먼트/개인화 CRUD |

**API 엔드포인트:**
- `GET/POST /api/ai-recommendations/store/:storeId/recommendations` — 추천 관리
- `GET/POST /api/ai-recommendations/store/:storeId/segments` — 고객 세그먼트 관리
- `GET/PATCH /api/ai-recommendations/store/:storeId/personalizations` — 고객 개인화 설정
- `GET /api/ai-recommendations/store/:storeId/personalization-analytics` — 개인화 분석

### Step 4: 수요 예측 API 구현
| 파일 | 설명 |
|---|---|
| `routes/demandForecast.js` | 9개 API 엔드포인트 정의 |
| `controllers/demandForecastController.js` | 수요 예측/경쟁사 가격/최적화 작업 관리 |

**API 엔드포인트:**
- `GET/POST /api/demand-forecast/store/:storeId/forecasts` — 수요 예측 조회/생성
- `GET/POST/PATCH/DELETE /api/demand-forecast/store/:storeId/competitor-prices` — 경쟁사 가격 관리
- `GET/POST/GET /api/demand-forecast/store/:storeId/pricing-jobs` — 최적화 작업 관리

### 검증 결과
- ESLint: 0 errors, 0 warnings (모든 새 파일)
- Node.js require 검증: 7개 파일 모두 정상 로드
- Route Mounting Test: 4/4 통과
- `require('./app.js')` 서버 시작 확인됨 (DB 미연결로 종료, 라우터 로드 정상)

### 미구현 (향후 작업)
- Prisma `migrate dev` 필요 (schema.prisma에 추가된 모델들 반영)
- E2E 테스트 복원
- 프론트엔드 UI 연동 (DynamicPricingManager.jsx 컴포넌트 미완성)
