# 플랫폼 법적 문서 공표 및 가입 게이트

작성일 2026-10-15, 2026-10-17 갱신.

## 공개 정본과 주소

정본은 `frontend/public/platform/terms.html`과 `frontend/public/platform/privacy.html`이며 배포 후 공개 URL은 다음과 같다.

- https://wemarket-saas.vercel.app/platform/terms.html
- https://wemarket-saas.vercel.app/platform/privacy.html

문서 버전과 가입 동의 기록 버전은 `platform-terms-privacy-2026-10-17-age14-v1`로 일치시킨다. 공개 배포 뒤 두 주소가 SPA 셸이 아니라 문서 본문을 반환하는지 확인한다.

## 문서

- PLATFORM_TERMS_DRAFT_KO.md
- PLATFORM_PRIVACY_DRAFT_KO.md

## 확정할 운영 정보

1. 운영 법인/사업자 상호·대표·등록번호·주소·지원 연락처·개인정보 보호책임자.
2. 가입 대상 연령과 미성년자 처리. 실제 판매/중개/결제 책임 구조.
3. 요금·갱신·재시도·해지 효력일·환불 및 청약철회 정책.
4. 수탁 계약 법인·국가·전달 항목·보유 기간, 국외 이전 근거/안내/동의.
5. 인증·감사·접속 로그의 확정 보존 기간과 자동 삭제, 연관 기록·백업 파기 검증.
6. 선택적 마케팅·AI 개인화 동의를 가입 필수 동의와 분리.

## 코드 대조 근거

- services/OAuthProvider.js: Google openid/email/profile, Kakao openid/account_email/profile_nickname.
- services/EmailAuthService.js: 인증 300초, 해시 검증·암호화 발송 payload 제거. 만료 행 자동 파기와 다름.
- services/AuthIdentityService.js: 동일 이메일 자동 병합 거부, signup:terms-privacy-v1 이벤트.
- services/AccountLifecycleService.js: 소유 매장 탈퇴 선행 정리, 직접 식별정보 제거·세션 폐기, 금융 기록 유지, providerConsentRevoked=false.
- reports/SMTP_LIVE_CHECK_2026-10-15.md: 실제 SMTP 수신 확인. OAuth/Turnstile E2E와 구분.

## 공표/연결 순서

운영 정보 확인 → 정책과 실제 코드 차이 수정·검증 → 최종 문구 승인 → 공개 플랫폼 전용 경로 구현/게시 → 동일 origin HTTPS URL 2개 설정 → 문서 버전·동의 이벤트 일치 검증 → 실제 staging 인증 E2E → 활성화 판단.

기존 후보 경로 `/platform/terms`, `/platform/privacy`는 Vercel SPA 셸을 반환하므로 정책 주소로 사용하지 않는다. 정적 문서에는 `.html` 경로를 사용한다. 매장별 `/legal/:storeId`와 구분한다. Render Blueprint는 `FREE_AUTH_TERMS_URL`·`FREE_AUTH_PRIVACY_URL` 값을 위 공개 주소로 준비하고, `FREE_AUTH_SIMPLE_SIGNUP_ENABLED=false`를 기본으로 둔다. Turnstile 사이트/비밀 키는 Cloudflare에서 발급 후 Render에 직접 등록한다.

현재 코드의 과거 terms-privacy-v1 문자열은 이 초안에 대한 사용자 동의 또는 최종 문서 승인 증거가 아니다. 로컬 미커밋 변경은 `platform-terms-privacy-2026-10-17-age14-v1`을 가입 challenge 및 계정 이벤트에 기록한다. 최종 게시된 문서의 버전·실제 동의 시각과 연결해야 한다. 설정 등록만으로 검증 완료라고 판단하지 않는다.

문서에 완료라고 적기 위해 개인정보 파기, 법정 본인확인, 제휴 체결, 국외 이전 실사 등 미구현/미확인 항목을 가정하지 않았다. 문서만 추가했으므로 API·DB·배포 변경과 실행 테스트는 없음. 기존 3개 수정 보고서는 보존.

## 2026-10-15 후속 검토·재검증

### 확인한 정보와 미확인 정보

- 운영 웹앱: https://wemarket-saas.vercel.app. 운영 API: https://wemarket-eiw4.onrender.com. 이는 사업자 상호·소재지 또는 발신 도메인 소유 증거가 아님.
- 연락처 표기가 일치하지 않음: frontend/src/pages/marketing/ContactPage.jsx에는 support@wemarket.co.kr, docs/swagger.js에는 support@wemarket.com. 어느 주소도 실제 관리·수신 확인이 없어 플랫폼 공식 지원/개인정보 창구로 확정하지 않음.
- 매장 입력 폼의 '(주)위마켓', '홍길동' 등은 placeholder이므로 운영자 신원으로 사용하지 않음. 매장별 법적 정보도 플랫폼 운영자 정보로 전용하지 않음.
- scripts/maintain-free-auth.cjs는 존재하며 FREE_AUTH_MAINTENANCE_ENABLED=true가 필요함. 만료 후 이메일 인증 7일, OAuth/MFA/재인증 1일, abuse bucket 윈도 2일 기준의 정리 코드를 포함. 확인한 저장소 CI·render.yaml에는 예약 연결을 찾지 못했으며 외부 cron·실행 이력은 미확인. 위 기간은 구현 상 기준이지 승인된 보존 정책 또는 운영 삭제 완료 증거가 아님.
- 운영 /api/auth/free/config 재조회: HTTP 200, enabled=false, termsUrl/privacyUrl 미설정.
- Google·Kakao 공식 JWKS HTTPS 조회: 각각 HTTP 200, RSA 공개키 2개. 공급자 네트워크·공개키 가용성 확인일 뿐 Client Secret, 앱 callback, 실제 로그인 성공 검증이 아님.
- SaaS 재실행 99 pass/0 fail/0 skip. 격리 PostgreSQL real Prisma 인증 테스트 passed=true, operatingDB=false, externalEmails=0. 동시 OTP·단일 소비·시도 소진·브라우저 결합·기존 계정 충돌·만료·SMTP 불확실·OAuth 재사용 차단·MFA·탈퇴/연결 해제 경합 검증.

