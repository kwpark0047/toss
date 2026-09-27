# 기능·운영 공백 매트릭스 v1

- 작성 기준일: 2026-09-27
- 대상 저장소: `/mnt/d/wemarket-toss/250105` (`main` 브랜치, inspection HEAD `67b01b8`)
- 문서 목적: 과거 분석 문서의 "완료/부재" 주장과 **현재 코드·설정**을 1:1 대조해 실제 공백과 운영 위험을 P0/P1/P2 로 확정
- 성격: **문서 작성만 수행.** 이 문서 작성 외에는 코드 수정·커밋·리팩터링을 수행하지 않음

---

## 1. 기준·범위·방법론

### 1.1 근거 우선순위

| 순위 | 근거 | 설명 |
|---|---|---|
| 1 | 현재 코드 (`*.ts/mts/js/mjsx`) | 실제 동작을 결정하는 유일한 진실 |
| 2 | 현재 설정 (`docker*`, `render.yaml`, `vercel.json`, `wrangler.jsonc`, `monitoring/**`) | 배포·운영 계약 |
| 3 | Prisma schema / migration | 영속 계약을 결정 |
| 4 | 과거 분석 문서 (`feature-analysis.md`, `PROJECT_ANALYSIS_REPORT_v7.md`, `handoff.md`, `COMPETITIVE_ANALYSIS.md`, `NEXT_TASK.md`, `tasks.md`, `CHANGELOG.md`) | **주장만 참조.** 코드와 충돌 시 현재 코드가 우선 |

> 원칙: 문서 주장은 "구현됨 / 부분 구현 / 실제 공백 / 오래된 제안 / 검증 필요" 5가지로만 분류한다. 추측으로 확정하지 않는다.

### 1.2 조사 범위

- 백엔드 `index.mts` / `app.mts` / `routes/` / `services/` / `middleware/` / `repositories/` / `prisma/`
- 프론트 `frontend/src` (259 파일: 페이지 36, 컴포넌트 141, hook 15, API 모듈 19, context 5)
- 배포 정적 분석: `Dockerfile`, `docker-compose*.yml`, `render.yaml`, `vercel.json`, `wrangler.jsonc`
- 모니터링 정적 분석: `monitoring/prometheus`, `monitoring/loki`, `monitoring/promtail`, `monitoring/alertmanager`, `monitoring/grafana`
- 테스트는 실행 결과로만 기록 (아래 3.1)
- 실제 런타임 검증 불가 항목은 §6으로 명시 분리

### 1.3 상태 분류 정의

| 상태 | 의미 |
|---|---|
| 구현됨 | 현재 코드에서 완결된 경로가 확인됨 (테스트·runtime 검증은 별도) |
| 부분 구현 | 골격은 있으나 핵심 경로/설정/테스트 중 하나 이상 결락 |
| 실제 공백 | 현재 코드·설정에서 기능 경로 자체가 없음 |
| 오래된 제안 | 과거 문서에만 있고 코드 근거 없음 (또는 코드에서 이미 폐기) |
| 검증 필요 | 구현 흔적은 있으나 runtime 계약·설정·효과 검증 불가 |

---

## 2. 근거 요약

### 2.1 테스트 (실행 결과만 기록)

- `npm test` → 종료 코드 `0`
- `Test Suites: 137 passed, 137 total`
- `Tests: 1186 passed, 1186 total`
- 소요 시간 `596.34 s`
- test 스크립트는 `NODE_OPTIONS=--experimental-vm-modules` 적용
- **coverage는 별도 미측정.** 과거 문서의 45%/60%/65%/80% 수치는 재검증 전까지 근거 없음으로 취급

### 2.2 Prisma

- `prisma/schema.prisma` 1,836줄 / model **87개** / enum 3개 / owning relation 110개 / back-reference 110개
- 필드 1,164개 (scalar 944 + relation 220), `@@index` 157개, 유니크 37개, `@updatedAt` 33개
- 모든 model/enum은 `public` 스키마. `auth` 스키마를 `schemas`에 선언하지만 실제 모델 없음 → **선언/실제 불일치(저우선)**
- `stores`가 54개 back-relation을 가진 hub 모델 → 스토어 삭제/합병 시 폭발 위험
- `@map`은 `ai_usage_logs`에만 11개

