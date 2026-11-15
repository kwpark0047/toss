# PR #48 주문·결제 route 테스트 분리

기준: main `d640e15dee1ddad470ca63f886fffad9bd523bb2`. PR #48의 `e803bfb1` 테스트를 최신 라우터에 맞춰 이식하고 미검증 경계를 보완했다. 운영 서비스 코드는 변경하지 않는다.

## HTTP route 검사

- 실제 Express 라우터·JWT·권한/capability/멱등 미들웨어를 사용한다. 세션 조회·Prisma 저장소와 controller는 mock이다. controller 내부 주문 처리/권한을 이 route 검사만으로 검증했다고 주장하지 않는다.
- 원본 orders mock에 현재 배차·배송 webhook·셀프 취소 핸들러가 없어 라우터 등록이 실패했다. 현재 핸들러를 보완했다.
- 매장 소유자·소속 manager/staff 허용, 비소속 사용자 거부, 현재 kitchen의 일반 `order:read` 거부 정책을 유지한다. kitchen 전용 KDS 권한을 넓히지 않는다.
- 주문 생성 입력, 주문 상세 capability와 다른 주문 토큰, 상태 변경 인증/권한/enum을 검사한다.
- 셀프 취소는 소유자 로그인만으로 capability를 대체할 수 없고 해당 주문 capability만 허용한다.
- 결제 준비·승인 capability, 현금 확인/부분 취소 인증·필수 멱등키, 포인트 지갑 소유권 경계를 검사한다.
- 완료된 멱등 응답 replay는 controller 재호출을 막는다. processing/uncertain은 409, 같은 키의 다른 body는 422, 저장소 장애·결과 저장 실패는 503이다. 주문 capability별·인증 사용자별 principal로 키가 분리되는지도 확인한다. 각 테스트의 mock 초기화 뒤 세션 조회 구현도 다시 주입해 인증 사용자 컨텍스트를 보존한다.

## 서비스 경합 검사

`customerCancelPaymentRace.test.js`는 실제 `OrderService.customerCancelOrder`, `PaymentService.processApproval`와 금액 검증, `PaymentCompensationService`의 자동 취소 로직을 사용한다. controller는 호출하지 않는다.

명시적 promise barrier로 가짜 PG 응답을 보류하고 동일한 메모리 주문·결제 상태에 두 작업을 실행한다. 동시 승인 사례는 두 요청 모두 PG에 도착했음을 확인한 뒤 응답을 해제한다. 시간 지연으로 순서를 추측하지 않는다.

`LedgerService.recordIncome` 호출을 메모리 수입 목록에 기록해 중복/누락을 확인하며 실제 원장을 쓰지 않는다. 고객 upsert·포인트 후처리·알림/이상 탐지 등 주변 효과는 mock이다.

| 순서/상황 | 확인 |
| --- | --- |
| CARD READY 승인 대기 중 셀프 취소 | 취소 409, 이후 승인 성공·결제 DONE·수입 1건 |
| CASH READY 취소가 승인 응답보다 먼저 완료 | 주문/결제 취소 유지, 실제 보상 로직이 가짜 PG 조회·취소 수행, 수입 0건 |
| STORE_CARD READY 취소 후 보상 PG 실패 | 승인 처리 409 유지, 수입 0건, autoCanceled=false 수동 확인 알림 |
| 승인이 먼저 완료된 후 셀프 취소·승인 재요청 | 취소 409, PG 재승인 없이 수입 1건 유지 |
| 같은 결제의 승인 두 건이 동시에 PG 대기 | 최종 DONE·수입 1건, 정상 선행 승인을 자동 취소하지 않음 |

**한계:** 메모리 트랜잭션은 순차 실행과 실패 rollback을 모사한다. PostgreSQL 실제 행 잠금·격리 수준·교착/다중 프로세스 경합을 증명하지 않는다. 보상 inbox의 영속 journal/lease는 가짜 executor를 사용하므로 복구 재실행 내구성도 별도 범위다. 실제 카드 청구나 PG exactly-once를 검증한 결과가 아니다. 보상 실패 때 가짜 PG에는 DONE이 남는 조건을 의도적으로 재현하며 수동 대사 알림을 확인한다.

## 검증

- 신규 route·경합 파일 3개: 46건 통과.
- 기존 tenant/capability/payment-role 검사 포함 집중 검사: 6 suites / 78 tests 통과.
- 최종 backend 단위·route·회귀 전체: 220 suites / 1,758 tests 통과 (`node scripts/run-jest.cjs --config jest.config.js tests/unit tests/routes tests/regression --roots tests --runInBand --coverage=false`).
- 변경 테스트 ESLint·Prettier 통과.
- `npm run ai:review:check`: 5/5 통과, 모든 AI·유료 호출·매장 활성화 OFF 전용 설정 유지.

## 경계

Supertest의 임시 loopback 서버와 합성 주문·계정을 사용한다. Prisma는 mock이고 PG는 가짜다. 서비스 경합 fixture는 외부 socket 연결을 차단한다. 실제 고객정보·카드 청구·운영 배포·DB 변경·유료 API 호출 없음. `ENABLE_PRODUCTION_DEPLOY=false`를 읽기 확인했으며 플래그·배포 설정·Prisma·Sentry 공유 wrapper를 변경하지 않았다.

원본 #48은 다른 잔여 작업이 있어 별도로 유지한다. 이 PR은 테스트·검증 문서만 포함하며 머지·운영 배포는 수행하지 않는다.
