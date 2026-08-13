# WeMarket 프로젝트 종합 분석 리포트 v5

> **분석 일자**: 2026-08-12 (종합 분석 v5, v4 이후 177개 커밋 반영)  
> **분석 대상**: `D:\wemarket-toss\250105`  
> **현재 버전**: v1.2.0  
> **최신 커밋**: `af26c34` — feat(eco): 에코 뱃지 시스템 활성화  
> **분석 범위**: 프로젝트 구조, 진행 상황, 해결된 문제, 잔여 문제점, 추가 기능 제안

---

## 1. 프로젝트 개요

WeMarket는 QR 코드 기반 매장 운영 SaaS 플랫폼으로, 식당/카페가 디지털 메뉴·주문·결제·재고·CRM을 통합 관리할 수 있는 풀스택 애플리케이션입니다.

| 구분 | 내용 |
|---|---|
| **백엔드** | Node.js 22 (`engines.node >= 22.22.0`) + Express 5 + Socket.IO, Prisma 5, PostgreSQL (Supabase) |
| **프론트엔드** | React 19 + Vite 7 + Tailwind CSS 4, 다국어(i18n ko/en/ja/zh) |
| **배포** | Render(`wemarket.onrender.com`) + Cloudflare Workers(`toss.wemarket.workers.dev`, wrangler `4.119.0` 고정) + Vercel |
| **실시간** | Socket.IO (주문·KDS·채팅·웨이팅) + SSE |
| **외부 연동** | Toss Payments, Kakao Alimtalk, Google Gemini AI, Naver Place API, Firebase FCM |
| **모니터링** | Prometheus + Grafana + Loki + Alertmanager |
| **CI/CD** | GitHub Actions (8개 병렬 Job) + Husky + Commitlint + Semgrep + Trivy |
| **PDF** | pdfkit `^0.19.1` (매출 리포트 PDF, 미커밋) |

### 프로젝트 규모

| 지표 | 수치 |
|---|---|
| 라우트 파일 | 53개 + `reportPdf` 신규 |
| 컨트롤러 | 53개 + `reportPdfController` 신규 |
| 서비스 | 39개 + `ReportPdfService` 신규 |
| 리포지토리 | 26개 |
| 미들웨어 | 14개 |
| Prisma 모델 | **67개** (신규 5개: grant_templates 등 복원) |
| 프론트엔드 컴포넌트 | 80+개 |
| 백엔드 단위 테스트 | ~100개 |
| 통합 테스트 | 14개 |
| E2E 테스트 | 3개 spec + 1 API flow |
| 프론트엔드 테스트 | 14개 (Vitest) |
| 총 문서(.md) | ~30개 |

---

## 2. 현재 진행 상황

### 2.1 버전 이력

| 버전 | 날짜 | 주요 내용 |
|---|---|---|
| **v1.2.0** | 2026-08-07 | 결제 고도화 (고객 QR 전체 결제 정상화, `'paid'` enum 제거), Swagger, 이상 매출 감지, ETA, 동적가격 |
| v1.1.1 | 2026-07-25 | 성능 최적화 (이미지/번들/CSS/캐시/Vitals/예산) |
| v1.1.0 | 2026-07-20 | i18n 다국어, Express 5 라우트 표준화, print-agent, CI/CD |
| v1.0.9 | 2026-07-19 | Cloudflare 마이그레이션, 알림톡, 포인트, ESC/POS |
| v1.0.8 | 2026-07-13 | AI TinkerBell, TDS 디자인, 보안 강화 |
| v1.0.7 | 2026-04 | QR/결제/알림 고도화 |
| v1.0.0~ | 2024-2025 | MVP, CRM, 권한, 분석 |

### 2.2 최근 고도화 작업 (2026-07-30 ~ 08-12, 커밋 177개)

v4 분석 이후 **2026-07-30 ~ 08-12 사이 177개 커밋**이 반영되었습니다. 핵심 작업 요약:

