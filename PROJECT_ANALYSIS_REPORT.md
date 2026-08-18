# WeMarket 프로젝트 종합 분석 리포트 v6

> **분석 일자**: 2026-08-18 (종합 분석 v6, v5 이후 60개 커밋 반영)  
> **분석 대상**: `D:\wemarket-toss\250105`  
> **현재 버전**: v1.3.0  
> **최신 커밋**: `38308c1` — docs: README 모델 수·jest 버전 갱신, v1.3.0 changelog 추가  
> **커밋 수**: 641개 (`af26c34..HEAD` 60개)  
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
| **PDF** | pdfkit `^0.19.1` (매출 리포트 PDF, 커밋 완료) |

### 프로젝트 규모

| 지표 | 수치 |
|---|---|
| 라우트 파일 | 67개 |
| 컨트롤러 | 65개 |
| 서비스 | 60개 |
| 리포지토리 | 28개 |
| 미들웨어 | 14개 |
| Prisma 마이그레이션 | 22개 |
| Prisma 모델 | **79개** |
| 프론트엔드 훅 | 15개 |
| 프론트엔드 컴포넌트 | 137개 |
| 프론트엔드 페이지 | 36개 |
| 총 문서(.md) | 46개 (print-agent 224개 제외) |
| 테스트 | 147개 (tests/ 135, frontend 11, `__tests__` 1) |

---

## 2. 현재 진행 상황

### 2.1 버전 이력

| 버전 | 날짜 | 주요 내용 |
|---|---|---|
| **v1.3.0** | 2026-08-18 | 푸드트럭 디자인 테마, 정산 CSV, 공개 플랜 API, 권한/검증 강화, SLO·프린트 실패 알림, scoped feature rollout, scoped OpenAPI 권한 |
| **v1.2.0** | 2026-08-07 | 스토어 테마 설정 저장·메뉴판 적용 (테마 프리셋) |
| v1.1.1 | 2026-07-25 | 성능 최적화 (이미지/번들/CSS/캐시/Vitals/예산) |
| v1.1.0 | 2026-07-20 | i18n 다국어, Express 5 라우트 표준화, print-agent, CI/CD |
| v1.0.9 | 2026-07-19 | Cloudflare 마이그레이션, 알림톡, 포인트, ESC/POS |
| v1.0.8 | 2026-07-13 | AI TinkerBell, TDS 디자인, 보안 강화 |
| v1.0.7 | 2026-04 | QR/결제/알림 고도화 |
| v1.0.0~ | 2024-2025 | MVP, CRM, 권한, 분석 |

> **정정(v5 → v6)**: v5에서 v1.2.0(2026-08-07)을 "결제 고도화"로 표기했으나, CHANGELOG 기준 v1.2.0은 **스토어 테마 설정 저장·메뉴판 적용(테마 프리셋)**입니다. 결제 고도화·Swagger·이상 매출 감지·ETA·동적 가격 작업은 v1.2.0 이전 커밋들에 해당하며, 아래 2.2 최근 고도화에서 별도로 다룹니다.

### 2.2 최근 고도화 작업 (v5 이후 `af26c34..HEAD`, 커밋 60개)

v5 분석(2026-08-12) 이후 **60개 커밋**이 반영되었습니다. 핵심 작업 요약:

