# 신규 회원가입 OTP 복구

## 원인과 변경
- 운영 화면 `POST /api/auth/send-otp` 404 확인. 컨트롤러 함수만 존재하고 인증 라우터 등록이 누락됐다. `/verify-otp`도 동일했다.
- 가입 화면은 phone/password를 전송하지만 라우터는 이메일 가입 스키마를 요구했다. 기존 이메일 스키마는 보존하고 실제 전화번호 가입 요청 스키마를 추가했다.
- 전화번호 하이픈 정규화와 6자리 코드 검증, 기존 영문·숫자 포함 8자 비밀번호 정책과 화면 안내를 일치시켰다.
- 잠재 위험도 함께 수정: 운영 OTP 응답 노출 제거, CSPRNG 생성, HMAC 저장, 발송 실패 503, 1분 재발송 제한, 5회 오입력 종료, 정확한 만료 검사.
- OTP 검증 후 5분짜리 가입 전용 서명 증명을 발급한다. 프론트는 메모리에만 보관하고 같은 전화번호 가입에 전달한다. 서비스는 proof의 OTP ID와 해당 전화번호의 검증 완료·미사용·미만료 challenge를 함께 확인한다.
- 전화번호별 advisory transaction lock, 사용자 생성과 OTP 소비의 동일 트랜잭션으로 동시 가입·DB 실패를 처리한다. 운영 BYPASS_OTP는 사용하지 않는다.

## 호환성
- 로그인·세션·JWT 키·기존 사용자·주문·원장은 변경하지 않는다.
- 등록 API에 verificationToken이 추가된다. 기존 화면도 함께 배포해야 한다. 이전에 받은 평문 OTP는 새로 발송받아야 한다. 이메일 가입 요청도 전화번호 소유권 증명이 필요하며 기존 이메일 필드는 유지한다.
- 기존 phone_otps.otp TEXT에 버전·횟수·digest를 저장하므로 신규 migration이 필요하지 않다. 새 AI 지원센터 migration은 이 복구와 분리되어 운영 미적용이다.

## 검증 증거
- `node --test tests/saas/registration-otp.test.cjs`: 수정 전 404로 실패 (`registration-otp-red.log`).
- OTP API·보안 테스트 4개 통과 (`registration-otp-green.log`).
- `node scripts/test-registration-otp-postgres.cjs`: 실제 로컬 PostgreSQL에서 해시 저장, proof 위변조·전화번호 변경 차단, DB 실패 rollback, 동시 가입 1회·OTP 소비 원자성 통과 (`registration-otp-postgres.log`). PG/SMS는 통제 응답이며 실제 SMS 발송 0건.
- 전체 backend unit/routes: 177 suites / 1357 tests 통과 (`support-registration-backend-full.log`).
- 전체 frontend: 46 files / 185 tests 통과 (`support-registration-frontend-full.log`). 이후 추가한 가입 증명 전달·전화번호 변경 차단과 지원센터 UI 4개 통과 (`signup-proof-frontend.log`).
- SaaS 회귀 81개 통과 (`support-registration-saas-full.log`).

## 운영 상태
코드·격리 DB 검증 완료. 이 문서 작성 시 운영 반영 전이며 배포 SHA·실제 HTTP 경로 검증은 후속 기록한다. 실제 SMS 제공자 인증·등록 발신번호·수신 성공은 검증하지 않았다. SMS 설정 없이 발송 성공 또는 가입 완료로 처리하지 않는다. 실발송 보류 요청을 유지한다.

## 복구
이전 Render/Vercel 정상 배포로 되돌릴 수 있고 DB 스키마 변경은 없다. 다만 이전 버전의 OTP 경로 누락·인증번호 노출 위험이 재발하므로 보안이 수정된 새 버전을 우선 복구 대상으로 삼는다. 새 가입 증명은 5분 내 만료되고 challenge가 소비되면 재사용할 수 없다.

## 운영 반영 확인
- 커밋 `3535a465341bbbadec0ff042ab36edcab130d81d`, GitHub main 및 RC 브랜치 게시 완료.
- Render `dep-db7fkibbc2fs73f1m1pg` Live. `/api/health` 200, DB connected, revision 일치.
- Vercel `dpl_5Dkj7ua1WrL4zo9TFUK8XiaDhqHp`, `https://wemarket-saas.vercel.app` alias 완료. 격리된 Git 커밋 frontend만 빌드하여 미완료 AI 지원센터 변경은 포함하지 않았다.
- 각 가입 API에 빈 입력만 POST하여 400 검증 응답 확인(404 해소); Origin CORS 일치. 실제 OTP 생성·문자·사용자 가입·운영 DB 쓰기 0건. 증거 `registration-live-api.log`.
- 브라우저 PWA 업데이트 후 meta app-commit SHA 일치와 가입 화면 렌더 확인. 증거 `registration-otp-live-20261014.jpg`.
- 첫 Vercel CLI 배포는 metadata 추가 시 Not authorized였다. 기존 계정·팀·프로젝트 접근을 확인하고 metadata 없이 동일 artifact를 배포하여 성공했다. 정확한 권한 오류 원인은 아직 미확정이며 실제 HTML SHA로 배포물을 검증했다.
- 실제 SMS 공급자 설정 및 수신 검증은 여전히 미검증/실발송 보류. 이것을 신규 가입 E2E 완료로 해석하지 않는다.

## 추가 가입 증명 보완

- backend `a35eccf5888b1bf37c2c6261f5adcb0c1c99822a` 배포, Render `dep-db7g42ij9qps73cb3bog` Live. 운영 health 200 / revision 일치 / DB connected (`registration-live-final.log`).
- OTP 행의 전화번호가 변경되더라도 다른 번호 가입에 증명을 전용할 수 없도록 서명 payload에 전화번호 HMAC을 결합했다. 원문 번호는 token에 넣지 않는다. 위변조 재현 테스트 실패 후 관련 5개 테스트와 실DB signup 회귀 통과.
- frontend는 opaque verificationToken을 전달하므로 기존 `3535a46`과 호환된다. 이전 방식으로 발급된 가입 증명은 새 인증번호를 요청해야 한다.