| 영역 | 작업 | 상태 |
|---|---|---|
| **API 문서화** | `feat(api): swagger api 문서화` — `/api/swagger` 라우트, JSDoc → Swagger 자동 문서 | ✅ 완료 (`df7c2cf`) |
| **프로덕션 안정화** | `fix(cors, firebase): 프로덕션 CORS 및 Firebase 설정 수정` | ✅ 완료 (`bce2ae4`) |
| **결제 정상화** | `fix(payment): 고객 QR 메뉴판 전체 결제 방식 정상화` — `OrderStatus` enum에서 `'paid'` 제거 (현금/포인트 즉시결제 실패 해결) | ✅ 완료 (`3aba107`) |
| **에코 뱃지** | `feat(eco): 에코 뱃지 시스템 활성화` | ✅ 완료 (`af26c34`) |
| **이상 매출 감지** | 스케줄러 15분 간격, FREEZE/급감 경보 | ✅ 완료 |
| **실시간 ETA** | 주문 모달 실시간 eta 예측 | ✅ 완료 |
| **동적 가격** | 날씨 기반 동적가격 + 기상특보, Heat Index °F 보정 | ✅ 완료 |
| **AI 고도화** | Gemini 모델 버전 갱신, B-1 멤버십 구독/B-2 포인트/B-3 AI 추천, `aiOrder` 라우트 복원, CustomerPreferenceService 싱글턴화 | ✅ 완료 |
| **품질** | TDZ 오류 수정, cold start UX 개선, 결제 테스트 수정 (`db52c74`) | ✅ 완료 |
| **매출 리포트 PDF** | pdfkit 기반 매장 리포트 PDF 생성 — **미커밋** (아래 2.3) | 🚧 진행 중 |

### 2.3 미커밋 대기 변경사항 (매출 리포트 PDF 기능)

`git status`: **`app.js` 수정 + 신규 2개 파일 (미커밋)** — `services/ReportPdfService.js`는 커밋 완료 상태

| 파일 | 상태 | 내용 |
|---|---|---|
| `app.js` | `M` | `reportPdf` 라우트를 `routes`에 추가 + `app.use(\`${API_PREFIX}/reports\`, routes.reportPdf)` 마운트 |
| `routes/reportPdf.js` | `??` (신규) | `GET /api/reports/store/:storeId`(authMiddleware + `checkStorePermission('stats:read')`, Swagger 문서화), `GET /api/reports/all`(슈퍼어드민 일괄), `GET /api/reports/templates` |
| `controllers/reportPdfController.js` | `??` (신규) | `generateStoreReport`(PDF 생성·다운로드), `generateAllStoreReports`(활성 매장 순회 일괄 생성), `getTemplates` |
| `services/ReportPdfService.js` | 커밋됨 | `generateStoreReportPdf(storeId, startDate, endDate, outputPath)` — PDFDocument(pdfkit), 매장/기간/주문 집계(`status != 'cancelled'`), 총매출·주문수·객단가, 한글 폰트 미지원(영문 레이아웃) |

**참고**: `reports/` 디렉터리는 아직 존재하지 않음 — 서비스가 `mkdirSync(recursive)`로 생성하므로 런타임 오류 없음. `/api/reports/all`은 `authMiddleware`만 적용(슈퍼어드민 권한 미검사) — 보안 검토 필요.

---

## 3. 문제점 분석

### 3.1 ✅ 해결된 문제 (이전 v4 → v5)

| # | 문제 | 해결 내용 |
|---|---|---|
| ~~3.1~~ | README.md 오염 | 이미 실제 프로젝트 README로 정상 — 분석 오류였음 |
| ~~3.2~~ | 카드 번호 평문 저장 | `maskCardNumber()` + `toss_pay_token` `encryptToken()` 적용 |
| ~~3.3~~ | Prisma 마이그레이션 누락 | `migrate deploy` 성공, 7개 migration 적용 완료 |
| ~~3.5~~ | 프론트엔드 API 미연동 | DynamicPricing 규칙 모달, GrantTemplate 전면 연결 |
| ~~3.6~~ | Express 5 호환성 | `validate.js` `Object.defineProperty` 대응 완료 |
| **신규** | 고객 QR 전체 결제 실패 | `OrderStatus` enum에서 `'paid'` 제거로 즉시결제 정상화 |
| **신규** | API 문서 부재 | Swagger (`/api/swagger`) 자동 문서화 완료 |
| **신규** | 프로덕션 CORS/Firebase 오류 | CORS 및 Firebase 설정 수정 완료 |

