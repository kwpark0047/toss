# WE-MARKET Production Release Candidate 최종 검증

검증일: 2026-10-09 KST. 저장소: `D:\wemarket-toss\250105`.

## 1. 최종 판정

**A. Release Blocked — 유료 상용 출시 승인 불가.** 로컬 P0 보완의 실DB 회귀는 통과했지만, 전체 integration 실패, 빈 DB migration 실패, 구독 금융 경합·웹훅 복구·세션 폐기 결함, 실제 PG sandbox 및 운영 복구 증거 부재가 남아 있다. 현재 작업 트리를 Staging Ready나 Production Ready로 인증하지 않는다.

이번 작업은 코드·보고서 대조, 격리 로컬 시험, 공개 URL/원격 CI 읽기 검증이다. 애플리케이션 코드 수정, 커밋·푸시·배포, 운영 DB 변경, 운영 키 변경, 실제 결제·환불을 실행하지 않았다. 테스트 DB에만 fixture를 생성했고 기존 미커밋 변경을 보존했다.

| 판정 | 현재 충족 | 판정 근거 / 필요한 조건 |
|---|---|---|
| A. Release Blocked | **해당** | 아래 RC-01~RC-10 차단/미검증 항목 존재. 로컬 통과를 운영 안전성으로 확대할 수 없음 |
| B. Staging Ready | 미충족 | 고정 RC SHA, 재현 가능한 migration/기존 DB 업그레이드, 실패 없는 필수 integration, 금융·인증 차단 결함 수정, 분리 staging 구성 필요 |
| C. Limited Production Pilot Ready | 미충족 | B + 동일 SHA staging 실제 PG sandbox 여정/장애 복구, 운영 schema·대사·worker·보안 설정 확인, 제한 고객/기능/금액·모니터링·중단·복구 책임자 승인 필요 |
| D. Production Ready | 미충족 | C + peak load/SLO, 지속 갱신·실패 재시도 검증, 실제 reference provider/대사, 개인정보 정책, backup/PITR·키/파일 복구 및 rollback 훈련 증거 필요 |

개발 환경에서 시험할 수 있다는 의미와 **B 출시 게이트 충족**은 다르다. 미검증 기능을 유료 상품에서 제외하려면 계약·화면·권한·feature flag·운영 지원 범위를 명시해 별도 위험 수용해야 한다. 현재 그런 범위 승인 증거는 없다.

## 2. 검증 대상의 식별과 증거 한계

| 대상 | 확인 결과 |
|---|---|
| 감사 기준 및 로컬 HEAD | `7d0c93fd69454bf46755038bb1e8a1180ffdb476` |
| 실제 검증 코드 | HEAD와 다른 다수의 미커밋/미추적 파일을 포함한 현재 작업 트리. **이를 식별하는 새 commit SHA 없음** |
| 원격 main | 읽기 API 확인: `420315c2891c0b49abf73369ed0d1617598ba0c9` |
| 원격 최신 CI | CI `37816386252` success, Security `37816386401` success, Scheduled Integration `37816386457` skipped. 모두 원격 420315c 기준 |
| 로컬 P0 핵심 파일 | 이전 증거의 RefundService/identity/Order/AI/capability JS·TS/schema/신규 migration 8개 SHA-256 모두 현재와 일치 |
| 운영 프런트 | `https://wemarket-saas.vercel.app/` HTTP 200, 단일 관측 1,234ms. HTML 성공만 확인; 로그인·실주문·현재 RC 동일성은 미확인 |
| 운영 백엔드 | `https://wemarket.onrender.com/api/health` HTTP 200, 단일 관측 **55,069ms**, version `1.3.0`, uptime `21`. 응답 commit/commit_sha 없음. DB connected 여부를 whitelist 결과에서 확인하지 못함 |

