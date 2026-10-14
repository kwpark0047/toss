# AI 사업자 성장 지원센터 구현·검증

## 상태 구분

| 영역 | 상태 |
|---|---|
| 지원센터·사업자 제안함·동의·사례·감사·worker 코드 | 로컬 구현 완료, 아래 검증 증적 참조 |
| 실제 PostgreSQL | 격리 로컬 DB 회귀 통과 |
| 브라우저 E2E | 격리 테스트 계정·매장 11에서 전달→승인→QR 실행→성과 대기→중단 확인 |
| 운영 지원센터 DB·worker·화면 | 미적용·미활성, 신규 운영 migration 승인 필요 |
| 실제 업체·원가·자동 발주·SMS | 자동 실행 없음, 연결/원본 자료·제공자 검증 별도 |
| 운영 신규 가입 OTP 404 긴급 수정 | 별도 커밋 3535a46 배포 완료, 실제 SMS 수신은 보류 |

Production Ready 선언이 아니다. 운영에서 새 지원 동의를 대신 등록하거나 사업자에게 지원안을 보내지 않았다.

## 구현 파일과 흐름

- `services/BusinessSupportService.js`: 실제 stores.user_id 소유자 동의, 최고관리자 검토·담당·전달, 사업자 수정 요청·보류·거절·승인·실행·중단·확인 완료, UUID 멱등 작업과 이력, 우선순위/sequence cursor 목록, 완료 평가 이력.
- `services/BusinessSupportWorker.js`: 지원 동의 매장만 bounded schedule/claim. 기본 10개 작업·동시성 최대 2, SKIP LOCKED, 2분 lease, 30초부터 지수 backoff, 최대 5회 DLQ, 수동 재분석. dirty generation이 분석 도중 바뀌어도 다음 작업을 보존하며 다른 worker가 회수한 lease로는 게시하지 않는다.
- `scripts/run-business-support-worker.cjs`: 별도 단발 worker 프로세스. `BUSINESS_SUPPORT_WORKER_ENABLED=true` 없으면 실행하지 않는다. 주문·결제 요청 경로에서 worker를 시작하지 않는다.
- `utils/businessSupportAnalysis.js`: 수금 순매출 비교, 미접수 지연, 등록 품절/0 이하 재고, 자료 부족·출처·기간·규칙 버전. 실재고·입고·원가·입금 차이는 추측하지 않는다.
- `routes/businessSupport.js`, `app.mts`: 인증·매장/최고관리자 권한, 입력 검증, rate limit, private no-store API.
- `routes/storeManager.js`, `services/StoreManagerService.js`: 최고관리자 역할만으로 approve/execute하지 못하게 수정. 서비스에서도 현재 실제 소유자를 store row lock 안에서 검증한다. 지원안에 연결된 작업의 기존 경로 우회를 거부하고 같은 transaction 안에서만 승인형 실행을 진행한다.
- `prisma/migrations/20261014010000_business_support/migration.sql`, `prisma/schema.prisma`: enrollment/case/event/job, tenant 복합 FK, 고유 operation ID, 상태 CHECK·인덱스, RLS·공개 권한 차단. 기존 주문·원장 변경 없음.
- `frontend/src/components/admin/BusinessSupportCenter.jsx`, API wrapper, lazy route, AdminLayout: 최고관리자 지원센터와 사업자 제안함. 기존 관리자 UI 재사용, 빈 상태·실패/retry·자료 부족·근거 기간·담당자·DLQ 재시도·명시적 앱 내 확인창 제공.

### 승인·실행 계약

플랫폼은 검토·전달·담당만 수행한다. 실제 매장 소유자만 승인·실행·중단한다. 실행 허용 범위는 기존 QR 추천 메뉴 노출이며 할인·SMS·광고·발주·지급·결제/원장 변경은 없다. owner 승인과 별도 실행 확인을 모두 요구한다. 기존 최고관리자의 직접 QR 작업 실행 권한은 의도적으로 축소된다. 읽기 API의 기존 JSON 필드는 유지한다.

운영 중단은 서버 추천 API에서 즉시 제외하며 고객 화면의 기존 60초 갱신 또는 새로고침으로 반영된다. 이미 열린 모든 탭에서 즉시 제거되는 push 완료로 주장하지 않는다.

### 근거 보존

현재 지원 분석의 snapshot/기간과 QR 실행안의 원본 snapshot/기간을 `action_source`로 구분한다. QR 작업이 연결된 draft와 전달된 근거는 불변이다. 읽기 전용 draft에 새 실행안을 연결할 때만 snapshot/evidence/action을 원자적으로 갱신한다. 5분 snapshot과 하루 단위 기존 action 중복 방지 주기가 달라도 유효·판매 가능·미연결 제안을 찾는다. 같은 사업자에게 5분마다 같은 지원안을 새로 만들지 않는다.

## 검증

