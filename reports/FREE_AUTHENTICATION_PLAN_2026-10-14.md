# SMS 비의존 무료 인증 전환: 현재 구조·구현 제안·비용

분석 기준: 2026-10-14, HEAD `cac2afa328747869b5f26b341634e824a643acf3`.
상태: 분석·설계 제안. 제품 코드·운영 DB·인증 공급자 설정·배포 변경 없음. 아래 신규 기능은 미구현이다.

## 1. 목표와 권장 결정

새 회원은 Google 우선, Kakao 또는 이메일 링크/6자리 OTP로 가입한다. 일반 가입·로그인에 유료 SMS를 요구하지 않는다. 기존 전화번호/이메일·비밀번호 로그인과 등록된 2FA는 유지한다. 기존 users.id 및 매장·주문·결제·구독 FK를 보존한다.

권장: 현재 Express + AuthSessionService를 인증의 단일 세션 발급자로 유지하고, OAuth 인증 코드 교환과 이메일 인증을 추가한다. Supabase는 기존 PostgreSQL·Storage 용도로 유지한다. 무료 SMTP 후보는 Marketplace에서 확인한 Resend를 우선하고 Brevo를 대안으로 둔다. 아직 외부 서비스를 설치하거나 계정을 만들지 않았다.

## 2. 실제 코드 조사

| 영역 | 현재 동작·근거 | 판정 |
|---|---|---|
| 인증 프레임워크 | Express 자체 JWT HS256, bcryptjs, Prisma. controllers/authController.js, middleware/auth.js | 자체 인증 |
| Supabase Auth | 실행 경로에서 signInWithOAuth/signInWithOtp 호출 없음. utils/storage.js의 createClient는 Storage용, 세션 저장/갱신 비활성 | 앱 인증으로 미사용. Dashboard 설정은 미확인 |
| 가입 | Register.jsx → send-otp → verify-otp → verificationToken → register. 컨트롤러는 phone 필수 | SMS 의존 |
| 기존 로그인 | 전화번호 암호문/레거시 후보 또는 이메일 조회 + bcrypt, 선택적 2FA | 보존 대상 |
| 가입 OTP | RegistrationOtpService: CSPRNG, HMAC 저장, 60초 재발송 제한, 기본 5분 만료, 5회 오입력, 트랜잭션/동일 번호 잠금 | 이메일에 재사용 가능한 보안 원칙 존재 |
| 세션 | AuthSessionService: auth_sessions, sid, refresh hash, 회전·폐기·실시간 현재 역할 확인. logout은 서버 revoke | 새 방식도 같은 서비스에 통합 필요 |
| 소셜 UI | SocialLoginButtons.jsx에 Google/Kakao/Naver 존재. VITE_GOOGLE_CLIENT_ID/VITE_KAKAO_JS_KEY 등 설정 시 표시 | 코드 존재, 운영 성공 미확인 |
| 소셜 API | app.mts에 /api/auth/social 마운트. socialAuthController.js가 provider userinfo를 조회 | 그대로 활성화 불가: 아래 결함 |
| 데이터 모델 | users.password는 필수 String, email/phone nullable unique. social_accounts(provider,provider_id) unique | 비밀번호 없는 새 계정 모델 처리 필요 |
| 이메일 인증 | 활성 인증 경로에 SMTP·이메일 challenge/검증 flow 없음 | 신규 구현 필요 |
| Turnstile | 활성 인증 코드에 검증 없음 | 신규 구현 필요 |
| 회원 탈퇴 | 조사한 auth/social 실행 경로에 완결된 탈퇴 orchestration 없음 | 구독/소유 매장/보존 자료를 포함해 설계 필요 |

보관된 이메일 값은 email_verified 증거가 아니다. 전화번호 OTP는 번호 점유 증명이며 실명·CI/DI 기반 휴대전화 본인확인과 다르다.

### 소셜 인증 선행 보완 사항

