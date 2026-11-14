# PR #26 운영 배포 후 검증

## 배포 완료 확인

- [PR #26](https://github.com/kwpark0047/toss/pull/26) 병합 커밋:
  `f3a77752fdf0f54b7084a0b141b144e551c14db5`.
- [main CI 및 운영 배포 실행](https://github.com/kwpark0047/toss/actions/runs/40112544534):
  `success`. E2E와 `deploy`를 포함한 실행 작업 모두 성공했다.
  조건상 생략된 작업은 [CI 기록](ci.json)의 `skipped`로 구분한다.
- Render 운영 `/api/health`의 `revision`이 병합 커밋과 일치했다.
  `status: ok`, `db: connected`를 확인했다.
- Vercel 운영 HTML의 `app-commit`도 동일한 병합 커밋이었다.
- 기능 검증 종료 후에도 두 운영 버전이 일치함을 재확인했다.

## 배포 후 기능 및 접근 차단 검증

운영 테스트 계정의 매장 3에서 기존 설정을 읽고, 변경·검증 후 원래 설정으로
복구했다. 관리자용 인증 API와 실제 고객 브라우저로 확인했다.

| 검증 항목 | 결과 |
| --- | --- |
| 설정 PUT 저장 → 관리자 GET 재조회 | 변경값 일치 |
| 고객용 설정 GET | 저장된 변경값 일치 |
| AI 추천 OFF | 빈 추천, `source: disabled` |
| AI 추천 ON | 추천 1개 반환 (`갑오징어쟁반짜장`) |
| 고객 브라우저 `/menu/3?table=1` | 설정·추천 요청 HTTP 200 |
| 고객 브라우저 JavaScript 실행 오류 | 0건 |
| 기존 설정 복구 및 재조회 | 일치, AI 추천 OFF 유지 |
| RLS | 활성화 유지 |
| anon / authenticated 직접 SELECT·INSERT·UPDATE·DELETE | 8건 모두 `42501` 권한 거부 |

직접 쓰기 차단 검증은 `WHERE false`와 트랜잭션 롤백을 사용하여 실제 데이터를
변경하지 않았다. AI `source: ai`는 운영 API의 응답값이며 외부 모델 호출이나
폴백 사용 여부를 별도로 추적한 것은 아니다. 검증 범위는 해당 테스트 매장과
데스크톱 고객 브라우저이며, 모든 매장·모바일·음성 기능을 검증했다는 의미는 아니다.

## 증빙 파일

- [deployment.json](deployment.json): 운영 프론트엔드·백엔드 버전 및 상태.
- [ci.json](ci.json): 병합 후 CI·배포 실행 결과.
- [functional.json](functional.json): 설정·추천·브라우저·복구 결과.
- [access.json](access.json): 역할별 직접 접근 차단 및 마이그레이션 이력.
- [customer.png](customer.png): 배포 후 고객 화면 캡처.

인증 비밀번호·토큰·DB 접속 문자열과 고객 화면의 전체 텍스트는 제외했다.
이는 검증 실행 시점의 기록이며 이후 운영 상태를 지속적으로 보장하는 자료는 아니다.