### 2.3 버전 drift (동일 저장소 내 6개 값)

| 위치 | 값 |
|---|---|
| `package.json` | 1.3.0 |
| `dist/package.json` | 1.3.0 |
| `docker-compose.prod.yml` (`APP_VERSION`, build `VERSION` 기본) | **1.0.0** |
| `CHANGELOG.md` 최신 | v1.3.1 (2026-09-23) |
| `PROJECT_ANALYSIS_REPORT_v7.md` 기준 | 2144a18 / v1.3.0 |
| `handoff.md` / `COMPETITIVE_ANALYSIS.md` | v1.2.0 / v1.1.0 |

### 2.4 배포 topology

- 백엔드: Render `https://wemarket.onrender.com` (free, singapore, autoDeploy)
- 프론트: Vercel `https://wemarket.vercel.app` (`vercel-build` → `frontend/dist`)
- Cloudflare Worker `/api` 설정(`wrangler.jsonc`)은 **현재와 병존하는 레거시** (main=`frontend/worker.js`)
- Docker Compose는 로컬/스테이징 성격의 배포 대안 (Render/Vercel과 병존)

### 2.5 실제 스택

Express 5.2.1 / Prisma 5.22 + PostgreSQL / React 19.2.8 / Vite 7.3.6 / Tailwind CSS 4.3.3 / react-router-dom 6.30.6 / @tanstack/react-query 5.101.4 / Node 22.23.1 (요구 `>=22.22.0`, `.nvmrc` `22.22.0`)

### 2.6 과거 문서 자체 모순 (feature-analysis.md)

- 871~885행: 모니터링 "완비" 제안 ↔ 868행: "모니터링 대시보드 없음" → 자체 모순
- 53개 모델 / 페이지 27개 / Tailwind v3 표기 ↔ 실제 87 / 36 / 4.3.3
- Dockerfile·Compose 부재 주장 ↔ 현재 파일 존재
- 테스트 suite 수·coverage 수치 미재검증
- 카드 번호 평문·모델 중복·문자열 enum·JSON 문자열·암호화 전화번호 검색 등은 **schema/service 재검증 전 확정 공백 아님**

---

## 3. 우선순위·난이도 정의

| 우선순위 | 의미 |
|---|---|
| **P0** | 배포/결제/치명 결함. 트래픽 유입 시 사고. 즉시 착수 |
| **P1** | 핵심 사용자 경로可靠性·권한·관측성에 영향. 차순 착수 |
| **P2** | 품질·정합성·비용. 여유 시 착수 |

| 난이도 | 의미 |
|---|---|
| S | 1줄·설정 값 (환경변수, 상수) |
| M | 단일 파일/함수 단위 수정 |
| L | 여러 파일·모듈 연관 또는 마이그레이션 |
| XL | 아키텍처 변경·외부 시스템 재설계 |

---

## 4. 상세 매트릭스

### 4.1 P0 — 배포/실행 치명 결함

