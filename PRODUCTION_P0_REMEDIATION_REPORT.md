# WeMarket P0 수정 및 검증 보고서

작성일: 2026-10-09 KST. 대상: `D:\wemarket-toss\250105`의 실제 작업 트리.

감사 기준과 현재 로컬 HEAD: `7d0c93fd69454bf46755038bb1e8a1180ffdb476`.
기준 문서: `PRODUCTION_READINESS_AUDIT.md`, `PRODUCTION_REMEDIATION_P0_P1.md`.

## 1. 판정과 범위

**P0-01/P0-02의 아래 재현 결함을 로컬 코드에서 수정했고, 실 PostgreSQL 27개 시나리오가 통과했다. 서비스 전체의 Production Ready 또는 운영 P0 0건을 선언하지 않는다.** 기존 integration 게이트의 10개 실패, 실제 PG 검증, 운영 마이그레이션·대사·복구 훈련이 남아 있다. P1 전체 수정으로 진행하지 않았다.

| 구분 | 코드 상태 | 테스트 상태 | staging | 운영 |
|---|---|---|---|---|
| P0-01 익명 AI 개인정보 접근 | 공개/개인화 분리, 인증·매장별 검증/동의, 조회·캐시 경계 구현 | unit/API/실DB 검증 통과 | 미수행 | 이번 수정 미반영 |
| 고객 이력 capability의 우회 경로 | v1 거부, v2 매장·보유 주문 범위 구현 | 발급·검증·실제 HTTP/DB·클라이언트 검증 통과 | 미수행 | 이번 수정 미반영 |
| P0-02 정상 등록 결제의 환불 | 양수 원장, 영속 intent/PG 결과, lease/CAS, 재고 보상 고유키 구현 | 실DB·fault injection·독립 프로세스 복구 통과 | 미수행 | 신규 금융 스키마 적용·대사 미수행 |
| 전체 출시 게이트 | 아래 통과/실패를 분리 기록 | 기존 integration 10 fail/1 skip | 미수행 | 출시 승인 근거 불충분 |

실제 Toss 운영 결제·환불, 운영 DB 변경, 운영 키 변경, 커밋·푸시·추가 배포는 이번 작업에서 실행하지 않았다. PG는 **통제된 provider 모형**이며 Toss sandbox가 아니다. 실제 PostgreSQL 트랜잭션·제약·일반 역할의 접근 차단과 실제 Express HTTP 경로를 사용했다.

## 2. 시작 상태와 변경 보존

- `git status`, `git diff`, `git log`를 다시 확인했다. 로컬 HEAD와 작업 트리가 달랐고, 기존 변경을 reset/checkout하거나 일괄 덮어쓰지 않았다.
- 이미 존재했던 수정: store-scoped AI 조회, optional customer identity, durable refund intent, mixed-sign refund 집계, split 환불, 부분 환불 전용 멱등성. 이것을 이번에 처음 구현했다고 주장하지 않는다.
- 미해결 확인: 개인정보 동의·전화번호 소유 확인 부재, 선호도 학습의 전 매장 조회, 건수 기반 AI 캐시 충돌, 광범위 history token, 재고 보상 DB 고유키 부재, PG 결과 저장/복구 경계, 사전 잔액 불일치 차단 부재.
- 실제 실행은 `package.json`의 `node --import tsx index.mts` → `app.mts` → lazy-loaded `routes/ai.js`, `routes/orders.js`, `routes/payments.js`, `routes/waiting.js`이다. JS/TS capability 구현을 모두 일치시켰다.
- Git 증거: `reports/p0-20261009-git-status.txt`, `reports/p0-20261009-git-log.txt`, `reports/p0-20261009-git-diff-stat.txt`. 이 파일은 작업 트리의 다른 개발 변경도 포함한 전체 상태이다.
- 새 P0 수정 커밋 SHA는 **없음**: 미커밋 작업 트리이다. 생성된 Prisma client는 로컬 생성물이며 운영 코드 반영의 증거가 아니다.

## 3. P0-01 원인, 수정 전후, 파일

근본 원인은 고객이 주장한 식별자, 로그인된 계정의 미검증 전화번호, 개인화 동의, 매장 권한을 구분하지 않은 것이다. 추가로 캐시가 주문/메뉴 내용 대신 길이를 사용했고, 공개 주문 생성이 전화번호를 광범위 이력 권한으로 바꾸었다.

