# Production P0/P1 수정·검증 기록

2026-10-09 후속 작업과 최종 실DB/회귀 증거는 [PRODUCTION_P0_REMEDIATION_REPORT.md](PRODUCTION_P0_REMEDIATION_REPORT.md)에 기록했다. 아래는 2026-10-08 시점 기록이다. 당시 대기 중이던 history capability 계약은 후속 작업에서 영향도를 보고한 뒤 v2 매장·보유 주문 범위로 변경했다. 운영 검증과 P1 전체 수정은 완료로 변경하지 않는다.

작성: 2026-10-08 KST. 기준 감사: `PRODUCTION_READINESS_AUDIT.md`. 작업 트리는 기존 미커밋 안정성 변경을 포함한다. 이 기록은 이번 수정과 실제 실행 결과를 구분한다. 커밋·푸시·운영 배포·운영 DB 변경은 수행하지 않았다.

## 현재 게이트 판정

**P0 0건을 증명하지 못했으므로 P1 일괄 수정으로 진행하지 않았다.**

| 항목 | 이번 수정 | 현재 판정 |
|---|---|---|
| P0-01 공개 AI 고객 이력 | request phone/key 무신뢰, 인증 DB identity, store 필수 조회, waiting 경로까지 수정 | 직접 AI 노출 재현은 차단/테스트 통과. 주문에서 발급되는 기존 고객 이력 capability의 무인증 발급·전역 범위 계약은 변경 결정 대기. 전체 항목은 열린 상태 |
| P0-02 환불 원장/재고/복구 | durable refund intent, lease/fencing, PG 결과 검증, 양수 원장, 실제 잔액, 원자적 재고 보상, split refund, 실제 HTTP 복구·이전 키 호환 | 로컬 PostgreSQL/HTTP 15 시나리오 통과. 운영 migration/과거 금융 데이터 대사/실제 PG sandbox 검증 미수행이므로 운영 완료로 표시하지 않음 |
| 전체 테스트 게이트 | backend/frontend/SaaS/실제 PG 모형+DB/기존 통합/build/startup 실행 | unit·API·회귀·프론트·SaaS 통과, 기존 integration 10실패/1skip. 전체 테스트 통과 선언 불가 |
| P1-01~17 | P0-02의 복구를 위해 필요한 환불 전용 멱등 경로만 함께 정리 | 나머지는 P0 gate 이후 진행. 구독 웹훅/청구 상태/세션 회수/SW 등 이번 작업에서 완료했다고 주장하지 않음 |
| 추가 P1 | 빈 DB migration history 실패 발견 | `008_add_status_enums`가 baseline보다 앞서 실행되어 orders 없음 오류. 신규 환경/복구 blocker로 기록 |

## 1. P0-01: 확인 → 재현 → 수정 → 회귀/실패 → 남은 계약

### 코드 확인과 재현

공개 추천과 tinkerbell은 request phone/toss_user_key로 전 매장 `Order.findByCustomer`를 호출했다. customer segment 역시 응답에 포함될 수 있었다. 별도 waiting 추천은 query phone으로 private preferences를 읽었다.

`tests/unit/controllers/aiPersonalization.security.test.js`를 먼저 작성해 기존 AI 2개 경로가 각각 타인 식별자로 history를 읽는 실패를 확인했다. waiting 경로도 별도 테스트를 먼저 실패시켰다. 첫 재현 실행의 결과는 3 fail / 48 pass(PaymentService 환불 재현 포함)였다. 테스트 mock 설정 오류는 본 재현과 구분해 바로잡은 뒤 실제 동작 assertion 실패를 확인했다.

### 최소 안전 수정 파일