| ID | 항목 | 근거 | 영향 | 구현 범위 | 난이도 | 위험 | 의존성 | MVP 검수 기준 |
|---|---|---|---|---|---|---|---|---|
| P0-01 | `index.mts`가 존재하지 않는 `./app.js` dynamic import | `index.mts:66` `await import('./app.js')` (실제 파일은 `app.mts`) | anomaly detection 초기화가 런타임에 throw. 서버 기동 후 첫 요청 또는 스케줄러 실행 시 장애 | import 경로를 `./app.mjs`/`./app.mts`로 정합 | S | import 실패로 프로세스 크래시 | 빌드 산출물 형태(§4.7) | 서버 기동 후 anomaly 초기화 로그 없이 정상 응답 |
| P0-02 | `dist` 시작점 불일치 (`index.js` vs 실제 `index.mjs`) | `dist/package.json` `main: index.js` / `start: node index.js`; `dist/index.mjs`만 존재. 최상위 `package.json` `main: index.js`도 동일 불일치 | `npm start`/프로덕션 node 실행이 즉시 ENOENT | `main`/`start`를 `index.mjs`로 수정 | S | 수정 누락 시 배포 파이프 전체 실패 | P0-03과 동일 계열 | `node dist/index.mjs` 및 패키지 start 스크립트 정상 기동 |
| P0-03 | `docker-compose.yml` 실행 경로가 존재하지 않는 `app.js` | `docker-compose.yml:122-129` `app.js` 호출 | 로컬/스테이징 compose 기동 실패 | `app.mjs`로 정합 수정 | S | 개발/스테이징 파이프 차단 | P0-02 | `docker compose up` 시 backend 컨테이너 healthy |
| P0-04 | GitHub Actions job이 시작 전 중단 (계정 결제/스펜딩) | CI 로그: `recent account payments have failed or your spending limit needs to be increased` (계정 `kwpark0047-iceu`) | 전체 자동화(빌드·테스트·배포) 파이프라인 정지 | 결제 수단/스펜딩 한도 정리 후 `Re-run failed jobs`. **코드 결함 아님(계정/결제 문제)** | S(환경) | 계정 문제로 코드와 무관하게 CI 전체 무력화 | 결제 수단 정상화 | billing 정리 후 workflow 재실행 성공 |
| P0-05 | `/store/:slug` 라우트 파라미터 불일치 | `frontend/src/App.jsx:224`가 `slug` 전달 ↔ `StoreDisplay.jsx`가 `useParams().storeId` 읽음 | 스토어 공개 페이지가 store를 못 찾아 빈 화면/오류. **직접 유입 핵심 경로** | `slug`로 통일하거나 라우트 파라미터 정합 | S | 고객-facing 404 | 스토어 조회 API slug 지원 여부(§6) | `/store/<실재slug>` 접근 시 해당 스토어 렌더 확인 |

### 4.2 P1 — 신뢰성·권한·관측성

