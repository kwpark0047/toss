# 무료 인증 설정 등록 확인

Render `srv-db0aoa7avr4c73esalbg` Environment를 새로고침하여 GOOGLE_CLIENT_SECRET, KAKAO_CLIENT_SECRET, TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY, EMAIL_AUTH_PEPPER가 등록된 것을 확인했다. 비밀값을 출력하거나 로컬 파일로 내보내지 않았다. 항목 존재 확인은 값의 유효성 검증을 의미하지 않는다.

OAuth callback용 FREE_AUTH_API_ORIGIN=https://wemarket-eiw4.onrender.com, FREE_AUTH_ENABLED=false를 Save only로 추가했다. 이 저장은 배포를 실행하지 않았다. 기존 JWT·암호화·공급자 비밀값은 변경하지 않았다.

운영 DB와 격리 staging의 인증 migration은 적용·보안 검증 완료다. 코드는 신규 무료 인증 기능, 기존 소셜 MFA 호환, SMTP_FROM 호환과 세션 폐기·계정 연결/탈퇴 보호를 포함한다. 기존 검증 결과는 FREE_AUTHENTICATION_IMPLEMENTATION_2026-10-14.md 및 FREE_AUTH_OPERATING_MIGRATION_2026-10-14.md 참조.

남은 검증: 실제 SMTP 인증·발송/수신, Google/Kakao callback·동의·MFA, Turnstile 실제 hostname/action, 실제 약관/개인정보처리방침 URL과 동의, 신규 코드 고정 SHA 배포 및 기존 인증 smoke. 테스트 수신 이메일은 아직 지정되지 않았다. 현재 Render 운영 버전은 a52d326495b4eb7d0f6e88ba430bf7b8ce96adf1이며 이 문서 작성 시 새 코드 배포는 실행하지 않았다.

새 코드에서 공급자 연결을 시험하기 전에 같은 RC의 staging 배포 및 callback 설정을 준비한다. 운영에 feature flag를 먼저 켜거나 기존 인증을 대체하지 않는다. 아직 외부 인증 완료·Production Ready를 주장하지 않는다.
