# 무료 인증 구현 및 검증 보고서

후속 상태: 사용자의 추가 승인으로 인증 migration을 운영·격리 staging에 적용하고 기존 인증 회귀를 확인했다. 아래는 구현 당시 기록이며, 최신 DB 적용 증거와 외부 설정 미완료 상태는 `FREE_AUTH_OPERATING_MIGRATION_2026-10-14.md`를 우선 참조한다. 새 코드 운영 배포는 여전히 미실행이다.

기준 HEAD: `cac2afa328747869b5f26b341634e824a643acf3`. 아래 구현은 로컬 작업 트리이며 커밋·공개 푸시·운영 배포하지 않았다. 기존 수정 보고서와 다른 작업 파일을 보존했다.

## 구현 범위와 구조

Supabase는 DB·Storage 용도로 사용하며 Supabase Auth로 기존 사용자를 이동하지 않았다. Express/Prisma users·social_accounts·auth_sessions를 유지하고 공통 세션 발급·폐기에 연결했다. 기존 비밀번호·휴대전화 가입 기능을 제거하지 않았다. 이메일 인증은 휴대전화 소유권·법적 본인확인이 아니므로 해당 기능을 대체하지 않는다.

- Google/Kakao: 서버 authorization code 교환, issuer/audience/서명/nonce/state 검증. Google PKCE, 브라우저 결합, 일회성 callback 결과, 기존 MFA 적용. 외부 토큰이나 로그인 JWT를 callback URL에 넣지 않는다.
- 이메일: SMTP, 인증 링크 10분·6자리 코드 5분, 공통 일회성 소비, 5회 실패 제한, 주소별 60초 재발송 제한, 주소/IP/일일 발송 예산. 발송 수락과 실제 도착을 구분한다.
- Turnstile: 서버 Siteverify의 hostname/action 검증, timeout 시 차단. 클라이언트 로딩 실패 시 명시적 재시도.
- 기존 주소 충돌: 이메일 문자열만으로 기존 계정을 자동 병합하지 않는다. 기존 로그인 후 최근 인증을 통해 명시적으로 연결한다.
- 계정 변경: 최근 인증 5분·세션 결합·일회성 소비, 마지막 인증 수단 해제 금지, 탈퇴 시 전체 세션 폐기. 매장 소유자는 이전·구독 정리 전 탈퇴 금지. 사용자 행·금융 기록은 삭제하지 않는다.
- 재해 복구: SMTP 요청 결과가 불확실하면 uncertain으로 남기며 자동 재발송하지 않는다. maintenance는 오래된 sending을 uncertain으로 바꾸고 만료 인증 자료만 보존기간에 따라 정리한다.

## 주요 파일

| 영역 | 파일 |
|---|---|
| 정책·비밀·MFA | utils/freeAuthPolicy.js, utils/freeAuthSecrets.js, utils/totp.js |
| 이메일 | services/AuthMailService.js, services/EmailAuthService.js |
| OAuth | services/OAuthProvider.js, services/OAuthLoginService.js, services/LegacySocialVerifier.js |
| 계정·세션 | services/AuthIdentityService.js, services/AccountLifecycleService.js, services/AuthSessionService.js, services/FreeAuthStore.js |
| API·로그 보호 | routes/freeAuth.js, middleware/redactAuthCallback.js, app.mts |
| 기존 인증 호환 | controllers/authController.js, controllers/socialAuthController.js, controllers/admin2faController.js, services/TwoFactorService.js |
| 화면 | frontend/src/components/FreeAuthOptions.jsx, TurnstileChallenge.jsx, Login.jsx, Register.jsx; frontend/src/pages/FreeAuthCallback.jsx, AccountSecurityPage.jsx |
| 클라이언트 세션 | frontend/src/api/freeAuth.js, auth.js, client.js; frontend/src/contexts/AuthContext.jsx |
| DB | prisma/schema.prisma, prisma/migrations/20261014030000_free_authentication/migration.sql |
| 유지관리 | scripts/maintain-free-auth.cjs |

## 검증 증거

| 실행 | 결과와 범위 |
|---|---|
| `node scripts/run-jest.cjs --config jest.config.js tests/unit tests/routes --runInBand --no-cache` | 177 suites / 1357 tests 통과. 최종 로그: free-auth-backend-full-final.log |
| `npm run test:saas` | 92 tests 통과, skip 0. free-auth-saas-final.log |
| `npm --prefix frontend test` | 49 files / 201 tests 통과. free-auth-frontend-full-final.log. 이후 추가한 복구 테스트는 아래 명령으로 별도 검증 |
| `npm --prefix frontend test -- src/test/free-auth-account-security.test.jsx src/test/free-auth-recovery.test.jsx src/test/free-auth.test.jsx src/test/auth-client.test.js` | 4 files / 14 tests 통과. free-auth-final-targeted.log |
| `node scripts/test-free-auth-postgres.cjs` | 실제 로컬 PostgreSQL·Prisma의 격리 임시 DB로 통과. 종료 시 자기 DB 제거. 운영 DB·실제 이메일 사용 0 |
| `npm --prefix frontend run build` | Vite production build 통과. 큰 chunk 경고 존재. free-auth-build-final.log |
| `npx prisma validate`, `npx prisma generate` | schema 검증·클라이언트 생성 통과 |
| ESLint | 검사한 신규 backend 파일 오류 0. frontend 신규 인증 파일 오류 0, AccountSecurityPage effect dependency 경고 1. 전 저장소 lint 통과를 의미하지 않음 |

