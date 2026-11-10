# 2차 고도화 운영 배포 결과

- PR: https://github.com/kwpark0047/toss/pull/72 (merged)
- 최종 운영 커밋: 53186816f372d7d627d44264e6d4b20e77c75820
- PR CI/E2E: https://github.com/kwpark0047/toss/actions/runs/42858904280 (success)
- main CI/E2E/운영 배포: https://github.com/kwpark0047/toss/actions/runs/42860033343 (success)
- Render: dep-dbpkt3d9fdbs73f6vgbg (live)
- Vercel: dpl_315nEWhsA3qMnH9c4BXZvkPc41qS (READY, production alias)
- 공개 API health/deep health HTTP 200, DB connected. API revision과 frontend app-commit 일치.
- 운영 390px 공개 화면 HTTP 200, 가로 넘침 없음, JS pageerror 없음, 고객 주문 조회 요청 0건.
- 운영 모바일 추가 점검의 초기 요청은 대기 제한에 걸렸으나 재실행에서 실제 화면 렌더링과 리비전을 확인했다.
- 상세 운영 측정값: release.json. 운영 화면: production-mobile-390.png.

실제 주문 흐름은 격리 QA에서 검증했다. 합성 주문 5, 접수 확인 184ms / 조리 중 141ms / 준비 완료 170ms, 실제 소켓 신호 4건. 320/390/430px, 오프라인 복구, 실제 SW 알림 1건, 중복 억제 및 확인 상태 유지 통과. 카드 청구 0건, 실제 고객 정보 사용 없음. 상세는 results.json 및 README.md 참조.

브라우저 알림은 페이지가 열려 있을 때 제공한다. 닫힌 앱의 서버 푸시와 숨김 탭 수신은 검증 완료 범위에 포함하지 않는다. 테스트 서버/전용 컨테이너는 정지했고 데이터 볼륨은 보존했다.
