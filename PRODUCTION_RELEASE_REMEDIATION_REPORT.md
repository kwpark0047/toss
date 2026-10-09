# Release 차단 항목 수정 및 활성화 준비 보고서

검증일: 2026-10-09 KST. 기준 HEAD: `7d0c93fd69454bf46755038bb1e8a1180ffdb476`.
이 보고서는 현재 **미커밋 작업 트리**의 로컬 결과이다. 이전 FINAL_PRODUCTION_READINESS_REPORT.md는 수정 전 감사 증거로 보존한다. 기존 개발자의 변경을 덮어쓰지 않았다.

## 판정과 활성화 상태

**Release Blocked 유지.** 로컬 코드의 여러 출시 차단 결함을 수정했으나, 모든 잔여 위험을 제거했다고 선언하지 않는다. 운영 DB·배포·금융 worker는 이번 작업에서 활성화하지 않았다. 실제 Toss sandbox, reference provider, staging 동일 SHA 검증, 운영 대사·PITR 복구·SLO·개인정보 보존 검증이 남아 있다.

| 단계 | 상태 |
|---|---|
| 아래 특정 결함의 코드 수정 | 구현 및 로컬 회귀 확인 |
| 전체 backend / frontend / SaaS | 아래 실행 증거 참고 |
| 실제 PostgreSQL transaction/금융 장애 시험 | 37개 통과; 통제 PG 사용 |
| 실제 Toss sandbox | 미검증; 키·테스트 계정 필요 |
| 실제 외부 업체 연결/매출 대사 | 미검증; 업체/공식 API 계약·테스트 계정 필요 |
| staging 활성화 | 미실행 |
| 운영 DB / 배포 / 자동 금융 worker | 미실행 |
| Production Ready | 해당하지 않음 |

## 수정한 근본 원인과 계약 영향

1. **주문 상세 500**: controllers/orderController.js가 설치되지 않은 dataloader와 실제 Prisma 모델과 맞지 않는 전역 loader를 사용했다. 기존 Order.findById의 매장 권한 검사 및 포함 관계를 사용한다. 결제 상세는 필드 allowlist로 PG key/raw payload를 제외한다. historyCapability.security.test.js에서 재현/검증했다.
   추가 lint에서 고객 FCM 등록의 남은 orderLoader 참조를 발견했다. 별도 재현 1 fail/4 pass 후 Order.findById로 수정하여 5 pass를 확인했다. 전체 backend 재실행 결과는 아래 최신 JSON을 확인한다.
2. **구독 stale owner 경합**: services/SaaSBillingService.js의 완료/실패 업데이트가 claim 소유권을 확인하지 않았다. claimed_at+attempts+processing 조건부 updateMany로 완료·실패를 fence하고, PG 성공 후 DB 실패는 manual_review로 분리한다. entitlement 변경은 소유권 확인 이후 transaction 내부에서만 수행한다. billing-fencing.test.cjs 및 billing-fencing-postgres.test.cjs에서 다른 DB transaction으로 claim을 바꿔 stale 성공/실패를 검증했다.
3. **세션 폐기 불가**: 서명된 JWT만으로 인증되어 logout·refresh 재사용·권한 회수를 서버에서 강제하지 못했다. services/AuthSessionService.js, middleware/auth.js, controllers/authController.js, socket/auth.js, AuthSession 모델을 추가했다. refresh hash CAS·reuse revocation, primary의 최신 사용자 role·세션 상태를 검사한다. 로그아웃은 서버 폐기 성공 뒤 로컬 토큰·매장 캐시·개인 API 캐시를 제거한다. Layout/AdminLayout도 await 후 이동한다. **기존 sid 없는 토큰은 재로그인 필요**. 운영 migration과 배포 순서 승인이 필요하다.
4. **쿠키 refresh CSRF**: frontend/src/lib/authSession.js에서 갱신 전에 credentials 포함 CSRF 증명을 얻고 동일 deadline으로 POST한다. 증명이 없으면 갱신하지 않는다. authSession.test.js 5개 검증.
5. **개인 응답의 SW 캐시**: frontend/vite.config.js의 전체 /api/ 캐시 규칙을 제거했다. public/sw-sync.js activate 및 로그아웃에서 과거 wemarket-api / wemarket-api-stale를 삭제한다. 공개 메뉴의 store 범위 캐시는 별도 유지한다.
6. **웹훅 durable receipt 부재**: PaymentWebhookInbox.js와 전용 모델로 암호화된 whitelist payload, provider event ID/hash, UNIQUE, owner lease/CAS, bounded retry/backoff, manual_review를 기록한다. malformed PAYMENT_STATUS_CHANGED는 DB 접근 전에 400으로 거부한다. 같은 ID/다른 내용은 409이다. handlers/subscriptionWebhook.js의 미검증 legacy Subscription 이벤트는 격리하며 이용 권한을 부여하지 않는다. **해당 legacy 계약을 사용하는 가맹점은 실제 공식 계약 확인 전 활성화 불가**.
7. **자동 PG 취소 intent 미기록/실패 false ACK**: PaymentCompensationService.js를 통해 PG 호출 전에 server-only auto_cancel 작업을 기록하고 고정 operation key와 PG 남은 잔액을 사용한다. PG 성공 후 retry는 PG 상태를 재조회한다. 24시간 이상 지난 불명확한 결과는 자동 재취소하지 않고 대사 대상으로 둔다. PaymentService.js가 오류를 삼키지 않아 재개 가능한 실패가 노출된다. operations-worker.cjs의 PAYMENT_INBOX_RETRY_ENABLED는 opt-in이다.
8. **민감정보 로그**: utils/logRedaction.js 및 logger.js에서 재귀 metadata, PG key/customer key, token, authorization, 전화번호 등을 redaction한다. 실제 Winston 출력 시험을 추가했다. 이미 저장된 운영 로그의 삭제·보존 처리는 별도 승인 절차이다.
9. **빈 DB migration 실패**: 008/009가 baseline보다 앞에 정렬됐다. deploy-migrations.cjs는 truly-empty DB에서 실제 baseline을 먼저 실행·확정 후 resolve하여 배포한다. 기존 DB failed migration을 임의 resolve하지 않는다. 역사적 Plan seed의 required updated_at 누락과 split-store SQL의 없는 eco 컬럼 참조를 수정했다. **이미 적용된 두 SQL 파일의 checksum 변경 영향은 별도 운영 history 리뷰가 필요하다. 운영 journal을 변경하지 않았다.**
10. **CI가 실패를 숨김/핵심 gate 미필수**: ci.yml의 integration/E2E를 PR·push에서도 실행하고 real PostgreSQL 금융 job을 배포 의존성에 추가했다. seed의 `|| true`를 제거했으며 seed_test.js는 test+local wemarket_test 이름만 허용하고 split된 사업자/시간/구독 모델을 사용한다. 이번 CI 변경은 아직 원격 실행되지 않았다.