### 3.2 🔴 잔여 심각 문제

#### 3.2.1 Trivy 취약점 스캔 실패로 배포 차단 (최우선)
- `NEXT_TASK.md` 최우선 이슈 — docker-build CI의 `trivy image --severity CRITICAL,HIGH --exit-code 1` 실패가 배포 파이프라인을 차단 중
- **필요**: base image/의존성 업그레이드 + `npm audit fix`

#### 3.2.2 카드 번호 DB 내 기존 평문 데이터
- 새 결제는 마스킹되나, 기존 DB의 `payments.card_number` 평문 데이터는 그대로
- **필요**: 백필(backfill) 마이그레이션 스크립트로 기존 데이터 일괄 마스킹

#### 3.2.3 Toss 웹훅 raw_response 미처리
- `handleTossWebhook` → `processApproval` 호출 시 `sanitizeRawResponse` 적용됨 ✅
- 그러나 웹훅 원본 로깅 경로에서 민감정보 노출 가능성 잔존

#### 3.2.4 신규 API 컨트롤러 AI 로직 부재
- `aiRecommendationsController.js` / `demandForecastController.js`는 대부분 스텁(stub) 상태
- 동적 가격 컨트롤러는 규칙 CRUD + 기본 가격 계산 로직만 구현됨

### 3.3 🟡 중간 문제

#### 3.3.1 주문/결제 상태 문자열 → enum 마이그레이션 필요
- `orders.status`, `payments.status` 수십 가지 문자열 값
- enum 도입 시 데이터 무결성 + 쿼리 성능 향상

#### 3.3.2 일반 사용자 2FA 미적용
- admin 2FA(TOTP) 완료, 일반 사용자 미적용

#### 3.3.3 `stores` 모델 500+ 라인 — 단일 책임 원칙 위반
- 30개 이상 relation 보유 — 도메인별 분할 필요

#### 3.3.4 환경 변수 관리 리스크
- `render.yaml` env var 누락 이력, `.env.example`이 실제 `.env`와 불일치 가능성

#### 3.3.5 다국어 지원 미완
- 프론트엔드 i18n 4개 locale 지원
- 알림톡/영수증/법적 문서 한국어 고정

#### 3.3.6 리포트 PDF 보안/품질 (신규)
- `/api/reports/all` 슈퍼어드민 권한 미검사 (`authMiddleware`만 적용)
- 한글 폰트 미지원 → 한글 매장명/내용 깨짐 가능
- PDF 테스트 부재

### 3.4 🟢 경미 문제

#### 3.4.1 테스트 도구 이원화 (Jest + Vitest)
- 백엔드 Jest, 프론트엔드 Vitest — CI에서 각자 정상 동작

#### 3.4.2 API Prefix 비일관성
- `app.js` kebab-case (`dynamic-pricing`) vs camelCase 혼용

#### 3.4.3 모듈 분산
- 10줄 미만 미들웨어/utils 존재 — 기능 분산

---

## 4. 추가 기능 제안

### 🔥 P0 (긴급)

| 순위 | 기능 | 설명 | 근거 |
|---|---|---|---|
| 1 | **Trivy 취약점 해소** | base image/의존성 업그레이드, `npm audit fix` — 배포 차단 해제 | 3.2.1 |
| 2 | **기존 카드 번호 백필 마이그레이션** | `payments.card_number` 기존 평문 데이터 일괄 마스킹 | 3.2.2 |
| 3 | **Toss 웹훅 민감정보 로깅 방지** | 웹훅 원본 로그 민감정보 필터링 + 서명 검증 | 3.2.3 |
| 4 | **reportPdf 커밋 + 권한 보강** | 미커밋 파일 커밋, `/api/reports/all` 슈퍼어드민 권한 검사 | 3.3.6 |

### ⬆️ P1 (높음)