원격 CI 성공은 미커밋 P0 수정본 검증을 의미하지 않는다. 공개 health의 긴 응답은 cold start 정황이지만 한 표본으로 원인·p95·p99·DB 병목을 확정하지 않는다. `version=1.3.0`은 commit 증명이 아니다. Render/Vercel 실제 실행 SHA는 **Unknown / 운영환경 확인 필요**이다.

Git 증거: `reports/rc-20261009-git-status.txt`, `rc-20261009-git-diff-stat.txt`. 핵심 파일 대조: `rc-20261009-code-hash-comparison.json`. 원격 API 조회와 HTTP 관측은 이번 도구 실행 출력에 기록됐으며 인증 정보·hook URL·토큰은 보고서에 싣지 않는다.

## 3. 이전 보고서의 완료 주장 재평가

감사·분석·수정·배포·운영화 문서 36개를 수집하고 완료/실패/제외 범위를 대조했다. 파일별 경로·SHA-256·관련 주장 원문은 `reports/rc-20261009-prior-report-inventory.json`에 보관했다. 보고서 날짜·검증 SHA·테스트 대상을 현재 RC와 분리한다. 배포 복사본 디렉터리는 중복 증거로 계산하지 않았다.

| 이전 문서 / 주장 | 현재 대조 결과 |
|---|---|
| `docs/ANALYSIS_REPORT_v2.1.md`의 READY FOR PRODUCTION DEPLOYMENT, v4/v5의 안정 단계·Q4 완료, 과거 전체 단위 테스트 통과 | 현재의 금융·운영 불변식 증거 없음. 당시 기능/단위 시험 완료 주장으로 한정하며 최종 출시 판정을 대체하지 못함 |
| `PROJECT_ANALYSIS_REPORT*.md`, `docs/AUDIT_2026-10-02.md` | 보안/배포/테스트 개선 이력. HS256 제한은 실제 auth 코드에 존재하지만 즉시 session 회수까지 구현됐다는 뜻은 아님 |
| `PRODUCTION_READINESS_AUDIT.md` | 2 P0와 다수 P1의 실제 코드 근거 존재. 이번 P0 보완으로 닫힌 로컬 재현 결함과 미반영 운영 위험을 분리 |
| `PRODUCTION_REMEDIATION_P0_P1.md`, `PRODUCTION_P0_REMEDIATION_REPORT.md` | 로컬 P0/실DB 통과 및 기존 integration 실패·운영 미검증을 정직하게 구분. 이번 재실행에서도 동일한 핵심 결과 확인 |
| `reports/SAAS_VALIDATION_2026-10-06.md`, `COMMERCIAL_SAAS_IMPLEMENTATION_2026-10-06.md` | 빌링/DB 호출은 대역 시험, 당시 운영 실결제 제외 명시. 구독 전체 lifecycle 운영 완료로 해석 불가 |
| `reports/DEPLOYMENT_STATUS_2026-10-06.md` | 당시 승인된 구독 migration 3개 운영 적용 증거. 이후 durable refund/identity compensation migration 적용 증거는 아님 |
| AI 매니저 LOCAL → DEPLOYMENT 보고서 | 먼저 로컬 유지 후 별도 게시·운영화된 시간 순서. 승인 기반 QR 추천/관측 평가는 구현; 모든 외부 마케팅 채널 실행·인과적 성과 입증은 제외 |
| `TABLE_QR_UPGRADE`, `DASHBOARD_DEPLOYMENT`, `ADMIN_RUNTIME_DEPLOYMENT`, `DEPLOYMENT_RENDERING_FIX`, `NEW_ACCOUNT_DEPLOYMENT` | UI/배포 장애 수정 이력. API fixture 화면 통과와 운영 고객·PG 종단 성공을 분리 |
| `WEBAPP_STARTUP_OPTIMIZATION`, `STARTUP_RELEASE` | 번들·캐시·slow API fixture 개선. 현재 운영 첫 접속 55초 관측을 상쇄하는 SLA 증거 아님 |
| `DATA_PIPELINE_AUDIT`, `STORE_INTEGRATION_DELIVERY`, `docs/EXTERNAL_INTEGRATION_PRODUCTION.md` | 공통 CSV/API·저장·격리 기반과 실제 업체 수집은 별개. 실제 업체 인증/대사 미완료 명시 |
| `CANONICAL_INTEGRATION_ACTIVATION_2026-10-08.md` | canonical 6개 테이블 운영 적용·RLS 및 과거 배포 증거. reference adapter/OAuth/worker/mapping/대사와 AI 외부 매출 사용은 미활성 |
| `COMMERCIAL_RELIABILITY*`, `PROJECT_STATUS_REVIEW_2026-10-08.md` | timeout/readiness/worker 진입점 준비와 운영 지속 실행·복구는 구분되어 있음. 현재 실제 worker·청구 설정 미확인 |

