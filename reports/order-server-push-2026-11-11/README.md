# 서버 준비 완료 푸시 검증

구현: 표준 Web Push + 독립 VAPID 키. 구독은 주문/고객 이력 서명 권한과 매장 범위를 확인하고 AES-GCM으로 암호화 저장한다. 알림 payload에는 고객정보·조회 토큰 없이 주문 ID만 포함한다. 서비스워커가 준비 완료를 표시하고 같은 출처의 주문 진행 화면으로 이동한다.

발송: DB 주문 ready 상태를 10초 간격으로 확인한다. DB lease로 중복 worker 발송을 제한하고 6회까지 지수 재시도한다. 404/410 등의 무효 구독은 비활성화하고 24시간 만료 자료는 삭제한다. provider TTL은 1시간이다. 서비스 재시작 후에도 미발송 자료가 남는다. 전달은 at-least-once이며 서비스워커 marker와 notification tag로 중복 표시를 억제한다.

검증 환경: localhost 전용 PostgreSQL/API/Redis, @example.invalid 합성 점주, 테스트 전용 매장. 실제 UI에서 현금 미결제 주문을 생성했고 고객 이름/전화번호나 카드 요청은 사용하지 않았다. PushManager의 실제 WNS 구독과 web-push 라이브러리의 실제 provider 발송을 사용했다. API 응답 모킹이나 push 이벤트 주입으로 수신을 대체하지 않았다.

- 320/390/430px 모바일 뷰포트, 가로 넘침 없음.
- 고객 페이지를 전부 닫은 후 준비 완료로 변경, 실제 외부 푸시 수신 확인.
- 수신된 Notification의 notificationclick 이벤트를 재현한 뒤 실제 clients.navigate로 주문 화면 이동.
- 새 페이지가 저장된 고객 이력 capability로 해당 주문의 준비 완료를 확인.
- 서버 단위 테스트 15건, 프론트 주문/푸시 테스트 20건, 타입 검사·lint·빌드·Prisma 검증 통과.
- 상세 수치와 증거: results.json, subscription-mobile-390.png, notification-click-mobile-390.png.

검증 경계: Windows Edge의 모바일 뷰포트 검증이며 물리 Android/iPhone 기기 시험은 아니다. OS 알림 센터가 자동화 도구에 노출되지 않아 OS 알림의 실제 클릭은 확인하지 못했다. 결과의 nativeNotificationClicked=false와 notificationClickEventReplayed=true를 그대로 유지한다. 실제 외부 서버 푸시 수신과 클릭 처리기 재현을 구분한다.

운영: WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY / WEB_PUSH_SUBJECT를 Render 서비스 환경에 병합 설정한다. 키와 구독 원문을 커밋·로그에 남기지 않는다. 개인키는 구독 암호화에도 사용하므로 임의로 교체하지 않는다. 교체 시 기존 구독을 해제하고 다시 동의받아야 한다. iPhone/iPad는 홈 화면에 추가한 웹 앱에서 알림을 허용해야 하며, OS의 알림 허용 및 브라우저 백그라운드 동작 설정에 따라 수신이 달라질 수 있다.

재실행: 테스트 fixture와 전용 VAPID 키를 준비한 뒤 `node frontend/scripts/verify-order-server-push.cjs`. fixture·키·브라우저 프로필은 git 제외 경로에 보관한다.

PWA 호환성 보완: 구독 전에 활성 서비스워커가 ORDER_PUSH_READY 프로토콜에 응답하는지 확인한다. 이전 워커면 서버 구독을 등록하지 않고 업데이트를 안내하며 페이지 알림을 유지한다. 새 워커를 사용한 실제 외부 푸시 재검증은 results.json에 기록했다.