| 순위 | 기능 | 설명 |
|---|---|---|
| 5 | **동적 가격 책정 실제 AI 연동** | Gemini AI 기반 수요 예측 + 가격 최적화 |
| 6 | **주문/결제 상태 enum 마이그레이션** | 데이터 무결성 + 쿼리 성능 |
| 7 | **테스트 커버리지 확대** | 서비스 레이어 30개+ 테스트 추가 |
| 8 | **일반 사용자 2FA** | TOTP 기반 2차 인증 |
| 9 | **Redis 캐싱 확대** | AI 응답/인기제품/매출 통계 캐싱 |
| 10 | **AI 추천/수요 예측 실제 로직 구현** | Gemini 연동, 프론트엔드 UI 연결 |

### 🔵 P2 (중간)

| 순위 | 기능 | 설명 |
|---|---|---|
| 11 | **리포트 PDF 고도화** | 한글 폰트(NanumGothic) 지원, 차트 추가, 전년도 비교, 컨트롤러/서비스 테스트 |
| 12 | **실시간 대시보드** (WebSocket) | 매출/주문/고객 실시간 모니터링 |
| 13 | **Alimtalk 템플릿 DB 관리** | 코드 하드코딩 제거 |
| 14 | **결제 수단별 수수료 정책** | 수수료 차등 관리 |
| 15 | **프린트 실패 자동 재시도** | 큐 기반 재시도 |
| 16 | **에약 시간대 커스텀 / 웨이팅 앱 푸시** | 30분 간격 개선, FCM 기반 |

### 🟣 P3 (낮음)

| 순위 | 기능 |
|---|---|
| 17 | 멤버십/구독 플랜 연동 |
| 18 | 푸드트럭 실시간 위치 추적 |
| 19 | 리뷰 사진 업로드 + 운영자 답변 |
| 20 | 재고 자동 발주 |
| 21 | 다국어 알림톡/영수증 (zh-TW, vi, th) |
| 22 | API 키 권한 세분화 |
| 23 | DB 인덱스 최적화 (EXPLAIN ANALYZE) |
| 24 | Docker 멀티스테이지 빌드 (500MB → 200MB) |

---

## 5. 아키텍처 분석

### 5.1 강점

- **레이어드 아키텍처**: Route → Controller → Service → Repository (Prisma) 명확 분리 (reportPdf도 동일 패턴 준수)
- **미들웨어 체인**: Auth → Rate Limit → Validation → XSS Sanitizer → Circuit Breaker → Response Format
- **실시간 통합**: Socket.IO + SSE 이중 채널, FCM 푸시 병행
- **DevOps 완성도**: Docker + Prometheus/Grafana/Loki + CI/CD 8개 Job + Semgrep + Trivy
- **API 문서화**: Swagger 자동 문서화 도입 (`/api/swagger`)

### 5.2 약점

- **stores 모델 과중**: 30개+ relation 단일 모델 집중
- **신규 AI 기능 로직 부재**: AI 추천/수요 예측 스텁 상태
- **테스트 불균형**: 일부 서비스만 집중 테스트, 30개+ 서비스 테스트 부재
- **문서 ↔ 실제 코드 불일치 가능성**: 30개 .md 파일 동기화 리스크
- **Clean Architecture 과도기**: `repositories/`(구)와 `app/`(신) 이중 구조 혼재
- **Trivy 배포 차단**: 취약점 미해소 시 CI/CD 파이프라인 정체

### 5.3 데이터 흐름 (핵심: 결제)

```
고객 앱 → Express → validate.js → auth → storeAuth → paymentController
  → PaymentService.processApproval()
    → _assertRequestedAmount() [금액 검증 1차]
    → TossAPI.confirmPayment() [PG 승인]
    → $transaction {
        tx.payments.updateMany() [card_number 마스킹 ✅, toss_pay_token 암호화 ✅, raw_response sanitize ✅]
        ledgerService.recordIncome()
        pointService.earn()
        tx.orders.update()
      }
    → AnomalyDetectionService.checkSalesAnomaly() [비동기]
    → WebSocket emit
    → Alimtalk notification
```

### 5.4 데이터 흐름 (신규: 리포트 PDF)

