# WeMarket - Error Handler / Sentry 분석 리포트

**분석일**: 2026-09-11
**프로젝트**: WeMarket - SaaS QR Menu & Store Management Platform
**버전**: v1.3.0 (커밋 `599b1af` 기준 — 워크트리 A~F 기능별 커밋 분리 완료)
**스택**: Express 5.2 / Prisma / PostgreSQL (Supabase) + Vite 7 + React 19 + Tailwind 4
**형식**: 진행 상황 / 문제점 / 추가 기능 제안 3축

---

## 1. 진행 상황

### 1.1 이번 세션: Error Handler / Sentry 초점 검증

| 항목 | 상태 | 설명 |
|---|---|---|
| 중앙 에러 핸들러 (`utils/errorHandler.js`) | ✅ 구현 | `AppError`(L3–12) + `errorTypes`(L14–130) — AUTH 1001~1011 / VALIDATION 1101~1104 / RESOURCE 2001~2012 / DB 5001~5004 / EXTERNAL 5010~5011 / FILE 5020~5021 / INTERNAL 9999. 응답 매핑 L133–198, `logError` L188–208, exports L210–215 |
| Sentry 로거 (`utils/sentry.js`) | ✅ 구현 | `initSentry` L29–63 — test 환경(31)·`SENTRY_DSN` 부재(33–37) 시 `null`. prod `tracesSampleRate: 0.1`(41–58), `beforeSend`가 `request.headers` 삭제(48–53). `captureException` L70–74, `captureMessage` L82–86 |
| Sentry 앱 연결 (`app.mts`) | ✅ 연결됨 | L21 import → L32 `initSentry()` → **L451–452 `Sentry.setupExpressErrorHandler(app)`** → L454 `app.use(errorHandler)`보다 먼저 장착 |
| `errorHandler.js` ↔ Sentry | ⚠️ 이중 구조 | **Sentry는 app 레벨 연결됨 (app.mts 21/32/451–452), `utils/errorHandler.js` 자체는 미사용** — `errorHandler.js` 내 커스텀 경로는 Winston 로그에만 의존 |
| 전역 크래시 감시 | ✅ 구현 | `app.mts` L33 `alerting.registerGlobalHandlers()` — unhandledRejection / uncaughtException 경로 담당 |
| 404 처리 | ✅ 구현 | `app.mts` L440–448 임계 로그 + JSON 응답 (커스텀 errorTypes 미사용 — 문제점 5) |
| 웹훅 에러 방어 (기존 검증 연계) | ✅ 구현 | `tossWebhookAuth.js` 4계층 — ④ HMAC-SHA256(L39–73) / ① 공유 시크릿(L127–131) / ② IP IPv4 CIDR(L133–143) / ③ 레거시 Basic(L145–151) |

**핵심**: 중앙 에러 코드(`errorTypes` 1001~9999)와 `AppError` 중심 설계가 정착되어 있고, Sentry는 미들웨어 체인 최상단(451–452)에서 Express 표준 오류를 선점 수집하는 구조다. 단, `utils/errorHandler.js`가 Sentry를 직접 알지 못해 오류 기록 경로가 Winston(test/운영 로그)과 Sentry(app 레벨)로 분리된 이중 구조다 — 오류 누락 없이 동작하지만 커스텀·비-Express 경로의 수집 보장은 app 레벨 장착 여부에 전적으로 의존한다.

### 1.2 전체 검증 결과

| 항목 | 결과 |
|---|---|
| 전체 테스트 | ✅ **127 suites / 1080건** 통과 |
| Lint | ✅ **0 에러 / 62 경고** |
| Sentry 패키지 | `@sentry/node ^10.67.0` (v10 `setupExpressErrorHandler` — deprecated `Sentry.Handlers` 대체) |
| 인증·웹훅 검증 | ① 2FA / ② Refresh Token·Logout 분석 리포트와 동일 기준 (커밋 `88640da`) |

### 1.3 마일스톤

| **마일스톤** | **상태** |
|---|---|
| **Q4 완료** (v1.3.0) | ✅ 커밋 `88640da` |
| **보안 검증** (Error Handler / Sentry) | ✅ errorTypes 1001~9999 중앙화 + Sentry app 레벨 연결 (`app.mts` 451–452) — 오류 수집 공백 보강은 문제점 1~3 참조 |

---

## 2. 문제점 분석