| ID | 항목 | 근거 | 영향 | 구현 범위 | 난이도 | 위험 | 의존성 | MVP 검수 기준 |
|---|---|---|---|---|---|---|---|---|
| P1-01 | `ErrorBoundary` 비작동 | `App.jsx:224` `<ErrorBoundary ... />`가 children 없이 self-closing, `FallbackComponent` 미처리 | 렌더 예외 시 복구 UI 없이 white screen. 전역 장애 대응 불가 | `ErrorBoundary` children 감싸기 + fallback 연결 | M | 흰 화면 지속 | React ErrorBoundary 구현 확인 | 일부 컴포넌트 강제 throw 시 fallback UI 표시 |
| P1-02 | `MenuWorldCup`가 존재하지 않는 `useAuth()._user` 사용 | `frontend/src/pages/MenuWorldCup.jsx:18` `useAuth()._user` | 해당 페이지 렌더 시 user undefined 접근 → 크래시 또는 잘못된 권한 표시 | Auth context의 실제 user 필드(예 `user`)로 정합 | S | 페이지 크래시 | AuthContext 필드명 확정 | MenuWorldCup 렌더 시 인증 사용자 정상 반영 |
| P1-03 | 알림 시스템 이중화 | `react-toastify`와 `sonner` 병행 사용 | 사용자별 알림 UX·일관성 저하, 번들 크기 증가 | 단일 라이브러리 통하거나 역할 명확화 | M | 하위 변경 | 알림 사용처 인벤토리 | 한 라이브러리로 통일 or 근거 문서화 |
| P1-04 | i18n 키 불일치 | `ko/translation.json`에만 존재하는 `admin.dynamicPricing` 등, `en/ja/zh`에 부재 | 비-ko 언어에서 번역 누락(raw key 노출) | ko를 기준으로 en/ja/zh 키 동기화 | M | 다국어 품질 | 번역 워크플로우 | 4개 locale 키 세트 완전 일치 |
| P1-05 | 매장 역할 모델 미확정 (`owner`/`manager`/`store_admin`/`super_admin`) | `ManagerView.jsx`·`BoardWrite.jsx`·`BoardDetail.jsx`는 `store_admin`; `AnalyticsDashboard.jsx`·`StaffManager.jsx`는 `owner`/`manager`; `AdminChatManager.jsx`는 `super_admin`/`owner` sender type | 권한 판정이 화면마다 달라질 수 있음. **API 계약 확인 전 단정 금지** | 전역 사용자 역할 ↔ 매장 멤버 역할의 API 의미 contract 문서화 후 정합 | L | 과도/부족 권한 | 백엔드 권한 매핑 확인(§6) | 역할 매핑 매트릭스가 코드·문서 일치 |
| P1-06 | Prometheus K8s pod SD가 현 topology에서 무효 | `monitoring/prometheus/prometheus.yml` K8s SD; Render/Compose에 K8s API·RBAC 없음 | K8s 계열 알림·대시보드 패널(Pod restart loop 등) 미동작 | K8s SD 제거 또는 노드/Compose SD로 대체 | M | 사일런트 알림 공백 | 알림 규칙 재매핑 | SD 대상이 실제 존재하는 리소스로만 구성 |
| P1-07 | Prometheus가 참조하는 exporter가 prod compose에 없음 | `prometheus.yml`이 `postgres-exporter:9187`, `redis-exporter:9121` scrape; prod compose에 해당 service 없음 | DB/Redis 지표 패널 미동작 → DB/Redis 장애 탐지 공백 | exporter service 추가 또는 해당 scrape job 제거 | M | DB/Redis 장애 미탐지 | 컴포즈 자원 | exporter target이 UP으로 조회되거나 제거 반영 |
| P1-08 | Tempo datasource 선언되나 Tempo service 없음 | `datasources.yaml:43` Tempo `http://tempo:3200`; prod compose에 Tempo 없음 | 트레이스 조회 패널 미작동(또는 빈 화면) | Tempo 배포 또는 datasource 제거 | M | 불필요 datasource 경고 | — | 대시보드 응답 없음(선택 datasource 제거) |
| P1-09 | Grafana dashboard 자동 로드 미보장 | `dashboard` mount(`docker-compose.prod.yml:317-318`)되나 `monitoring/grafana/provisioning` 디렉터리 없음 | JSON dashboard가 자동 임포트 안 되어 빈/기본 대시보드 | provisioning/dashboard YAML 추가 or 수동 임포트 절차 문서화 | M | 대시보드 미표시 | 대시보드 JSON | 기동 시 overview 대시보드 자동 등장 |
| P1-10 | Loki 로그 규칙이 prod compose에 미연결 + LogQL 오류 | `monitoring/loki/rules/logs-rules.yml`(78줄)이 compose에 `logs-rules`/`rules` mount 없음. OOM 규칙 `|= "OOM" or |= "out of memory"`, auth 규칙 `or |=`는 LogQL 문법 오류 의심 | 로그 기반 알림 전부 무동작 또는 부분 오동작 | rules mount 추가 + LogQL 문법 정정 | M | 로그 알림 사일런트 실패 | promtool 검증(§6) | `promtool`-동등 검증으로 규칙 파싱 통과 |
| P1-11 | Alertmanager receiver가 placeholder secret | `alertmanager.yml:55-77` receiver가 `SMTP_PASSWORD`·`SLACK_WEBHOOK_URL`·`PAGERDUTY_KEY` 주입 문자열 없음(`docker-compose.prod.yml:463-474` 주석 예시뿐) | 알림 발송 실패 또는 placeholder로 유출 | 실제 secret 주입 또는 미사용 receiver 제거 | M | 알림 유실 / placeholder 노출 | 배포 secret 관리 | 실수신 테스트 또는 미사용 receiver 정리 |
| P1-12 | Grafana "Active Connections"가 실제 연결 수가 아님 | `wemarket-overview.json` 쿼리가 누적 API 요청 수를 표시 | 연결 지표 오독 → 용량 판단 오류 | 쿼리 정정(연결 게이지 metric) | M | 잘못된 용량 판단 | 올바른 connection metric 존재 여부 | 패널 값이 실제 활성 연결과 일치 |
| P1-13 | Render free 인스턴스 + 자동 배포 | `render.yaml` `plan: free`, `autoDeploy: true` | free 티어 스케일아웃/정지/자동응답 제한, 자동 배포로 인한 미검증 빌드 리스크 | plan 상향 또는 free 운영 수용 명시, autoDeploy 정책 결정 | M(인프라) | 장애·비용 | Render 정책 | 배포 정책 문서화 및 인스턴스 상태 확인 |
| P1-14 | staging 환경 부재 | Render 단일 free, Vercel preview 미정의(`vercel.json`에 preview 없음) | 프로덕션 직접 검증, 회귀 위험 | preview/staging 분리 | L(인프라) | 배포 사고 | 인프라 예산 | staging URL에서 회귀 확인 가능 |