## 4. 10개 영역 최종 검증

상태는 Production Ready / Partial / Missing / Risk / Unknown 중 구체적 증거에 맞춰 표시한다. **10개 전체 영역 중 Production Ready로 인증할 수 있는 영역은 없다.** 이는 통과한 세부 기능을 부정하는 의미가 아니다.

### 4.1 고객 개인정보 및 매장 격리 — Partial / 운영 Unknown

- 근거: `routes/ai.js:81,367`, `middleware/customerIdentity.js:12`, `repositories/Order.js:253,262,274`, `services/CustomerPreferenceService.js:35`, `services/aiService.js:251,369`, `utils/orderCapability.js:30`, `.ts:35`.
- 공개 추천은 개인 이력을 읽지 않고, 개인화는 인증 user/store + 검증 phone + 명시적 동의·철회 확인이 필요하다. 전화번호·외부 ID 단독은 인증이 아니다. history v2는 store 및 보유 order IDs로 제한한다. content hash 캐시는 같은 길이의 타 고객 이력 혼합을 차단한다.
- unit/API 및 실 PostgreSQL의 실제 HTTP/일반 역할 차단 통과. 모든 route×role×tenant 전체 matrix를 실운영에서 실행한 증거는 없음. 개인화 동의/소유 검증 producer UI/서버 흐름도 아직 연결하지 않아 fallback 상태.
- **RC-01 / P0 운영 반영 차단:** 검증한 P0 코드·신규 schema가 운영 적용되지 않았으므로 운영 개인정보 경계 완료를 선언할 수 없음. 동의 없이 임의 backfill 금지.
- 완료 조건: 동일 RC를 staging에 적용, 타 사용자/타 매장 matrix·철회 즉시 반영·LLM payload 검증, 승인된 운영 반영 후 재검증. 전체 데이터 격리 인증은 이 범위를 넘어야 함.

### 4.2 QR → 메뉴 → 주문 → 결제 → 원장 → 환불 — Partial / Risk

- 근거: `controllers/orderController.js:67,84`, `services/PaymentService.js`, `services/RefundService.js:47,60,80,118,140`, `services/LedgerService.js:54`, `tests/database/refunds-postgres.test.cjs`.
- 정상 등록 결제의 신규 환불은 양수 원장, 남은 잔액 취소, payment lock, operation/event UNIQUE, PG result journal, inventory compensation UNIQUE와 transaction으로 처리한다. 실제 DB의 10,000 → 2,000 → 3,000 → 5,000 잔액 취소 및 fault recovery가 통과한다.
- QR 브라우저는 1440/390px에서 이미지·PNG/PDF·menu URL·오류 재시도 통과. **모든 API fixture, 실제 주문/결제/실스캔 모바일 네트워크 시험 아님.** 기존 `tests/e2e/order-flow.spec.js`는 demo 메뉴/결제 버튼·receipt 화면 중심이며 실제 Toss 승인까지 증명하지 않는다.
- **RC-02 / P0 운영 반영 차단:** 신규 금융 schema 미반영, 기존 금융 원장/PG 잔액 대사 미수행. 전체 주문 integration 실패도 남음.
- 필요: 실제 staging QR→주문→Toss sandbox 승인→원장→부분/잔액 취소, 영수증·포인트·재고까지 대사. 과거 금액은 추측으로 변경하지 않음.

