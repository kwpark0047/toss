# 인증 요청 45초 timeout 대응

## 확인한 사실

- 브라우저 공통 client는 POST에 45초 timeout을 적용하며 주문·SMS 등 변경 요청은 자동 cold retry하지 않는다.
- 앱 시작의 비동기 wakeup은 인증 POST 전송과 경합하며, auth API 자체에는 준비 대기가 없었다.
- 운영 Render 로그에 새 서버 기동(20:39:07)과 초기화(20:39:32) 기록이 존재한다. 무료 인스턴스의 50초 이상 재기동 지연 안내도 확인했다. 사용자 요청 ID가 없어 해당 요청의 전 구간 시간을 단정하지 않는다.
- 운영 SMS 공급자 환경 설정 누락 경고가 존재하며, read-only DB 메타데이터 조회에서 global coolsms 설정 행도 0개였다. 실제 SMS 발송 가능한 상태로 주장하지 않는다.

## 수정

인증번호 요청·검증·가입·로그인 전에 기존 shared wakeup의 읽기 전용 health 확인을 기다린다. 준비 실패 시 POST를 보내지 않는다. 이미 전송된 POST timeout은 재시도하지 않고 처리 결과 미확정 안내를 표시한다. 기존 45초 제한을 늘리거나 인증을 우회하지 않는다. 등록 화면이 새 오류 안내를 유지하도록 했다.

## 테스트

- `auth-readiness-red.log`: 수정 전 6개 테스트 실패로 준비 대기 누락 재현.
- `npm --prefix frontend test -- src/test/auth-readiness.test.js src/test/auth-client.test.js src/test/signup-proof.test.jsx`: 3 files / 10 tests 통과, skip 0.
- readiness 지연 중 POST 0회, 준비 실패 시 POST 0회, 준비 후 1회, ambiguous timeout 후 재전송 없음, 기존 401/refresh·가입 증명 계약 유지.
- 실 SMS 발송·운영 계정 생성 없음.

## 한계 및 운영 조치

무료 서버 재기동 자체가 사라지는 변경은 아니다. health 대기 중 지연은 남을 수 있다. 실제 45초 timeout의 모든 가능 원인을 해결했다는 주장은 하지 않는다.
최고관리자가 기존 공급자 설정 화면에 Coolsms API key·secret·등록 발신번호를 안전하게 등록해야 실제 회원가입 문자 수신 검증이 가능하다. 비밀값은 채팅/보고서에 기록하지 않는다.