| P1-15 | index.mts:166-172 비 graceful shutdown | `index.mts:166-172` `forceExit.unref(); process.exit(0)`로 graceful shutdown 보장 안 함 | 셧다운 시 트래픽 손실 및 클라이언트 크래시 가능성 | M | 셧다운 중 서비스 불안정, 클라이언트 에러 로그 증가 | — | 셧다운 시 정상 종료 확인 및 클라이언트 연결 정리 검증 |
### 4.3 P2 — 품질·정합성·비용

| ID | 항목 | 근거 | 영향 | 구현 범위 | 난이도 | 위험 | 의존성 | MVP 검수 기준 |
|---|---|---|---|---|---|---|---|---|
| P2-01 | 버전 drift 6종 | §2.3 표 | 릴리스 추적성 저하, 이미지 태그 불일치 | 단일 source로 통합 | S | 롤백 혼선 | — | 단일 값으로 정합 |
| P2-02 | Render build가 `index.mts`를 tsx로 직접 실행 | `render.yaml` start `node --import tsx index.mts` | dev 의존(tsx) 기반 운영 실행, 번들/최적화 없음 | 사전 빌드 산출물 실행으로 전환 | M | 운영 성능·안정성 | P0-02 정합 | 빌드 산출물 기반 start가 prod에서 정상 |
| P2-03 | Cloudflare Worker 레거시 병존 | `wrangler.jsonc` main=`frontend/worker.js` + Vercel + Render 3중 구조 | 라우팅/비용/디버깅 복잡도, `/api` 경로 혼동 | Worker 제거 또는 명확한 역할 정의 | L | 라우팅 버그 | CDN/DNS 구성 확인 | 단일 진실의 API 엔드포인트 맵 |
| P2-04 | auth 스키마 선언 vs 실제 미사용 | `schema.prisma` `schemas=[public, auth]` 선언, auth 모델 없음 | 다중 스키마 마이그레이션 혼란 | 선언 제거 또는 auth 스키마 실제 사용 | S | 마이그레이션 오류 | — | 스키마 선언 = 실제 일치 |
| P2-05 | `stores` hub 모델 54 back-relation | schema 카운트 | 스토어 삭제/병합 시 cascade 폭발, 성능 | 관계 정리/soft delete | L | 데이터 손실 | 스토어 도메인 정책 | 스토어 아카이브 경로 안전한지 확인 |
| P2-06 | 알림 규칙 일부 주석 처리 | `wemarket-alerts.yml` AI latency/fallback, memory, disk, slow query, payment failure 주석 | 핵심 결제/성능 알림 미적용 | 의존성 정리 후 활성화 | M | 결제 장애 미탐지 | §4.2 모니터링 정리 | 결제 failure 알림 실사용 테스트 |
| P2-07 | v7 보고서가 결제 장애를 P0로 기록 | `PROJECT_ANALYSIS_REPORT_v7.md` | (P0-04와 동일) 계정/결제 미해결 상태 지속 | P0-04 해결 | (P0-04) | CI 무력화 지속 | — | P0-04 해결 시 함께 종결 |
| P2-08 | cAdvisor가 `privileged: true` + host rootfs mount | `docker-compose.prod.yml:439-461` 구간 인용, `cador/v0.47.2` privileged | 호스트 격리 약화(로컬/스테이징 한정) | 비-root/축소 mount 검토 | M | 컨테이너 탈출 위험 | 로컬 전용 전제 확인 | 본 저장소에 production 노출 없음 확인 |
| P2-09 | test 스크립트 `experimental-vm-modules` 강제 | `package.json` test script | ESM 강제라 비-ESM 경로 제약, CI/로컬 차이 가능 | 유지 또는 분리 | S | 테스트 불안정 | — | 로컬/CI 동일 결과 |