1. socialAuthController의 자체 signTokens는 sid/auth_sessions 없이 발급한다. 현재 middleware는 sid를 요구하므로 소셜 로그인 후 보호 API가 401이 될 수 있다. AuthSessionService.issue로 통일한다.
2. 신규 소셜 생성은 필수 users.password 없이 userRepository.create를 호출한다. 현재 Prisma 모델과 불일치한다.
3. 이메일 문자열만 같으면 기존 회원을 자동 선택한다. provider verified email 확인과 기존 계정 소유권 재인증 없이 연결하지 않는다.
4. Google/Kakao 응답의 상태·필수 subject·앱 audience 검증을 강화한다. 현재 Kakao는 id가 없으면 String(undefined)가 될 수 있다. 외부 HTTPS 헬퍼에는 명시적 시간/응답 크기 제한이 없다.
5. 소셜 safeUser는 password만 제거한다. 공통 publicUser로 통일해 2FA secret/backup 정보 반환을 막는다.
6. 현재 unlink는 마지막 로그인 수단 제거를 막지 않는다. 재인증과 대체 인증수단 확인이 필요하다. 기존 2FA 사용자에게 소셜 방식으로 2FA를 우회시키지 않는다.

## 3. 선택 가능한 접근

| 접근 | 이점 | 부담 | 권고 |
|---|---|---|---|
| 기존 인증 확장 + OAuth/SMTP | 기존 ID·세션·권한·API 유지. 이중 세션 없음 | OAuth/메일 challenge 보안과 운영을 직접 관리 | 현재 저장소에 권장 |
| Supabase Auth 신규 인증 + 기존 세션 bridge | 관리형 Google/Kakao/메일/Turnstile 활용 | auth UUID↔users.id 매핑, 자동 identity linking 정책·탈퇴·양쪽 세션 폐기 추가 검증 | 장기 대안 |
| 기존 인증을 Supabase Auth로 전면 교체 | 관리형으로 일원화 가능 | 기존 비밀번호·세션·FK·휴대전화 회원 이행 영향 큼 | 이번 범위에서 제외 |

Supabase Auth를 사용해야 무료 인증이 가능한 것은 아니다. 반대로 이를 도입해도 SMTP와 발송 도메인은 필요하다. 권장안에서는 Supabase Authentication 설정을 임의로 켜거나 Supabase JWT로 기존 middleware를 우회하지 않는다.

## 4. 권장 흐름

### Google → Kakao

- 서버가 authorization request를 생성하고 state를 브라우저·flow·redirect와 결합해 단기 저장한다. OIDC nonce, Google의 PKCE 지원 흐름을 적용한다. Kakao는 공식 지원 flow/OIDC 설정에 맞춰 state·nonce·서버 code exchange를 검증하며 미지원 파라미터를 가정하지 않는다.
- callback에서 code를 서버에서 교환하고 issuer/audience/서명/만료/nonce와 provider subject를 검증한다. access token만 받는 기존 경로는 계약 분석 후 단계적으로 교체한다.
- provider subject를 계정 키로 사용한다. email 동의 거부·미제공은 허용하되 필요한 연락처는 별도 검증한다. 클라이언트가 role/store 권한을 선택하지 못한다.
- 최초 신규 회원은 약관/개인정보 동의와 최소 프로필 완료 후 user 역할로 생성한다. 기존 소유자/직원 권한을 자동 부여하지 않는다.
- 기존 회원과 이메일이 일치하면 기존 방식 재로그인 후 명시적 연결을 요구한다. 이메일 미등록 전화번호 회원도 기존 로그인 후 연결할 수 있다. 이전에 검증하지 않은 이메일을 새 소셜 인증의 소유권 증명으로 간주하지 않는다.
- 동일 callback·동시 연결은 트랜잭션과 provider subject unique로 1회 처리한다. 소셜 신규 생성과 identity 연결은 원자적으로 수행한다.

### 이메일 링크와 6자리 OTP

