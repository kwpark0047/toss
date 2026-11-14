# PR #29 운영 배포 후 검증

## 대상 및 배포 완료

- 대상: [PR #29](https://github.com/kwpark0047/toss/pull/29) 병합 커밋
  `f6d3745926474914784041756c0f20cb508bf397`.
- [main CI·운영 배포 실행](https://github.com/kwpark0047/toss/actions/runs/40150112884):
  success. 실행된 작업은 E2E·deploy를 포함해 모두 성공했고, 조건상 생략된
  작업은 [ci.json](ci.json)의 skipped로 구분했다.
- Render 운영 health revision과 Vercel 운영 HTML app-commit이 대상 커밋과
  일치했다. 백엔드 status는 ok, DB는 connected였다.
- 기능 검증 종료 후에도 최신 main 및 운영 프론트엔드·백엔드 커밋 일치를 재확인했다.

## 기능 및 접근 차단 재검증

검증 시간: 2026-10-25 10:28:20~10:29:36 KST
([functional.json](functional.json)의 UTC 시각 기준).
운영 테스트 계정의 매장 3에서 설정을 변경한 뒤 기존 값으로 복구했다.

| 항목 | 결과 |
| --- | --- |
| 관리자 설정 PUT → GET | 저장·재조회 값 일치 |
| 고객용 설정 GET | 변경값 반영 일치 |
| AI 추천 OFF | 빈 추천, source: disabled |
| AI 추천 ON 직접 API 요청 | 갑오징어쟁반짜장 1개 반환 |
| 고객 브라우저 추천 요청 | 추천 3개 반환 및 메뉴 표시 확인 |
| 고객 브라우저 설정·추천 응답 | HTTP 200 |
| 고객 브라우저 JavaScript 실행 오류 | 0건 |
| 테스트 후 기존 설정 복구·재조회 | 일치, AI 추천 기본 OFF 유지 |
| RLS | 활성화 유지 |
| anon·authenticated 직접 SELECT/INSERT/UPDATE/DELETE | 8건 모두 42501 권한 거부 |

직접 API와 고객 브라우저 요청은 별도 호출이며 추천 수가 다르다. 실제 결과를
각각 기록했으며 고정된 추천 수나 메뉴가 항상 반환된다는 의미는 아니다.
source: ai는 API 응답값으로, 외부 모델 호출·폴백 여부는 별도로 추적하지 않았다.
직접 쓰기 차단 검사는 WHERE false 및 트랜잭션 롤백으로 데이터 변경 없이 수행했다.

검증 범위는 해당 테스트 매장과 데스크톱 고객 브라우저다. 모든 매장·모바일·음성
기능에 대한 검증이나 이후 상태의 지속적인 모니터링은 포함하지 않는다.

## 증빙

- [deployment.json](deployment.json): 운영 버전 및 상태.
- [ci.json](ci.json): 배포 실행 및 작업별 결과.
- [functional.json](functional.json): 설정·추천·브라우저·복구 결과와 검증 시각.
- [access.json](access.json): 직접 접근 차단 및 적용된 마이그레이션 이력.
- [customer.png](customer.png): 해당 배포에서 촬영한 고객 화면.

인증정보·DB 접속 문자열 및 고객 화면 전체 텍스트는 포함하지 않았다.
앞선 [PR #27 포함 main 검증](../post-pr27-latest-main/README.md)은 별도로 보존했다.