### 4.4 기능 주장 대조표 (과거 문서 vs 현재 코드)

| 과거 주장 (출처) | 현재 코드 근거 | 분류 |
|---|---|---|
| "모니터링 완비" (feature-analysis 871~885) | rules/rulestore 미연결, SD 무효, exporter/Tempo 없음 (P1-06~11) | **오래된 제안 / 부분만 구현** |
| "모니터링 대시보드 없음" (feature-analysis 868) | 대시보드 JSON 존재 (단 §4.2 provisioning 이슈) | **오래된 주장** (부분 해소) |
| Prisma 모델 53개 (feature-analysis) | 실제 87개 | **오래된 수치** |
| 페이지 27개 (feature-analysis) | 실제 36개 | **오래된 수치** |
| Tailwind CSS v3 (feature-analysis) | 실제 4.3.3 | **오래된 수치** |
| Dockerfile·Compose 부재 (feature-analysis) | 현재 파일 존재 | **오래된 주장** |
| 카드 번호 평문/중복 모델/문자열 enum/JSON 문자열/암호화 전화번호 검색 (feature-analysis) | schema/service 재검증 전 | **검증 필요** (확정 아님) |
| PCI DSS 미비 (feature-analysis) | audit/token/2FA 흔적 존재, 효과 미검증 | **검증 필요** |
| 2FA 흐름 (docs/2FA_FLOW_ANALYSIS.md) | `TwoFactorService.js`, 라우트, user 필드, migration 존재 | **구현됨**(효과 검증 별도) |
| refresh/logout (docs/REFRESH_TOKEN_LOGOUT_ANALYSIS.md) | cookie/httpOnly+localStorage 이중 경로, `AuditLogService`, `tokenCookies.{js,ts}` 존재 | **부분 구현** (revocation/속성 효과 미검증) |
| Sentry (docs/ERROR_HANDLER_SENTRY_ANALYSIS.md) | `frontend/src/lib/sentry.js` `@sentry/react` 동적 import, `Sentry.init`(:74), `AuthContext.syncSentryUser` import | **구현됨**(호출·DSN·활성화 검증 필요, §6) |
| branch coverage 45% / 60% / 65% / 80% | 미재측정 | **검증 필요** (근거 없음) |
| 테스트 "N suites passed" (feature-analysis) | 이번 실행 `137 suites / 1186 tests` 통과 | **오래된 수치** (현행은 §2.1) |

### 4.5 보안·권한 주 대상 상태 (2FA / refresh / Sentry / logout / PCI)

| 영역 | 구현 존재 | 테스트 결과 | runtime 설정 | 통제 효과 | 분류 |
|---|---|---|---|---|---|
| 2FA | `TwoFactorService.js`, `routes/auth.js`, user 필드+migration, context(`getTwoFactorStatus`/`sendTwoFactorOtp`) | 스위트 통과 범위 내 | 미검증 | **미검증** | 부분 구현 |
| refresh token | cookie/httpOnly + localStorage 이중, `tokenCookies` | 스위트 통과 범위 내 | `VITE_HTTPONLY_COOKIE` 모드 | **미검증**(속성·rotation) | 부분 구현 |
| Sentry | `sentry.js` init 존재 | — | DSN/sampling 미검증 | **미검증** | 부분 구현 |
| logout | 로그아웃 경로 존재 | 스위트 통과 범위 내 | **token revocation 미검증** | 미검증 | 부분 구현 |
| PCI DSS | audit/token/2FA 흔적 | — | **미검증** | 미검증 | 검증 필요 |
| 역할(권한) | `owner/manager/store_admin/super_admin` 사용 | — | API contract **미검증** | 미검증 | 검증 필요 |

