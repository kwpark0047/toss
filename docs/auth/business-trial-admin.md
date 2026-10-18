# 최고관리자 체험 계정 관리

`/api/admin/business-trials`의 목록·변경 API는 인증된 `super_admin`만 사용할 수 있습니다.

- 정식 이용 승인: 체험 상태를 `approved`로 바꾸고 승인 이력을 남깁니다.
- 승인 취소: `approved` 계정을 다시 `trialing`으로 바꾸며 기존 체험 시작일·종료일은 유지합니다. 종료일이 지났다면 체험은 즉시 만료 상태로 제한됩니다.
- 계정 삭제: 확인 문구 `삭제`를 입력해야 합니다. 매장 소유 계정과 최고관리자 계정은 보호합니다. 삭제 대상은 로그인 세션·연결 인증 수단을 폐기하고 직접 식별정보를 익명화하며, 재무·감사 참조 기록은 보존합니다. 계정은 `deletion_pending` 상태로 전환되어 로그인할 수 없습니다.

관련 API:

- `POST /api/admin/business-trials/:id/approve`
- `POST /api/admin/business-trials/:id/revoke-approval`
- `DELETE /api/admin/business-trials/:id` (요청 본문 `{ "confirm": "삭제" }` 필요)

DB 스키마 변경은 없습니다. 서비스 테스트는 `tests/unit/services/BusinessTrialService.test.js`, 화면 테스트는 `frontend/src/test/super-admin-business-trial.test.jsx`입니다.