- 수정 전 `business-support-red.log`: 신규 분석 모듈 누락 실패. 초기 샌드박스 로컬 포트 EACCES는 별도 실행 권한으로 해소했다.
- `node --test tests/saas/store-manager.test.cjs tests/saas/business-support.test.cjs`: 최초 8개 통과; 최종 SaaS 전체 회귀에 포함.
- `npm run test:saas`: 81개 통과 (`business-support-saas-final-full.log`). 이후 전화번호 증명 변조 테스트 1개 추가는 `registration-otp-green.log`에서 5개 관련 테스트 통과.
- backend unit/routes: 177 suites / 1357 tests 통과 (`support-registration-backend-full.log`).
- frontend 전체: 47 files / 188 tests 통과 (`business-support-frontend-final-full.log`). 마지막 원본 근거 표시 변경은 targeted UI + production build로 추가 확인한다.
- frontend production build 통과 (`business-support-build.log`), 400KB 초과 일부 기존 chunk 경고 존재. 단순히 경고를 숨기지 않았다.
- `npx prisma validate`, `npx prisma generate` 통과 (`business-support-prisma.log`, `business-support-prisma-generate.log`).
- 새 backend 파일 ESLint 오류 0 (`business-support-eslint.log`).
- `node scripts/test-business-support-postgres.cjs`: 실제 로컬 PostgreSQL transaction/unique/FK/row lock/RLS/lease 검증. 타 매장 차단, 플랫폼 승인 차단, 동시 전달/QR 실행 1회, 변경 요청·재전달, 동의 철회 후 중단, dirty generation, 재시작 lease 회수·오래된 worker 차단, backoff/DLQ/수동 복구, 7일 경과 표본 부족·비인과 평가/감사 1회, OTP 동시 가입을 확인.
- 기존 `scripts/test-store-manager-postgres.cjs`의 격리 PostgreSQL 회귀 통과: snapshot, tenant, approved execution, concurrency, QR, expiry, evaluation, AI 한도 (`business-support-manager-compat.log`). pg 단일 client 병렬 query deprecation 경고는 기존 테스트 harness의 기술부채다.

## 독립 검토와 재현 수정

독립 read-only reviewer가 중요 문제 2건을 발견했다. `business-support-evidence-red.log`와 `business-support-rollover-red.log`로 실제 DB에서 실패를 재현한 뒤 원본 근거 불변/일별 action 조회와 source 추적으로 수정했다. 수정 후 reviewer가 두 문제 해소와 새 중요 회귀 없음으로 확인했다. 추가 lease 회수 시 성공으로 잘못 보고하던 문제는 `business-support-lease-red.log`로 재현 후 `lease_lost` 상태로 수정했다.

## 브라우저 E2E 증거

실제 운영 계정 대신 새 격리 fixture를 사용했다. 테스트 수금 완료 행은 분석 입력 fixture이며 PG sandbox 결제 성공 증거가 아니다.

1. 최고관리자 메뉴→지원 요약/근거/담당/전달, 플랫폼 승인 버튼 없음.
2. 테스트 owner 로그인→제안함→승인→앱 내 확인→QR 실행.
3. 공개 featured API 200 / 1개 및 고객 메뉴 추천 영역 확인.
4. 7일 전 성과 조회는 pending / 인과 효과 단정 없음.
5. owner 중단→공개 featured API 0개→고객 메뉴 새로고침 후 추천 영역 제거.

증거: `business-support-platform-e2e-20261014.jpg`, `business-support-qr-e2e-20261014.jpg`, `business-support-owner-e2e-20261014.jpg`, `business-support-qr-live-local.log`.
초기 기본 JS 확인창이 IAB 제어를 막아 실패했다. 블로킹 window.confirm을 접근 가능한 HTML dialog로 교체했고 Chrome에서 위 흐름을 완료했다. 실패를 E2E 성공으로 계산하지 않았다.

## 운영 인수·복구

1. 신규 스키마 승인 후 백업/현재 schema와 기존 manager 테이블을 확인하고 `20261014010000_business_support`만 적용·migration 이력을 기록한다. 전체 미적용 migration을 임의로 일괄 실행하지 않는다.
2. 별도 운영 보안 확인에서 phone_otps/provider_credentials의 공개 역할 권한과 RLS 누락을 발견했다. `20261014020000_private_registration_and_provider_tables`는 별도 운영 승인 대기다. 이를 해결하기 전 보안 출시 완료로 판단하지 않는다.
3. 화면·API 배포 후 실제 소유자가 소수 pilot 매장의 동의를 직접 등록한다. 플랫폼 관리자 역할을 동의로 대체하지 않는다.
4. worker를 처음에는 제한된 단발 실행으로 확인하고, 작업 스케줄러는 운영 처리량·DB pool·모니터링을 확인한 뒤 연결한다. 현재 코드에 운영 cron을 몰래 등록하지 않았다.
5. 장애 시 worker 실행을 중단하고 기존 정상 배포로 복구한다. 새 지원 테이블과 감사 이력은 유지한다. 실행 중 QR은 소유자 중단 또는 7일 TTL로 종료한다. DB DROP/일괄 취소·환불은 수행하지 않는다.

## 남은 검증 및 한계

- 운영 지원센터 schema·worker·실제 매장 동의·실사용 데이터 정확성·부하·알림 SLA는 미검증.
- 실제 업체/PG 정산 대사·매입/원가·SMS 공급자 수신·동의 기반 CRM은 미검증이며 자동 실행을 제공하지 않는다.
- 지원센터는 저장된 분석을 읽는다. 주문별 LLM 호출, 전체 공개 매장 분석, 신규 cross-tenant websocket broadcast는 추가하지 않았다. 실시간 push 인프라를 구축한 것으로 보고하지 않는다.
- SMS 접수 후 DB 저장 실패 시 접수된 코드가 무효가 되는 안전한 실패 경로는 실제 제공자 fault 검증이 남아 있다. 자동 중복 발송 재시도는 하지 않는다.
- 로컬 구현 커밋/운영 배포 SHA는 최종 커밋 후 아래에 기록한다. 신규 지원센터를 운영에 반영했다고 주장하지 않는다.
