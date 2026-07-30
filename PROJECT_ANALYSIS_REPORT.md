# WeMarket 프로젝트 종합 분석 리포트 v4

> **분석 일자**: 2026-07-30 (종합 분석 v4)  
> **분석 대상**: `D:\wemarket-toss\250105`  
> **현재 버전**: v1.1.1 → v1.2.0 (고도화 진행 중)  
> **최신 커밋**: `d86f8bc` — fix: StoreSetupWizard 오류 표시 + 음성ON 버튼 제거 + 결제 보안 + 신규 API 라우트  
> **분석 범위**: 프로젝트 구조, 진행 상황, 해결된 문제, 잔여 문제점, 추가 기능 제안

---

## 1. 프로젝트 개요

WeMarket는 QR 코드 기반 매장 운영 SaaS 플랫폼으로, 식당/카페가 디지털 메뉴·주문·결제·재고·CRM을 통합 관리할 수 있는 풀스택 애플리케이션입니다.

| 구분 | 내용 |
|---|---|
| **백엔드** | Node.js 22 + Express 5 + Socket.IO, Prisma ORM, PostgreSQL (Supabase) |
| **프론트엔드** | React 19 + Vite 7 + Tailwind CSS 4, 다국어(i18n ko/en/ja/zh) |
| **배포** | Cloudflare Pages(프론트) + Render(백엔드) + ArgoCD/GitOps |
| **실시간** | Socket.IO (주문·KDS·채팅·웨이팅) + SSE |
| **외부 연동** | Toss Payments, Kakao Alimtalk, Google Gemini AI, Naver Place API, Firebase FCM |
| **모니터링** | Prometheus + Grafana + Loki + Alertmanager (k8s) |
| **CI/CD** | GitHub Actions (8개 병렬 Job) + Husky + Commitlint + Semgrep |

### 프로젝트 규모

| 지표 | 수치 |
|---|---|
| 라우트 파일 | 53개 |
| 컨트롤러 | 53개 |
| 서비스 | 39개 |
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
| v1.1.1 | 2026-07-25 | 성능 최적화 (이미지/번들/CSS/캐시/Vitals/예산) |
| v1.1.0 | 2026-07-20 | i18n 다국어, Express 5 라우트 표준화, print-agent, CI/CD |
| v1.0.9 | 2026-07-19 | Cloudflare 마이그레이션, 알림톡, 포인트, ESC/POS |
| v1.0.8 | 2026-07-13 | AI TinkerBell, TDS 디자인, 보안 강화 |
| v1.0.7 | 2026-04 | QR/결제/알림 고도화 |
| v1.0.0~ | 2024-2025 | MVP, CRM, 권한, 분석 |

### 2.2 최근 고도화 작업 (2026-07-30 Session)

| 단계 | 작업 | 상태 |
|---|---|---|
| **Step 1** | Prisma 마이그레이션 복원 — schema drift 수정 (grant_templates 등 4개 모델), 9개 신규 AI 테이블 마이그레이션 생성 및 `migrate deploy` | ✅ 완료 |
| **Step 2** | README.md 확인 — 이미 실제 프로젝트 README로 정상 | ✅ 확인 |
| **Step 3** | 카드 번호 마스킹 + `toss_pay_token` AES-256-CBC 암호화 + `raw_response` sanitize | ✅ 완료 |
| **Step 4** | DynamicPricingManager 규칙 생성/수정 모달 추가 + GrantTemplateManager 컨트롤러/라우트/API 연결 | ✅ 완료 |
| **Step 5** | Express 5 호환성 (`validate.js` read-only getter `Object.defineProperty` 대응) | ✅ 완료 |

### 2.3 미적용 대기 변경사항

`git status`: **21개 파일 변경 (staged/committed 전)** — Step 1-5 구현 코드 커밋 전

---

## 3. 문제점 분석

### 3.1 ✅ 해결된 문제 (이전 v3 → v4)

| # | 문제 | 해결 내용 |
|---|---|---|
| ~~3.1~~ | README.md 오염 | 이미 실제 프로젝트 README로 정상 — 분석 오류였음 |
| ~~3.2~~ | 카드 번호 평문 저장 | `maskCardNumber()` + `toss_pay_token` `encryptToken()` 적용 |
| ~~3.3~~ | Prisma 마이그레이션 누락 | `migrate deploy` 성공, 7개 migration 적용 완료 |
| ~~3.5~~ | 프론트엔드 API 미연동 | DynamicPricing 규칙 모달, GrantTemplate 전면 연결 |
| ~~3.6~~ | Express 5 호환성 | `validate.js` `Object.defineProperty` 대응 완료 |