- 가입/로그인 intent를 구분한다. 로그인 요청이 임의 새 계정을 만들지 않으며, 가입은 약관 동의를 요구한다.
- 제안 기본값: OTP 5분·오입력 5회, 링크 10분, 이메일별 재발송 간격 60초/시간당 5회, IP별 추가 한도와 전역 일일 발송 예산. 실제 도메인/공유망 환경에서 조정한다.
- CSPRNG, 서버 전용 pepper로 HMAC, 고엔트로피 링크 토큰 해시만 저장. challenge id/email/intent에 결합한다. 링크와 OTP가 같은 challenge를 사용하면 어느 쪽이든 성공 시 함께 소모하고 재사용을 거부한다.
- 재발송의 이전 challenge 무효화, 시도 횟수 증가, 사용 처리와 회원/세션 생성은 DB transaction/CAS/unique로 검증한다.
- 존재하는 이메일 여부는 발송 API 응답·타이밍으로 공개하지 않는다. 주소 정규화는 trim/도메인 기준을 명시하고 Gmail 점/플러스 임의 제거는 하지 않는다. 기존 대소문자 중복은 읽기 전용 조사 후 처리한다.
- 보안 메일 스캐너의 GET만으로 로그인하지 않는다. 확인 landing과 명시적 POST 검증, 고정 redirect allowlist, no-store/Referrer-Policy, 토큰 URL·로그 유출 방지 설계.
- SMTP는 transaction 밖에서 제한시간 내 처리한다. durable dispatch 상태·유효기간·멱등성을 설계하되 SMTP 접수 후 연결 단절은 결과 미확정으로 기록한다. 무조건 재발송하거나 전달 완료로 표시하지 않는다. OAuth 로그인은 SMTP 장애와 격리한다.

### Turnstile·세션·탈퇴

- 가입·메일 발송·위험 로그인에 Turnstile 적용. widget 표시만으로 통과시키지 않고 서버 Siteverify 성공, hostname/action/만료/재사용을 검증한다. cold start health 대기 후 새 challenge를 받아 토큰 선만료를 피한다.
- 공급자 장애 시 신규 발송/가입을 fail closed하되 기존 로그인 세션과 주문·결제를 막는 전역 middleware로 사용하지 않는다. IP·이메일·계정 rate limit은 다중 인스턴스에서 공유되는 DB/기존 Redis 저장소를 사용한다.
- AuthSessionService를 모든 방식의 세션 발급·갱신·폐기 공통 경로로 사용한다. 기존 localStorage/쿠키 계약을 갑자기 전환하지 않으며 HttpOnly 전환은 cross-site 쿠키·CSRF·Safari/PWA를 별도로 검증한다.
- 기존 2FA를 우회하지 않는다. 무료 인증 앱 TOTP·복구 코드를 우선 선택지로 제공하고 SMS 2FA는 기존 회원용으로 보존한다.
- 연결/해제에는 최근 재인증을 요구하고 마지막 로그인 수단 해제를 거부한다. 회원 탈퇴는 재인증→매장 소유권/활성 구독 처리→계정 비활성·모든 세션 폐기→provider 연결 해제→삭제/익명화 작업 순서로 진행한다. 금융·법정 보존 자료는 보존 정책 검토 후 분리하며 주문·원장을 cascade 삭제하지 않는다.

## 5. DB/API 변경 후보와 호환성

- 신규 private 테이블 후보: email_auth_challenges, email_dispatch_jobs, oauth_login_flows. RLS 활성화, PUBLIC/anon/authenticated 권한 회수, 서버 전용.
- 기존 social_accounts subject unique를 유지한다. users에 email_verified_at·account_status·password_login_enabled 등 최소 추가를 검토한다.
- users.password NOT NULL을 즉시 변경하지 않는다. 신규 passwordless 회원은 알 수 없는 고엔트로피 값의 bcrypt hash + password_login_enabled=false로 기존 schema를 보존하는 방안을 우선 검토한다. 빈 비밀번호·공통 기본 비밀번호 금지. 기존 회원의 비밀번호/로그인 가능 여부는 보존한다.
- /auth/email/request, /auth/email/verify, /auth/email/confirm, /auth/oauth/:provider/start/callback, 계정 연결·탈퇴 API 후보를 상세 계약에서 확정한다. 기존 phone OTP/비밀번호 endpoint는 삭제하지 않는다.
- stores/orders/payments/subscriptions의 user_id와 기존 사용자 role은 수정하지 않는다. phone_verified와 identity_verified를 email_verified에서 추론하지 않는다.

## 6. 설정과 배포