| 실제 수정 파일·위치 | 수정 전 → 수정 후 |
|---|---|
| `routes/ai.js:81`, `:367` | 로그인 여부에 따라 공개 API도 개인화 → 공개 recommend/tinkerbell은 항상 개인 이력 없음. 인증된 별도 `/personalized-recommend`, `/personalized-tinkerbell-rec` 추가 |
| `middleware/customerIdentity.js:12` | DB 전화번호만 존재하면 개인화 → JWT 사용자 ID + 유효 store ID + 매장별 서버 검증 전화번호 + 동의 + 철회 없음이 모두 필요. 동의는 primary transaction으로 조회; 오류는 공개 fallback |
| `controllers/aiController.js:40`, `:342` | identity의 매장과 요청 매장 일치 여부 불명확 → 일치할 때만 개인 이력/세그먼트 사용. 개인 컨텍스트 오류 원문 로그 제거 |
| `controllers/waitingController.js:117` | 동일 개인화 경계의 매장 확인 부족 → identity의 storeId 일치 필요 |
| `repositories/Order.js:253` | history의 전역 ID 탐색/존재하지 않는 메서드 사용 → SQL WHERE에 store_id AND 보유 order IDs 강제, 반환 결제 필드에서 PG 키 제외 |
| `repositories/Order.js:262`, `:274` | 구형 전역 조회가 남음 → store 없는 구형 호출/외부 ID 단독 조회 fail closed. 개인 조회 실패 원문 예외가 로그로 전파되지 않음 |
| `services/CustomerPreferenceService.js:35` | 학습에서 `findByCustomer(phone)` → `findByCustomerInStore(storeId,phone)`. 개인 프로필 실패는 빈 프로필로 처리; 원문 오류 로그 제거 |
| `services/RecommendationContextService.js` | 개인 쿼리 오류 message 로그 → store ID와 고정 메시지만 기록 |
| `services/aiService.js:251`, `:369` | 같은 길이의 타 고객/타 메뉴가 캐시 공유 → context와 메뉴 내용 전체의 SHA-256 키; 디저트도 내용 기반. 키에 원문 개인 정보 없음 |
| `utils/orderCapability.js:30`, `utils/orderCapability.ts:35` | phone/toss key를 담은 v1 이력 JWT → version 2, storeId, 양의 정수 orderIds(최대 30), HS256 검증. 원문 전화번호/외부 식별자 없음 |
| `controllers/orderController.js:67`, `:84` | 주문 입력 식별자로 과거 전체 권한 발급 → 방금 생성한 주문 + 검증한 기존 같은 매장 proof의 주문만 이어감. req.body order_ids는 무시 |
| `frontend/src/api/orders.js`, `frontend/src/components/customer/OrderHistory.jsx` | 광범위 토큰 저장/원문 에러 로그 → 기존 보유 토큰을 생성 요청에 전달, 새 proof 저장, 403 때 해당 오래된 토큰 제거·화면 비움, 원문 로그 제거 |
| `config/corsHeaders.js` | history proof 헤더 preflight 누락 → `X-Customer-History-Capability` 허용 |
| `prisma/schema.prisma:220`, 신규 migration | 개인화 증명 저장 구조 없음 → 서버 전용 `customer_ai_consents`, 매장/사용자 PK, 암호화 전화번호·소유 확인·동의·철회 시각 |

### 계약과 기능 영향

변경 전 영향도를 사용자에게 보고한 뒤 적용했다. JSON 추천 응답과 기존 공개 URL, QR/메뉴/주문/결제/단일 주문 capability는 유지된다. **공개 추천의 로그인 기반 자동 개인화와 v1 토큰의 과거 전체 이력 권한은 보안상 종료된다.** 현재 매장의 보유 주문 proof를 최대 30개 이어갈 수 있지만, 다른 매장으로 전환하면 해당 매장의 새 proof가 저장된다. 장치/브라우저 간 전체 이력 동기화는 이번 범위가 아니다.

새 개인화 경로의 인증 실패는 401이다. 인증은 유효하나 동의/소유 증명/매장 범위가 불충분하거나 증명 조회에 실패하면 기존 공개 메뉴 추천으로 처리한다. DB 계정 phone, marketing consent, 요청 body의 consent=true를 개인화 동의로 간주하지 않는다.

**운영 개인화는 자동 활성화하지 않는다.** 소유 확인을 완료한 서버 경로에서 암호화 `verified_phone`과 store/user에 묶인 명시적 동의 기록을 만들고 철회해야 한다. 이 안전한 동의 등록/철회 사용자 흐름은 아직 연결하지 않았다. 기존 고객을 추정으로 backfill하지 않았으며, 증명 없이는 안전하게 비개인화된다. 전화번호 변경 시 기존 증명과 불일치하므로 개인화되지 않는다.