### 4.3 결제·웹훅 중복/지연/역전/복구 — Risk / P1

- `handlers/subscriptionWebhook.js:21–33,59–95`: 처리 전 process-local Map에 dedup ID를 넣고 실패해도 제거하지 않는다. 같은 이벤트 재전송이 유실되고 다중 인스턴스/재시작 간 중복 제어가 공유되지 않는다. 지원 `Subscription.*` 계약은 실제 Toss 공식 이벤트와 연결되는지 운영 확인 필요.
- `services/PaymentService.js:724`는 DONE 이벤트 중심이며 취소·외부 환불·역전 이벤트 전체 대사가 입증되지 않았다. `:571,737` 직접 PG 자동 취소 경로는 정상 등록 결제의 새 durable refund와 별개이다.
- 신규 RefundService는 DB 실패/재고 실패/lease 만료·stale owner/별도 프로세스 재개를 실제 DB + 통제 provider로 검증. OS 강제 종료·네트워크 분할·Toss 실제 멱등성 보존 기간은 미검증.
- **RC-03:** provider+event UNIQUE durable inbox, 성공 후 처리 상태 원자 기록, 실패 retry/DLQ, 최신 상태/terminal fencing, 모든 PG 자동 취소 intent와 대사 필요. 서명 검증 코드 존재와 실제 가맹점 event 검증은 별도.
- 완료 조건: 동일 이벤트 동시 두 process, 최초 DB 실패 후 재전송, 늦은 DONE/CANCELED/취소, ACK 직후 kill 재개에서 동일 금전 결과. PG sandbox와 실제 PostgreSQL 조합 증거 필요.

### 4.4 SaaS 구독 lifecycle — Risk / P1

- `services/SaaSBillingService.js:210–217,241–254,301–315`: claim은 조건부이나 paid/failed 쓰기는 invoice ID만 조건. 오래된 worker catch가 subscription을 무조건 past_due로 바꿔 최신 paid/active 상태를 덮을 수 있다. 안정 PG orderId는 이 DB 경합을 해결하지 않는다.
- 신규 subscription/billingInvoice와 legacy store_subscriptions/웹훅이 공존한다. 갱신·혜택·해지의 단일 권위 상태와 legacy event 최신성 검증 필요.
- `render.yaml:36`은 청구 scheduler 기본 false, 독립 `scripts/operations-worker.cjs` 진입점은 있으나 실제 지속 worker·활성 flag·backlog·paging 운영 증거 없음. 설정을 추정하여 청구를 켜지 않았다.
- SaaS 58개는 통제 대역/로컬 HTTP 시험이며 real PG billing/renewal DB 경합 certification 아님.
- **RC-04:** claim token/generation terminal CAS, paid 회귀 금지·entitlement transaction, 월말/KST 기간·해지와 갱신 경합, PG 성공 DB 실패 복구, consent/가격 변경 재동의 검증. 실제 PostgreSQL + Toss billing sandbox + worker 재시작을 완료해야 함.

### 4.5 AI 근거·추천·승인·성과 — Partial

