# OTP Prisma void 반환 오류 수정

## 원인 및 수정

`RegistrationOtpService.lock()`이 `SELECT pg_advisory_xact_lock(...)`의 void 열을 `$queryRawUnsafe()`로 반환해 Prisma 역직렬화가 실패했다. 기존 격리 PostgreSQL 테스트의 pg adapter는 void를 허용하므로 이 호환성 문제를 검출하지 못했다.

쿼리를 `SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext($1))) AS lock_result`로 바꿨다. 바인딩 파라미터·잠금 키·트랜잭션 범위는 유지하고 반환형만 정수로 제한한다. 잠금 제거·오류 무시·인증 우회는 하지 않는다. DB migration과 키 변경은 필요 없다.

## 재현 및 검증

- `node scripts/test-signup-prisma-lock.cjs`: 수정 전 실제 Prisma + 격리 PostgreSQL에서 사용자와 동일한 void 역직렬화 오류 재현 (`signup-prisma-lock-red.log`).
- 같은 명령 수정 후 통과. 실제 두 Prisma 세션의 동시 잠금 차단, commit 후 해제, rollback 후 해제 확인. 테이블 행 변경·SMS 0건.
- `node scripts/test-registration-otp-postgres.cjs`: 실제 PostgreSQL OTP 해시·증명 결합·변조 거부·rollback·동시 가입 1회·단일 사용 통과.
- `node --test tests/saas/registration-otp.test.cjs tests/saas/registration-otp-security.test.cjs`: 5/5 통과, skip 0.
- 다른 서비스의 advisory lock 검색: AdminPointAdjustment는 이미 정수 반환, StoreIntegrationService는 text cast 사용. 동일 void 직접 반환 문제는 검색 범위에서 추가 발견되지 않았다.

## 반영 상태

로컬 코드·실제 Prisma/DB 회귀 완료. 운영 배포 SHA와 확인 결과는 배포 후 기록한다. 실제 SMS 수신·신규 회원 가입 전 과정은 별도 미검증이며 이번 테스트를 그 증거로 대체하지 않는다.