### 3.2 🔴 잔여 심각 문제

#### 3.2.1 카드 번호 DB 내 기존 평문 데이터
- 새 결제는 마스킹되나, 기존 DB의 `payments.card_number` 평문 데이터는 그대로
- **필요**: 백필(backfill) 마이그레이션 스크립트로 기존 데이터 일괄 마스킹

#### 3.2.2 토스 웹훅 raw_response 미처리
- `handleTossWebhook` → `processApproval` 호출 시 `sanitizeRawResponse` 적용됨 ✅
- 그러나 `handleTossWebhook`에서 직접 `processApproval` 호출 전 웹훅 원본 로깅 시 민감정보 노출 가능성

#### 3.2.3 테스트 커버리지 편중 (미해결)
- OrderService, PaymentService 편중, 30개 이상 서비스 테스트 부재
- `coverage-final.json` 평균 0.0% (계측 미흡)

#### 3.2.4 신규 API 컨트롤러 AI 로직 부재
- `dynamicPricingController.js` / `aiRecommendationsController.js` / `demandForecastController.js`
- 동적 가격 컨트롤러는 규칙 CRUD + 기본 가격 계산 로직 구현됨
- AI 추천/수요 예측 컨트롤러는 대부분 스텁(stub) 상태

### 3.3 🟡 중간 문제

#### 3.3.1 주문/결제 상태 문자열 → enum 마이그레이션 필요
- `orders.status`, `payments.status` 수십 가지 문자열 값
- enum 도입 시 데이터 무결성 + 쿼리 성능 향상

#### 3.3.2 일반 사용자 2FA 미적용
- admin 2FA(TOTP) 완료, 일반 사용자 미적용

#### 3.3.3 `stores` 모델 500+ 라인 — 단일 책임 원칙 위반
- 30개 이상 relation 보유 — 도메인별 분할 필요

#### 3.3.4 환경 변수 관리 리스크
- `render.yaml` env var 누락 이력 (5254838에서 일부 수정)
- `.env.example`이 실제 `.env`와 불일치 가능성

#### 3.3.5 `responseFormatter` 기본 200 응답
- `res.success(data, msg, 200)` — 생성 API에 201 미사용
- REST 관례 위반이나 동작 문제는 없음

#### 3.3.6 다국어 지원 미완
- 프론트엔드 i18n 4개 locale 지원
- 알림톡/영수증/법적 문서 한국어 고정

### 3.4 🟢 경미 문제

#### 3.4.1 테스트 도구 이원화 (Jest + Vitest)
- 백엔드 Jest, 프론트엔드 Vitest — Vite 프로젝트의 자연스러운 패턴
- CI에서 각자 정상 동작하므로 실질적 문제는 낮음

#### 3.4.2 API Prefix 비일관성
- `app.js` kebab-case (`dynamic-pricing`) vs camelCase 혼용

#### 3.4.3 모듈 분산
- 10줄 미만 미들웨어/utils 존재 — 기능 분산

---

## 4. 추가 기능 제안

### 🔥 P0 (긴급)

| 순위 | 기능 | 설명 | 근거 |
|---|---|---|---|
| 1 | **기존 카드 번호 백필 마이그레이션** | `payments.card_number` 기존 평문 데이터 일괄 마스킹 | 3.2.1 |
| 2 | **Toss 웹훅 민감정보 로깅 방지** | 웹훅 원본 로그 민감정보 필터링 | 3.2.2 |
| 3 | **동적 가격 책정 실제 AI 연동** | Gemini AI 기반 수요 예측 + 가격 최적화 | 3.2.4 |

### ⬆️ P1 (높음)

| 순위 | 기능 | 설명 |
|---|---|---|
| 4 | **주문/결제 상태 enum 마이그레이션** | 데이터 무결성 + 쿼리 성능 |
| 5 | **테스트 커버리지 확대** | 서비스 레이어 30개+ 테스트 추가 |
| 6 | **일반 사용자 2FA** | TOTP 기반 2차 인증 |
| 7 | **Redis 캐싱 확대** | AI 응답/인기제품/매출 통계 캐싱 |
| 8 | **AI 추천/수요 예측 실제 로직 구현** | Gemini 연동, 프론트엔드 UI 연결 |

### 🔵 P2 (중간)