| 영역 | 작업 | 상태 |
|---|---|---|
| **릴리스 문서화** | `38308c1` v1.3.0 changelog + README 갱신 | ✅ 완료 |
| **푸드트럭 디자인 테마** | `0c3e016` 푸드트럭 디자인 쇼케이스 테마, `c16517c` 마이그레이션명 타임스탬프 컨벤션 정렬, `1a41bfe` 메뉴 테마 프리셋·카테고리 임포트 모달·내비 경로 정렬 | ✅ 완료 |
| **권한/검증 강화** | `46445ca` scoped OpenAPI 권한, `b9756ce` 엔드포인트별 OpenAPI scope 문서화, `77edc13` 상품/카테고리 매장 접근 제어, `983cd7b` 사업자등록번호·계좌번호 검증, `7518699` 동적 가격 규칙 검증, `db4180e` 영수증 설정 화이트리스트 | ✅ 완료 |
| **정산 강화** | `c9299be` 정산 CSV 다운로드·삭제·기간 검증 | ✅ 완료 |
| **공개 API** | `b8b0402` 공개 플랜 목록 API | ✅ 완료 |
| **알림/모니터링** | `7ec3ded` SLO + 프린트 실패 알림, `89aa937` 프린트 재시도 백오프/실패 이벤트, `61c8a8d` 알림톡 전송 이력 로깅 | ✅ 완료 |
| **피처 플래그** | `d86681f` scoped feature rollout, `2cb72c7` 플래그 삭제 시 스코프 보존, `a418acc`/`f8d4f93`/`969665c` 피처 플래그 관리·감사 로그 UI, `be972ff` 감사/플래그 운영 UI | ✅ 완료 |
| **주문/CRM/재고** | `9b4666a`/`4397251` 주문 이벤트 히스토리·원장, `d1cf9ef`/`9251d33` CRM 캠페인 승인 UI + 승인된 캠페인만 사용, `ca08d1f` 웨이팅/예약 capability 헤더, `4e947d6` 관리자 대시보드 fetch → api client, `0fd8edd` 재고 재주문 후보 | ✅ 완료 |
| **테스트/품질** | `27c6cfd` 핵심 API 라우트 계약 테스트, `88dbf1a`/`89c311b` vitest 격리·탐지 수정, `017583d` 릴리스 게이트 + 주문 상태 중앙화, `0e2623d` 계정 하드닝, `f9a0c8f` AI 추천 confidence 설명 | ✅ 완료 |

### 2.3 미커밋 대기 변경사항

`git status`: 작업 트리는 깨끗하며(추적 파일 기준), 미커밋 대기는 **untracked 1개 파일**뿐입니다.

| 파일 | 상태 | 내용 |
|---|---|---|
| `apply-food-truck-design.js` | `??` (신규, 21줄) | `prisma/migrations/20260818070000_add_food_truck_design_theme/migration.sql`을 `require('./prisma/app/generated/prisma')` 경유로 적용하는 1회성 스크립트 — 실행 후 커밋하거나 제거 권장 |

**참고**: v5에서 미커밋이던 reportPdf 관련 파일(`app.js`, `routes/reportPdf.js`, `controllers/reportPdfController.js`)은 모두 커밋 완료되었습니다.

---

## 3. 문제점 분석

### 3.1 ✅ 해결된 문제 (이전 v5 → v6)

| # | 문제 | 해결 내용 |
|---|---|---|
| **신규** | reportPdf 미커밋 | `app.js` + `routes/reportPdf.js` + `controllers/reportPdfController.js` 커밋 완료 |
| **신규** | OpenAPI 권한 미세분화 부재 | `46445ca` scoped OpenAPI 권한 + `b9756ce` 엔드포인트별 scope 문서화 |
| **신규** | 프린트 실패 재시도 부재 | `89aa937` 재시도 백오프/실패 이벤트 + `7ec3ded` SLO·프린트 실패 알림 |
| **신규** | 알림톡 이력 부재 | `61c8a8d` 알림톡 전송 이력 로깅 |
| **신규** | 영수증 설정 주입 리스크 | `db4180e` 화이트리스트 적용 |
| **신규** | 사업자등록번호·계좌번호 검증 부재 | `983cd7b` |
| **신규** | 상품/카테고리 교차 매장 접근 | `77edc13` 매장 접근 제어 |
| **신규** | 주문 이력 추적 부재 | `9b4666a`/`4397251` 주문 이벤트 히스토리·원장 |
| **신규** | CRM 캠페인 무검증 적용 | `d1cf9ef`/`9251d33` 승인 절차 UI + 승인된 캠페인만 사용 |
| **신규** | 재고 발주 판단 부재 | `0fd8edd` 재주문 후보 기능 |
| **신규** | 피처 플래그 무분별 배포 | `d86681f` scoped rollout + `2cb72c7` 스코프 보존 + 관리·감사 UI |
| **신규** | vitest 테스트 격리 문제 | `88dbf1a`/`89c311b` |
| **신규** | 배포 게이트·주문 상태 분산 | `017583d` 릴리스 게이트 + 주문 상태 중앙화 |
| **신규** | 계정 보안 | `0e2623d` 계정 하드닝 |