- `services/StoreManagerService.js:70,133–194,217–291`: provider/분석 기간 provenance, store scoped action lock, 승인 전 execute 차단, QR 추천 노출/중단/만료, 7일 관측 평가 구현.
- 이번 실제 PostgreSQL 검사는 tenant isolation, 승인 실행, 동시 멱등성, 만료/중단, 관측 평가 및 AI quota를 통과했다. fixture 브라우저의 승인/실행/대화/QR 노출도 통과.
- `services/integrations/canonicalAnalysis.js:12,16`: 외부 근거 provider/period/count/job 제공, 조회 실패는 unavailable로 격리, **used_for_revenue=false**. 외부 자료가 매출 추천의 실분석 source로 완성되었다고 판단하지 않는다.
- **RC-05 / P1:** 실제 LLM timeout/injection/구조 validation·비용·tenant payload·불충분 데이터·운영 관측 시험 미충족. native 결과는 일부 검증했으나 전체 모델/외부 API fault 범위를 인증하지 않음.
- 완료 조건: 승인 없는 외부 행동 0, 근거와 기간 재현, 모수 부족시 추측 0, model 실패에도 주문/결제 E2E 유지. 관측 개선을 인과적 효과라고 표현하지 않아야 함.

### 4.6 외부 업체 수집·매출 대사 — Partial / 실제 reference Missing

- `services/integrations/providerPipeline.js:35–57`, `runSyncPage.js`, `SyncStore.js`, `20261008020000_canonical_sync`가 adapter/validation/hash/timeout/backoff·tenant FK·owner fencing·page/checkpoint atomicity를 제공한다.
- 공통 ingress DB script와 canonical PostgreSQL 시험에서 격리·동시 재전송·중복·conflict rollback·cursor 원자성 통과. encrypted credentials 검사는 공통 API credential 보호에 한정하며 완전한 provider OAuth lifecycle 증명 아님.
- 실제 업체명/공식 계약/reference adapter/account 성공·pagination 전체 순회·OAuth refresh/revoke·menu mapping/unmapped queue·manual resync·자동 worker·provider health/일별 매출/환불 대사 운영 증거 없음.
- **RC-06 / P1:** 연동 매출을 과금 상품/AI 근거로 약속하기 전에 1개 실제 provider를 연결하여 provider 원액−취소와 canonical/native 중복 제거 결과가 일치함을 입증해야 함. 샘플 성공을 운영 성공으로 표시하지 않음.

### 4.7 인증·세션 폐기·API·캐시 — Risk / P1

- `middleware/auth.js:27–36` HS256/access type 확인은 구현. req.user는 JWT snapshot이며 매 요청 session 폐기/current role/version 조회는 없음.
- `controllers/authController.js:360–395` refresh token rotation/reuse 방지 저장소 없음; logout은 cookie 제거이고 서버 JWT 무효화가 없다고 코드에 명시. 탈취 token·관리자 권한 회수 즉시 차단이 보장되지 않는다.
- `frontend/src/lib/authSession.js:12` fetch refresh에는 X-CSRF-Token이 없다. `middleware/csrf.js`는 cookie mode의 변경 메서드에 해당 헤더를 요구한다. 실제 cross-site cookie mode refresh 재현 브라우저 검증 필요.
- `frontend/vite.config.js:103–126` same-origin `/api/` GET에 광범위 NetworkFirst cache, 민감/인증 응답 exclusion 없음. 현재 cross-origin Render 요청에 동일 규칙이 적용된다고 단정하지 않지만 향후 proxy/same-origin 경로 위험은 남는다.
- `handlers/subscriptionWebhook.js:119–125` paymentKey/customerKey 로그 원문 경로도 남아 있다. 전체 로그에서 개인정보가 제거되었다는 주장은 불가.
- **RC-07:** session/refresh revoke·role version·reuse detection, 실cookie CSRF 갱신, public allowlist 캐시와 로그 redaction, 전체 API tenant/role matrix 필요.

### 4.8 cold start·DB·부하·장애 — Partial / 운영 Risk·Unknown

