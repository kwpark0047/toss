# 최고관리자 체험 계정 관리

`/api/admin/business-trials`의 목록·변경 API는 인증된 `super_admin`만 사용할 수 있습니다.

- 정식 이용 승인: 체험 상태를 `approved`로 바꾸고 승인 이력을 남깁니다.
- 승인 취소: `approved` 계정을 다시 `trialing`으로 바꾸며 기존 체험 시작일·종료일은 유지합니다. 이미 종료일이 지난 계정은 계속 만료 상태로 제한됩니다.
- 계정 삭제: 버튼 확인 후 `삭제` 입력을 요구합니다. 매장 소유 계정은 주문·결제·정산 기록 보존을 위해 거부합니다. 허용된 체험 계정은 로그인 세션과 인증 수단을 폐기하고 직접 식별정보를 익명화하며 감사 이력과 금융 기록은 보존합니다. 사용자는 `deletion_pending` 상태로 남아 로그인할 수 없습니다.

관련 API:

- `POST /api/admin/business-trials/:id/approve`
- `POST /api/admin/business-trials/:id/revoke-approval`
- `DELETE /api/admin/business-trials/:id` (`{ "confirm": "삭제" }` 필요)

DB 스키마 변경은 없습니다. 서비스/화면 단위 테스트는 `BusinessTrialService.test.js`와 `super-admin-business-trial.test.jsx`입니다.

