# 사업자 간편 가입과 1개월 체험

## 동작

- 가입은 휴대전화번호, 이메일, 비밀번호, 약관 동의, 만 14세 이상 확인, Turnstile을 받습니다.
- SMS·이메일 OTP는 보내지 않습니다. 전화번호와 이메일은 소유가 확인되지 않은 연락처로 취급합니다.
- 전화번호는 기존 `PHONE_ENC_KEY`/`JWT_SECRET` 기반 전화번호 암호화와 호환되게 저장하며, 기존 로그인 API의 전화번호 로그인 경로를 사용합니다.
- 가입 시 `business_access_status=trialing`, `trial_started_at=now()`, `trial_ends_at=now()+1 month`를 같은 DB transaction에서 기록합니다.
- 체험 종료 후 로그인과 조회는 가능하지만, 체험 매장의 쓰기 API와 신규 매장 생성은 `TRIAL_EXPIRED`로 차단합니다.
- 최고관리자는 체험 중/만료 계정을 조회하고 정식 이용을 승인할 수 있습니다. 승인은 조건부 UPDATE와 감사 이벤트를 하나의 transaction으로 처리합니다.
- 기존 계정은 migration 기본값 `approved`를 받으므로 새 체험 정책의 적용을 받지 않습니다.

## 운영 반영 순서

1. 백업/복구 계획과 migration SQL을 검토합니다.
2. `20261018090000_business_signup_trial_approval`을 staging DB에 적용하고 signup, phone login, 만료 차단, 관리자 승인 흐름을 검증합니다.
3. 운영 DB에 migration을 별도 승인받아 적용합니다.
4. 해당 migration이 적용된 API 배포 후 가입, 로그인, 관리자 목록/승인 smoke test를 진행합니다.

이번 변경은 코드와 migration만 준비합니다. 운영 DB 적용·배포는 이 문서 작성 시점에 수행하지 않았습니다.