- `middleware/customerIdentity.js`: JWT 검증을 거친 사용자 ID로 DB 계정 전화번호를 조회한다. 요청 body/query, JWT에 임의로 넣은 phone, 주문 생성에서 얻은 history token을 identity proof로 사용하지 않는다. identity 조회 실패는 공개 추천으로 degrade한다.
- `controllers/aiController.js`: recommendMenus/tinkerbell 개인 이력은 req.customerIdentity로만 읽는다. 입력 phone/external ID는 개인화 권한에 영향을 주지 않는다.
- `controllers/waitingController.js`, `routes/waiting.js`: 같은 identity 경계를 waiting 개인화에 적용했다.
- `routes/ai.js`: 공개 추천은 유지하고 optional identity middleware를 연결했다. tinkerbell store_id 검증을 기존 추천과 일치시켰다.
- `repositories/Order.js`: `findByCustomerInStore(storeId,phone)` 추가. 유효한 store ID가 없으면 조회하지 않고, SQL WHERE에 store_id와 phone을 함께 넣는다. 기존 전역 repository 메서드를 다른 사용자 기능 때문에 임의 삭제하지 않았다.

### 실행된 검증

- 공개 추천/tinkerbell/waiting의 claimed identifier는 history/context 조회0회.
- 인증된 identity는 요청 store 내부에서만 조회하고, 입력 victim identifier를 사용하지 않음.
- middleware의 무토큰/변조토큰은 private lookup0회, DB failure는 anonymous 결과로 degrade.
- 실제 PostgreSQL에서 두 매장의 같은 전화번호 주문을 구성하고 요청 store의 주문만 반환됨을 검증.
- controller 회귀 14개, identity/ledger unit 5개가 개별 통과했고 최종 backend 전체 실행에도 포함됐다.

### 계약 영향 분석 / 승인 대기

`controllers/orderController.js:67` 및 dataloader variant는 공개 주문 body의 phone/key로 30일 `customer_history_capability`를 발급한다. 서명은 위변조를 막을 뿐 전화번호 소유를 증명하지 않는다. 현재 history controller는 전역 고객 ID 조회를 의도하지만 **`Order.findIdsByCustomer`가 repository에 존재하지 않아 실행 오류 가능성도 확인했다.** 따라서 원시 이력이 지금 정상 반환됐다고 주장하지 않는다. 이 누락 메서드만 추가하면 무인증 전역 조회 문제가 실현될 수 있어 함께 설계를 바꿔야 한다.

제안한 변경:

1. 익명 주문/결제와 해당 주문 capability는 유지.
2. 새 history token은 매장·발급 주문 ID·version에 묶음. phone 문자열만으로 과거 전체 이력 권한을 발급하지 않음.
3. 이전 광범위 토큰은 private history 인증으로 사용하지 않음. 과거 전체 이력은 검증된 고객 인증 후 별도 scope로 제공.
4. 클라이언트는 403/토큰 version 변경 시 과거 토큰을 폐기하고 현재 주문 접근 기능을 유지.

영향: 기존 토큰으로 과거 전체 이력을 볼 수 없게 됨. 이는 보안상 필요한 breaking change이므로 사용자 지시 “breaking change가 필요한 경우 임의로 적용하지 말고 영향도를 먼저 분석”에 따라 영향도를 알리고 적용 결정을 요청했다. **답변이 아직 없으므로 이 계약 변경은 실행하지 않았다.**

## 2. P0-02: 확인 → 재현 → 수정 → DB/HTTP/실패 검증

### 확인·재현 결과

- 전체 환불이 원액50000을 기록해, 선행 부분 환불10000 뒤 잔액40000 기대 assertion이 실패했다.
- 실제 PostgreSQL에서 현장 split의 첫 환불만으로 order.payment_status가 refunded가 되는 실패를 재현했다.
- mixed-sign -1000/+2000 환불의 AI net revenue가7000 대신9000이 되는 실패를 재현했다.
- Ledger summary가 -2000/+8000을 합쳐6000으로 집계하는 실패를 재현했다.
- Settlement가 분리된 config 대신 stores의 없는 commission_rate를 select하는 Prisma 오류를 재현했다.
- generic idempotency가 durable 환불의 재시도를 막는 unit 실패를 재현했다.
- 실제 HTTP에서 canceled 재요청 거부/문자열 order ID 사용 문제를 확인했다.
- 업그레이드 이전 partial key와 원장, 또는 PG만 성공한 이전 환불을 새 key로 처리하면 재환불할 수 있음을 재현했다.
- payment/order tenant 불일치가 PG 호출을 통과하는 실패를 재현했다.