## 테스트 실행 증거

실패 로그도 reports/release-remediation-*에 보존한다. HTTP EACCES는 로컬 연결 권한을 허용하여 동일 시험을 다시 실행했으며 테스트를 skip하지 않았다. 초기 frontend 병렬 실행의 3개 timeout은 동일 15초 제한, maxWorkers=1로 재실행했다. 아래 시험은 실사용자 데이터·운영 PG를 사용하지 않았다.

| 실행 명령 / 분류 | 실제 결과 | 증거 |
|---|---|---|
| node scripts/run-jest.cjs --config jest.config.js tests/unit tests/routes tests/regression --runInBand --forceExit --json | 156 suites / 1306 pass / 0 fail | reports/release-remediation-backend-final.json, .log |
| node scripts/run-jest.cjs --config jest.config.integration.js --runInBand --json | 15 suites / 113 pass / 0 fail / 0 skip; 시험 후 종료되지 않아 프로세스를 중단(exit 1), CI 게이트 미통과 | reports/release-remediation-integration-final.json, .log |
| node --test tests/saas/*.test.cjs | 63 pass / 0 fail / 0 skip | reports/release-remediation-saas-final.log |
| npm --prefix frontend test -- --testTimeout=15000 --maxWorkers=1 --reporter=dot | 25 files / 121 pass / 0 fail | reports/release-remediation-frontend-final.log |
| node --import tsx --test tests/database/{refunds,auth-sessions,billing-fencing,webhook-inbox,canonical-sync}-postgres.test.cjs (실행 시 각 파일을 명시적으로 열거) | 37 pass / 0 fail / 0 skip; PostgreSQL16 localhost:55438, 통제 PG | reports/release-remediation-postgres-final.log |
| npm run typecheck:backend | exit 0 | reports/release-remediation-typecheck.log |
| npm --prefix frontend run build | exit 0; PWA 생성 확인; >400kB chunk 경고 있음 | reports/release-remediation-build.log |
| node scripts/deploy-migrations.cjs --apply / 신규 빈 DB | 전체 34 migration 적용 성공 | reports/release-remediation-bootstrap-final34.log |
| 같은 wrapper / 기존 fixture DB의 33→34 migration | 성공 | reports/release-remediation-upgrade-final.log |
| NODE_ENV=test node scripts/seed_test.js | 성공, fixture만 사용 | reports/release-remediation-seed.log |
| git diff --check | exit 0; CRLF 정보 경고만 있음 | reports/release-remediation-diff-check.log |
| 수정 auth/payment/logger/order 및 logout UI 대상 eslint --quiet | exit 0; 전체 저장소 lint를 대체하지 않음 | reports/release-remediation-lint.log |
| node scripts/smoke-table-qr.cjs | exit 0; 1440/390 화면 PNG/PDF/retry 통과, 오류 0, 외부 QR 요청 0; fixture 브라우저 시험 | reports/release-remediation-qr-browser.log |

## 신규 DB 변경과 운영 데이터

- 20261009020000_auth_sessions: 서버 세션/refresh hash/폐기 상태.
- 20261009030000_payment_webhook_inbox: 웹훅 및 자동 취소 durable inbox.
- 선행 P0 migration 20261008010000_durable_refunds 및 20261009010000_p0_identity_compensation의 운영 적용도 별도로 확인해야 한다.
- 외부 canonical schema의 과거 운영 적용 주장과 이번 금융/auth schema 적용을 혼동하지 않는다.
- 운영 원장·PG 잔액은 읽기 전용 대사를 먼저 수행한다. 기존 데이터 금액/재고/동의를 추측으로 backfill하거나 고치지 않았다.

## 아직 닫히지 않은 위험과 필수 조치

- 동일 immutable RC SHA에서 staging DB upgrade, browser E2E와 실제 Toss sandbox 주문·부분환불·잔액취소·구독 lifecycle/웹훅을 검증해야 한다. mock 통과는 이를 대체하지 않는다.
- 실제 reference provider의 credential lifecycle·pagination·cursor 복구·매출 대사·AI provenance는 업체 계정으로 검증해야 한다. canonical AI revenue는 미검증 provider를 완료로 표시하면 안 된다.
- billing manual_review 및 외부 취소/지연/순서 역전 webhook의 manual_review 대사는 자동 완료 기능이 아니다. 운영 담당자 화면·대사·재개 절차가 추가로 필요하다.
- socket 서버 push의 기존 room 권한 회수와 다중 instance Redis adapter, refresh reuse 후 연결 즉시 해제를 추가 검증해야 한다. packet 검증 및 logout disconnect를 전역 즉시 회수 완료로 확대하지 않는다.
- operations worker SIGTERM drain/중단 경계, 전체 API role×tenant matrix의 실제 DB/E2E, LLM fault/injection/cost, alert 전달은 추가 검증 범위다.
- 개인정보 법정 보존표/삭제·가명화, 감사 불변성, 실제 backup/PITR 및 암호화 키·파일 restore/RTO/RPO는 운영 증거가 없다.
- free Render의 실제 cold start/SLO·capacity와 rollback 연습은 운영에서 확인해야 한다. 요금제를 변경하지 않았다.
- 두 역사 migration checksum 변경은 기존 운영 migration history와 대조하고 승인된 적용/복구안을 확정해야 한다. deploy build에 migration 명령이 있어 현재 상태 그대로 운영 deploy를 실행하면 안 된다.
- backend `--forceExit`와 integration의 열린 handle은 graceful shutdown 증거가 아니다. lint/원격 CI/운영 배포 SHA도 아직 인증하지 않는다.
  integration의 ESM app teardown을 추가한 재시험도 113개 assertion은 통과했으나 자연 종료하지 않았다. `reports/release-remediation-integration-cleanup.json/.log` 및 `release-remediation-openhandles-full.log`에 보존한다. 종료 원인을 해결하기 전 activation gate로 사용할 수 없다. 끝난 시험 프로세스와 소유 테스트 컨테이너는 중지했으며 DB 데이터는 보존했다.

## 활성화 절차 및 복구

1. 활성화 대상(staging / 검증된 운영 수정 / 금융 worker 포함)을 확정한다. 운영 금융 worker는 실제 PG 검증 후 별도 활성화한다.
2. 작업 트리 전체 변경을 리뷰하고 immutable RC commit/manifest를 확보한다. 이전 HEAD의 성공 CI를 현재 변경의 성공으로 사용하지 않는다.
3. snapshot/restore 검증 및 historical migration history 계획을 먼저 확정하고 staging에 신규 schema를 적용한다. 이 단계까지 운영 변경은 없다.
4. 동일 SHA에서 필수 CI, browser/PG sandbox, 장애 복구·대사를 검증한다. 실패 시 release를 차단한다.
5. 승인된 운영 적용 시 API보다 schema를 먼저 적용하고 사용자 재로그인을 안내한다. 신규 durable 금융 작업이 발생한 뒤에는 이전 stateless/보상 미지원 API로 무조건 rollback하지 않는다.
6. rollback은 writer/worker를 중지하고 durable 작업 목록·PG 상태를 보존한 뒤 호환된 마지막 정상 artifact로 수행한다. 데이터 테이블 drop/원장 역수정으로 복구하지 않는다.
7. 운영 health revision·DB revision·기능 flag·worker heartbeat·대사 결과를 확인하기 전 운영 검증 완료로 표시하지 않는다.

Git commit/푸시/운영 배포: 이번 수정 작업에서는 미실행. 이 보고서의 로컬 통과는 상용 활성화 승인이나 Production Ready 선언이 아니다.
