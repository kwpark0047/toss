# 최고관리자 체험 계정 관리

`/api/admin/business-trials`의 목록·변경 API는 인증된 `super_admin`만 사용할 수 있습니다.

## 체험 정책

- 기본 요금제는 무료(`free`, ₩0)입니다.
- 새로 가입한 계정은 가입 시점부터 1개월 동안 프로(`pro`) 요금제의 기능과 한도를 무료로 씁니다(`users.trial_ends_at`).
- 체험이 끝나면 별도 조치 없이 무료 요금제로 돌아갑니다. 쓰기는 막지 않고 무료 요금제 한도만 적용합니다.
- 유효한 유료 구독이 있으면 체험보다 유료 구독이 우선합니다.
- 판정 로직: `utils/subscriptionPolicy.js`의 `resolvePlan`, `ownerTrialEndsAt`

## 관리 기능

- 체험 연장: 남은 기간이 있으면 그 종료일에서, 이미 끝났으면 지금부터 지정한 일수(1~90일, 기본 30일)를 더합니다. 체험 이력(`trial_started_at`)이 있는 활성 계정만 연장할 수 있고, 감사 이벤트 `business-trial:extended:<N>d:admin:<관리자 ID>`를 남깁니다.
- 계정 삭제: 확인 문구 `삭제`를 입력해야 합니다. 매장 소유 계정과 최고관리자 계정은 보호합니다. 삭제 대상은 로그인 세션·연결 인증 수단을 폐기하고 직접 식별정보를 익명화하며, 재무·감사 참조 기록은 보존합니다. 계정은 `deletion_pending` 상태로 전환되어 로그인할 수 없습니다.
- 목록 필터: `trialing`(프로 체험 중), `expired`(체험 종료·무료 요금제), `all`. 상태는 `trial_ends_at` 기준으로 판단합니다.

관련 API:

- `GET /api/admin/business-trials?status=trialing|expired|all`
- `POST /api/admin/business-trials/:id/extend` (요청 본문 `{ "days": 30 }`, 생략 시 30일)
- `DELETE /api/admin/business-trials/:id` (요청 본문 `{ "confirm": "삭제" }` 필요)

DB 스키마 변경은 없습니다. 서비스 테스트는 `tests/unit/services/BusinessTrialService.test.js`, `tests/saas/business-trial.test.cjs`, 플랜 판정 테스트는 `tests/saas/trial-plan.test.cjs`, 화면 테스트는 `frontend/src/test/super-admin-business-trial.test.jsx`입니다.