### 수정 파일과 근본 구조

| 파일 | 수정 |
|---|---|
| `services/RefundService.js` | 외부 호출 전 intent commit; 결제 row lock; 동일 결제의 미확정 작업 단일화; lease owner fencing; PG 결과 key/total/balance/status 확인; 불명 결과는 unknown; 같은 키 재시도는 PG 조회로 대사; 이전 partial PG key 유지 |
| `prisma/schema.prisma` | refund_operations 모델/결제 FK 관계 추가 |
| `prisma/migrations/20261008010000_durable_refunds/migration.sql` | additive table, operation unique, unresolved payment partial unique, amount/balance CHECK, FK, server-only 기본 거부 RLS 및 PUBLIC/anon/authenticated 권한 제거; 과거 원장 자동 변경 없음 |
| `services/PaymentService.js` | 전체 split 결제를 각 durable full key로 처리; partial 재시도는 original payment binding; 이전 event key replay; 오프라인은 마지막 DONE 환불 뒤만 주문 확정/재고 복구 |
| `controllers/paymentController.js` | partial 환불의 권한은 immutable order tenant에서 검사, canceled replay를 서비스에 전달 |
| `middleware/idempotency.js`, `routes/payments.js` | 환불에 한해 domainOwned 모드. key/body binding은 유지하되 generic response-state가 native intent recovery를 막지 않게 연결. 일반 주문/결제의 기존 fail-closed 로직은 유지 |
| `repositories/Ledger.js` | 각 refund event를 개별 절대값으로 집계해 기존 negative rows와 새 positive rows 혼합 지원 |
| `repositories/Settlement.js` | 실제 store_settlement_config 사용; amount별 group으로 서로 다른 부호가 집계 전 상쇄되지 않게 처리 |
| `services/StoreManagerService.js` | SUM(ABS(amount))로 native 매출·제품·성과 평가의 환불 반영 일관화 |

외부 PG와 DB를 한 DB transaction으로 묶었다고 주장하지 않는다. 의도를 먼저 저장하고 외부 효과를 안정 키로 실행/조회한 뒤 **원장+payment 상태+points+실제 재고 보상+order 상태+intent confirmed**를 한 로컬 DB transaction으로 확정한다. 중간 실패는 모두 rollback하고 unknown intent가 남아 같은 키로 복구한다. 서로 다른 미확정 키는409로 차단한다.

재고는 cart quantity를 임의 증가시키지 않고 기존 ORDER stock_history에 실제 차감된 수량만 복구한다. order lock과 CANCEL history 확인, atomic increment로 중복/동시 갱신을 제어한다. 제품의 tenant가 다르면 실패한다. 결제와 주문의 tenant도 PG 호출 전에 검사한다.

**API 호환:** endpoint·입력·성공 필드의 기본 구조 유지. 재환불 성공에는 alreadyRefunded가 추가될 수 있음. 부분 금액은 양의 안전한 정수, key는 필수. 기존 partial provider key `partial-refund:<client key>`와 legacy ledger replay를 유지한다. mixed-sign 데이터는 읽기 시 정상화하며 이전 과다 전체 환불 기록 자체를 자동 보정하지 않는다.

### 실제 PostgreSQL/HTTP 15개 시나리오

`tests/database/refunds-postgres.test.cjs`, 결과 `reports/p0-postgres.log`: **15 pass, 0 fail, 0 skip**.