| 위치 | 필요한 설정 이름/작업 |
|---|---|
| Render 서버 | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, KAKAO_REST_API_KEY, KAKAO_CLIENT_SECRET(설정 시), OAuth redirect allowlist |
| Render SMTP | SMTP_HOST, SMTP_PORT, SMTP_SECURE/STARTTLS, SMTP_USER, SMTP_PASSWORD, MAIL_FROM, EMAIL_AUTH_PEPPER, 발송 예산·timeout |
| Render Turnstile | TURNSTILE_SECRET_KEY, 허용 hostname/action 목록 |
| Vercel 공개 설정 | VITE_TURNSTILE_SITE_KEY, 기존 VITE_API_URL. OAuth client ID/site key만 공개 가능. Secret은 VITE_* 금지 |
| Google/Kakao Console | 소유 앱·운영/전용 staging 도메인, consent screen/동의항목, 각 환경의 정확한 callback 등록. 앱 심사/사업자 권한 필요 여부 확인 |
| 발송 도메인 | 소유 도메인의 발신 주소, SPF/DKIM/DMARC, 인증 메일 추적 링크 비활성, 반송/수신 거부·평판 관찰 |
| Supabase 권장안 | DB 신규 private 테이블만 적용. Auth 설정 변경 없음. 기존 JWT/암호화 키 보존 |
| Supabase Auth 대안 선택 시 | Google/Kakao provider, custom SMTP, SITE_URL·정확한 redirect 목록, Turnstile, OTP/template/만료 설정, UUID↔기존 회원 매핑 및 기존 세션과의 bridge 필요 |

운영과 staging은 OAuth·Turnstile·SMTP 자격증명을 분리하고 운영 redirect에 임의 preview wildcard를 허용하지 않는다. SMTP 자격증명은 Render에 안전하게 등록하고 저장소·브라우저·채팅에 출력하지 않는다. 운영 DB 변경·배포는 검증된 artifact로 별도 반영한다.

## 7. 구현 순서·공수

| 단계 | 작업 | 예상 개발 공수 |
|---|---|---|
| 0 | 소셜 세션·응답 필터·계정 연결 결함 재현, 호환 계약 확정 | 1~2 인일 |
| 1 | Google 서버 인증 코드 flow, 기존 계정 연결, UI | 2~3 인일 |
| 2 | Kakao OIDC/동의 거부·연결·모바일/PWA 검증 | 1~2 인일 |
| 3 | SMTP·이메일 링크/OTP·제한·동시성·발송 장애 복구 | 3~4 인일 |
| 4 | Turnstile·세션/2FA·해제·탈퇴/보존 처리 | 2~3 인일 |
| 5 | 실DB·브라우저·실메일 staging, 회귀·문서·pilot | 2~3 인일 |

합계 11~17 인일의 예비 추정. 공급자 앱 심사·DNS 전파·계정 발급 대기와 대규모 중복 회원 정리는 별도다. 단가가 없으므로 개발 인건비 총액은 산정하지 않았다. Google 우선 pilot 후 나머지를 순차 공개한다.

## 8. 예상 운영 비용 (2026-10-14 공식 페이지 확인)

| 항목 | 추가 비용 예산 | 조건 |
|---|---|---|
| Google/Kakao 기본 OAuth | SMS 건당 비용 0원 목표 | 기본 로그인 범위, 제공자 쿼터·동의/앱 정책 적용. 유료 메시지·본인확인 상품과 구분 |
| Cloudflare Turnstile Free | $0/월 | 공식 Free: 20 widgets, widget당 10 hostnames, challenge 무제한. 고급 Enterprise 제외 |
| Resend SMTP Free (우선 후보) | $0/월 | 월 3,000통·하루 100통. 인증/재발송/복구 메일 모두 합산 |
| Brevo SMTP Free (대안) | $0/월 | 하루 300통, 미사용 일일 한도 이월 없음. 계정/발신자 승인·도달성 확인 필요 |
| Resend Pro 전환 예산 | $20/월부터 | 월 50,000통, 공식 요금 기준. 자동 전환/결제 활성화 안 함 |
| Supabase Auth 대안 | Free 50,000 MAU, Pro $25/월부터 | 별도 선택 시 예산. 기존 프로젝트 실제 요금제·DB 사용량과 합산 검토. SMTP 비용 별도 |
| 기존 Render/Vercel/DB | 현재 비용 유지 | 무료 SMTP와 별개. 무료 서버 cold start는 인증 방식 변경만으로 해소되지 않음 |
| 발송 도메인 | 기존 소유 도메인 사용 시 추가 구매 불필요 | 미소유 시 등록기관 실제 견적 별도. vercel.app/onrender.com을 소유 발송 도메인으로 간주하지 않음 |

