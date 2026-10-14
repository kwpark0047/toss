# 무료 인증 도메인 설정 확인

## 확인된 정보

- 사용자 지정 웹앱 주소: `https://wemarket-saas.vercel.app`
- Render `FRONTEND_URL`에 사용할 origin: `https://wemarket-saas.vercel.app`
- 인증 완료 화면: `/auth/free/callback`, 이메일 확인 화면: `/auth/free/email`
- 이 주소 제공은 SMTP 도메인 소유권, OAuth 앱 설정 완료 또는 운영 DB 변경 승인을 의미하지 않는다.

## 별도 확인할 설정

`vercel.app`은 Vercel 소유 도메인이므로 이 주소로 발송 도메인 DNS(SPF/DKIM)를 등록할 수 없다. 이메일 인증에는 소유 도메인의 검증된 발신주소 또는 SMTP 공급자가 허용한 발신주소가 필요하다. 웹앱 주소는 그대로 유지할 수 있다.

Render 백엔드의 실제 활성 origin을 확인한 후 `FREE_AUTH_API_ORIGIN`에 등록한다. Google·카카오 개발자 콘솔의 callback은 프론트 주소가 아니라 아래 백엔드 주소여야 한다.

```text
${FREE_AUTH_API_ORIGIN}/api/auth/free/oauth/google/callback
${FREE_AUTH_API_ORIGIN}/api/auth/free/oauth/kakao/callback
```

Google 승인된 JavaScript origin과 Turnstile 허용 hostname에는 각각 `https://wemarket-saas.vercel.app`, `wemarket-saas.vercel.app`을 설정한다. 카카오 OpenID Connect 활성화 및 필요한 동의항목 권한도 확인한다.

## 비밀 설정 위치

클라이언트 번들·Git·채팅에 비밀값을 넣지 않는다. 실제 운영 백엔드 Render 서비스의 Environment 또는 연결된 비밀 저장소에 등록한다. 프론트 `VITE_*` 변수에 Client Secret·SMTP 비밀번호·Turnstile Secret을 넣으면 안 된다.

```text
FREE_AUTH_ENABLED=false
FRONTEND_URL=https://wemarket-saas.vercel.app
FREE_AUTH_API_ORIGIN=<확인된 백엔드 HTTPS origin>
GOOGLE_CLIENT_ID=<기존 앱 client ID>
GOOGLE_CLIENT_SECRET=<비밀값>
KAKAO_REST_API_KEY=<기존 앱 REST key>
KAKAO_CLIENT_SECRET=<비밀값>
TURNSTILE_SITE_KEY=<공개 site key>
TURNSTILE_SECRET_KEY=<비밀값>
EMAIL_AUTH_PEPPER=<독립적인 32자 이상 무작위 비밀값>
SMTP_HOST=<공급자 SMTP host>
SMTP_PORT=587
SMTP_USER=<SMTP 계정>
SMTP_PASSWORD=<비밀값>
MAIL_FROM=<검증된 발신 이메일>
FREE_AUTH_TERMS_URL=<동일 웹앱 origin의 실제 이용약관 URL>
FREE_AUTH_PRIVACY_URL=<동일 웹앱 origin의 실제 개인정보처리방침 URL>
```

## 활성화 순서와 현재 상태

1. 기존 이메일 대소문자 중복을 읽기 전용으로 점검한다. 충돌을 임의 병합하지 않는다.
2. 신규 마이그레이션 `20261014030000_free_authentication`을 검토하고 운영 적용 승인을 별도로 확보한다. 기존 로그인에도 추가 사용자 컬럼이 필요하므로 **코드 배포 전에 스키마 적용이 필수**다.
3. OAuth 앱·SMTP·Turnstile을 staging에 설정하고 실제 발송, callback, MFA, 연결 해제·로그아웃을 검증한다.
4. 회귀 검증과 운영 설정 확인 후 feature flag를 활성화한다.

현재 확인 완료: 웹앱 origin. 미확인: 발송주소·도메인, OAuth 앱 이름/ID, 실제 비밀 설정 위치, 실제 외부 서비스 인증 성공. 이 문서는 운영 설정 변경 또는 실제 메일 발송 증거가 아니다.