### 3.2 🔴 잔여 심각 문제

#### 3.2.1 Trivy 취약점 스캔 실패로 배포 차단 (최우선, v5 연속)
- `NEXT_TASK.md` 최우선 이슈 — docker-build CI의 `trivy image --severity CRITICAL,HIGH --exit-code 1` 실패가 배포 파이프라인을 차단 중
- **필요**: base image/의존성 업그레이드 + `npm audit fix`

#### 3.2.2 카드 번호 DB 내 기존 평문 데이터 (v5 연속)
- 새 결제는 마스킹되나, 기존 DB의 `payments.card_number` 평문 데이터는 그대로
- **필요**: 백필(backfill) 마이그레이션 스크립트로 기존 데이터 일괄 마스킹

#### 3.2.3 Toss 웹훅 raw_response 미처리 (v5 연속)
- `handleTossWebhook` → `processApproval` 호출 시 `sanitizeRawResponse` 적용됨 ✅
- 그러나 웹훅 원본 로깅 경로에서 민감정보 노출 가능성 잔존

#### 3.2.4 신규 API 컨트롤러 AI 로직 부재 (v5 연속)
- `aiRecommendationsController.js` / `demandForecastController.js`는 대부분 스텁(stub) 상태
- 동적 가격 컨트롤러는 규칙 CRUD + 기본 가격 계산 로직만 구현됨

#### 3.2.5 `/api/reports/all` 슈퍼어드민 권한 미검사 (v5 연속, v6 재확인)
- v5에서 지적된 이슈. v6 작성 시점에 `routes/reportPdf.js` / `controllers/reportPdfController.js`를 재검색한 결과 슈퍼어드민/권한 검사 패턴이 여전히 없음 — `authMiddleware`만 적용된 상태 유지
- **필요**: `adminOnly` 또는 별도 슈퍼어드민 권한 검사 추가

### 3.3 🟡 중간 문제

#### 3.3.1 주문/결제 상태 문자열 → enum 마이그레이션 필요 (v5 연속)
- `orders.status`, `payments.status` 수십 가지 문자열 값
- enum 도입 시 데이터 무결성 + 쿼리 성능 향상 (단, `017583d`에서 주문 상태 중앙화는 진행됨)

#### 3.3.2 일반 사용자 2FA 미적용 (v5 연속)
- admin 2FA(TOTP) 완료, 일반 사용자 미적용

#### 3.3.3 `stores` 모델 500+ 라인 — 단일 책임 원칙 위반 (v5 연속)
- 30개 이상 relation 보유 — 도메인별 분할 필요

#### 3.3.4 환경 변수 관리 리스크 (v5 연속)
- `render.yaml` env var 누락 이력, `.env.example`이 실제 `.env`와 불일치 가능성

#### 3.3.5 다국어 지원 미완 (v5 연속)
- 프론트엔드 i18n 4개 locale 지원
- 알림톡/영수증/법적 문서 한국어 고정

#### 3.3.6 리포트 PDF 한글 폰트 미지원 (v5 연속)
- 한글 매장명/내용이 깨질 수 있음 (영문 레이아웃 기준)
- PDF 테스트 부재

#### 3.3.7 버전 태그 누락 (신규)
- `git tag`는 `v1.0.0`만 존재 — CHANGELOG의 v1.1.0/v1.2.0/v1.3.0과 불일치
- **필요**: 릴리스 시 태그 발행 절차 정립 (예: `git tag v1.3.0 && git push --tags`)