- 로컬 `index.mts:15–49` 비동기 DB 준비·worker stop·SIGTERM 정리, `utils/readinessProbe.js` 공유 probe/응답 deadline 존재. `config/prisma.js:17–18` transaction maxWait/timeout은 연결 timeout/pool cap/replica lag와 별개이다.
- `render.yaml:12` free 설정; 실제 dashboard 요금/환경과 일치 여부 미확인. 공개 health 한 표본 55초는 고객 즉시 접속 요구를 인증할 수 없는 증거.
- load-test 파일 존재와 실행 성공은 다르다. peak 부하, DB pool 고갈·replica failover, webhook backlog, CPU/memory 재시작, 외부 장애 전파 차단 실부하 검증 미수행.
- **RC-08 / P1:** startup/메뉴·주문·결제 p95/p99, 승인된 SLO, request ID/지표/alerts·담당자, 지속 worker capacity, 외부 timeout·DB outage·SIGTERM recovery 실험 필요. 테스트의 Jest forceExit는 graceful shutdown 증거 아님.

### 4.9 CI/CD·staging·migration·rollback·SHA — Risk / P1

- `.github/workflows/ci.yml:249,288,304,339,432–483`: integration/E2E는 dispatch/schedule이고 deploy needs에는 없다. seed `|| true`가 실패를 숨긴다. 신규 refunds-postgres 실DB 테스트도 필수 CI 게이트 연결 없음. 이번 로컬 실행에서 실패/skip을 통과로 바꾸지 않았다.
- **새 빈 로컬 DB**에서 `npx prisma migrate deploy` 실제 실행: 32 migrations 중 첫 `008_add_status_enums`가 orders 없음으로 P3018/42P01 실패. baseline보다 앞선 순서가 원인. schema push나 resolve로 실패를 우회하지 않았다.
- 신규 `20261008010000_durable_refunds`, `20261009010000_p0_identity_compensation` 운영 미적용. 이전 canonical SQL의 targeted 적용은 전체 migration 역사 성공 증거 아님. 기존 운영 baseline/drift 업그레이드는 별도 확인 필요.
- hook accepted/배포 status READY와 실제 새 SHA의 health·finance smoke 통과는 별개. DB 금융 schema와 코드 rollback 호환·pending drain/대사·이전 정상 버전 복구 훈련 없음.
- **RC-09:** 고정 RC SHA/전체 소스 manifest, staging 환경 분리, migration 신규/기존DB 두 경로, 필수 모든 게이트, 안전 seed, actual deployment SHA/DB revision, expand/contract·refund 호환 rollback 훈련 필요.

### 4.10 개인정보 보존·감사로그·backup/PITR — Partial / 운영 Unknown

- `services/AuditLogService.js:92–99` 감사로그 prune 함수는 있으나 전체 금융·권한·AI action audit coverage·불변 보관·운영 실행 주기 증거 없음.
- 고객/AI prompt·snapshot/외부 payload/멱등 응답/증빙/backup 전체 보존·삭제 및 동의 철회 전파의 검증 증거 없음. 이전 감사의 legacy 원장 archive 위험은 별도 문서에 남아 있으나 이번 검색한 활성 services/controllers 경로에서 archiveLogs 연결을 확인하지 못했으므로 실행 중이라고 주장하지 않음.
- DB 제공자 backup/PITR 기능이 없다는 뜻이 아니다. 플랜/retention/암호화·키·권한/RPO/RTO/복구 훈련 확인이 안 된 상태이다. 파일·비공개 증빙 및 encryption key까지 함께 복구해야 한다.
- **RC-10 / P1:** 법무 확인된 보존표·삭제/가명화 runbook·감사 무결성/권한, 제공자 PITR 확인, 격리 restore에서 건수·원장·매장 격리·키/파일 복구 및 시간을 입증해야 함. 실제 backup 데이터 접근은 승인된 절차로 수행.

## 5. 이번 실제 실행 결과

증거 위치는 모두 `reports/rc-20261009-*`. mock과 DB 결과를 합쳐 하나의 금융 인증 숫자로 보고하지 않는다.

