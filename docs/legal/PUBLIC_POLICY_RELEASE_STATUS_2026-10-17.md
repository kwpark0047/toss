# 공개 약관·개인정보처리방침 게시 및 가입 준비 상태

작성일: 2026-10-17

## 정책 문서

- 이용약관 정본: `frontend/public/platform/terms.html`
- 개인정보처리방침 정본: `frontend/public/platform/privacy.html`
- 문서/동의 버전: `platform-terms-privacy-2026-10-17-age14-v1`
- 공개 후보 주소: `https://wemarket-saas.vercel.app/platform/terms.html`, `https://wemarket-saas.vercel.app/platform/privacy.html`

문서는 사용자가 제공한 운영자·연락처·연령 정보 및 기본 해지/환불 원칙을 반영한다. 문서 URL의 `200` 응답만으로 공개 완료로 판정하지 않고, 실제 배포 뒤 콘텐츠 유형·본문·동의 버전을 별도 확인한다.

## Render 설정 템플릿

`render.yaml`은 두 정책 URL을 지정하고 가입 기능을 `false`로 둔다. Turnstile 변수 이름은 `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`이며 값은 Cloudflare 대시보드에서 동일 위젯에 대해 발급되어야 한다. 키를 저장소에 커밋하지 않는다. Blueprint는 `autoDeploy: false`이므로 이 파일을 커밋해도 Render 서비스 설정에 자동 적용되는 것은 아니다.

## DB 준비 확인

간편 가입 readiness가 확인하는 최소 테이블은 기존 `users`, `auth_sessions`, `auth_abuse_buckets`, `auth_account_events`이다. 저장소에는 `20261009020000_auth_sessions`와 `20261014030000_free_authentication` migration이 포함되어 있다. 별도 새 테이블 migration은 이 직접 가입 흐름에 필요하지 않다. 다만 현재 Workspace의 `.env`는 `localhost/wemarket_dev`를 가리키고, 연결된 Supabase 도구의 프로젝트 목록에 사용자 제공 운영 프로젝트 ref `yreoeqmcebnosmtlyump`가 없다. 따라서 운영 DB에 해당 테이블이 실제 존재하는지 확인하거나 적용한 것이 아니다.

## 활성화 차단 조건

2026-10-17 현재 운영 Render 환경, 운영 DB readiness, 운영 Turnstile widget/keys를 이 연결에서 읽을 수 없다. 운영 signup flag는 false로 유지한다. 실제 API의 `/api/auth/free/config`가 `simpleSignup: true`를 반환하고, 위 두 HTTPS 주소가 각각 진짜 정책 HTML을 반환하며, 운영 Turnstile hostname/action 검증과 staging 가입·기존 로그인 회귀가 확인된 뒤에만 운영 활성화를 판단한다.

