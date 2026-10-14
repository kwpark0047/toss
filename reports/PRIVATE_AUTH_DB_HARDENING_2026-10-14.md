# 운영 인증·공급자 테이블 공개 접근 차단안

## 확인한 사실

`reports/verify-registration-operating-schema.cjs`는 TLS CA 검증과 BEGIN READ ONLY로 운영 프로젝트의 테이블/컬럼/권한 메타데이터만 조회했다. 실제 전화번호·OTP·키·암호문·사용자 행은 조회하지 않았다.

- phone_otps: 존재, 필요한 컬럼 존재, RLS false.
- provider_credentials: 존재, RLS false.
- phone_otps에는 anon/authenticated의 SELECT·INSERT·UPDATE·DELETE 등 직접 grant가 존재.
- 이는 공개 Data API 역할의 접근 차단이 불충분한 상태다. 실제 유출·악용이 발생했다는 증거로 해석하지 않는다.

## 변경안과 영향

`prisma/migrations/20261014020000_private_registration_and_provider_tables/migration.sql`:

- 두 테이블의 RLS를 활성화한다.
- PUBLIC·anon·authenticated의 테이블 권한을 회수한다.
- 기존 사용자·OTP·공급자 설정 행, 암호화 키, 로그인 서명키는 수정하지 않는다.
- 서버 DB 역할은 유지한다. Express가 서버 역할로 수행하는 가입·공급자 설정 기능을 보존한다.
- 공개 Supabase Data API로 두 테이블을 직접 읽거나 쓰던 클라이언트는 차단된다. 이 저장소의 정상 기능은 Express API를 사용한다.

OTP 증명에는 원문 전화번호 대신 HMAC을 서명 payload에 결합해 challenge 행의 전화번호가 바뀌더라도 다른 번호 가입에 전용할 수 없도록 코드 방어도 추가했다. 이것은 DB 공개 권한 차단의 대체가 아니다.

## 테스트

`node scripts/test-private-auth-tables-postgres.cjs` 통과 (`private-auth-tables-postgres.log`). 격리 로컬 DB의 새 schema와 NOLOGIN 시험 역할에서 직접 SELECT/UPDATE 권한이 있어도 RLS가 행 접근을 차단하고, 서버 owner 역할은 기존 행을 읽을 수 있음을 확인했다. schema/시험 역할은 테스트 종료 후 제거했다.

## 운영 절차 및 완료 조건

1. 별도 운영 승인 후, 현재 테이블 ACL·RLS와 적용 대상 checksum을 기록한다.
2. 해당 SQL만 적용하고 동일 파일 checksum으로 Prisma migration journal을 기록한다. AI 지원센터 신규 schema는 이 승인에 포함되지 않는다.
3. 읽기 전용 재확인: 두 테이블 RLS true, public 역할의 유효 table privileges 없음, 서버 역할 조회 가능.
4. `/api/health` DB connected 확인과 빈 입력 OTP 요청의 400 검증 응답을 확인한다. 실제 SMS는 보류를 유지한다.

권한 회수를 되돌려 공개 읽기·쓰기를 다시 허용하는 rollback을 기본 복구로 사용하지 않는다. 서버 역할이 잘못 지정된 경우 먼저 해당 서버 연결 역할을 확인하고 정상 서버 전용 접근을 복구한다. 비밀키/계정/운영 데이터 일괄 변경은 별도 승인이다.

현재 상태: 운영 적용 승인 요청 중, 미적용. 이 P0를 해결 완료로 보고하지 않는다.