| 실행 명령 | 구분 | 결과 | 증거 |
|---|---|---|---|
| `node scripts/run-jest.cjs --config jest.config.js tests/unit tests/routes tests/regression ...` | unit/API/회귀, 다수 mock | **155 suites / 1,303 pass / 0 fail**, 46.243초 | `backend.json`, `backend.log` |
| `npm --prefix frontend test -- --testTimeout=15000 --maxWorkers=2 --reporter=dot` | frontend unit/component | **25 files / 119 pass / 0 fail**, 74.46초 | `frontend.log` |
| `npm run test:saas` | 통제 대역·로컬 HTTP | **58 pass / 0 fail / 0 skip** | `saas.log` |
| `node --import tsx --test tests/database/refunds-postgres.test.cjs` | **실 PostgreSQL + 통제 PG provider**, 실제 HTTP/fault injection | **27 pass / 0 fail / 0 skip**, 6.828초 | `postgres.log` |
| `node --test tests/database/canonical-sync-postgres.test.cjs` | 실 PostgreSQL, test-only record | **1 pass / 0 fail / 0 skip** | `postgres-canonical.log` |
| `node scripts/test-store-manager-postgres.cjs` | 실 PostgreSQL 임시 schema, 실제 service + DB adapter | passed:true; tenant/승인/동시성/만료/평가/quota | `postgres-manager.log` |
| `node scripts/test-store-integrations-postgres.cjs` | 실 PostgreSQL 임시 schema, 실제 importer/service | passed:true; tenant/동시 dedup/rollback/환불/credential scope | `postgres-integration.log` |
| `node scripts/smoke-table-qr.cjs` | 로컬 Chromium **API fixture** | 1440/390px 통과, page error 0 | `browser-qr.log` |
| `node scripts/smoke-store-manager.cjs` | 로컬 Chromium **API fixture** | 1440/390px 승인/실행/평가/대화/QR 통과 | `browser-ai.log` |
| `node scripts/run-jest.cjs --config jest.config.integration.js ...` | 기존 integration, mocked API 게이트 | **4 failed / 11 passed suites; 10 fail / 102 pass / 1 기존 skip**, exit 1 | `integration.json`, `integration.log`, `integration-failures.json` |
| 새 고정 로컬 DB + `npx prisma migrate deploy` | 실 PostgreSQL 전체 migration history | **실패 exit 1, P3018/42P01** | `migration-fresh.log` |
| `git diff --check` | 현재 소스 whitespace 검증 | exit 0; CRLF 안내는 별도 | 이번 실행 출력 |

Jest 공통 옵션: `--modulePathIgnorePatterns='<rootDir>/reports/|<rootDir>/dist/|<rootDir>/toss-miniapp-examples/|<rootDir>/wemarket-miniapp/|<rootDir>/miniapp/' --runInBand --forceExit`. 배포 복사본과 다른 앱을 중복 수집하지 않는다. 테스트 개별 실패를 제외하는 옵션은 사용하지 않았다. 기존 test.skip 1개는 코드 변경 없이 **미검증/미통과**로 기록한다.

로컬 PostgreSQL 16 컨테이너 `wemarket-p0-audit-20261008`, 127.0.0.1:55438의 전용 fixture DB만 사용했다. 빈 migration 시험 DB는 `wemarket_rc_migration_20261009`; migration 실패 상태를 증거로 보존했다. 운영 연결 문자열을 시험 대상으로 선택하지 않았다. 실제 PG 테스트는 통제 provider이며 **Toss sandbox가 아니다**.

### integration 게이트 실패 상세

- FoodTruck offline-sync 2개: HTTP 200 기대, 400 수신.
- Orders 6개: 매장 주문 목록/통계/생성/상태 변경/취소/삭제 실패.
- 메뉴 번역 1개: HTTP 200 기대, 500 수신.
- Payments 조회 1개: 500 반환 금지 assertion 실패.
- Orders 상세 조회 1개는 기존 skipped이다.