| 순위 | 기능 | 설명 |
|---|---|---|
| 9 | **실시간 대시보드** (WebSocket) | 매출/주문/고객 실시간 모니터링 |
| 10 | **Swagger API 문서 자동화** | JSDoc → 자동 문서화 |
| 11 | **Alimtalk 템플릿 DB 관리** | 코드 하드코딩 제거 |
| 12 | **결제 수단별 수수료 정책** | 수수료 차등 관리 |
| 13 | **프린트 실패 자동 재시도** | 큐 기반 재시도 |
| 14 | **에약 시간대 커스텀** | 30분 간격 개선 |
| 15 | **웨이팅 앱 푸시 알림** | FCM 기반 |

### 🟣 P3 (낮음)

| 순위 | 기능 |
|---|---|
| 16 | 멤버십/구독 플랜 연동 |
| 17 | 푸드트럭 실시간 위치 추적 |
| 18 | 리뷰 사진 업로드 + 운영자 답변 |
| 19 | 재고 자동 발주 |
| 20 | 다국어 알림톡/영수증 (zh-TW, vi, th) |
| 21 | API 키 권한 세분화 |
| 22 | DB 인덱스 최적화 (EXPLAIN ANALYZE) |
| 23 | Docker 멀티스테이지 빌드 (500MB → 200MB) |

---

## 5. 아키텍처 분석

### 5.1 강점

- **레이어드 아키텍처**: Route → Controller → Service → Repository (Prisma) 명확 분리
- **미들웨어 체인**: Auth → Rate Limit → Validation → XSS Sanitizer → Circuit Breaker → Response Format
- **Clean Architecture 시도**: `app/application`, `app/domain`, `app/infrastructure/prisma/` — 일부 마이그레이션 진행 중
- **실시간 통합**: Socket.IO + SSE 이중 채널, FCM 푸시 병행
- **DevOps 완성도**: Docker + Helm + ArgoCD + Prometheus/Grafana/Loki + CI/CD 8개 Job

### 5.2 약점

- **stores 모델 과중**: 30개+ relation 단일 모델 집중 — 도메인 이벤트/분할 고려 필요
- **신규 AI 기능 로직 부재**: API 스텁 상태, 실제 AI 연동 미구현
- **테스트 불균형**: 일부 서비스만 집중 테스트, 30개+ 서비스 테스트 부재
- **문서 ↔ 실제 코드 불일치 가능성**: 30개 .md 파일 동기화 리스크
- **Clean Architecture 과도기**: `repositories/`(구)와 `app/`(신) 이중 구조 혼재

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
| 감사 | Semgrep CI 스캔, Sentry 오류 추적, AnomalyDetectionService |
| 인가 | authMiddleware + adminOnly + checkStorePermission 3단계 |

### 6.2 미적용 보안

| 항목 | 상태 | 중요도 |
|---|---|---|
| 일반 사용자 2FA | 미적용 | 중간 |
| API 키 권한 세분화 | 개발자 포탈 미완 | 중간 |
| Toss 웹훅 서명 검증 | 미확인 | 높음 |
| PCI DSS 완전 준수 | 카드번호 마스킹 완료, 정기 감사 필요 | 높음 |
| DB 암호화 키 순환 정책 | PHONE_ENC_KEY/TOKEN_ENC_KEY 순환 절차 없음 | 중간 |

---

## 7. 권장 실행 순서

### Week 1: 보안 마무리 + 기존 데이터 정리
```
Day 1: 기존 card_number 백필 마스킹 스크립트
Day 2: Toss 웹훅 서명 검증 + 로깅 보안
Day 3: DB 암호화 키 순환 정책 문서화
Day 4: 일반 사용자 2FA 설계
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
Day 1-2: 서비스 레이어 테스트 확대 (신규 서비스 우선)
Day 3-4: 주문/결제 상태 enum 마이그레이션
Day 5: 통합 테스트 보강
```

### Week 4+: 고도화
```
├── 실시간 대시보드 (WebSocket)
├── Redis 캐싱 확대
├── Alimtalk 템플릿 DB 관리
├── Swagger 문서 자동화
├── stores 모델 분할 리팩토링
└── 멀티스테이지 Docker 빌드
```

---

## 8. 참고 문서

| 문서 | 내용 |
|---|---|
| `ARCHITECTURE.md` | 아키텍처 문서 (576 lines) |
| `NEXT_TASK.md` | 다음 작업 목록 |
| `feature-analysis.md` | 기능별 상세 분석 (28개 기능) |
| `CHANGELOG.md` | 전체 릴리스 이력 |
| `docs/ANALYSIS_REPORT_v3.0.md` | 이전 분석 보고서 v3 |
| `docs/DEPLOYMENT.md` | 배포 가이드 |
| `.github/workflows/ci.yml` | CI 파이프라인 |
| `monitoring/` | Prometheus/Grafana/Loki/Alertmanager 설정 |
