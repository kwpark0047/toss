# RC staging·업체 대사·운영 복구 검증 절차

## 환경과 안전 경계

운영 결제·환불·DB migration·키 교체·요금 변경을 실행하지 않는다. 실제 PG 검증은 별도 Toss **테스트 가맹점/테스트 키**와 staging DB에서 수행한다. 운영 URL 두 개(wemarket.onrender.com, wemarket-saas.vercel.app)를 staging 대신 사용하지 않는다. 비밀키는 관리자/환경변수 저장소에만 등록한다.

필요 입력: staging backend/frontend URL, 전용 DB, Toss test client/secret 및 실제 webhook 계약·서명 설정, 별도 tenant 두 개와 테스트 사업자/고객 계정, 실제 연동 업체·공식 문서·테스트 계정, 운영 backup/PITR 읽기 접근 및 격리 복구 대상. 제공되지 않은 값은 추정하거나 샘플 성공으로 대체하지 않는다.

## 1. 동일 RC 배포 준비

1. RELEASE_SEQUENCE_STATUS_2026-10-09.md의 고정 소스 manifest 및 Git commit을 사용한다.
2. 기존 DB journal·두 역사 SQL checksum 변경을 대조한다. snapshot/복구 확인 후 승인된 migration 계획을 staging에서 검증한다. 기존 실패 history를 무조건 resolve하지 않는다.
3. 신규 durable refunds, customer identity/compensation, auth sessions, webhook inbox가 있어야 한다. schema를 먼저 적용하고 API를 배포한다. 기존 sid 없는 token은 재로그인 대상이다.
4. backend health의 revision이 RC 전체 SHA와 같고 readiness가 DB connected인지 확인한다. frontend도 같은 소스 SHA의 artifact인지 확인한다.
5. 자동 청구/자동 취소 worker는 먼저 비활성 상태로 배포한다. 테스트 키·실제 provider 확인 후 테스트 환경에서만 단계별 활성화한다.

## 2. Toss sandbox + 실제 PostgreSQL + 브라우저 E2E

QR→메뉴→주문→Toss 테스트 승인→주문 상태→원장→부분 2,000→추가 부분 3,000→잔액 취소 5,000을 원액 10,000 예제로 대조한다. 화면 receipt만으로 승인 성공을 판단하지 않는다.

- PG 순액 = 로컬 결제 잔액 = 원장 순액; tenant B는 tenant A의 주문/결제/고객 데이터 접근 불가.
- 같은 주문/환불 operation/webhook 동시·반복 실행의 금전 효과는 한 번만 발생해야 한다.
- PG 성공 직후 DB write 실패, 재고 보상 실패, worker SIGTERM 및 강제 종료 후 재개를 확인한다.
- 이벤트 역전·지연·외부 취소는 manual_review에 들어갈 수 있다. 대사하지 않은 이벤트를 처리 완료/과금 혜택 지급으로 승격하지 않는다.
- 신규 구독→첫 청구→갱신→실패→재시도→해지·기간 종료, 월말/KST·해지 경합 및 혜택 일치를 검증한다.
- invoice manual_review는 PG 공식 증거(order ID/amount/status/승인·취소 내역)와 로컬 원장을 대조한다. 결제 key 없는 불확실한 건에 신규 청구를 실행하여 해결하지 않는다.
- 사업자 승인 전 AI 외부 실행 0, 부족한 데이터는 판단 보류, 근거 기간 추적, AI/외부 provider 장애 중 주문·결제 유지.

증거는 각 실행의 RC SHA, 환경, 명령, PG sandbox 표시, test tenant, event/operation 상관 ID, 금액·잔액·row count, 장애 주입·재개 결과, 브라우저 trace로 기록한다. 토큰·키·전화번호·실사용자 payload는 저장하지 않는다.

## 3. 실제 업체 1곳 reference 대사

공식 provider adapter와 테스트 계정을 지정한다. 전체 pagination, 동일 기간 incremental cursor, timeout/429/retry/401 재인증, menu mapping/미매핑 보류, 중복/환불/원주문 매핑, 수동 재수집을 실행한다. 업체 원액−취소 = canonical 매출을 검증하며 native 주문과 중복 계상하지 않는다.

AI 응답에 provider·분석 기간·sync job·표본을 남긴다. 현재 canonical `used_for_revenue=false`는 안전 격리 상태이며 실제 외부 매출 분석 완료가 아니다. 대사·중복 제거 검증 후 별도 구현 리뷰 없이 이 flag만 켜지 않는다.

## 4. 운영 복구 검증

운영 원본은 수정하지 않고 승인된 backup/PITR 사본을 격리 환경에 복구한다. DB만 아니라 암호화 키·private proof 파일·migration journal·durable jobs를 함께 검증한다. 테스트 사본에서 운영 SMS/메일/PG/외부 실행과 금융 worker는 차단한다.

건수·tenant 격리·원장 합계·PG 증거·pending 보상·권한·키 복호화·파일 접근을 대조하고 RPO/RTO를 기록한다. API/worker writer 중지 후 호환된 artifact로 rollback을 연습한다. 신규 금융 작업이 있는 DB에 과거 durable compensation 미지원 코드를 무조건 rollback하거나 테이블을 drop하지 않는다.

## 최종 종료 조건

RC 소스 고정 + 실패 없는 CI + 동일 SHA staging PG/브라우저/실DB 시험 + 실제 provider 대사 + 개인정보/감사/SLO·alert + backup/PITR 및 호환 rollback 증거가 모두 있어야 상용 판정을 재평가한다. 미확보 항목은 미검증으로 유지한다.