예: 메일 2,000통/월·피크 80통/일이면 Resend Free 범위. 월 2,000통이어도 하루 150통이면 일일 한도를 초과한다. OAuth 80%·이메일 20%·이메일 사용자 월 2회 발송, 1,000명 가정이면 약 400통/월이지만 피크·재발송을 별도 계산해야 한다.

결론: 소규모에서 인증 관련 추가 서비스 비용 $0/월은 가능하지만 무제한/영구 무료·메일 도달 보장·전체 SaaS 운영비 0원은 아니다. 한도 초과 시 발송을 제한하고 승인 없이 유료 상품이나 유료 SMS로 fallback하지 않는다.

## 9. 테스트 기준 및 현재 실행 결과

- 변경 전 frontend: Login/auth-client/auth-readiness/signup-proof 4 files, 29 tests 통과 (`free-auth-baseline-frontend.log`).
- 변경 전 backend: registration OTP/security 5 tests 통과, skip 0 (`free-auth-baseline-backend.log`). 실제 메일/SMS/운영 데이터 변경 없음.
- 소셜 운영 성공, SMTP/Turnstile 운영 설정, 실제 callback·메일 도달은 미검증. 기존 테스트 성공이 위 소셜 결함의 안전성을 보장하지 않는다.
- 구현 시 RED→GREEN 대상: 잘못된 issuer/audience/nonce/state·재사용 code 거부, 이메일 자동 탈취 연결 방지, provider 응답 timeout, email 미제공, 중복 callback 1회원, 타 사용자 identity 연결 거부.
- 실제 PostgreSQL 대상: OTP 오입력 증가/만료·재전송 무효화·동시 성공 1회·소모와 세션 생성 원자성·계정 연결 unique·탈퇴 후 전체 세션 차단.
- 브라우저 대상: Google/Kakao 실제 테스트 계정·팝업 취소/모바일 redirect·Safari/PWA·다른 기기 이메일 OTP·링크 스캐너·Turnstile 만료·readiness·로그아웃·기존 전화번호 로그인/관리자 2FA·소유 매장 접근 유지.
- 장애 대상: SMTP 미설정/한도/접수 후 timeout·DB 저장 실패·Turnstile 장애·provider 429/5xx. 무조건 성공/자동 재발송/보안 우회 금지.

## 10. 본인확인 분리와 미완료 항목

로그인 인증은 Google/Kakao 계정 또는 이메일 점유 증명이다. 이메일/소셜 계정으로 휴대전화 실명·CI/DI·성인·사업자 신원·계좌 소유가 검증됐다고 표시하지 않는다. 해당 기능은 별도 verified_identity 계약/테이블/권한으로 분리하고 PASS/NICE/KCB 등 필요한 수단·비용을 별도 검토한다. 기존 휴대전화 로그인·2FA·검증 증거는 삭제하지 않는다.

현재는 계획 단계다. 신규 인증 코드/DB/공급자 계정·Secret·발송 도메인·Turnstile widget·운영 배포는 모두 미진행이다. 다음 결정은 권장안(기존 인증 확장) 채택 여부, 발송 도메인과 Google/Kakao 앱 소유 계정·SMTP 계정의 안전한 설정 위치다. 비밀값을 채팅으로 받지 않는다.

## 공식 근거

- Supabase 요금: https://supabase.com/pricing
- Supabase Google/Kakao: https://supabase.com/docs/guides/auth/social-login/auth-google / https://supabase.com/docs/guides/auth/social-login/auth-kakao
- Supabase 메일/SMTP: https://supabase.com/docs/guides/auth/auth-email-passwordless / https://supabase.com/docs/guides/auth/auth-smtp
- Resend 요금/SMTP: https://resend.com/pricing / https://resend.com/docs/send-with-smtp
- Brevo 무료 한도: https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans
- Turnstile 요금/검증: https://developers.cloudflare.com/turnstile/plans/ / https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Google 로그인/세션 범위: https://developers.google.com/identity/siwg/integrate
- Kakao 쿼터/REST: https://developers.kakao.com/docs/ko/getting-started/quota / https://developers.kakao.com/docs/ko/kakaologin/rest-api

Marketplace `categories` 및 `discover --category messaging` 읽기 전용 조회에서 Resend email 확인. 외부 서비스 provisioning·과금 약관 수락은 수행하지 않았다. Supabase changelog.md는 웹 도구의 markdown content-type 제한으로 열리지 않아 관련 최신 공식 Auth 문서를 별도로 확인했다.
