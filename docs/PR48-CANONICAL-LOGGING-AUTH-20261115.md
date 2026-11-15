# PR #48 로그·인증 정본 분리

기준 main: `053ff2996a663db6ff46e583d81da1d14f37f54c`. PR #48 전체 정리와 분리한 최소 변경이다.

## 변경과 실제 import 경로

- `app.mts`, `index.mts`의 logger import를 `utils/logger.ts`에서 `utils/logger.js`로 전환한다.
- 별도 Winston 인스턴스를 만들고 마스킹이 없는 `utils/logger.ts`를 제거한다. JS 정본의 기본·도메인별 로거와 로그 마스킹을 공유한다.
- 세션 조회 없이 JWT 내용을 신뢰하고 개발 기본 secret을 사용하는 `middleware/auth.ts` 사본을 제거한다. 기존 CommonJS 소비자와 tsx ESM의 `.js` import가 `middleware/auth.js` 정본을 사용한다.
- JS 인증의 HS256 제한, access 타입 검사, `AuthSessionService.verifyAccess` 및 선택적 인증 동작은 수정하지 않는다.
- 현재 소스 검색에서 명시적 logger.ts import는 두 서버 진입점이었다. auth.ts 직접 소비자는 발견되지 않았다. 삭제는 향후 tsx의 `.js`→`.ts` 우선 해석에 따른 사본 사용도 방지한다. 이번 검증은 기존 운영 인증 우회가 외부에서 재현됐다는 주장이 아니다.
- `config/prisma.ts`, `utils/sentry.ts` 및 JS 정본은 변경하지 않는다. 공유 wrapper와 지연 로딩을 유지한다. 나머지 중복 파일·의존성·lockfile도 범위에서 제외한다.

## 실제 로더 회귀 검증

`tests/fixtures/canonical-logging-auth.mts`를 `node --import tsx`로 실행한다. Jest의 변환이나 auth mock에만 의존하지 않고, ESM `.js` import와 CommonJS require가 동일 인스턴스/함수를 반환하는지 확인한다. 서버 진입점도 JS import를 사용하는지 검사한다.

- 로그: 실제 Winston 출력 포맷을 메모리 스트림으로 받아 Error/stack, 문자열, 중첩 메타, 객체 메시지의 합성 secret·전화번호가 제거되고 안전한 값은 남는지 검사한다. 기본/도메인별 logger 동일성을 검사한다.
- 인증: 실제 JWT 서명과 실제 `AuthSessionService.verifyAccess`를 사용한다. 저장소 조회와 오류 타입만 가짜로 주입하며, 실제 Prisma·DB는 로드하지 않는다.
- 유효한 header/cookie 토큰의 통과, 최신 세션 역할로 오래된 JWT 관리자 역할 대체, 폐기·만료·없는 세션 거부를 검사한다.
- 선택적 인증은 폐기된 세션을 인증 사용자로 만들지 않고 계속 진행한다. HS384, refresh 타입, sid 없는 토큰, 토큰 없음은 거부한다.
- child process의 네트워크 연결을 차단한다. 인증/결제/AI 외부 API를 호출하지 않는다. 전체 앱 서버는 부팅하지 않는다.
- 수정 전 신규 검사 3건 실패, 수정 후 3건 통과를 확인했다. 단독 실행에서 검색 지연이 있어 `--roots tests`로 검색 범위를 제한했다.

## 결과

```text
node scripts/run-jest.cjs --config jest.config.js tests/unit tests/routes --roots tests --runInBand --coverage=false
216 suites / 1,691 tests PASS

로그·인증 및 기존 startup-module-sharing 집중 검사
5 suites / 43 tests PASS

npm run typecheck:backend
PASS

npm run ai:review:check
5 tests PASS; OFF-only settings match
```

Prisma/Sentry 공유 검사 4개 조합(JS/TS 로드 순서 및 replica 여부)이 집중 검사에 포함된다. backend 전체 검사는 단위·route 범위이며 실제 운영 DB 동시성 또는 운영 서버 E2E 검증과 구분한다.

## 경계

AI 활성화·유료 호출·매장 활성화 플래그는 OFF 전용 설정을 유지한다. 운영 배포·DB 변경·유료 API 호출·실제 고객정보 사용 없음. 이 PR은 운영 배포를 수행하지 않는다. 기존 노출 자격증명 교체와 다른 #48 미반영 항목은 별도 작업이다.