1. 부분→전체의 실제 잔액, 양수 원장, stock/order 수렴과 반복 요청.
2. PG 성공 뒤 DB 확정 실패 rollback과 재시도 대사(PG 재환불 없음).
3. 서로 다른 두 concurrent refunds의 동일 잔액 경쟁.
4. PG response loss, 다른 key 차단, 같은 key 복구.
5. 이전 negative partial row의 개별 잔액 계산.
6. stock 차감 이력이 없으면 복구 증가 없음.
7. 현장 split 마지막 환불 전 order/stock 유지, 완료 후1회 복구.
8. 같은 phone을 가진 두 tenant의 scoped repository 조회.
9. mixed-sign 원장을 반영한 실제 SQL AI 매출.
10. 실제 config 모델과 mixed-sign settlement 계산.
11. partial API 재시도가 CANCELED 뒤에도 같은 payment 결과를 재사용.
12. 실제 auth/router/idempotency/DB HTTP에서 PG 성공→DB 실패→두 번 재요청, PG1회/원장1건.
13. 이전 partial ledger key의 업그레이드 replay.
14. payment/order tenant 불일치를 PG 효과 전에 차단.
15. 이전 PG 성공·ledger 유실을 동일 provider key로 재시도, 추가 환불 없이 원장1건.

DB는 실제 PostgreSQL16/Docker다. **PG는 deterministic test adapter이며 실제 Toss sandbox/live 호출을 하지 않았다.** 따라서 provider의 실제 key TTL, field 계약, 고객 결제 검증은 운영/PG sandbox 후속 조건이다.

### migration 검증과 발견한 blocker

- 원본 신규 migration SQL을 별도 `wemarket_refund_migration_test`에서 검증하고, RLS assertion이 먼저 실패한 뒤 보강했다. 최종 원본은 `wemarket_refund_migration_v2_test`에 새로 적용했다. `tests/database/refund-migration.sql`의 RLS, unresolved unique, amount/balance CHECK, payment FK 검증이 통과했다. fixture transaction은 rollback했다. 운영 backend DB role의 owner/BYPASSRLS 권한과 공개 역할 무접근은 적용 preflight가 필요하다.
- 전체 migration history를 빈 `wemarket_p0_test`에서 실행하면 `008_add_status_enums`가 orders 테이블 없이 먼저 실행되어 **P3018 / 42P01**로 실패했다.
- 이를 숨기지 않고, 별도 `wemarket_p0_schema_test`에 현재 Prisma schema를 구성하여 업무 transaction 검증과 전체 history 검증을 분리했다.
- 운영 DB에는 신규 migration을 적용하지 않았다. 코드 배포 전에 이 테이블/제약과 운영 호환 preflight가 필요하다. 운영 ledger 과거 과다금액은 먼저 PG 대사 후 별도 승인된 보정으로 처리해야 한다.
- 지금 상태에서 이 코드만 운영에 배포하면 미적용 테이블 때문에 환불이 실패할 수 있다. 따라서 배포하지 않았다.

## 3. 전체 실행 결과

| 검사 | 실제 실행 결과 | 증적 |
|---|---|---|
| backend unit/API/regression | **150 suites / 1286 tests pass**, 0fail | `reports/p0-backend-jest.json`, `.log` |
| SaaS node tests | **48 pass**, 0fail | `reports/p0-saas.log` |
| actual PostgreSQL/HTTP | **15 pass**, 0fail | `reports/p0-postgres.log` |
| frontend Vitest 전체 | **24 files / 117 tests pass**, 0fail | `reports/p0-frontend-vitest.log` |
| legacy integration 전체 | **11 suites pass / 4 fail; 102 tests pass / 10 fail / 1skip** | `reports/p0-legacy-integration.json`, `.log` |
| backend typecheck / Prisma validate | exit0 / schema valid | 실제 CLI 실행 |
| route / JSX / API contract | 88 routes / 292 JSX / 6 groups 통과 | 실제 CLI 실행 |
| frontend production build | 통과, PWA15 precache entries | `reports/p0-frontend-build.log` |
| actual startup smoke | liveness/readiness·protected route·capability CORS 통과 | `reports/p0-startup-smoke.log` |
| 신규 migration SQL 제약 | 원본 apply, RLS 실제 일반 역할 무조회, unique/CHECK/FK assertions 통과 | `tests/database/refund-migration.sql`, 실제 psql 실행 |
| full migration empty DB | 실패(P3018/42P01) | 본 문서 기록; 운영 DB 미접속 |