범례: 🔴 높음 / 🟡 중간 / 🟢 낮음

| # | 문제 | 우선순위 | 실사 근거 |
|---|---|---|---|
| 1 | **Sentry DSN 부재 시 오류 수집 조용한 공백** — `initSentry`가 `SENTRY_DSN` 미설정이면 `null`을 반환하고, `app.mts`가 `if (sentryClient)`로 `setupExpressErrorHandler` 장착을 생략한다. DSN 누락 시 어떤 경고·로그도 없이 Sentry가 조용히 꺼진다 | 🔴 높음 | `utils/sentry.js` L33–37, `app.mts` L451–452 |
| 2 | **오류 기록 이중 경로 (Winston vs Sentry) 분리** — `utils/errorHandler.js`(`logError` L188–208)는 순수 Winston 전용이며 Sentry를 import/호출하지 않는다. Express 표준 오류는 `setupExpressErrorHandler`(451–452)가 선점 수집하지만, Express 미들웨어 체인을 우회하는 경로(타이머·이벤트 리스너·백그라운드 잡·미들웨어 로드 이전 예외)는 Sentry로 전송되지 않는다 | 🔴 높음 | `utils/errorHandler.js` 전체(Sentry import 부재), `app.mts` L451–454 |
| 3 | **비동기/전역 예외의 Sentry 수집 보장 부재** — `sentry.js`의 `captureException`(70–74) 래퍼가 있으나 이를 명시적으로 호출하는 지점이 앱에 없다. `process.on` 전역 후킹은 `alerting.registerGlobalHandlers()`(33)가 담당하고 이 역시 Sentry에 연결되지 않아, unhandledRejection/onWarning 계열 예외가 Winston/Sentry 어디에도 남지 않을 수 있다 | 🟡 중간 | `utils/sentry.js` L70–74, `app.mts` L33 |
| 4 | **`beforeSend` 필터가 헤더만 탈락** — 요청 헤더 삭제(48–53)는 필수 보안 필터지만, `http.response`, `extra`(에러 컨텍스트)에 실린 민감 필드(세션·쿠키·요청 바디 일부)는 필터 밖이다. 전송 전 가명화(pseudonymization) 스키마가 헤더 외 확장돼 있지 않다 | 🟡 중간 | `utils/sentry.js` L48–53 |
| 5 | **404 응답이 `errorTypes` 체계 미사용** — `app.mts` L440–448의 404 핸들러는 커스텀 `errorTypes.NOT_FOUND(2001)`을 사용하지 않고 HTTP 404 응답만 반환한다. 클라이언트가 성공/에러를 `code` 필드로 판별할 수 없는 비일관 구간이 남는다 | 🟢 낮음 | `app.mts` L440–448, `utils/errorHandler.js` L14–130 |

---

## 3. 추가 기능 제안

### P0 (긴급, 2건)

1. **Sentry DSN 미설정 시 경고 로그 추가** — `initSentry`의 null 반환 분기(L33–37)에 `logger.warn`/콘솔 경고를 남겨 운영자가 오류 수집 공백을 인지하도록 한다. CI/스테이징에서 DSN 유효성 검증(체크 명령)도 함께 제안.
2. **`utils/errorHandler.js`에 Sentry 연동** — `logError`(~188–208)에서 `captureException` 호출로 Express 밖 경로도 수집하거나, `AppError` 기록 시 Sentry 컨텍스트(코드·statusCode)를 함께 첨부한다. 현재의 "app 레벨 선장착(451–452) → errorHandler(454)" 이중 구조를 단일화한다.

### P1 (중요, 2건)

3. **전역 비동기 예외를 Sentry로 결합** — `alerting.registerGlobalHandlers()`(app.mts 33)가 처리하는 unhandledRejection/uncaughtException을 `sentry.js`의 `captureException`과 연결해, Sentry 활성 시 자동 전송되도록 보강한다.
4. **`beforeSend` 필터 확장** — 헤더(L48–53)뿐 아니라 `event.extra`·`http.response`에서 세션 토큰·시크릿 키 이름·요청 바디 민감 필드를 탈락시키는 정규화 레이어를 추가한다.

### P2 (제안, 1건)

5. **404 응답에 `errorTypes.NOT_FOUND(2001)` 적용** — `app.mts` L440–448을 중앙 체계와 통일해 클라이언트가 항상 `{ code, message }`로 오류를 식별하게 한다.