# 무료 인증 실제 설정 진행 상황

Render `wemarket` 서비스(`srv-db0aoa7avr4c73esalbg`) Environment를 실제 확인했다. 비밀값은 열거나 출력하지 않았으며, 항목 존재만 확인했다.

등록 확인: GOOGLE_CLIENT_ID, KAKAO_REST_API_KEY, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM. 값의 유효성과 SMTP 인증·발신 허용 여부는 아직 미검증이다.

미등록: GOOGLE_CLIENT_SECRET, KAKAO_CLIENT_SECRET, TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY, EMAIL_AUTH_PEPPER, FREE_AUTH_API_ORIGIN, 무료 인증 약관 URL/개인정보처리방침 URL. GOOGLE_CLIENT_ID라는 Secret File도 있지만 현재 코드는 해당 파일을 OAuth 설정으로 읽지 않는다. Client ID와 Secret을 Environment에 각각 등록해야 한다.

## 이번 수정

기존 Render 발신 설정이 SMTP_FROM인데 새 AuthMailService와 publicConfig는 MAIL_FROM만 읽는 불일치를 발견했다. MAIL_FROM 우선, SMTP_FROM fallback으로 호환성을 수정했다. 다른 SMTP 설정과 기존 키는 변경하지 않았다.

재현 테스트를 먼저 작성해 실제 실패를 확인했다(`free-auth-smtp-alias-red.log`). 수정 후 전체 SaaS 93개 테스트 통과, 격리 PostgreSQL 인증 회귀 통과. `tests/saas/free-auth-mail.test.cjs`에서 기존 이름과 우선순위를 검증한다.

## 현재 배포 게이트

운영 인증 migration은 이전 턴에 적용·권한 검증 완료했다. Render가 표시하는 운영 backend SHA는 여전히 a52d326495b4eb7d0f6e88ba430bf7b8ce96adf1이다. 무료 인증 코드의 커밋·배포와 실제 외부 공급자 E2E는 미완료다.

새 공통 소셜 MFA는 EMAIL_AUTH_PEPPER가 필요하므로 해당 비밀값 없이 backend를 배포하지 않는다. Turnstile/공급자 설정 미완료 상태에서 feature flag를 활성화하지 않는다. 현재 등록된 SMTP_PASSWORD가 실제 공급자 인증정보인지 확인하기 전, 수신자를 임의 선택해 인증 메일을 보내지 않았다.

다음 작업: 운영 Render의 미등록 설정을 안전하게 입력 → 같은 설정의 전용 staging callback 확인 → 실제 SMTP 연결 검증 → 동의한 테스트 계정의 OAuth·메일·Turnstile E2E → 버전 고정/배포/기존 인증 회귀. 실제 발송 도메인·약관 페이지·공급자 앱을 임의 생성하지 않는다.