### 3.4 🟢 경미 문제

#### 3.4.1 테스트 도구 이원화 (Jest + Vitest) (v5 연속)
- 백엔드 Jest, 프론트엔드 Vitest — CI에서 각자 정상 동작

#### 3.4.2 API Prefix 비일관성 (v5 연속)
- `app.js` kebab-case (`dynamic-pricing`) vs camelCase 혼용

#### 3.4.3 모듈 분산 (v5 연속)
- 10줄 미만 미들웨어/utils 존재 — 기능 분산

#### 3.4.4 `ReportPdfService.js` 파일명 케이스 불일치 (신규)
- 주변 `reportPdf*` 파일과 달리 PascalCase 서비스명 — WSL 대소문자 비민감 FS라 실질 문제는 없으나 일관성 차원에서 정리 권장

#### 3.4.5 1회성 스크립트 작업 트리 잔존 (신규)
- `apply-food-truck-design.js`(untracked)가 작업 트리에 남아 있음 — 실행 후 커밋 또는 제거 필요

---

## 4. 추가 기능 제안

### 🔥 P0 (긴급)

| 순위 | 기능 | 설명 | 근거 |
|---|---|---|---|
| 1 | **Trivy 취약점 해소** | base image/의존성 업그레이드, `npm audit fix` — 배포 차단 해제 | 3.2.1 |
| 2 | **기존 카드 번호 백필 마이그레이션** | `payments.card_number` 기존 평문 데이터 일괄 마스킹 | 3.2.2 |
| 3 | **Toss 웹훅 민감정보 로깅 방지** | 웹훅 원본 로그 민감정보 필터링 + 서명 검증 | 3.2.3 |
| 4 | **`/api/reports/all` 권한 보강 + PDF 한글 폰트** | 슈퍼어드민 권한 검사 + NanumGothic 지원 | 3.2.5 / 3.3.6 |

### ⬆️ P1 (높음)

| 순위 | 기능 | 설명 |
|---|---|---|
| 5 | **동적 가격 책정 실제 AI 연동** | Gemini AI 기반 수요 예측 + 가격 최적화 |
| 6 | **주문/결제 상태 enum 마이그레이션** | 데이터 무결성 + 쿼리 성능 (주문 상태 중앙화와 연계) |
| 7 | **일반 사용자 2FA** | TOTP 기반 2차 인증 |
| 8 | **버전 태깅 프로세스 정립** | 릴리스 시 `git tag` 자동 발행 (v1.3.0 태그 발행) |
| 9 | **Redis 캐싱 확대** | AI 응답/인기제품/매출 통계 캐싱 |
| 10 | **AI 추천/수요 예측 실제 로직 구현** | Gemini 연동, 프론트엔드 UI 연결 |

### 🔵 P2 (중간)

| 순위 | 기능 | 설명 |
|---|---|---|
| 11 | **리포트 PDF 고도화** | 한글 폰트(NanumGothic) 지원, 차트 추가, 전년도 비교, 컨트롤러/서비스 테스트 |
| 12 | **실시간 대시보드** (WebSocket) | 매출/주문/고객 실시간 모니터링 |
| 13 | **Alimtalk 템플릿 DB 관리** | 코드 하드코딩 제거 |
| 14 | **결제 수단별 수수료 정책** | 수수료 차등 관리 |
| 15 | **에약 시간대 커스텀 / 웨이팅 앱 푸시** | 30분 간격 개선, FCM 기반 |

### 🟣 P3 (낮음)

| 순위 | 기능 |
|---|---|
| 16 | 멤버십/구독 플랜 연동 |
| 17 | 푸드트럭 실시간 위치 추적 |
| 18 | 리뷰 사진 업로드 + 운영자 답변 |
| 19 | 다국어 알림톡/영수증 (zh-TW, vi, th) |
| 20 | DB 인덱스 최적화 (EXPLAIN ANALYZE) |
| 21 | Docker 멀티스테이지 빌드 (이미지 크기 축소) |