mock/fixture와 계약 불일치 가능성은 있으나 원인을 확정하여 고친 결과가 없으므로 실패를 정상 기능 증거로 해석하지 않는다. 실패 stack/이름은 `integration-failures.json`에 보존했다.

### 실행하지 않은 검증

실제 Toss sandbox, real PG billing, 외부 provider 운영 인증·전량/증분 수집·대사, 실backend 기반 가입→결제→환불→구독 전체 브라우저 E2E, Safari/실모바일 카메라 QR, peak load, staging 적용, 운영 P0 migration·PG 대사, 운영 권한/세션 회수, PITR/파일/키 restore, 배포 rollback. 미실행은 통과로 계산하지 않는다.

이전 P0 보고서의 typecheck/build/routes/JSX/startup 통과는 **이전 실행 증거**이며 이번 재실행으로 표기하지 않는다. 브라우저는 기존 로컬 dist를 사용하므로 이 역시 현재 전체 source 재빌드 또는 운영 artifact SHA 증거가 아니다. 프론트 motion 대역의 DOM prop 경고, manager DB script의 pg query 동시 호출 deprecation, Jest forceExit 경고는 로그에 남아 있다.

## 6. 출시 차단 해소 순서와 완료 조건

| 순서 | 담당 역할 | 조치 | 닫힘 증거 |
|---|---|---|---|
| 1 | 기술 책임자 / QA | 검증 worktree를 보존해 고정 RC SHA·manifest 생성; integration 10실패/1skip 원인 해결 및 신규/기존 DB migration 경로 교정 | immutable SHA, 실패/skip 0 필수 게이트, 신규 DB bootstrap·기존 복제DB 업그레이드 결과 |
| 2 | 보안 / 결제 책임자 | RC-01/02 로컬 보완 유지; RC-03/04 웹훅 inbox·billing owner fencing·자동 취소 복구와 RC-07 세션/CSRF/캐시/로그 수정 | 재현 red→green, 실제 DB 다중 process/fault/권한 및 sandbox 결과 |
| 3 | QA / SRE | 분리 staging에 동일 SHA·schema 반영, sandbox 주문/구독 전체 E2E 및 성능/장애 실험 | transaction IDs 비식별 대사, 브라우저 trace, PG/원장/잔액/재고/혜택 일치, SLO |
| 4 | 데이터 / AI 책임자 | 실제 업체 1개 reference 연동·mapping·unmapped/recovery·매출 대사; AI 근거/불충분/fallback 승인 검사 | 최근 실제 수집 성공·provider health·기간별 취소 포함 차액 0 또는 설명된 차액, 실행 audit |
| 5 | SRE / 개인정보 책임자 | 운영 DB drift·권한·worker·키/증빙·alerts·보존 설정, PITR restore·금융 호환 rollback 훈련 | RPO/RTO 승인 및 실측, 원장/tenant/키/파일 복구 결과·담당 연락체계 |
| 6 | 사업 / 운영 승인자 | C의 기능/고객/금액 제한·지원/중단 조건 승인 후 제한 운영 검증; D 확대는 별도 판단 | 승인된 범위와 운영 대사/SLO/복구 기록. 코드 완료와 운영 완료를 계속 분리 |

운영 schema·배포·키·실결제·환불은 별도 승인 대상이다. **이 보고서는 그 실행을 승인하거나 자동 진행하지 않는다.** 새 환불 schema 없이 코드만 배포하면 실패할 수 있다. 환불 pending/unknown을 삭제하거나 구형 stateless 환불로 단순 rollback하지 말고 기능 차단/호환 코드·대사·복구 절차를 먼저 시험한다.

## 7. 종료 상태

현재 **로컬 코드 일부 준비 / 위 로컬 시험 일부 통과 / 전체 게이트 실패 / staging 미검증 / 운영 RC 동일성·금융 검증 미완료**이다. 보고서와 증거 파일을 작성했고 배포를 실행하지 않았다. 최종 판정은 **A. Release Blocked**로 유지한다.