증거: reports/free-auth-followup-saas-20261015.log, reports/free-auth-followup-postgres-20261015.log, reports/free-auth-provider-preflight-20261015.json.

### 현재 중단 경계와 다음 입력

운영자의 법적 정보·연령·실제 지원 연락처·보호책임자·계약/보존/환불 정책을 사용자에게 요청했다. 값을 추정하지 않는다. 해당 정보 없이 최종 문서로 공표하거나 동의 수집에 연결하지 않는다.

사용자 확인 뒤 최종 문서 경로/버전과 동의 기록을 연결하고, 전용 staging에 실제 OAuth 앱 callback·Turnstile 허용 hostname을 설정해 검증한다. 실제 사용자 로그인·동의/보안 확인이 필요한 단계는 브라우저로 안내한다. 새 Secret 입력은 사용자가 안전한 환경변수 위치에 직접 수행한다.

SMTP 연결 테스트 수신은 이미 확인됐으므로 임의 재발송하지 않았다. 실제 OTP/링크 수신·소비 E2E는 별도 남아 있다. 무료 인증은 disabled 유지, 운영 DB·JWT·공급자 키·CI Secret·배포는 이번 검토에서 변경하지 않음.

## 운영 정책 권장안

RECOMMENDED_OPERATING_POLICIES_KO.md에 초기 가입 연령, 보존·파기, 구독 해지·환불·재시도 제안을 작성했다. 사용자 답변에 따라 운영자 정보는 '미정'이며 추정 상호·이메일을 채우지 않았다. 해당 문서는 승인된 운영 정책·최종 약관이 아니다.

정책 검증 상태는 reports/FREE_AUTH_POLICY_VALIDATION_2026-10-15.md 참조. 코드 차이와 필요한 검증을 함께 기록했으며 운영 정리·실청구·환불·배포·인증 flag를 변경하지 않았다.

## 2026-10-17 운영자 정보 반영

사용자가 제공한 내용은 검토용 약관·개인정보처리방침 초안에만 반영했다.

- 상호 위마켓, 대표 박강원, 사업자등록번호 670-26-00755, 주소 경기도 부천시 춘의로198 202.
- 공식 연락 전화 010-3890-0047. 이메일 지원 주소는 제공되지 않았다.
- 사용자는 처음에 상한 연령 제한이 없기를 요청했고, 후속 확인에서 신규 가입 최저 연령을 만 14세로 결정했다. 법정 신원·휴대전화 본인확인이 아니라 가입자의 연령 확인 진술로 적용한다.
- 사용자는 기본 보존·파기 및 구독 해지·환불 기준을 요청했다. `RECOMMENDED_OPERATING_POLICIES_KO.md`는 권고 초안이고, 실제 파기·백업·환불 운영이 그 기준을 충족하는지 검증되기 전 확정 정책으로 공표하지 않는다.
- 추가 확인 응답: 가입 최저 연령은 만 14세로 제한, 상한 없음. 박강원 대표를 개인정보 보호책임자로 지정. 지원 및 보호책임자 연락은 010-3890-0047. 공식 이메일은 제공되지 않았다.

2026-10-17 기준 결정: 운영 가입은 이 문서의 초안이 실제로 공표되고 Render 설정·DB·Turnstile·운영 API가 확인되기 전까지 비활성 상태다. 운영 무료 인증과 신규 이메일·비밀번호 가입의 flag는 별개로 관리한다. 간편 가입 설정·검증 절차는 [`docs/auth/SIMPLE_SIGNUP_ACTIVATION_KO.md`](../auth/SIMPLE_SIGNUP_ACTIVATION_KO.md)에 기록한다. 약관·개인정보처리방침 후보 경로를 앱이 SPA fallback으로 제공하는 것만으로는 공개 문서로 인정하지 않는다.

### 2026-10-17 가입 게이트 구현 상태

- 신규 간편 가입은 이메일 소유 인증이나 SMS를 요구하지 않는다. 이메일/비밀번호·약관 및 개인정보 동의·만 14세 이상 확인·Turnstile을 요구한다. 이 흐름이 이메일 소유, 법적 신원 또는 연령을 검증한다고 표현하지 않는다.
- 서버는 같은 확인을 독립적으로 강제한다. 이메일·OAuth challenge에 동의 버전을 보관하고, 값이 없거나 버전이 다른 기존 challenge로는 계정을 만들 수 없다.
- `prisma/migrations/20261017120000_signup_age_consent/migration.sql`이 필요하다. 로컬 격리 PostgreSQL에서 적용·회귀 검증했으며, 운영 DB에는 적용하지 않았다.
- 현재 정책 초안은 여전히 공표되지 않았다. Render 무료 인증 flag와 약관 URL도 변경하지 않았다. OTP 5분과 링크 10분 만료를 구분해 문서에 반영했다.
- 검증: `tests/saas/free-auth-policy.test.cjs` 5 pass, 프런트 무료 인증 10 pass, `scripts/test-free-auth-postgres.cjs` 실제 격리 PostgreSQL 통과, 프런트 production build 성공.

