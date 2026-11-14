# PR #27 포함 최신 main 운영 배포 후 검증

## 대상 버전 및 배포

검증 대상은 `3fda0363084388f6d0c984406daaba741008d5da`이며, 검증 종료 시점의
main과 일치했다. 이 커밋은 PR #27 병합 커밋
`35e983a9131867738a9d6efe711785185485a0cb`보다 1커밋 앞서 있고 뒤처진 커밋은
없다([포함 관계 증빙](ancestry.json)).

PR #27 자체의 [main 실행](https://github.com/kwpark0047/toss/actions/runs/40114031814)은
후속 main 실행으로 대체되어 E2E·배포가 취소됐다. 이후 PR #28까지 포함한
[최신 main CI·운영 배포](https://github.com/kwpark0047/toss/actions/runs/40114518824)가
`success`로 완료됐다. 이 문서는 그 최신 배포에서 수행한 검증을 기록한다.

- 실행된 CI 작업은 E2E·deploy를 포함해 성공했다. 조건상 생략한 작업은
  [ci.json](ci.json)의 `skipped`로 구분한다.
- Render `/api/health`의 revision 및 Vercel 운영 HTML의 app-commit이 모두
  대상 커밋과 일치했다. 백엔드 상태는 `ok`, DB 연결은 `connected`였다.
- 기능 검증 종료 후에도 운영 양쪽 버전과 최신 main 일치를 재확인했다.

## 운영 기능 및 접근 차단 재검증

운영 테스트 계정의 매장 3에서 기존 설정을 조회한 뒤 변경·검증하고 복구했다.

| 항목 | 결과 |
| --- | --- |
| 설정 PUT → 관리자 GET | 저장값 일치 |
| 고객용 설정 GET | 변경값 반영 일치 |
| AI 추천 OFF | 빈 추천, source: disabled |
| AI 추천 ON | 옛날짬뽕·육즙탕수육·고추유린기 3개 반환 |
| 고객 브라우저 `/menu/3?table=1` | 설정·추천 요청 모두 HTTP 200 |
| JavaScript 실행 오류 | 0건 |
| 기존 설정 복구 후 재조회 | 일치, AI 추천 기본 OFF 유지 |
| RLS | 활성화 유지 |
| anon·authenticated 직접 SELECT/INSERT/UPDATE/DELETE | 총 8건 모두 42501 권한 거부 |

직접 쓰기 차단 검증은 WHERE false와 롤백을 사용해 실제 데이터 변경 없이 수행했다.
고객 화면에서 추천 메뉴와 설명 표시를 확인하고 [캡처](customer.png)를 남겼다.

검증 범위는 해당 테스트 매장과 데스크톱 고객 브라우저다. 모든 매장·모바일·음성
기능의 검증은 포함하지 않는다. source: ai는 API 응답값이며 외부 모델 호출과
폴백 사용 여부를 별도로 추적한 결과는 아니다. 이 기록은 해당 실행 시점의
결과이며 이후 운영 상태를 지속적으로 보장하는 자료는 아니다.

## 증빙

- [deployment.json](deployment.json): 요청한 병합 커밋과 실제 운영 커밋 및 상태.
- [ancestry.json](ancestry.json): 최신 main에 PR #27이 포함됨을 확인한 비교 결과.
- [ci.json](ci.json): 성공한 최신 main CI·배포 실행.
- [functional.json](functional.json): 설정·추천·고객 브라우저·설정 복구 결과.
- [access.json](access.json): RLS 및 역할별 직접 접근 차단 검증.
- [customer.png](customer.png): 해당 배포에서 촬영한 고객 화면.

인증 비밀번호·토큰·DB 접속 문자열 및 고객 화면 전체 텍스트는 제외했다.
이전 [PR #26 배포 검증](../post-deploy/README.md)은 별도로 보존했다.