### 4.6 실행·배포 정합성 요약 (P0 축)

```
Build/Run 경로 3중 불일치:
  package.json main: index.js          ─┐
  dist/package.json start: index.js     ─┼─→ 실제 산출물은 dist/index.mjs  (P0-02)
  index.mts:66 import './app.js'        ─┘  (실제 app.mts / dist/app.mjs)  (P0-01)
  docker-compose.yml:122-129 app.js                                          (P0-03)

Render:  node --import tsx index.mts   (tsx dev 의존으로 prod 실행)          (P2-02)
Dockerfile CMD: node --import tsx index.mts (동일 패턴)
```

### 4.7 빌드 산출물 형태 (P0-01/02 결정에 필요한 사실)

- 소스는 `index.mts` + `app.mts`(TypeScript), `dist`는 `index.mjs` + `app.mjs`(ESM)로 컴파일되어 존재
- 따라서 `dist`를 쓰는 배포 경로와 `tsx`로 소스를 직접 실행하는 경로가 병존하며, **어느 쪽을 정본으로 삼을지 결정이 P0-01/02/03의 선행 조건**

---

## 5. MVP 로드맵 (권장 순서)

### Phase 1 — 배포 즉시성 (P0)

1. **빌드 산출물 정본 결정** (§4.7) → 이후 import/시작점 정합이 한 번에 해결
2. `index.mts:66` import 경로 정합 (P0-01)
3. `package.json` / `dist/package.json` / `docker-compose.yml` 실행 경로 정합 (P0-02, P0-03)
4. GitHub Actions billing 정리 + 워크플로 재실행 (P0-04, 코드 외 환경 조치)
5. `/store/:slug` 파라미터 정합 (P0-05) → 고객-facing 404 제거

**Phase 1 완료 기준:** staging/로컬에서 서버 기동·배포 파이프라인이 실패 없이 통과하고, `/store/<slug>`가 실제 스토어를 렌더.

### Phase 2 — 신뢰성·관측성 (P1)

1. `ErrorBoundary` children/fallback 연결 (P1-01)
2. `MenuWorldCup` auth 필드 정합 (P1-02)
3. Prometheus SD/exporter/Tempo 정리로 "실동작하는 모니터링"만 남기기 (P1-06~08)
4. Loki rules mount + LogQL 정정, 알림 실사용 검증 (P1-10, P2-06)
5. Alertmanager secret 주입 또는 placeholder 제거 (P1-11)
6. 역할 모델 contract 문서화·정합 (P1-05) — 백엔드 권한 매핑 확인 후
7. i18n 키 동기화, 알림 이중화 정리 (P1-03, P1-04)

**Phase 2 완료 기준:** 장애 시 Sentry/로그/알림이 실제로 관측되고, 역할별 접근이 일관되며, 주요 페이지 렌더 예외가 복구된다.

### Phase 3 — 정합성·인프라 (P2)

1. 버전 단일화 (P2-01), Render tsx→빌드 산출물 전환 (P2-02)
2. staging 분리 (P1-14), Cloudflare Worker 레거시 정리 (P2-03)
3. 스키마/관계 정리 (P2-04, P2-05), cAdvisor 권한 축소 (P2-08)

---

## 6. 미해결 검증 항목 (결론 내리지 않음)

