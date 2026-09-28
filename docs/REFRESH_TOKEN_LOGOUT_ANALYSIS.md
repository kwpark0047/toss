# WeMarket Refresh Token / Logout 플로우 분석 리포트

**분석일**: 2026-09-11
**프로젝트**: WeMarket - SaaS QR Menu & Store Management Platform
**버전**: v1.3.0 (커밋 `599b1af` 기준 — 워크트리 A~F 기능별 커밋 분리 완료)
**스택**: Express 5.2 / Prisma / PostgreSQL (Supabase) + Vite 7 + React 19 + Tailwind 4
**형식**: 진행 상황 / 문제점 / 추가 기능 제안 3축

## 1. 진행 상황

### 1.1 이번 세션: Refresh Token / Logout 플로우 실사

JWT access(2h)/refresh(7d) 2-토큰 방식 + 쿠키 모드(기본 cross-site)와 Bearer 헤더 폴백 기반 인증을 실사했다. 토큰 생성·재발급(`authController.signTokens`·`refreshToken`), 쿠키 옵션 구성(`tokenCookies.buildCookieOptions`·`setTokenCookies`), 라우트 배선(`routes/auth.js` `/refresh-token`·`/logout`), 그리고 로그아웃 시 서버측 무효화 여부까지 코드 기준으로 확인했다.

| 항목 | 상태 | 설명 |
| --- | --- | --- |
| 토큰 발급 | ✅ | `signTokens`가 access `2h` / refresh `7d` JWT를 발급 (`authController.js:29-30, 32-42`) |
| `/api/auth/refresh-token` | ✅ | `validateBody(refreshTokenSchema)` + `refreshToken` 컨트롤러 배선 (`routes/auth.js:191`) |
| 토큰 쿠키 전달 | ✅ | httpOnly/secure/sameSite none(lax) 쿠키 + Bearer 헤더 폴백 (`tokenCookies.js:32-51`, `middleware/auth.js:13-22`) |
| 로그아웃 무효화 | 🔴 | `logout`이 쿠키 삭제만 수행 — refresh 토큰 서버측 폐기 없음 (`authController.js:388-393`) |

### 1.2 전체 검증 결과

- 전체 테스트 ✅ 127 suites / 1080건
- lint ✅ 0 에러 / 62 경고
- 대상 파일 실사: `controllers/authController.js`(406줄), `routes/auth.js`(237줄), `middleware/auth.js`(61줄), `utils/tokenCookies.js`, `config/authConstants.js`

### 1.3 마일스톤

| **마일스톤** | **상태** |
| --- | --- |
| **Q4 완료** (v1.3.0) | ✅ 커밋 `88640da` |
| **보안 검증** (Refresh Token / Logout) | 🔴 refresh 토큰 서버측 무효화 미구현 — 아래 문제점 1·2 참조 |

## 2. 문제점 분석

범례: 🔴 높음 / 🟡 중간 / 🟢 낮음

| # | 문제 | 우선순위 | 실사 근거 |
| --- | --- | --- | --- |
| 1 | 로그아웃이 클라이언트측 쿠키 삭제뿐 — refresh 토큰이 서버에는 계속 유효 | 🔴 | `logout`(`authController.js:388-393`)는 `clearTokenCookies`만 호출, 블랙리스트·서버측 무효화 없음 |
| 2 | Refresh token rotation 미적용 — 토큰 재사용 탐지 불가 | 🔴 | `refreshToken`(`authController.js:360-381`)은 매회 `signTokens` 재발급만 수행, 이전 토큰 폐기·사용 이력 없음 |
| 3 | 토큰 쿠키 path 제한 미적용 — `AUTH_COOKIE_PATH`가 실제 옵션에 미반영 | 🟡 | `buildCookieOptions`(`tokenCookies.js:32-51`)가 `path:'/'` 하드코딩, `AUTH_COOKIE_PATH = '/api/auth'`(`tokenCookies.js:56`) 미사용 |
| 4 | `JWT_REFRESH_SECRET` 미설정 시 access secret으로 폴백 | 🟡 | `JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET \|\| JWT_SECRET` (`authController.js:21`) |
| 5 | refresh 토큰 검증 오류 응답 평탄화 (만료/무효 모두 401) | 🟢 | `refreshToken` catch-all 401 (`authController.js:360-381`) — middleware의 `TOKEN_EXPIRED`(`middleware/auth.js`) 같은 코드 구분 부재 |

## 3. 추가 기능 제안

### P0 (즉시 개선, 2건)

1. **로그아웃 시 refresh 토큰 서버측 폐기**
   `logout`(`authController.js:388-393`)에 토큰 블랙리스트(DB/Redis) 무효화를 추가하고, `refreshToken`(`authController.js:360-381`)이 폐기된 토큰이면 401을 반환해 탈취 토큰의 수명을 차단한다. `clearTokenCookies`는 클라이언트 정리 수단으로 병행 유지한다.

2. **Refresh token rotation + 재사용 감지**
   매 refresh 시 신규 refresh 토큰 발급 후 이전 토큰을 폐기하고, 이미 소비된 토큰이 다시 제출되면 해당 세션을 전체 폐기하는 재사용 탐지를 추가한다. access 2h/refresh 7d 수명 내 탈취 창구를 좁힌다.

### P1 (단기 개선, 2건)

1. **토큰 쿠키 path를 `/api/auth`로 제한**
   `buildCookieOptions`(`tokenCookies.js:32-51`)의 `path:'/'`를 기정의된 `AUTH_COOKIE_PATH`(`tokenCookies.js:56`)로 변경해 토큰 쿠키의 노출 범위를 인증 경로로 축소한다.

2. **`JWT_REFRESH_SECRET` 필수화**
   `authController.js:21`의 `JWT_SECRET` 폴백을 제거하고 부팅 시 미설정이면 FATAL 종료되도록 하여 access/refresh 서명 분리를 강제한다 (기존 `signTokens`의 분리 서명 원칙을 환경 설정에서도 보장).

### P2 (장기 개선, 1건)

1. **refresh 토큰 오류 응답 세분화**
   만료(`token_expired`)·무효(`invalid_token`)·탈취 의심(`token_reuse`) 코드를 구분해 클라이언트가 명확히 재로그인을 유도할 수 있게 하고, `errorTypes`(`utils/errorHandler.js:14-130`)의 AUTH 체계와 정합시킨다.