## 4. P0-02 원인, 금액 계약, 복구 구조

감사 당시 전체 환불은 원액, 부분 환불은 음수 원장을 사용했다. 부분→전체 흐름은 이미 환불한 금액을 차감하지 않았고, 비영속 후속 재고 복구는 장애 후 빠질 수 있었다. 이번 시작 시 기본 intent/transaction 수정은 있었지만, PG 잔액 대사와 결과 증거 저장 및 재고 보상 DB 고유키가 부족했다.

### 단일 계약

- `payments.amount`는 원 결제액을 유지한다. 로컬 잔액 = 원액 − payment에 연결된 확정 REFUND 각 행의 절댓값 합계.
- **신규 REFUND amount는 양의 정수**이다. `LedgerService.recordRefund`가 음수/0/소수 입력을 거부한다.
- 원장 순매출 = INCOME 합계 − REFUND 금액 합계. 과거 음수 환불은 읽을 때만 각 행의 절댓값으로 해석한다. 기존 데이터를 변경하지 않는다.
- 전체 취소의 PG 요청 금액은 원액이 아니라 남은 잔액이다. 예: 10,000 → 2,000 부분 → 3,000 부분 → 5,000 잔액 취소.
- payment별 미확정 intent 1개, payment 행 잠금, 환불별 operation_key, 원장 event_key, lease owner CAS가 중복/동시 실행을 제한한다.

### 실제 수정 및 유지한 기반

| 파일 | 실제 동작/수정 |
|---|---|
| `services/RefundService.js:47`, `:60`, `:80` | PG 호출 전 intent와 필요 재고 보상 pending을 영속화. PG 조회의 key/원액/잔액 검증. 외부 환불과 로컬 불일치 시 409 대사 요구. 잔액 감소만으로 자기 작업이라고 추정하지 않고 같은 provider key로 replay; 검증된 최소 PG 결과를 별도 영속 저장 |
| `services/RefundService.js:118` | order별 재고 보상 기록, 실제 음수 ORDER 차감만 복구. store/product 검증. 재고 증가와 stock_history 고유키/완료 상태가 같은 transaction. stock 복구 실패 시 금융 finalize도 rollback되어 intent를 다시 재개할 수 있음 |
| `services/RefundService.js:140` | store 필수 bounded `resumePendingRefunds` 추가. unknown 또는 만료 lease를 같은 키로 재개. 항목별 실패 격리. 자동 운영 worker/외부 action은 활성화하지 않음 |
| `services/LedgerService.js:54` | 신규 환불의 양의 정수 계약 강제 |
| `prisma/schema.prisma`, 신규 migration | `refund_operations.provider_result`, `inventory_compensations`, `stock_history.compensation_key` UNIQUE 추가. 서버 전용 테이블 RLS 및 PUBLIC/anon/authenticated 권한 제거 |
| `scripts/reconcile-refunds-readonly.cjs` | explicit DB URL만 허용, READ ONLY transaction으로 원장·잔액·부호·매장 불일치 보고. PG key/고객 phone/DB URL을 출력하지 않음. 복구 SQL 실행 없음 |

기존 `services/PaymentService.js`, `controllers/paymentController.js`, `middleware/idempotency.js`, `routes/payments.js`, `repositories/Ledger.js`, `repositories/Settlement.js`, `services/StoreManagerService.js`의 환불 orchestration/store 권한/부분 환불 멱등성/SUM ABS 수정은 보존했다. 오프라인 split 환불도 같은 재고 보상 구조를 사용하고, 마지막 DONE 결제 취소 전에는 주문을 refunded로 바꾸지 않는다.

PG 결과가 저장되면 프로세스 종료 뒤 해당 증거와 PG 잔액을 확인하고 DB finalize를 재개한다. 결과 저장 전 통신/DB 실패는 unknown으로 남고 같은 provider key로 재확인한다. **결과 증거가 없는 24시간 초과 unknown은 자동 PG 재호출을 중단**한다. 이는 보수적 운영 정책이며 Toss의 실제 idempotency 보존 기간을 검증했다는 뜻이 아니다. 수동 PG 대사 후 승인된 복구가 필요하다.

## 5. 재현 → 수정 → 검증 증거

### 먼저 실패를 확인한 회귀

