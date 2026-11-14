# 페이지 종료 후 준비 완료 서버 푸시 배포 결과

- 최종 운영 커밋: `ed474254891d9281c36832f3fbbe345286eb2796`
- 구현 PR: https://github.com/kwpark0047/toss/pull/73 (merged)
- PWA 호환성·RLS 보완 PR: https://github.com/kwpark0047/toss/pull/74 (merged)
- 최종 PR CI/E2E: https://github.com/kwpark0047/toss/actions/runs/42872604800 (success)
- 최종 main CI/E2E/운영 배포: https://github.com/kwpark0047/toss/actions/runs/42873749780 (success)
- Render: `dep-dbpm27hsrm7s73as2sc0`, live
- Vercel: `dpl_5Uf8Zgtk1jxgZAvRHHT1S1eM7Y7V`, READY, https://wemarket-saas.vercel.app

격리된 테스트 매장·합성 계정으로 실제 UI 현금 미결제 주문 10을 생성했다. 실제 고객정보와 카드 요청은 사용하지 않았다. 모든 고객 페이지를 닫은 후 실제 WNS Web Push가 4.541초에 수신됐다. 수신된 Notification의 클릭 이벤트를 재현해 실제 서비스워커의 clients.navigate와 API 조회로 해당 주문의 준비 완료를 확인했다. 320/390/430px 가로 넘침 없음, 프론트 회귀 20건 및 서버 기능 테스트 15건 통과. 전체 CI와 E2E도 통과했다.

검증 경계: Windows Edge의 모바일 뷰포트 검증이다. 물리 Android/iPhone 기기와 OS 알림의 실제 클릭은 미검증이다. 실제 외부 서버 푸시 수신과 notificationclick 이벤트 재현을 구분하며 results.json의 nativeNotificationClicked=false를 유지했다. 알림 클릭의 새 창 생성 자체를 실제 OS 입력으로 검증한 것은 아니다.

모바일 증거: notification-click-mobile-390.png, subscription-mobile-390.png. 실제 수신 및 이동 결과: results.json.

운영 추가 확인: API revision과 frontend app-commit이 최종 커밋으로 일치한다. DB connected, deep health 200, orderWebPush configured/schemaReady 정상, 운영 공개 키가 생성한 운영 VAPID 키와 일치한다. 활성 production 서비스워커가 ORDER_PUSH_READY에 응답했다. 공개 모바일 화면은 320/390/430px 가로 넘침과 pageerror가 없었으며 고객 주문 API 요청은 0건이었다. 측정값은 release.json에 기록했다.

초기 운영 배포에서는 실제 Render 빌드 명령이 저장소 render.yaml과 달리 Prisma 생성만 실행해 새 테이블이 없었고, deep health가 이를 감지했다. 이번 두 추가 SQL만 운영에 적용하고 실제 스키마·RLS를 확인한 뒤 Prisma 이력에 기록했다. 두 파일의 체크섬 일치와 적용 완료를 재확인했다. 다른 대기 마이그레이션이나 고객 데이터는 실행·수정하지 않았다. 실제 Render 빌드의 자동 마이그레이션 누락 자체는 변경하지 않았으므로 이후 스키마 변경에도 적용 상태를 별도로 확인해야 한다. production-migration.json 참조.

새 테이블의 anon/authenticated 권한은 없고 RLS가 활성화됐다. Supabase의 [RLS Enabled No Policy 정보 항목](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)은 공개 접근을 허용하지 않는 백엔드 전용 설계에 해당한다.

기존 PWA는 새 버전을 적용한 후 서버 알림을 켜야 한다. 이전 워커가 푸시 프로토콜에 응답하지 않으면 서버 구독을 등록하지 않고 업데이트를 안내한다. iPhone/iPad는 홈 화면에 추가한 웹 앱에서 알림을 허용해야 한다. 운영 키·테스트 키·구독 원문은 저장소에 포함하지 않았다. 테스트 서버와 전용 컨테이너는 정지했고 재현용 데이터는 보존했다.