```
점주 앱 → GET /api/reports/store/:storeId?startDate&endDate
  → authMiddleware → checkStorePermission('stats:read')
  → reportPdfController.generateStoreReport
    → ReportPdfService.generateStoreReportPdf(storeId, startDate, endDate, outputPath)
      → prisma.stores.findUnique() [없으면 '매장을 찾을 수 없습니다.']
      → prisma.orders.findMany({ status != 'cancelled', 기간 필터 })
      → PDFDocument(pdfkit) → reports/ 디렉터리 생성 → 파일 스트림
  → res.download() (다운로드 후 삭제는 주석 처리)
```

---

## 6. 보안 분석

### 6.1 적용된 보안 조치

| 계층 | 조치 |
|---|---|
| 전송 | HTTPS (Cloudflare), helmet CSP nonce |
| 인증 | JWT (access + refresh), 2FA (admin TOTP) |
| 입력 | Joi validation, XSS sanitizer, rate limiter |
| 저장 | `payer_phone` AES-256-CBC, `toss_pay_token` AES-256-CBC, `card_number` 마스킹 |
| 출력 | `raw_response` 민감필드 제거 |
| 감사 | Semgrep CI 스캔, Trivy, Sentry 오류 추적, AnomalyDetectionService |
| 인가 | authMiddleware + adminOnly + checkStorePermission 3단계 |

### 6.2 미적용 보안

| 항목 | 상태 | 중요도 |
|---|---|---|
| 일반 사용자 2FA | 미적용 | 중간 |
| API 키 권한 세분화 | 개발자 포탈 미완 | 중간 |
| Toss 웹훅 서명 검증 | 미확인 | 높음 |
| `/api/reports/all` 슈퍼어드민 권한 검사 | 미적용 (authMiddleware만) | 높음 |
| PCI DSS 완전 준수 | 카드번호 마스킹 완료, 정기 감사 필요 | 높음 |
| DB 암호화 키 순환 정책 | PHONE_ENC_KEY/TOKEN_ENC_KEY 순환 절차 없음 | 중간 |

---

## 7. 권장 실행 순서

### Week 1: 배포 차단 해제 + 보안 마무리
```
Day 1: Trivy 취약점 해소 (base image + npm audit fix) — 배포 차단 해제
Day 2: reportPdf 미커밋 파일 커밋 + /api/reports/all 슈퍼어드민 권한 보강
Day 3: 기존 card_number 백필 마스킹 스크립트
Day 4: Toss 웹훅 서명 검증 + 로깅 보안
Day 5: .env.example 동기화 + render.yaml 검증
```

### Week 2: AI 기능 실제 구현
```
Day 1-2: AI 추천 엔진 (Gemini) 실제 연동 — 고객 세그먼트 기반 메뉴 추천
Day 3-4: 수요 예측 실제 ML 로직 — 과거 주문 데이터 기반 예측
Day 5: 프론트엔드 AI 추천 UI 구현
```

### Week 3: 테스트 + enum 마이그레이션
```
Day 1-2: 서비스 레이어 테스트 확대 (신규 서비스 우선, ReportPdfService 포함)
Day 3-4: 주문/결제 상태 enum 마이그레이션
Day 5: 통합 테스트 보강 + PDF 한글 폰트 지원
```

### Week 4+: 고도화
```
├── 리포트 PDF 고도화 (한글 폰트, 차트, 전년도 비교)
├── 실시간 대시보드 (WebSocket)
├── Redis 캐싱 확대
├── Alimtalk 템플릿 DB 관리
├── stores 모델 분할 리팩토링
└── 멀티스테이지 Docker 빌드
```

---

## 8. 참고 문서

| 문서 | 내용 |
|---|---|
| `ARCHITECTURE.md` | 아키텍처 문서 (576 lines) |
| `NEXT_TASK.md` | 다음 작업 목록 (Trivy 차단 최우선, 로컬 통합테스트, Playwright E2E) |
| `feature-analysis.md` | 기능별 상세 분석 (28개 기능) |
| `CHANGELOG.md` | 전체 릴리스 이력 (v1.2.0 2026-08-07) |
| `docs/ANALYSIS_REPORT_v3.0.md` | 이전 분석 보고서 v3 |
| `docs/DEPLOYMENT.md` | 배포 가이드 |
| `.github/workflows/ci.yml` | CI 파이프라인 (Trivy 포함) |
| `monitoring/` | Prometheus/Grafana/Loki/Alertmanager 설정 |