| 증거 파일 | 수정 전 실행 결과 |
|---|---|
| `reports/p0-20261009-ai-red.json` | 3 suites: 6 fail/3 pass. 동의 미확인, 캐시 충돌, 전역 선호도 학습 재현 |
| `reports/p0-20261009-refunds-red.log` | 실DB 19개: 3 fail/16 pass. PG 잔액 불일치의 추가 취소, 재고 보상 구조/재개 부재 재현 |
| `reports/p0-20261009-ledger-red.json` | 3 fail/2 pass. 음수/0/소수 환불 원장 허용 재현 |
| `reports/p0-20261009-history-red.json` | 3 fail. phone-only 발급, 광범위 v1 허용, scope 없는 JWT 재현 |
| `reports/p0-20261009-cors-red.json` | 1 fail/3 pass. 브라우저 history 헤더 preflight 누락 재현 |
| `reports/p0-20261009-private-failure-red.json` | 2 fail/1 pass. 개인 조회 DB 오류의 원문 식별자 예외 전파 재현 |

### 최종 실행 명령과 결과

Jest 명령의 공통 옵션은 `--modulePathIgnorePatterns='<rootDir>/reports/|<rootDir>/dist/|<rootDir>/toss-miniapp-examples/|<rootDir>/wemarket-miniapp/|<rootDir>/miniapp/' --runInBand --forceExit`이다. reports의 이전 배포 복사본을 테스트 대상으로 읽지 않는다. JSON/log 증거를 각각 보관했다.

| 명령 | 최종 결과 | 증거 |
|---|---|---|
| `node scripts/run-jest.cjs --config jest.config.js tests/unit tests/routes tests/regression ...` | **155 suites / 1,303 pass / 0 fail** | `reports/p0-20261009-backend-release-gate.json`, `.log` |
| `node --import tsx --test tests/database/refunds-postgres.test.cjs` | **27 pass / 0 fail** | `reports/p0-20261009-db-release-gate.log` |
| `npm run test:saas` | **58 pass / 0 fail** | `reports/p0-20261009-saas-final.log` |
| `npm --prefix frontend test -- --testTimeout=15000 --maxWorkers=2 --reporter=dot` | **25 files / 119 pass / 0 fail** | `reports/p0-20261009-frontend-final.log` |
| `node scripts/run-jest.cjs --config jest.config.integration.js ...` | **102 pass / 10 fail / 1 skip** | `reports/p0-20261009-legacy-integration-final.json`, `.log` |
| `npm run typecheck:backend` | exit 0 | 실행 결과; 이후 JS 예외 처리 변경은 타입 선언 변경 없음 |
| `npm run validate:routes` | 88 routes 정상 | 실행 결과 |
| `npm run validate:api` | 6 critical groups 정상 | 실행 결과 |
| `npm run validate:jsx` | 293 files 정상 | 실행 결과 |
| `npx prisma validate`, `npx prisma generate` | 성공 | 최종 schema/client로 실DB 재실행 |
| `npm --prefix frontend run build` | 성공; PWA 생성 | `reports/p0-20261009-build.log` |
| `npm run smoke:startup` | 실제 app 시작·DB readiness binding·구독 보호·capability CORS 통과 | `reports/p0-20261009-startup.log` |
| `git diff --check` | exit 0 | 실행 결과 |

### 추가/확장 테스트 파일

- `tests/unit/controllers/aiPersonalization.security.test.js`: 공개 recommend/tinkerbell/waiting의 private 조회 0회, 검증 identity의 매장 범위.
- `tests/unit/middleware/customerIdentity.test.js`: claimed phone, invalid JWT, DB identity, store별 grant, 동의 없음·철회·다른 검증 phone·DB 장애.
- `tests/unit/services/aiCache.privacy.test.js`: 같은 길이의 서로 다른 고객/메뉴가 모델 호출과 캐시를 공유하지 않음; 두 번째 모델 입력에 첫 번째 이력 없음.
- `tests/unit/services/preferenceTenant.security.test.js`, `tests/unit/repositories/Order.customerPrivacy.test.js`: 학습 store 범위와 개인 조회 실패의 식별자 예외 전파 차단.
- `tests/unit/utils/customerHistory.scope.test.js`, `tests/unit/controllers/historyCapability.security.test.js`, `tests/routes/customerCapabilitySecurity.test.js`: v2 scope, legacy 거부, claimed order IDs 무시, 다른 매장 proof 연결 금지, CORS.
- `tests/unit/services/LedgerService.test.js`: 신규 환불 양의 정수 강제.
- `frontend/src/test/order-history-capability.test.js`: 보유 proof 연결, 새 proof 저장, 오래된 proof 403 정리, 더 최신 proof 보존.
- `tests/saas/core.test.cjs`: 신규 재고 보상 delegate를 fixture에 추가; 기존 오프라인 정확히 한 번 금융 assertion 유지.
- `tests/database/refunds-postgres.test.cjs`: 이전 15개에 사전 대사, 다단계 환불, 재고 실패, lease 복구, 실제 AI/이력 HTTP, RLS/일반 역할, 별도 Node 프로세스 복구, stale owner fencing, PG journal 저장 실패, 오래된 unknown 안전 중단 추가.
- `scripts/test-refund-recovery-child.cjs`: 새 Node 프로세스에서 영속 PG 증거를 읽고 복구. 추가 PG cancel 호출은 테스트를 실패시킴.