---

## 5. 아키텍처 분석

### 5.1 강점

- **레이어드 아키텍처**: Route → Controller → Service → Repository (Prisma) 명확 분리 (reportPdf도 동일 패턴 준수)
- **미들웨어 체인**: Auth → Rate Limit → Validation → XSS Sanitizer → Circuit Breaker → Response Format
- **실시간 통합**: Socket.IO + SSE 이중 채널, FCM 푸시 병행
- **DevOps 완성도**: Docker + Prometheus/Grafana/Loki + CI/CD 8개 Job + Semgrep + Trivy
- **권한 세분화 진전**: scoped OpenAPI 권한, scoped feature rollout, capability 헤더, 매장 접근 제어
- **추적성**: 주문 이벤트 히스토리·원장, 알림톡 이력, 감사 로그 UI
- **API 문서화**: Swagger 자동 문서화 도입 (`/api/swagger`) + 엔드포인트별 scope 문서화

### 5.2 약점

- **stores 모델 과중**: 30개+ relation 단일 모델 집중
- **신규 AI 기능 로직 부재**: AI 추천/수요 예측 스텁 상태
- **문서 ↔ 실제 코드 불일치 가능성**: 46개 .md 파일 동기화 리스크
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

### 5.4 데이터 흐름 (신규: 리포트 PDF, 커밋 완료)

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
| 인가 | authMiddleware + adminOnly + checkStorePermission 3단계, scoped OpenAPI 권한, 매장 접근 제어 |
| 감사 | Semgrep CI 스캔, Trivy, Sentry 오류 추적, AnomalyDetectionService, 감사 로그 UI, 알림톡 이력 |
| 운영 | SLO + 프린트 실패 알림, 릴리스 게이트, 피처 플래그 scoped rollout, 계정 하드닝 |

### 6.2 미적용 보안

| 항목 | 상태 | 중요도 |
|---|---|---|
| 일반 사용자 2FA | 미적용 | 중간 |
| API 키 권한 세분화 | 개발자 포탈 미완 | 중간 |
| Toss 웹훅 서명 검증 | 미확인 | 높음 |
| `/api/reports/all` 슈퍼어드민 권한 검사 | 미적용 (authMiddleware만, v6 재확인) | 높음 |
| PCI DSS 완전 준수 | 카드번호 마스킹 완료, 정기 감사 필요 | 높음 |
| DB 암호화 키 순환 정책 | PHONE_ENC_KEY/TOKEN_ENC_KEY 순환 절차 없음 | 중간 |

---

## 7. 권장 실행 순서

### Week 1: 배포 차단 해제 + 보안 마무리
```
Day 1: Trivy 취약점 해소 (base image + npm audit fix) — 배포 차단 해제
Day 2: /api/reports/all 슈퍼어드민 권한 보강 + 리포트 PDF 한글 폰트(NanumGothic)
Day 3: 기존 card_number 백필 마스킹 스크립트
Day 4: Toss 웹훅 서명 검증 + 로깅 보안
Day 5: .env.example 동기화 + render.yaml 검증 + v1.3.0 git tag 발행
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
Day 3-4: 주문/결제 상태 enum 마이그레이션 (주문 상태 중앙화와 연계)
Day 5: 통합 테스트 보강 + PDF 컨트롤러/서비스 테스트
```

### Week 4+: 고도화
```
├── 리포트 PDF 고도화 (차트, 전년도 비교)
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
| `feature-analysis.md` | 기능별 상세 분석 (29개 기능) |
| `CHANGELOG.md` | 전체 릴리스 이력 (v1.3.0 2026-08-18) |
| `docs/ANALYSIS_REPORT_v3.0.md` | 이전 분석 보고서 v3 |
| `docs/DEPLOYMENT.md` | 배포 가이드 |
| `.github/workflows/ci.yml` | CI 파이프라인 (Trivy 포함) |
| `monitoring/` | Prometheus/Grafana/Loki/Alertmanager 설정 |
