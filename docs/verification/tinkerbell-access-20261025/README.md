# 팅커벨 설정 접근 차단 및 운영 검증

## 변경 및 운영 적용 상태

`public.store_tinkerbell_settings`에 RLS를 활성화하고 `anon`,
`authenticated`의 테이블 및 ID 시퀀스 권한을 회수했다.
공개 Data API의 직접 접근을 차단하고, 기존 Express API의 매장 권한 검사를
통한 접근은 유지한다. DB 소유자와 신뢰된 서버 역할의 접근은 유지된다.
클라이언트용 RLS 허용 정책은 의도적으로 만들지 않는다.

`20261025010000_tinkerbell_settings_rls`는 사용자 승인 후 운영 DB에
Prisma로 적용되었고 `_prisma_migrations`의 성공 이력을 확인했다.
이 PR은 이미 적용한 SQL을 저장소 이력에 반영한다. 기존 마이그레이션의
내용이나 체크섬은 변경하지 않았다.

## 확인한 결과

- `anon`, `authenticated` 각각 SELECT / INSERT / UPDATE / DELETE 직접 실행:
  총 8건 모두 PostgreSQL `42501`(권한 거부).
- 쓰기 차단 검증은 `WHERE false` 및 트랜잭션 롤백으로 데이터 변경 없이 수행.
- RLS 활성화, 테이블 및 시퀀스의 공개 역할 권한 없음 확인.
- 운영 테스트 계정의 매장 3 설정 PUT 후 GET 및 고객용 GET 값 일치.
- AI 추천 OFF: 빈 추천과 `source: disabled` 응답 확인.
- AI 추천 ON: 추천 메뉴 1개 반환 확인. `source: ai`는 API 응답값이며,
  외부 모델 호출 여부까지 별도로 추적한 결과는 아니다.
- 실제 고객 브라우저 `/menu/3?table=1`: 설정 및 팅커벨 추천 요청 모두
  HTTP 200, JavaScript 실행 오류 0건.
- 테스트 후 기존 설정 복구 및 재조회 일치 확인. AI 추천 기본 OFF 유지.

## 증빙

- [접근 차단 검증 JSON](access.json): 역할별 결과, RLS, 마이그레이션 이력.
- [기능 검증 JSON](functional.json): 저장·조회, AI ON/OFF, 브라우저, 복구 결과.
- [고객 화면 캡처](customer.png).

위 자료는 해당 운영 검증 실행의 기록이며 지속적인 모니터링 결과는 아니다.
로그인 비밀번호, 토큰, DB 접속 문자열 및 고객 화면의 전체 텍스트는 포함하지 않았다.
