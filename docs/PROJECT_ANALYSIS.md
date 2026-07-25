# WeMarket 프로젝트 분석 보고서 (PROJECT_ANALYSIS)

**분석일:** 2026-07-21
**프로젝트 경로:** `D:\wemarket-toss\250105`
**분석 목적:** 진행 상황 파악, 문제점 식별, 고도화 방향 제안

---

## 1. 진행 상황 (Progress)

### 1.1 백엔드 규모
- **총 181 files / 약 24,800 lines**
- routes: 46 files (7,429 lines)
- controllers: 41 files (4,632 lines)
- services: 36 files (6,731 lines)
- repositories: 22 files (3,124 lines)
- middleware: 11 files (641 lines)
- socket: 1 file (213 lines)
- utils: 24 files (1,676 lines)
- **stub/빈 파일: 0** (모든 계층 실제 구현됨)

### 1.2 프론트엔드 / 데이터 / 테스트
- frontend: pages 32, components 127
- Prisma 모델: 53개
- 테스트: backend `.test.js` 52 files (통합/단위 혼합)

### 1.3 최근 변경 이력 (CHANGELOG.md 기준)
- v1.1.0 (2026-07-20): i18n 다국어 (ko/en/ja/zh, 4 locale), Express 5.2 Router 패턴 재구성, print-agent 통합, 보안(CSP nonce, XSS sanitizer, CORS domain.js 분리), 테스트 인프라 확충, pnpm 마이그레이션, GitHub Actions CI, TWA 설정
- v1.0.9: 카카오 알림톡, 로컬 프린트 에이전트, 포인트 적립, ESC/POS, Vercel→Cloudflare Pages

**결론:** 백엔드/프론트엔드 모두 운영 가능 수준의 완성도. 다만 일부 보안·문서·의존성 부채가 존재.

---

## 2. 문제점 (Issues)

### 🔴 심각 (Severe)

#### 1. cspNonceMiddleware 비활성화
- **위치:** `app.js` line 118 (주석 처리됨)
- **원인:** `middleware/cspNonce.js`가 `res.setHeader('Content-Security-Policy', ...)`를 무조건 호출 → helmet(line 54-80)가 이미 설정한 CSP 헤더와 충돌하며 **요청이 hangs** (통합 테스트 5000ms 타임아웃 유발, 진단 완료)
- **영향:** CSP nonce 보안 기능이 빠진 채 운영 중. helmet 기본 CSP만 동작 (nonce 없음 → XSS 방어 약화)
- **해결 필요:** helmet의 내장 nonce 지원(`'nonce-<%= nonce %>'` 디렉티브 + `res.locals.cspNonce`)으로 통합. cspNonce 미들웨어는 헤더를 직접 setHeader 하지 않고 helmet nonce를 재사용하도록 리팩터

#### 2. 문서 오염 (README.md == ANALYSIS_REPORT.md v2.1.md)
- **현상:** `README.md` 와 `ANALYSIS_REPORT.md`(v2.1) 가 **동일한 i18n 프로젝트 보고서**(2025-07-19) 임
- **문제:** 실제 프로젝트 README 가 아님. 새 사용자/배포자 혼동, 리포지토리 진입점 오염
- **해결 필요:** 실제 프로젝트 README 로 교체 (기존 i18n 보고서는 별도 파일로 백업)

### 🟡 중간 (Medium)

#### 3. 낡은 의존성
- `jest ^25.5.4` (매우 오래됨, 2020년대 초반) + `express ^5.2.1` (Express 5)
- 테스트 스크립트가 `--forceExit --detectOpenHandles` 사용 → 열린 핸들(socket.io 등) 관리 미흡 징후
- **권장:** jest 최신으로 업그레이드, open handle 정리(테스트 종료 시 socket.io/io close)

#### 4. responseFormatter 기본 200
- `res.success(data, msg='Success', statusCode=200)` — 호출자가 statusCode 미전달 시 200
- 생성/갱신 API가 201/204 를 안 줌 → REST 관례 위반 (클라이언트는 success 플래그로 판단하므로 동작은 됨)
- **권장:** `res.created()` / `res.updated()` 헬퍼 추가, 컨트롤러 점진적 마이그레이션

#### 5. 테스트 커버리지 편중
- backend 통합 테스트는 일부 라우트만, frontend 컴포넌트 테스트는 소수, E2E spec 대부분 제거됨
- **권장:** 핵심 플로우(주문→결제→영수증) E2E 복원, routes별 단위 테스트 균등화

### 🟢 경미 (Minor)

#### 6. 과도하게 작은 모듈
- 미들웨어 2개 / utils 1개가 10줄 미만 → 기능 분산 가능성
- **권장:** 응집도 평가 후 통합 또는 책임 명확화

#### 7. Monitoring.record 미모의 경고
- 테스트 중 `Monitoring.record` 가 prisma 미모의 상태에서 경고 출력 (무해하나 노이즈)
- **권장:** jest.setup 에서 Monitoring 모듈 mock 처리

---

## 3. 추가 기능 제안 (Feature Proposals)

1. **관리자 분석 대시보드 고도화** — admin 라우트는 기본 CRUD 위주. 매출/방문/인기메뉴 시각화
2. **멤버십/구독 UI** — points 적립은 있으나 멤버십 등급·구독 플랜 프론트 연동 필요
3. **리뷰 프론트엔드 연동** — reviews 라우트는 있으나 MenuPage 등 클라이언트 노출 미흡
4. **OpenAPI/Swagger 자동화** — 현재 `docs/swagger` 수동 정의. 라우트에서 자동 생성 권장
5. **E2E 테스트 복원** — Playwright 설정은 있으나 spec 대부분 제거. 핵심 플로우 복원
6. **로그 중앙집중** — pino 다중 로거가 있으나 외부 aggregator(Sentry/CloudWatch) 연동 없음
7. **AI 메뉴 추천** — `routes/ai.js` 존재하나 실제 추천 로직 보강
8. **다국어 영수증/알림** — i18n 됐으나 알림톡/영수증 템플릿은 한국어 고정

---

## 4. 우선순위 액션 플랜

| 우선순위 | 항목 | 작업 |
|---|---|---|
| P0 | 심각1 | cspNonce ↔ helmet nonce 통합 (보안 복구) |
| P0 | 심각2 | README.md 실제 README 교체 + i18n 보고서 백업 |
| P1 | 중간3 | jest 업그레이드 / open handle 정리 |
| P1 | 중간4 | responseFormatter 201/204 헬퍼 |
| P2 | 중간5 | E2E / 단위 커버리지 보강 |
| P3 | 경미6/7 | 모듈 통합 / Monitoring mock |
