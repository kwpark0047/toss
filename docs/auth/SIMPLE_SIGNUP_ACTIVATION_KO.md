# 이메일·비밀번호 간편 가입 운영 설정

작성일: 2026-10-17
상태: 코드·격리 테스트 준비. 운영 활성화 및 공개 약관 URL 검증은 별도 운영 증거가 필요합니다.

## 동작

- 회원은 이메일과 비밀번호를 입력하고 이용약관·개인정보 처리방침·만 14세 이상 확인에 동의한 뒤 바로 계정을 만듭니다.
- 가입 입력은 이메일과 비밀번호 두 항목으로 제한합니다. 이름은 가입 뒤 프로필에서 설정할 수 있으며, 비밀번호 확인 입력은 생략하고 기존 API 호환을 위해 제출 시 비밀번호를 확인값으로 함께 보냅니다.
- 이메일 OTP, SMS, Google·카카오 인증은 이 경로에서 요구하지 않습니다. 회원의 이메일 소유를 확인하지 않으므로 주소 오타나 타인 주소 입력 위험을 가입 화면에서 알립니다.
- Cloudflare Turnstile은 자동화 남용 방지 수단이며 신원·연령·이메일 소유를 인증하지 않습니다.
- 서버는 bcrypt 비밀번호 해시, 동의 이벤트, 세션을 기록하고 이메일·IP별 가입 시도를 제한합니다. 중복 이메일은 새 계정이나 세션을 만들지 않습니다.
- `FREE_AUTH_SIMPLE_SIGNUP_ENABLED`는 간편 가입만 제어합니다. 기존 `FREE_AUTH_ENABLED`를 켜지 않아도 되며, 따라서 OAuth·이메일 OTP·계정 연결을 함께 활성화하지 않습니다.

## Render 백엔드 환경변수

운영 Render의 정확한 API 서비스에서 다음 값만 별도로 검토·등록합니다. Secret 값은 공개 저장소·로그·채팅에 기록하지 않습니다.

| 변수 | 값 |
| --- | --- |
| `FREE_AUTH_SIMPLE_SIGNUP_ENABLED` | 검증 전 `false`, 공개·운영 확인 후 `true` |
| `FREE_AUTH_ENABLED` | 간편 가입만 켤 때 기존 값 유지. `true`로 바꾸지 않음 |
| `FRONTEND_URL` | `https://wemarket-saas.vercel.app` |
| `FREE_AUTH_TERMS_URL` | `https://wemarket-saas.vercel.app/platform/terms.html` |
| `FREE_AUTH_PRIVACY_URL` | `https://wemarket-saas.vercel.app/platform/privacy.html` |
| `TURNSTILE_SITE_KEY` | 운영 Cloudflare Turnstile 위젯의 공개 Site Key |
| `TURNSTILE_SECRET_KEY` | 같은 위젯의 Secret Key (Render Secret 값) |
| `DATABASE_URL` | 기존 운영 설정 유지. 재입력하지 않음 |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | 기존 로그인과 호환되도록 유지. 회전하지 않음 |

약관 주소는 `FRONTEND_URL`과 같은 HTTPS origin이어야 하며 브라우저에서 실제 문서 내용을 반환해야 합니다. 정적 파일은 `frontend/public/platform/`에 있으며 Vercel 배포 후 `.html` 경로에서 본문 응답을 확인합니다. Vercel SPA fallback이 HTTP 200을 반환하는 것만으로 약관 페이지가 존재한다고 볼 수 없습니다. Cloudflare Turnstile에서 위젯을 만들 때 허용 호스트명 `wemarket-saas.vercel.app`, 위젯 유형 Managed를 설정하고, 공개 Site Key와 비밀 Secret Key를 별도로 복사해 운영 Render의 `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`에 등록합니다. Site Key는 브라우저에 노출되는 공개값이며 Secret Key는 Render secret으로만 저장합니다. 위젯 action은 서버 검증값과 맞춰 `signup`을 사용합니다. 키를 채팅·Git·정책 파일에 기록하지 않습니다.

## 기능 가드와 데이터베이스

`GET /api/auth/free/config`는 위 공개 문서 주소, 두 Turnstile 키, `users`, `auth_abuse_buckets`, `auth_account_events`, `auth_sessions` 테이블이 모두 유효할 때만 `simpleSignup: true`를 반환합니다. OAuth용 테이블은 Google 또는 카카오가 설정된 경우에만 별도로 확인합니다. DB 준비 확인이 실패하면 가입 UI는 닫힌 상태를 유지합니다.

가입은 `POST /api/auth/free/signup/simple`이며 일반 로그인과 같은 기존 users·session 테이블을 사용합니다. 새로운 필수 스키마 migration은 이 구현에 추가하지 않았습니다. 실제 운영 테이블의 존재·권한은 API readiness 검증 전까지 확인된 것으로 간주하지 않습니다.

## 검증 순서와 완료 기준

1. 테스트에서 `FREE_AUTH_ENABLED=false`, `FREE_AUTH_SIMPLE_SIGNUP_ENABLED=true` 조합이 단순 가입만 공개하는지 확인합니다.
2. 비동의, 14세 미만 응답, 잘못된/타 origin URL, Turnstile 실패·잘못된 hostname/action, 중복 이메일, 이메일/IP 제한, 세션 기록 실패를 차단합니다.
3. staging UI에서 새 계정 1개를 만들고 즉시 로그인·로그아웃·재로그인, 기존 계정 로그인, 중복 가입, 비밀번호 오류, 약관 링크, 휴대전화/SMS가 호출되지 않음을 확인합니다.
4. staging에서 `GET /api/auth/free/config` 응답과 실제 DB transaction/session을 확인합니다. Toss·운영 고객 데이터는 사용하지 않습니다.
5. 운영 문서가 공표된 HTTPS URL이고 DB/Turnstile 준비가 확인된 뒤에만 Render의 간편 가입 flag를 켭니다.
6. 배포 후 `/api/auth/free/config`의 `simpleSignup: true`, 회원가입 1건, 세션·동의 이벤트, 로그아웃·재로그인, 중복 방지와 기존 로그인 회귀를 확인합니다.

개인정보처리방침의 외부 서비스 계약법인·세부 국외 이전 및 실제 보존/파기 이행, 운영 DB readiness와 Turnstile live verification이 확인되지 않으면 가입 flag는 false로 둡니다. 운영 DB·PG에 가짜 회원·결제를 만들지 않습니다.

## 현 시점 판단

로컬 설정과 테스트는 구현할 수 있지만, 이 저장소만으로 Render 환경변수 변경 권한, 배포 SHA 또는 운영 DB 상태를 증명할 수 없습니다. 또한 후보 URL이 SPA fallback만 반환한다면 실제 약관 게시로 보지 않습니다. `FREE_AUTH_SIMPLE_SIGNUP_ENABLED=true`를 설정했다고 보고하지 않으며, 운영 검증 완료까지 가입 플래그는 false로 유지합니다.