| # | 항목 | 왜 미결 | 필요한 검증 |
|---|---|---|---|
| U-01 | 2FA / refresh / logout / Sentry / PCI의 **runtime 효과** | 스위트 통과 ≠ 실환경 동작/설정 확인. DSN·cookie 속성·rotation·revocation 미확인 | 실제 환경 세션 테스트, DSN/ENV 확인, cookie 속성 점검 |
| U-02 | 역할(`owner`/`manager`/`store_admin`/`super_admin`)의 **API 의미** | 화면 사용처만 확인했고 백엔드 권한 매핑 미대조. 매장 멤버 역할 vs 전역 역할 구분 미확정 | 백엔드 권한 매핑 코드/스키마 대조 |
| U-03 | webhook / cron / scheduler 존재 여부 | 재귀 grep이 timeout으로 중단. 부재/존재 결론 내리지 않음 | `routes/services` 내 스케줄·웹훅 등록 정적 탐색(범위 제한) |
| U-04 | Sentry 실제 활성화 | `sentry.js` init 존재만 확인. 호출부·DSN·샘플링·환경분리 미확인 | `AuthContext` 호출 연결 및 빌드 ENV 확인 |
| U-05 | Compose/모니터링 설정의 **런타임 유효성** | 로컬에 `docker`·`promtool`·`logcli` 없음 | 해당 도구 구비 환경에서 `docker compose config`, `promtool check rules` 등 |
| U-06 | 커버리리지 실측 | 미실행 | `npm test -- --coverage` (또는 프로젝트 커버리지 명령) 실행 |
| U-07 | 스토어 slug 조회 API 지원 여부 | P0-05 해결 방식(파라미터 vs API)에 영향 | 스토어 조회 라우트 slug/ID 지원 확인 |
| U-08 | GitHub Actions 결제 해결 후 재실행 결과 | 계정/결제 미해결 상태 | billing 정리 후 `Re-run failed jobs` 성공 확인 |

---

## 7. 부록: 주요 근거 파일 위치

| 범위 | 파일 |
|---|---|
| 엔트리/부팅 | `index.mts`(`:2`,`:66`,`:167-172`), `app.mts`(`:458`) |
| 빌드/배포 | `Dockerfile`, `docker-compose.yml`(`:122-129`), `docker-compose.override.yml`, `docker-compose.prod.yml`(`:317-318`,`:444-474`), `render.yaml`, `vercel.json`, `wrangler.jsonc` |
| 스키마 | `prisma/schema.prisma`, `prisma/migrations/20260729000000_add_users_two_factor_enabled/migration.sql` |
| 인증/2FA | `routes/auth.js`, `routes/socialAuth.js`, `services/TwoFactorService.js`, `services/AuditLogService.js`, `utils/tokenCookies.{js,ts}` |
| 프론트 | `frontend/src/App.jsx`(`:224`), `frontend/src/pages/StoreDisplay.jsx`, `frontend/src/pages/MenuWorldCup.jsx`(`:18`), `frontend/src/contexts/AuthContext.jsx`, `frontend/src/lib/sentry.js`(`:19`,`:74`), `frontend/src/locales/` |
| 모니터링 | `monitoring/prometheus/prometheus.yml`, `monitoring/prometheus/rules/wemarket-alerts.yml`, `monitoring/loki/loki-config.yaml`, `monitoring/loki/rules/logs-rules.yml`, `monitoring/promtail/promtail-config.yaml`, `monitoring/alertmanager/alertmanager.yml`(`:55-77`), `monitoring/grafana/datasources/datasources.yaml`(`:43`), `monitoring/grafana/dashboards/wemarket-overview.json` |
| 과거 문서 | `feature-analysis.md`, `PROJECT_ANALYSIS_REPORT_v7.md`, `NEXT_TASK.md`, `tasks.md`, `handoff.md`, `CHANGELOG.md`, `COMPETITIVE_ANALYSIS.md` |

---

## 8. 변경 이력

| 버전 | 일자 | 내용 |
|---|---|---|
| v1 | 2026-09-27 | 최초 작성. 현재 코드/설정 기준 P0/P1/P2 매트릭스, 오래된 주장 분류, MVP 로드맵, 미해결 8건 정의 |
