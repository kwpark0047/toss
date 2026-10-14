# AI 사업자 지원센터 운영 반영

사용자 운영 반영 요청에 따라 기존 검증된 지원센터를 배포한다. 기존 운영 주문·결제·원장·키·매장 동의는 변경하지 않는다.

## DB

- 2026-10-14 17:41 KST: `20261014010000_business_support` 대상 migration만 운영 적용. checksum `b8c651844ade36817582e8279506d7501c8872a2c1c86cf2afcd3c98ee30e876`.
- 신규 enrollment/case/event/job 4개 테이블 RLS true, 공개 역할 권한 없음, 서버 조회 유지. migration journal 원자적 기록.
- bigserial 시퀀스의 공개 권한도 회수. 격리 실DB 회귀 재통과 후 적용.
- 기존 `20261014020000_private_registration_and_provider_tables` 운영 보안 적용도 완료. 별도 보고서 참조.

## 검증

- `node --test tests/saas/business-support.test.cjs tests/saas/store-manager.test.cjs tests/saas/registration-otp.test.cjs`: 9/9 통과, skip 0.
- `node scripts/test-business-support-postgres.cjs`: 격리 실제 PostgreSQL 통과. 소유자 동의·매장 격리·플랫폼 승인 차단·동시 실행 멱등·작업 복구·RLS 확인.
- 기존 전체 테스트 및 브라우저 증적: `AI_BUSINESS_SUPPORT_IMPLEMENTATION_2026-10-14.md` 참조.

## 배포 및 잔여 검증

코드 배포·운영 API·화면 상태는 배포 후 기록한다. 매장 소유자의 동의를 플랫폼이 대신 등록하지 않는다. worker는 우선 동의된 매장만 처리하는 제한된 단발 실행으로 확인한다. 별도 상시 스케줄러·신규 유료 서비스는 자동 생성하지 않는다.

복구: worker 중단 및 backend a35eccf / frontend 3535a46 정상 배포로 복구. 추가 테이블과 감사 기록은 유지하며 DROP·수금·환불을 수행하지 않는다.