초기 전체 테스트의 로컬 HTTP EACCES, Vitest 캐시 EPERM은 sandbox 실행 제한이었다. 허가된 실행 환경에서 재실행했으며 실패 테스트를 skip하거나 조건을 완화하지 않았다. 원래 backend route mounting 실패는 `/api/auth/free` 직접 마운트로 수정했다.

### 실DB로 확인한 항목

동시 OTP 인증에서 정확히 한 번 세션 발급, 링크/OTP 교차 재사용 거부, 브라우저 불일치, 5회 실패 잠금, 기존 이메일 충돌, 트랜잭션 실패 후 challenge 보존, OTP와 링크 만료 차이, SMTP 불확실 상태 보존, OAuth callback/결과 동시 소비 한 번, MFA 복구 코드 일회성, 탈퇴 후 access/refresh 폐기, 매장 소유자 탈퇴 거부, 마지막 인증 수단 해제 거부, 연결 해제와 로그인 경쟁 시 오래된 identity 거부, maintenance 만료 자료 정리.

외부 OAuth 응답·SMTP는 통제된 fixture다. OIDC 서명 검증 테스트는 실제 RSA 키와 jose 검증기를 사용한다. 이를 실제 Google/Kakao 인증이나 실제 메일 도착 성공으로 간주하지 않는다.

## 독립 검토와 수정

독립 읽기 전용 검토에서 발견한 두 P1을 수정했다.

1. 연결 해제 전에 읽은 identity로 이후 로그인 세션 발급 가능: 사용자 잠금 후 identity를 다시 읽어 존재·소유자를 확인한다. 실DB에서 SELECT 후 일시 정지 → 다른 트랜잭션 unlink commit → 로그인 재개 순서를 검증했다.
2. 기존 소셜 MFA UI 계약 불일치: 기존 요청에 브라우저 proof를 추가하고 MFA 결과를 새 MFA 화면에 연결했다. 신규 가입 flag가 꺼져도 일회성 MFA 완료 API는 기존 사용자에게 제공한다. 유효 temp token 없이는 완료할 수 없다.

추가로 미설정 provider가 기존 버튼을 숨기는 문제, 재인증 만료 후 화면 복구, Turnstile 실패 script 재사용 문제를 수정했다.

## DB·배포 게이트

**flag=false만으로 구 DB와 호환되지 않는다.** 공통 세션 및 Prisma users 조회가 새 컬럼을 사용한다. 운영 배포 전에 다음이 필수다.

1. users 이메일 lower(email) 중복을 읽기 전용으로 조사한다. 기능 인덱스 충돌 시 migration 전체를 중단하며 계정을 임의 병합하지 않는다.
2. 신규 migration의 별도 운영 승인과 적용. 기존 사용자 컬럼은 active/password enabled 기본값, 인증 테이블 6개는 RLS 및 공개 권한 회수.
3. 같은 스키마를 적용한 staging에서 기존 로그인·MFA·로그아웃을 먼저 검증한다.
4. 이전 정상 코드 artifact/SHA 보존. rollback은 additive 컬럼/테이블을 유지한 채 이전 코드를 되돌린다. 운영 데이터나 테이블을 drop하는 down migration을 자동 수행하지 않는다.
5. 무료 인증 flag는 공급자·Turnstile·법적 문서 URL·독립 pepper·SMTP 확인 후 활성화한다. 기존 JWT·암호화 키를 이 작업 때문에 변경하지 않는다.

## 환경 설정·비용·운영 미검증

`FREE_AUTH_DOMAIN_CONFIGURATION_2026-10-14.md`에 변수 이름과 callback/등록 위치를 기록했다. 확인된 프론트 origin은 `https://wemarket-saas.vercel.app`이다. vercel.app 자체는 소유 발송 도메인으로 DNS 인증할 수 없다.

Google/Kakao 앱 이름·ID, 실제 SMTP 검증 발신주소·비밀 저장 위치, Turnstile widget은 미확인이다. 무료 한도 내 공급자 이용을 지원하되 무제한 무료 발송을 보장하지 않는다. Resend Free 3000/월·100/일, Brevo Free 300/일은 조사 당시 기준이며 가입 시 최신 약관·한도를 확인한다. 코드 기본 전역 발송 예산은 80/일이며 유료 플랜으로 자동 전환하지 않는다. SMTP 운영 공급자는 아직 연결하지 않았다.

OAuth reauth는 최근 auth_time이 없으면 거부한다. 실제 공급자 claim·동의항목은 staging에서 확인하고, 미지원이면 이메일/TOTP/비밀번호 재인증 경로를 검증한다. 외부 공급자 동의 철회는 자동 완료로 주장하지 않으며 사용자의 공급자 설정에서 별도 철회가 필요하다. 금융기록 법적 보존·최종 삭제 정책 및 감사 이벤트 장기 보존기간은 운영 정책 검토가 필요하다.

maintenance는 `FREE_AUTH_MAINTENANCE_ENABLED=true node scripts/maintain-free-auth.cjs` 명시적 실행만 지원한다. 환경변수 DB 대상 확인 후 운영 승인 범위에서 실행한다. 이메일 만료 후 7일, OAuth/MFA/최근 proof 만료 후 1일, abuse bucket 2일을 정리한다. 계정 감사 이벤트·금융 원장은 정리하지 않는다. 정기 작업은 아직 운영에 등록하지 않았다.

## 상태 판정

- 로컬 코드: 구현 및 회귀 검증 수행, 미커밋.
- 격리 PostgreSQL: 인증 핵심 동시성·실패/복구 시나리오 통과.
- 실제 공급자 staging E2E: 미검증.
- 운영 DB migration·배포·실제 외부 인증: 미실행.
- Production Ready: 선언하지 않음. 실제 설정과 staging/운영 검증 증거 확보가 다음 게이트다.

