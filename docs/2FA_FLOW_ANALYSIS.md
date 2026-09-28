# WeMarket 2FA 플로우 분석 리포트

**분석일**: 2026-09-11
**프로젝트**: WeMarket - SaaS QR Menu & Store Management Platform
**버전**: v1.3.0 (커밋 `599b1af` 기준 — 워크트리 A~F 기능별 커밋 분리 완료)
**스택**: Express 5.2 / Prisma / PostgreSQL (Supabase) + Vite 7 + React 19 + Tailwind 4
**형식**: 진행 상황 / 문제점 / 추가 기능 제안 3축

## 1. 진행 상황

### 1.1 이번 세션: 2FA 구현체 이중화(일반 TOTP vs 관리자 SMS OTP) 관통 분석

코드베이스에는 **두 개의 독립적인 2FA 구현체**가 존재한다. 하나는 일반 사용자(스토어 기능)용 `controllers/twoFactorController.js`(291줄)이고, 다른 하나는 관리자/대표용 SMS OTP 기반 `controllers/admin2faController.js`(249줄)이다. 두 구현체가 라우트 레벨에서 동시에 노출되면서 충돌(섀도잉)이 발생한다.

| 항목 | 상태 | 설명 |
|------|------|------|
| 일반 2FA 라우트 배선 | ✅ | `routes/auth.js` 228 `POST /2fa/verify` (public), 213 `GET /2fa/status` (public) |
| 관리자 SMS OTP 라우트 배선 | 🔴 | `routes/auth.js` 234 `POST /2fa/verify` (auth), 235 `GET /2fa/status` (auth) — **앞선 213/228 라우트에 의해 도달 불가(섀도잉)** |
| `verify2fa` 정상 토큰 발급 | 🔴 | 일반 구현은 `res.success({ userId })`만 반환, `signTokens`/`setTokenCookies` 미발급 |
| 토큰 발급 구현 보존 | ✅ | `admin2faController.signTokens`(17–27) + `safeUser`(29–32, password 제거) 정상 동작 |
| 로그인 tempToken 소비 | 🔴 | tempToken(243–249, 5분, body-only)은 관리자 SMS OTP 전용 → 일반 2FA 로그인 흐름은 고아 상태 |
| 2FA 상태 조회 | ✅ | `getStatus`(11–40): `two_factor_enabled`/`two_factor_secret`/`two_factor_backup_codes`, 미등록 유저는 404 |
| 중복 활성화 가드 | ✅ | `enableSetup`(46–58+): 이미 활성화 시 400 반환 |

### 1.2 전체 검증 결과
- 전체 테스트 ✅ 127 suites / 1080건
- lint ✅ 0 에러 / 62 경고
- 대상 파일 실사: `controllers/twoFactorController.js` 1–58, `controllers/admin2faController.js` 1–55, `routes/auth.js` 1–61 및 205–237

### 1.3 마일스톤

| **마일스톤** | **상태** |
|------|------|
| **Q4 완료** (v1.3.0) | ✅ 커밋 `88640da` |
| **보안 검증** (2FA 플로우) | 🔴 2FA 라우트 섀도잉 · 토큰 미발급 이슈 식별 |

## 2. 문제점 분석

범례: `🔴 높음 / 🟡 중간 / 🟢 낮음`

| # | 문제 | 우선순위 | 실사 근거 |
|---|------|:---:|-----------|
| 1 | **일반 2FA 인증 성공 후 세션/토큰 미발급** — `verify2fa`가 `res.success({ userId })`만 반환하므로 클라이언트는 2FA 통과 후에도 인증 상태를 얻지 못함 | 🔴 | `twoFactorController.verify2fa` vs `authController.verify2fa`(121–145, 정상적으로 `signTokens`+`setTokenCookies`) |
| 2 | **admin 2FA 라우트 섀도잉** — `POST /2fa/verify`·`GET /2fa/status`가 public 라우트(228/213)에 먼저 매칭되어 관리자 SMS OTP 라우트(234/235)는 절대 실행되지 않음 | 🔴 | `routes/auth.js` 213–235의 등록 순서 |
| 3 | **tempToken 고아 흐름** — `verifyLogin`(208–256)이 발급하는 로그인 tempToken은 `type:'2fa_pending'`(5분, body-only)으로 관리자 SMS OTP 라우트(231/232)에서만 소비됨. 일반 2FA 로그인 경로에서는 발급 후 소비 지점이 없어 사실상 사용 불가 | 🔴 | `twoFactorController` 243–249 토큰 생성, 소비처는 `admin2faController.verifyTempToken`(37–46)뿐 |
| 4 | **`updateProfile`에 `safeUser` 누락** — 프로필 수정 응답 시 `password` 해시가 그대로 포함될 수 있는 구조 | 🟡 | `authController.updateProfile` 316–319 |
| 5 | **구현체 복제로 인한 유지보수 비용** — JWT 발급 로직이 두 컨트롤러에 분산(`signTokens`가 authController와 admin2faController에 각각 존재) | 🟡 | `authController.js` 32–42, `admin2faController.js` 17–27 |

### 핵심 요약
- 일반(사용자 TOTP) 플로우와 관리자(대표 SMS OTP) 플로우가 **한 `routes/auth.js`에 병렬 배선**되면서 라우트 충돌과 미완성 인증 흐름이 공존한다.
- `admin2faController`의 토큰·safeUser·tempToken 검증 구현은 올바르게 갖춰져 있어, **라우트 순서 정리 + 일반 `verify2fa`에 토큰 발급 로직 보강**만 되면 전체 흐름을 수렴시킬 수 있다.
- `OTP_EXPIRY_MS`는 `config/authConstants.js:7`에서 `process.env.OTP_EXPIRY_MS || 5분`으로 집중 정의되어 있어 만료 정책 변경 지점이 명확하다.

## 3. 추가 기능 제안

### P0 (즉시 개선, 2건)
1. **라우트 순서 정리 및 라우팅 전담 명확화** — public 2FA(213/228)와 auth 2FA(234/235)의 충돌을 해소한다. 관리자 SMS OTP는 `/2fa/settings-otp` 등 별도 하위 경로로 분리해 섀도잉을 제거하고, 둘 중 하나만 활성화하도록 결정하는 것이 먼저다.
2. **일반 `verify2fa`에 토큰 발급 로직 보강** — `authController.verify2fa`(121–145) 패턴(`signTokens` + `setTokenCookies` + `safeUser`)을 `twoFactorController.verify2fa`·`verifyLogin`에도 동일 적용해 "2FA 성공 = 정상 인증 완료"가 보장되게 한다.

### P1 (보완, 2건)
3. **로그인 tempToken 사용 주체 단일화** — 발급(243–249)과 소비(`admin2faController`)의 짝이 맞지 않는 분리를 정리하고, 로그인 2FA(일반/관리자) 경로에서 tempToken이 항상 발급 직후 같은 흐름에서 소비되도록 보장한다.
4. **`updateProfile`(316–319) 응답에 `safeUser` 적용** — 다른 인증 응답과 동일하게 `password` 등 민감 필드를 제거해 일관된 사용자 DTO를 유지한다.

### P2 (정리, 1건)
5. **JWT 발급 유틸 단일화** — `signTokens`·`safeUser`·`verifyTempToken`을 공용 유틸(예: `utils/session.js`)로 이전해 두 컨트롤러의 중복을 제거하고, 향후 third-party 인증(JWT 갱신 등) 확장 시 단일 지점에서 관리한다.