# 무료 인증 운영 DB 적용 및 staging 검증

사용자의 인증 마이그레이션 적용 지시에 따라 `20261014030000_free_authentication` 하나만 적용했다. 다른 pending migration을 일괄 실행하지 않았다. 새 코드의 공개 푸시·운영 배포 및 실제 외부 인증은 실행하지 않았다.

## 운영 DB 결과

- 대상: 기존 Supabase 프로젝트 `yreoeqmcebnosmtlyump`.
- SHA256: `f25991e59b5043d016b8672af862fb146ac679c5b010ba32e2044556439758e0`.
- 적용 전 lower(email) 중복 그룹: 0.
- 사용자 수: 적용 전 15 / 적용 후 15.
- 추가: 사용자 인증 컬럼 3개, 인증 테이블 6개, 이메일 casefold unique index.
- RLS: 신규 6개 테이블 모두 활성화.
- PUBLIC·anon·authenticated 공개 테이블 권한: 0.
- 실제 anon/authenticated 역할 조회 검사: 12개 모두 PostgreSQL `42501` 접근 거부.
- DDL 및 `_prisma_migrations` checksum 이력을 같은 트랜잭션에서 기록했다. 별도 읽기 전용 연결로 이력·스키마를 재확인했다.
- 사용자·주문·결제 값 및 기존 JWT/암호화 키는 변경하지 않았다. 기존 사용자에 새 인증 상태 기본값만 추가했다.

증거: `free-auth-production-preflight.json`, `free-auth-production-migration.json`, `free-auth-production-postverify.json`.

## 격리 staging 검증

- 대상: `127.0.0.1:55438/wemarket_test_staging_20261010`.
- 같은 migration 적용 및 Prisma 실DB 일회성·동시성·계정 수명주기 회귀 통과.
- 로컬 앱: frontend `http://127.0.0.1:5174`, backend `http://127.0.0.1:5300`.
- health 200 / `/api/auth/free/config` 200, enabled=false.
- 사업자·매니저·주방 기존 테스트 계정 각각 로그인 200 → `/auth/me` 200 → 로그아웃 200 → 같은 access token 조회 401.
- 회원가입 브라우저: 무료 인증 준비 중 안내와 기존 휴대전화 가입 경로를 확인했다.
- 실제 이메일·SMS·PG 호출 0. 이는 외부 OAuth·SMTP·Turnstile 성공 검증이 아니다.

증거: `free-auth-staging-migration.json`, `free-auth-staging-runtime-verification.json`, `free-auth-postgres-final.log`.

## 외부 설정 확인 및 남은 조건

실제 Render `wemarket` (`srv-db0aoa7avr4c73esalbg`)의 Environment 화면을 조회했다. Google OAuth Client ID/Secret, Kakao REST/Client Secret, SMTP host/user/password/발신주소, Turnstile site/secret, EMAIL_AUTH_PEPPER 등록이 확인되지 않았다. 연결된 환경 그룹도 없었다. 로컬 파일에도 전체 연결에 필요한 값이 없으며 `.env`에 Kakao REST key만 존재한다. 그 값의 유효성·앱 소유권은 검증하지 않았다.

확인된 운영 backend origin: `https://wemarket-eiw4.onrender.com`.

개발자 콘솔 callback 등록값:

```text
https://wemarket-eiw4.onrender.com/api/auth/free/oauth/google/callback
https://wemarket-eiw4.onrender.com/api/auth/free/oauth/kakao/callback
```

실제 staging OAuth 검증에는 외부 공급자가 허용하는 전용 staging callback URL과 해당 설정이 별도로 필요하다. 운영 callback과 staging을 혼용하지 않는다. 현재 localhost 테스트는 기존 인증 호환성 검증 범위다.

비밀값은 Render/비밀 저장소에 직접 등록하고 Git·채팅·프론트 변수에 넣지 않는다. 도메인/변수 안내는 `FREE_AUTH_DOMAIN_CONFIGURATION_2026-10-14.md` 참조. 기존 발신 도메인·Google/Kakao 앱 정보가 없으므로 앱·발신주소를 임의 생성하거나 실제 인증 성공으로 기록하지 않았다.

현재 운영 Render 코드는 이전 `a52d326495b4eb7d0f6e88ba430bf7b8ce96adf1`이며 새 무료 인증 API는 아직 배포하지 않았다. 마이그레이션 완료와 새 기능 활성화를 혼동하면 안 된다. feature flag를 먼저 켜지 않는다.

## 복구 및 상태

운영 schema는 additive 변경으로 유지한다. 장애 시 이전 정상 코드로 복구하고 새 테이블/컬럼을 임의 삭제하지 않는다. 환경/공급자 설정, 실제 staging OAuth·메일·Turnstile E2E, 코드 버전 고정과 배포 검증은 남아 있다.

판정: **운영 인증 schema 적용·검증 완료 / 기존 인증 staging 회귀 완료 / 실제 외부 인증·신규 코드 운영 반영 미완료**.
