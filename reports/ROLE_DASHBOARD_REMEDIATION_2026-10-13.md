# 사업자·매니저·주방 대시보드 수정 및 검증

## 상태와 범위

기준 HEAD: `9aec28e67b1e61695e3e56c16194878c158bf5ba`. 변경은 미커밋 작업 트리이며 기존 변경을 보존했다. 운영 배포 및 운영 DB 변경은 수행하지 않았다. 코드 검증, 격리 PostgreSQL 검증, 로컬 브라우저 검증을 분리한다. 모든 계정의 모든 기능을 검증 완료했다고 판단하지 않는다.

## 실제 수정

| 문제 | 원인·수정 | 주요 파일 |
|---|---|---|
| 매니저 접근 거부·잘못된 메뉴 | 글로벌 staff와 매장별 manager 역할 혼동. 인증된 내 매장 API로 배정을 확인하고 역할별 진입·메뉴 분리 | ManagerView.jsx, MasterDashboard.jsx, AdminLayout.jsx, adminMenuAccess.js |
| 주방 API 인증 누락 | 상대 URL fetch 대신 공통 인증 API 사용, 실패·재시도 표시 | KitchenDisplay.jsx |
| 주문 확인 후 KDS에서 사라짐 | confirmed 상태 누락 보완 및 조리 상태 전이 허용 | KdsService.js, orderStatus.js |
| 재인쇄가 주문 상태를 변경 | 상태 변경 fallback 제거, 실제 프린터 미연결 오류를 인라인 표시. 브라우저를 멈추던 alert 제거 | KitchenDisplay.jsx |
| 반복 조리 요청에 중복 작업 | 상태 CAS·트랜잭션 및 동일 상태 재시도 처리. 공유 재고 처리 경로 사용 | KdsService.js |
| 주방 개인정보·금융 접근 | 최소 KDS DTO, 연락처 등록 여부만 제공. 공통 권한표로 수납/환불 분리, 일반 주문 상세 조회 제한 | storeAuth.js, paymentController.js, kdsController.js, routes/orders.js |
| KDS 취소가 금융·재고 경로 우회 | cancelled 직접 변경 409, 기존 관리자 취소 경로 사용 | kdsController.js |
| 매장 정보가 빈 객체 | async cache.get Promise를 await하지 않던 근본 원인 수정 | routes/stores.js |
| 미수금도 매출로 표시 | 주문 금액 합계 대신 해당 기간 원장의 수입−환불로 통계 계산, 실패 시 오류 전파 | repositories/Order.js |
| 비활성 직원의 매장 표시 | 내 매장 조회에 is_active 조건 적용 | repositories/Store.js |
| 한국 자정 주문번호 날짜 오류 | 신규 번호에 KST 날짜 사용, 기존 번호 보존 | repositories/Order.js |

역할 API 변경 영향은 `ROLE_API_CHANGE_IMPACT_2026-10-13.md`에 기록했다. 외부 KDS 클라이언트는 최소 DTO 및 취소 제한에 대응해야 한다.

## 계정별 실제 확인

사업자: 합성 계정 로그인, 홈·메뉴 관리·메뉴판 빌더·정산 화면 렌더링 확인. 메뉴 CRUD·실제 정산 전체를 실행한 것은 아니다.

매니저: 글로벌 staff의 매장별 manager 배정으로 로그인·진입, 매장명과 미수금 매출 0 표시, 주문 확인 실행, 일정/매출 링크 확인.

주방: 로그인 및 주방 전용 메뉴 확인. 주문 2542를 조리 시작 → 조리 완료(CALL) → 음식 수령 완료로 실제 브라우저 전환. 프린터 미연결 오류를 인라인 처리하도록 변경. 실제 프린터 출력은 미검증.

## 실DB 증거

전용 Docker PostgreSQL: `127.0.0.1:55438/wemarket_test_staging_20261010`. 운영과 분리된 합성 데이터만 사용했다.

- `node --import tsx reports/verify-role-pipeline-postgres.cjs`: 매장 8 / 주문 2543, 실제 배정·다른 매장 차단·confirmed 조회·조리 완료·재고/인쇄 1회·미수금 유지 통과. 통제된 스크립트 PG 호출 0.
- `node --import tsx reports/verify-inactive-membership-postgres.cjs`: 비활성 매장 배정 제외 검증.
- `node --import tsx reports/verify-role-browser-final.cjs`: 브라우저 주문 2542 / 매장 6, completed·payment pending·결제 레코드 READY·원장 0건·인쇄 작업 1건·재고 이벤트 1건·잔여 재고 3 통과. `role-browser-final-20261013.json` 참조.

수령 완료와 수금 완료는 분리되어 있으며 이번 테스트는 실제 수금하지 않았다.

## 테스트 실행

- Backend: `node scripts/run-jest.cjs --config jest.config.js tests/unit tests/routes --runInBand`: 최종 170 suites / 1348 tests 통과 (`role-full-backend-release-final-20261013.log`).
- SaaS: `node --test tests/saas/*.test.cjs`: 74 통과, skip 0 (`role-saas-final-20261013.log`).
- Frontend 최종 순차 실행 결과는 아래 최종 게이트에 기록한다.
- JSX 참조 검증: 305파일 미정의 참조 없음 (`role-jsx-reference-validation.log`).

실패도 보존: 제한 환경 backend는 localhost EACCES로 실패/중단했다. 연결 허용 환경 첫 실행은 구 권한 middleware 기대 테스트 2건 실패(1346 통과). 새 읽기 권한 및 구 경로 미호출을 검증하도록 수정한 후 전체 1348 통과. Frontend 병렬 실행은 모듈 로딩 timeout이 발생했고 중단했다. timeout을 늘리거나 테스트를 skip하지 않고 순차 재실행했다.

## 남은 검증·위험

- 운영은 여전히 별도 이전 SHA이며 이번 코드 반영·브라우저 검증은 미완료. 로컬 실행 서버 일부 후속 수정은 재기동 반영 전이나 CLI 테스트는 최신 소스를 검증한다.
- 실제 PG sandbox/운영 결제, 실제 수납, 물리 프린터, SMS 발송, 외부 업체 연동 및 복구 검증은 이번 계정 테스트로 인증하지 않는다. SMS 발송 보류 유지.
- DetailedStats·다중 매장 분석 등의 모든 매출 계산 경로를 원장 기준으로 통일한 것은 아니다. 별도 검증 필요.
- 메뉴 CRUD, 직원 일정 CRUD, AI 추천 승인/실행, 리뷰 및 외부 데이터의 계정별 전체 E2E는 미완료.
- 운영 원장 불일치 기존 18건은 PG 근거 확인 전 보정하지 않는다. 운영 webhook 인증 설정 누락도 별도 출시 위험이다.
- 역할 수정 자체의 신규 DB migration은 없다. 앞선 SMS 설정 기능은 별도 migration 운영 미적용 상태다.

## 최종 게이트

Frontend: `npm test -- --run --maxWorkers=1` 전체 36 files / 156 tests 통과, 113.68초 (`role-full-frontend-release-sequential-20261013.log`). 실행 중 출력이 지연됐으나 최종 로그와 종료 결과로 통과 확인했다. 추가 `npx vitest run src/test/role-dashboard-runtime.test.jsx src/test/admin-menu-roles.test.js --pool=threads --maxWorkers=1` 2 files / 12 tests 통과 (`role-ui-final-targeted-20261013.log`). 이번 코드·로컬 테스트 통과는 운영 검증 완료를 의미하지 않는다.
