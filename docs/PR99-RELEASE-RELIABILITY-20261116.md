# PR #99 운영 안정성 수정·배포 검증

2026-11-16 KST. 기준 main c1c2963e를 통합한 `fix/release-reliability-20261109`.

## 수정

- 정기 통합·Playwright 검사에 DIRECT_URL 및 격리 DB 초기화 단계를 맞추고 테스트 실패를 숨기지 않는다.
- 권한 검사에서 params/query/body의 매장 ID 충돌을 거부하고 AI 작업은 검증된 매장 ID를 사용한다.
- 주문 채널 설정 조회 오류를 기본 공개 설정으로 바꾸지 않는다. 공개 목록·커뮤니티·법적 고지의 주소 숨김에도 적용한다.
- 배차 요청은 주문 잠금 아래 선점한 기록을 커밋한 후 대행사를 호출한다. 결과 미확정 요청은 자동 재전송하거나 직접 배달로 전환하지 않는다.
- 웹훅 상태·주문 상태·중복 기록을 함께 커밋한다. 완료 상태와 이전 배차의 늦은 이벤트를 차단한다.
- 재고·포인트 후속 처리는 상태를 다시 쓰지 않고 재시도한다. 별도 포인트 처리 이력과 lease를 사용하며 서버 시작·주기적 worker로 재개한다.
- 배포 smoke 검사는 연결뿐 아니라 주문·배차·청구서의 필수 스키마도 확인한다.
- Render 실제 buildCommand를 `npm ci --include=dev && node scripts/deploy-migrations.cjs --check && npx prisma generate`로 맞췄다. 자동 배포 OFF는 유지한다.

## 검증 근거

- 최신 main 통합 로컬 백엔드: 220 suites / 1772 tests 통과.
- 최신 main 통합 로컬 프론트: 97 files / 434 tests 통과. 프로덕션 빌드 성공.
- 실제 격리 PostgreSQL 배차: 10 tests 통과. 동시 요청 1회 호출, 미확정 결과 재전송 차단, DB 실패 롤백·동일 이벤트 재시도, 중복·역순·과거 배차 이벤트 차단, 재시작 후 추가 웹훅 없이 후속 효과 복구.
- 정기 Playwright workflow run 43801765541 성공.
- 정기 통합 workflow run 43802597062 성공 (116 passed, 배차 실DB 검사는 별도 job).
- PR CI는 최종 head 기준 GitHub checks에서 확인하며, 이미지 검사·머지·운영 배포 결과는 PR과 실행 이력으로 추적한다.

## 운영 DB

사용자가 3건 모두 운영 적용을 명시 승인한 뒤 SQL과 Prisma 이력을 적용·대조했다.

| 마이그레이션 | 2026-11-16 적용 확인 |
| --- | --- |
| 20261021010000_business_support_messages | 메시지 테이블·접근 제한·journal 확인 |
| 20261104020000_store_order_pace | 바쁨 모드 설정 테이블·journal 확인 |
| 20261109010000_delivery_dispatch_claim | 요청 상태 1컬럼, 웹훅 효과 5컬럼, delivery_order_effects·journal 확인 |

기존 행 삭제나 매장 기능 활성화는 하지 않았다. 실제 바로고·부릉·생각대로 호출은 제휴 API 미연동 상태다. AI·유료 호출 게이트도 이번 릴리스에서 활성화하지 않는다.

## 배포 확인 기준

PR #99의 최종 CI·보안·이미지 검사를 확인한 후 merge한다. 이번 승인된 배포를 위해 GitHub `ENABLE_PRODUCTION_DEPLOY`를 일시적으로 켜고 완료 후 원래 false로 복구한다. Render health revision과 Vercel production HTML의 app-commit이 merge SHA인지, deep schema·검색·공개 설정이 정상인지 확인한다. 운영에서 실제 결제·문자·배차를 생성하지 않는다.

이미지 검사 보강: SARIF 모드에서도 기존 HIGH/CRITICAL 차단 기준을 적용하도록 `limit-severities-for-sarif`를 명시했다. zlib 및 XML parser·glob·minimatch 보안 업데이트를 적용했고, 별도 clean install에서 Swagger 330개 경로 생성·ZIP 내용·파일 패턴·레거시 rimraf API·XML 파싱 7항목을 통과했다. 이 호환성 스크립트도 매 PR CI에서 실행한다.

## 배포 전 후속 보완

추가 독립 검토에서 복구 스캔이 매번 오래된 50개 실패 주문부터 시작하면 이후 주문이 계속 밀릴 수 있음을 확인했다. PR #99 머지 후 배포 실행을 취소하고, 이벤트 ID 커서를 유지하며 끝에서 다시 순회하도록 보완했다. 추가 마이그레이션은 없다. 실제 PostgreSQL에서 batch limit=1·첫 주문 지속 실패·두 번째 주문 성공·끝에서 실패 주문 재시도를 확인했으며 배차 DB 검사는 총 11건 통과했다. 이 후속 PR까지 최종 검사·머지한 리비전을 배포한다.