### 실DB에서 확인한 불변식과 한계

매장·고객·주문 scope, 누적 환불 상한, provider key replay, 원장 event/재고 compensation UNIQUE, transaction rollback, lease owner CAS, ordinary role 권한 거부를 실제 PostgreSQL로 확인했다. 10,000원의 INCOME과 2,000/3,000/5,000 REFUND을 저장하고 PG 잔액과 원장 순매출이 모두 0인지 확인했다. PG 모형 성공 후 DB journal 저장 또는 finalize 실패, 재고 실패 후 독립 프로세스 복구에서도 금전/재고 효과가 한 번만 반영되었다.

독립 프로세스 테스트는 새로운 Node 프로세스의 영속 상태 복구를 증명한다. OS 강제 종료, 네트워크 분할, 실제 PG idempotency TTL, 운영 다중 인스턴스/부하 검증까지 대체하지 않는다.

## 6. 실패·미검증 항목

기존 integration의 같은 10개 실패가 수정 전/후에 남았다. FoodTruck 2개(200 기대/400), Orders 6개(목록·통계·생성·상태·취소·삭제: 500), Phase4 번역 1개(500), Payments 조회 1개(500)이다. 기존 mock/fixture와 실행 계약 불일치 정황이 있으나, 이를 근거로 기능이 정상이라고 단정하지 않고 열린 게이트로 남긴다. 목록과 stack은 JSON/log에 있다.

초기 프론트 테스트는 Windows sandbox 임시 cache rename의 EPERM으로 24개 파일이 테스트 실행 전 실패했다. 정상 권한 재실행 및 최종 25개 파일 119개 테스트는 통과했다. 초기 개별 route 검증의 EACCES도 최종 정상 권한 backend 전체 실행으로 검증했다.

환불 preflight 추가 후 이전 테스트 fixture 하나의 PG get stub 누락으로 `test_sk_123` 키의 조회가 인증 오류를 반환했다. 결제·환불 효과는 없었다. stub을 보완했고, 실DB 테스트에서 Axios 외부 HTTP를 차단하고 JWT/order/phone/PG/AI/Redis 설정을 fixture 값으로 고정했다. 이후 최종 검증은 외부 PG 호출 없이 통과했다.

미수행: 실제 Toss sandbox, 전체 Playwright 가입→QR→결제→AI→구독 여정, staging 검증, 운영 PG/원장 대사, 운영 RBAC/다중 replica/부하, 운영 backup restore/rollback 훈련. 프론트 테스트의 motion prop 경고와 build 큰 청크 경고는 통과와 별도로 남는다. Jest의 `--forceExit` 통과는 모든 백엔드 background handle의 graceful shutdown 증거가 아니다.

## 7. DB migration, 읽기 전용 대사, 복구 계획

필요 migration:

1. 기존 미적용 `20261008010000_durable_refunds`: refund_operations, 금융 intent 제약/RLS.
2. 신규 `20261009010000_p0_identity_compensation`: customer_ai_consents, PG result journal, inventory_compensations, stock_history compensation UNIQUE/RLS.

두 번째 SQL은 기존 원장/재고 값을 수정하지 않는다. 기존 stock_history의 새 nullable 키는 NULL로 남으며, 과거 CANCEL 이력은 신규 복구 시 다시 증가하지 않는다. 로컬 전용 DB에 SQL을 transaction으로 적용하고 runtime/test로 확인했다. 이것은 `prisma migrate deploy`의 전체 역사 검증과 다르다.

