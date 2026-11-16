# 바로고 공개 API 구현·오프라인 검증

확인일: 2026-11-16. 계정 발급 전 개발이며 운영 배차는 비활성이다.

## 구현

- `barogoClient.js`: 공식 staging 도메인의 Bearer 인증 접수·조회·취소. 10초 제한, 리디렉션 차단, 자동 재시도 없음. 업체 오류 원문·키·고객정보를 오류로 전달하지 않는다.
- `barogoOrder.js`: 별도 저장한 도로명/상세주소, 서버 상품합계+배달팁, 할인 후 주문액과 DONE 결제 합계, 암호화 전화번호 복호화를 연결한다. paid 표시만으로 접수하지 않는다. 선결제만 지원한다.
- `barogoAdapter.js`: 의존성 주입 전용 staging 어댑터. claim 전에 필수값을 검증한다. 운영 기본 레지스트리에는 등록하지 않는다.
- 주문 화면/API/저장소: 도로명·상세주소를 분리 저장하고 기존 화면용 통합 주소를 유지한다. 고객이 보낸 배달비는 서버 견적으로 대체한다. 레거시 통합 주소를 추측해서 분리하지 않는다.
- 콜백: 기존 경로와 `/delivery-webhooks/:provider/:storeId/delivery/status`, `/delivery-webhooks/:provider/:storeId/order/status`를 지원한다. HTTP 성공 응답은 기존 200 응답을 유지한다.
- 인증: 테스트 등록 계약에서 명시한 헤더 이름·값을 상수시간 비교하고 제휴사·매장·경로 종류를 검사한다. 실제 업체의 인증 전달 방식은 계정 발급 시 확인해야 한다. 테스트 대행사의 HMAC을 바로고 서명으로 가정하지 않는다.
- 재배차: `ALLOCATION_CANCELED`는 주문 취소가 아닌 재배차 대기다. 픽업 전에만 배차→요청으로 전환하고 이전 기사 정보를 지운다. `changedAt`을 DB에 저장하여 지연·역순 이벤트를 무시한다. 픽업 이후와 종료 상태는 되돌리지 않는다. 같은 단계의 기사 변경도 저장·알린다.
- 응답 전 콜백: claim의 안정적인 `delivery-dispatch:<ID>`를 외부 주문번호로 미리 저장한다. 콜백 반영 후 도착한 접수 응답이 상태를 덮어쓰지 않는다.

## 운영 비활성 경계

기본 `adapters.js`의 바로고는 계속 `ready:false`이다. 신규 활성화 환경변수는 없다. 일반 HTTP 요청으로 어댑터를 주입할 수 없다. 기본 서비스의 접수는 501, 콜백은 404로 차단하고 취소도 준비 상태를 검사한다. 부릉·생각대로 역시 비활성이다.

실제 업체 호출·운영 DB 변경·실배차·비용 발생은 수행하지 않았다. 테스트 전송기는 로컬 가짜 응답만 사용한다. 계정 가입·제휴 신청도 수행하지 않았다.

## 추가 마이그레이션

`20261116010000_barogo_order_details`는 기존 데이터 삭제 없이 nullable 열 세 개만 추가한다.

- `orders.delivery_road_address`, `orders.delivery_address_detail`: varchar(100)
- `delivery_dispatches.provider_changed_at`: bigint

운영에는 미적용이다. **향후 머지·배포 전에 별도 승인하에 적용하고 Prisma 이력을 확인해야 한다.** 기존 read-only 마이그레이션 게이트는 미적용 배포를 차단한다. 이번 작업은 PR까지이며 머지·배포하지 않는다.

## 검증

- 신규 클라이언트·주소/결제 변환·어댑터 및 기존 주문·라우트 단위 회귀 검사.
- 격리된 실제 PostgreSQL에서 추가 SQL 적용, 주문·결제 조회→요청 구성→인증 콜백→상태 반영, 중복·역순·재배차·조기 콜백과 잘못된 요청의 무접수 검증.
- 고객 주문 화면 테스트·프런트 빌드, ESLint와 변경 형식 검사.

```powershell
node scripts/run-jest.cjs --config jest.config.js tests/unit tests/routes --runInBand --silent --modulePathIgnorePatterns '<rootDir>/.tmp/'
# localhost의 wemarket_dispatch_test만 생성·초기화한다.
$env:DISPATCH_TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:55434/postgres'
node scripts/run-delivery-dispatch-postgres.cjs
npm --prefix frontend test
npm --prefix frontend run build
```

## 계정 발급 후 남는 검증

1. 제휴사 ID·시험 매장 매핑·키와 콜백 등록 규격을 확인한다. 일반 인증정보 UI의 기존 api_key/api_secret 자리표시자만으로 활성화되지 않는다.
2. 공식 샌드박스에서 접수→배차→픽업→완료·취소와 응답 유실 시 결과 조회를 검수한다. 미확정 요청은 자동 재접수하지 않는다.
3. 옵션 상품·예약·주류·자율 수행·현장 수금은 현재 주문 매퍼에서 거절한다. 업체별 요금·부가세·취소비와 추가 콜백도 검수 후 확장한다.
4. 계약·검수와 승인된 스키마 적용을 확인한 뒤 별도 변경으로 운영 활성화한다.

공식 근거: [인증 가이드](https://developer.gorelas.com/guide), [접수·조회·취소](https://developer.gorelas.com/api-doc/request), [상태 콜백](https://developer.gorelas.com/api-doc/callback).