최종 backend 전체 실행 이후 추가된 업무 수정은 RefundService의 이전 provider key 유지다. 이 부분은 실제 DB/HTTP 회귀15건에서 검증했다. 이어 신규 migration의 server-only RLS를 보강하고 RLS가 활성화된 DB에서 같은15건을 재실행해 통과했다. SQL에서는 SELECT 권한을 준 일반 역할로 전환해 금융 행 조회0건도 확인했다.

초기 sandbox 실행의 EACCES/EPERM은 애플리케이션 실패와 구분하고 로컬 테스트 권한으로 재실행했다. 프론트 최초 전체 실행의2실패 중 module import5초 timeout은15초/worker2 설정에서 해소됐다. auth-client 테스트는 기존 uncommitted refreshSession이 native fetch를 쓰는데 axios mock만 있던 계약 drift였다. **앱 인증 코드를 바꾸거나 assertion을 삭제하지 않고 fetch payload+retry Authorization 검증으로 fixture를 갱신했다.**

Legacy integration은 `tests/integration/setupIntegration.js`에서 Prisma 전체를 mock한다. 이 suite를 “실제 DB 통합 통과”로 집계하지 않았다. 실패는 foodTruck2, orders6, phase4 translation1, payments getById1이다. typed ID/인가/입력·mock 계약의 어긋남을 확인했으나 현재 P0 gate를 건너뛰어 관련 P1/legacy 기능을 임의 수정하지 않았다. 전체 테스트가 모두 green이라는 선언은 하지 않는다.

Playwright 전체 사용자 여정, 실제 Toss sandbox, load/performance, 운영 backup restore는 이번에 수행하지 않았다. 기존 테스트 통과로 이를 대체하지 않는다.

## 4. 실행·복구 절차

생성한 로컬 전용 컨테이너: `wemarket-p0-audit-20261008`, localhost55438, fixture DB만 포함. 실제 고객/운영 데이터를 넣지 않았다. 이 컨테이너와 SQL test는 운영환경용이 아니다.

```powershell
# 컨테이너가 정지되어 있으면 로컬 테스트 재개
docker start wemarket-p0-audit-20261008
$env:P0_TEST_DATABASE_URL='postgresql://audit:audit-local-only@127.0.0.1:55438/wemarket_p0_schema_test'
$env:NODE_ENV='test'
$env:JWT_SECRET='p0-isolated-test-secret-20261008'
node --import tsx --test tests/database/refunds-postgres.test.cjs
```

해당 test script는 이 hostname/port/database가 아니면 실행을 거부한다. 운영 URL/default .env를 DB fixture 대상으로 자동 선택하지 않는다.

배포 전 요구: 과거 실패/미확정 환불 PG 대사 → schema migration preflight/backup → 새 additive table 적용 → 새 code 검증 → 실제 PG sandbox 및 소액 운영 검증(별도 실행). rollback은 **기존 stateless 환불 코드로 단순 회귀하면 새 intent 복구를 잃을 수 있으므로** 미확정 금융 작업 drain/대사 후 승인된 버전으로 전환하는 절차가 필요하다. migration rollback으로 intent/원장을 삭제하지 않는다. 현재 그 운영 훈련은 미수행이다.

## 5. 다음 작업의 순서

1. 고객 history capability의 계약 변경 결정 후 version/store/order scope와 client migration을 구현·재현·검증한다.
2. P0-01의 모든 관련 경로와 P0-02의 운영 조건·이전 금융 데이터 대사를 닫는다.
3. 전체 regression/integration/E2E 게이트를 다시 실행해 잔여 P0와 시험 실패를 분리한다.
4. **P0 0건의 근거가 확보된 뒤** P1-01~17과 새 migration bootstrap blocker를 순서대로 진행한다.

현재 기록은 로컬 수정·시험 결과이며 서비스의 상용 준비 완료 보고가 아니다.