로컬 컨테이너: `wemarket-p0-audit-20261008`, PostgreSQL 16, `127.0.0.1:55438/wemarket_p0_schema_test`. fixture DB URL은 위 실DB test에만 허용하며 다른 주소/DB는 시작 전에 거부한다. 재실행:

```powershell
docker start wemarket-p0-audit-20261008
$env:P0_TEST_DATABASE_URL='postgresql://audit:audit-local-only@127.0.0.1:55438/wemarket_p0_schema_test'
node --import tsx --test tests/database/refunds-postgres.test.cjs
```

**운영 대사와 보정은 미실행**이다. `scripts/reconcile-refunds-readonly.cjs`는 `P0_RECONCILE_DATABASE_URL` 명시 후에만 SELECT를 실행한다. 로컬 실행 산출물 `reports/p0-refund-reconciliation-dry-run.json`은 fixture 346개 결제 중 326개를 표시했다. 의도적으로 INCOME 없는/불일치 fixture가 많아 이 숫자는 운영 문제 수가 아니다. PG 검증은 `pg_verified:false`이다.

운영 보정이 필요하면 다음 별도 승인 자료를 만든 뒤 시행해야 한다:

1. 읽기 전용 로컬/원장 대사 + PG 거래/취소 증거의 payment/event 연결; 음수 환불 행을 추측으로 일괄 뒤집지 않음.
2. 대상 row ID, 이전 값, 기대 값, PG 근거, 영향 합계, 중복 확인을 담은 dry-run 보고서.
3. 승인 가능한 보정 migration의 대상 조건/CAS, transaction, 별도 정정 event key, 전후 대사 assertion.
4. snapshot/PITR 복구 가능성 확인; inverse 보정/복구 절차 및 검증. 정정/복구 중 새로운 금융 호출 금지.

현재 읽기 전용 대사만 준비했다. 근거 없는 운영 보정 migration은 작성하거나 적용하지 않았다.

## 8. 배포 전 조건, rollback, 남은 P0/P1

운영 출시 차단 조건은 아직 닫히지 않았다:

- P0-01: 신규 인증·동의 경계의 운영 배포와 검증 미수행. 안전한 소유 확인/동의 producer 연결 전까지 개인화는 비활성 fallback으로 유지해야 한다.
- P0-02: 신규 금융 migration 운영 미적용, 과거/미확정 환불의 PG 대사 미수행, 실제 PG sandbox 및 운영 장애 복구 확인 미수행.
- 전체 테스트 게이트: 기존 integration 10 fail/1 skip; 전체 E2E와 restore/rollback 훈련 미수행.

따라서 **로컬에서 다룬 P0 재현 시나리오가 통과한 것과 운영 P0 0건은 다르다.** 운영 반영은 별도 승인을 받아야 한다.

배포 순서는 승인된 backup/preflight → 전체 migration 역사/드리프트 확인 → additive schema 적용 → 이번 코드와 클라이언트 함께 반영 → staging 실제 PG 검증 → 별도 승인 운영 검증이다. 신규 DB 보상 테이블 없이 새 refund 코드를 먼저 배포하면 실패한다. 기존 환경의 `008_add_status_enums`가 baseline보다 먼저 실행되는 빈 DB bootstrap 실패는 이전 기록에서 발견된 열린 P1이며, 이번 전체 migration 역사로 재검증하지 않았다.

복구 중에는 새 금융 작업을 중지/격리하고 pending/unknown intent를 보존·대사한다. 스키마는 additive로 유지하고 데이터/intent 테이블을 drop하지 않는다. 이전의 stateless 환불 구현으로 단순 rollback하면 중복 환불·재고 누락이 재발할 수 있으므로, 정상 결제/주문을 유지하면서 refund endpoint를 일시 차단하는 호환 버전과 pending 복구 경로를 검증해야 한다. 실제 운영 rollback 훈련은 미수행이다.

남은 주요 P1은 기준 감사의 구독 webhook/청구 fencing·entitlement, PG 승인 실패/자동 취소의 영속 복구(`PaymentService` 직접 PG 자동 취소 경로 포함), 세션 폐기/관리자 회수, CSRF, 주문 상태 전이, worker/DLQ, 개인정보 보존·삭제, 실외부 provider 검증, CI/복구 게이트이다. AI 캐시 충돌의 P0 관련 부분만 이번에 처리했으며 P1 전체 완료로 확대하지 않는다.

**종료 상태:** 코드 및 위 증거를 로컬 작업 트리에 남겼다. 신규 운영 작업과 P1 일괄 수정은 시작하지 않고 P0 보고 단계에서 멈춘다.
