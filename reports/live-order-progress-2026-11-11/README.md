# 실시간 주문 진행 2차 고도화 검증

- 격리된 localhost PostgreSQL/API/Redis, @example.invalid 합성 점주 및 테스트 전용 매장 사용.
- 실제 UI 주문 생성 → 매장찾기 → 점주 API 접수/조리/준비 완료 → 수령 완료. API 응답 모킹 없음.
- 현금 미결제 테스트 주문만 생성. 고객 이름/전화번호 없음, 카드 결제 요청 0건.
- 실제 소켓으로 상태 변경 수신, 320/390/430px 가로 넘침 없음.
- 실제 서비스워커 시스템 알림 1건 생성, 재조회/새로고침 중복 억제, 확인 상태 유지.
- 오프라인 표시, 재연결 시 놓친 상태 복구 확인.
- 상세 수치: results.json. 화면: preparing-*.png, ready-*.png, offline.png, completed.png.
- 브라우저 알림은 고객이 직접 켜야 하며 페이지가 열려 있는 동안 제공한다. 닫힌 앱의 서버 푸시는 이번 범위에 포함하지 않는다.
- 자동화 브라우저는 탭 전환 후에도 visibilityState=visible을 보고했으므로 숨김 탭 수신은 검증 완료로 주장하지 않는다.
- 단위 테스트: 프론트 12건, 백엔드 소켓/제한 17건 통과. 프론트 프로덕션 빌드 통과.

재실행: 테스트 fixture를 준비한 뒤 `node frontend/scripts/verify-live-order-progress.cjs`.
fixture는 git에서 제외되며 저장소에 계정 비밀번호나 결제 키를 포함하지 않는다.
