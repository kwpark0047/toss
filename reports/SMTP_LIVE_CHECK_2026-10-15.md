# 실제 SMTP 연결 검증

## 수정 후 재검증

사용자가 SMTP_PASSWORD 수정 후 임시 재다운로드·최대 1건 재발송·삭제를 별도로 승인했다. 재검증 결과 SMTP 인증 성공, 지정 수신주소에 연결 테스트 메일 1건 발송, 공급자 접수 성공을 확인했다. 이후 사용자가 해당 테스트 메일의 **수신 완료**를 회신했다. 따라서 발송·수신 연결 검증은 완료다. 이번 메일은 OTP나 로그인 링크가 아닌 연결 테스트 안내이며 인증 E2E 완료로 판단하지 않는다.

`smtp-live-recheck-20261015.json`: smtpAuthenticated=true, sent=true, providerAccepted=true, delivered=false, authenticationFlowVerified=false. 이 JSON의 delivered=false는 실행 당시 도착을 확인할 수 없다는 의미다. 후속 사용자 회신으로 수신을 확인했으며 JSON 실행 원본은 유지한다. 재다운로드한 `D:\Downloads\wemarket.env`는 finally에서 삭제하고 부재를 확인했다. 실제 운영 계정·DB·JWT·OAuth 설정은 변경하지 않았다.

아래는 수정 전 첫 시도의 실패 기록이다.

사용자가 Render 운영 환경파일의 임시 다운로드, 지정한 테스트 주소에 1회 발송 및 파일 삭제를 명시적으로 승인했다. 공급자 인증정보는 출력·Git 저장하지 않았다.

## 실행 결과

- 실행: `node scripts/verify-smtp-connection.cjs <temporary-env> <approved-recipient> --send`.
- SMTP host: `smtp.gmail.com` (Render 화면에서 서버 주소만 추가 확인).
- 결과: SMTP authentication 실패, `EAUTH`, responseCode `534`.
- `transport.verify()`에서 중단되어 `sendMail()`은 실행하지 않았다. 실제 발송 0건.
- 수신·OTP·OAuth·Turnstile E2E 성공을 의미하지 않는다.
- 임시 다운로드 파일 `D:\Downloads\wemarket.env`는 finally에서 삭제하고 부재를 확인했다. 원본 Render 설정은 변경하지 않았다.
- 오류 원문/인증정보는 로그에 남기지 않았으며, 증거 JSON은 오류 코드만 담는다: `smtp-live-check-20261015.json`.

## 필요한 조치

Gmail SMTP의 534는 앱 비밀번호 필요 등 추가 인증 정책에 의한 거부일 수 있다. 현재 수집한 숫자 코드만으로 세부 응답 문자열까지 확정하지 않는다.

SMTP_USER에 해당하는 Google 계정에서 2단계 인증 및 앱 비밀번호 사용 가능 여부를 확인한다. 일반 로그인 비밀번호 대신 해당 계정에서 발급한 앱 비밀번호를 Render SMTP_PASSWORD에 직접 입력한다. 발급 기능이 없다면 Workspace 관리자 정책·계정 유형을 확인한다. 보안을 낮추거나 2단계 인증을 끄지 않는다.

SMTP_FROM/MAIL_FROM은 인증 계정 또는 Gmail이 허용한 발신 별칭이어야 한다. 값을 채팅으로 보내지 않는다. 새 인증정보 저장 후 별도 시도로 연결 및 지정 주소 수신을 재검증해야 한다. 이번 작업에서는 인증정보를 변경하지 않았고 반복 발송하지 않았다.
