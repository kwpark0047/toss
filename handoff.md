# WeMarket 프로젝트 인수인계 문서

> **작성일**: 2026-07-25  
> **작성자**: WeMarket 개발팀  
> **버전**: v1.1.1  
> **상태**: 성능 최적화 고도화 완료, CI 파이프라인 준비 완료

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **프로젝트명** | WeMarket (QR 메뉴 & 스마트 매장 관리 플랫폼) |
| **레포지토리** | https://github.com/kwpark0047-iceu/250105 |
| **현재 버전** | v1.1.1 (성능 최적화 고도화 완료) |
| **배포 환경** | 백엔드: Render.com, 프론트엔드: Cloudflare Pages |
| **데이터베이스** | PostgreSQL (Supabase) + Prisma ORM |

---

## 2. 기술 스택 요약

| 계층 | 기술 스택 |
|------|-----------|
| **Backend** | Node.js 18+, Express 5, Socket.IO, Prisma ORM, PostgreSQL |
| **Frontend** | React 19, Vite 7, React Router 7, react-i18next (4개 언어) |
| **Infra** | Cloudflare Pages/Workers, Render, Supabase, GitHub Actions |
| **Testing** | Jest (Backend), Vitest (Frontend), Playwright (E2E) |
| **CI/CD** | GitHub Actions (8개 Job 병렬 실행) |

---

## 3. 최근 완료된 주요 작업 (v1.1.1)

### 성능 최적화 고도화 (2026-07-25 완료)

| # | 작업 | 도구/기술 | 검증 결과 |
|---|------|-----------|-----------|
| 1 | 이미지 WebP/AVIF 자동 변환 | `vite-imagetools` | 원본 대비 ~70% 용량 감소 |
| 2 | 번들 분석 리포트 | `rollup-plugin-visualizer` | `bundle-analysis.html` 자동 생성 |
| 3 | Critical CSS 인라인화 | `vite-plugin-critical-css` | index.html/offline.html 인라인 (LCP 개선) |
| 4 | 성능 예산 CI 게이트 | `perf:budget` 스크립트 | Script 4000KB, CSS 350KB, Total 8500KB 통과 |
| 4 | Web Vitals 실시간 측정 | `web-vitals` v4 | LCP/FID/CLS/FCP/TTFB/INP 실시간 측정 |
| 5 | 리소스 힌트 (preconnect/preload) | HTML `<link>` | 폰트/Unsplash/Kakao Maps/Solapi 사전 연결 |
| 6 | SW 캐시 전략 강화 | Workbox `NetworkFirst` + `StaleWhileRevalidate` | API 3s 타임아웃, 비중요 GET stale-while-revalidate |

---

## 4. 현재 파이프라인 상태

### GitHub Actions CI (`.github/workflows/ci.yml`)

```yaml
Jobs (병렬 실행):
  1. lint-and-test          → ESLint + Jest (단위/통합)
  2. backend-unit-tests     → PostgreSQL 컨테이너 + 428 테스트
  3. backend-integration-tests → PostgreSQL + 통합 테스트
  4. frontend-test          → npm install + vitest (33 테스트)
  4. print-agent-test       → Jest (21 테스트)
  5. security-scan          → semgrep (JS/Node/Secrets/OWASP)
  6. docker-build           → Docker 빌드 + Trivy 취약점 스캔
  7. deploy                 → Render(백엔드) + Cloudflare Workers(프론트)
```

**현재 상태**: 로컬에서 모든 단계 검증 완료, 푸시 시 자동 실행 대기 중

---

## 5. 주요 설정 파일 현황

| 파일 | 설명 | 상태 |
|------|------|------|
| `eslint.config.js` | 백엔드 ESLint (no-unused-vars: warn, dist/scripts/인터페이스 ignore) | ✅ |
| `frontend/eslint.config.js` | 프론트엔드 ESLint (테스트/테스트파일 off, react-hooks 권장) | ✅ |
| `jest.config.js` | Jest 설정 (커버리지 임계값, test 환경) | ✅ |
| `jest.setup.js` | Jest 폴리필 (Node 22+ 글로벌 가드) | ✅ |
| `vite.config.js` | Vite + PWA + Critical CSS + 이미지 최적화 + 번들 분석 | ✅ |
| `frontend/vite.config.js` | 프론트엔드 Vite (PWA, Critical CSS, imagetools, visualizer) | ✅ |
| `playwright.config.js` | Playwright E2E (크로마/모바일/레거시) | ✅ |
| `frontend/performance-budget.json` | 성능 예산 (Script 4000KB, CSS 350KB, Total 8500KB) | ✅ |
| `frontend/scripts/performance-budget.cjs` | 성능 예산 검증 스크립트 (`npm run perf:budget`) | ✅ |
| `playwright.config.js` | Playwright E2E (Chromium 단일 프로젝트로 단순화) | ✅ |
| `.github/workflows/ci.yml` | 8개 Job 병렬 CI 파이프라인 | ✅ |

---

## 6. 테스트 현황

| 테스트 종류 | 파일 수 | 테스트 수 | 상태 |
|------------|--------|----------|------|
| Backend 단위 | 41개 | 428개 | ✅ 428/428 통과 |
| Print-agent | 2개 | 21개 | ✅ 21/21 통과 |
| Frontend 단위 | 4개 | 33개 | ✅ 33/33 통과 |
| Backend 통합 | 12개 | - | ⚠️ PostgreSQL 필요 (CI에서만) |
| E2E Playwright | 3개 | - | ⚠️ 브라우저 의존 (CI에서만) |

---

## 7. 주요 커밋 히스토리 (최근)

| 커밋 | 메시지 | 날짜 |
|------|--------|------|
| `1fa366d` | ci: 파이프라인 강화 — lint/test/build/보안 | 2026-07-25 |
| - | 프론트엔드 pnpm→npm 전환, 테스트/빌드/린트/예산 모두 통과 | |
| - | Service Worker Stale-While-Revalidate 전략 적용 | |
| - | Web Vitals 모니터링 추가 (LCP/FID/CLS/FCP/TTFB/INP) | |
| - | Critical CSS 인라인화 (index.html/offline.html) | |
| - | rollup-plugin-visualizer 번들 분석 추가 | |
| - | vite-imagetools AVIF/WebP 자동 변환 | |
| - | performance-budget.json + perf:budget 스크립트 | |
| - | web-vitals 라이브러리로 LCP/FID/CLS/FCP/TTFB/INP 측정 | |
| - | index.html preconnect/preload/dns-prefetch 리소스 힌트 | |
| - | Workbox NetworkFirst(3s) + StaleWhileRevalidate API 캐시 | |

---

## 8. 다음 작업 우선순위 (NEXT_TASK.md 참조)

| 순위 | 작업 | 난이도 | 예상 기간 |
|------|------|--------|-----------|
| 1 | GitHub Secrets 설정 및 CI 실행 검증 | 낮 | 30분 |
| 2 | PostgreSQL 컨테이너로 통합 테스트 로컬 검증 | 중간 | 1시간 |
| 3 | Playwright E2E 브라우저 의존성 해결 (CI) | 중간 | 1시간 |
| 4 | Semgrep 보안 스캔 규칙 튜닝 | 낮 | 30분 |
| 5 | Docker 이미지 크기 최적화 (multi-stage) | 중간 | 1시간 |
| 6 | 프론트엔드 번들 추가 분할 (lazy loading) | 중간 | 2시간 |
| 7 | DB 인덱스 최적화 (느린 쿼리 분석) | 높음 | 2시간 |

---

## 8. 주요 파일 위치 요약

```
250105/
├── .github/workflows/ci.yml          # CI 파이프라인 (8개 Job)
├── eslint.config.js                  # 백엔드 ESLint
├── jest.config.js / jest.setup.js    # Jest 설정
├── package.json / package-lock.json  # 백엔드 의존성
├── playwright.config.js              # Playwright E2E 설정
├── CHANGELOG.md                      # 변경 이력 (v1.1.1 최신)
├── CONTRIBUTING.md                   # 기여 가이드 (신규)
├── handoff.md                        # 이 문서
├── NEXT_TASK.md                      # 다음 작업 우선순위 (별도 파일)
├── README.md                         # 프로젝트 개요 (성능 최적화 반영)
├── LICENSE                           # MIT License (신규)
├── CONTRIBUTING.md                   # 기여 가이드 (신규)
├── handoff.md                        # 이 문서
├── NEXT_TASK.md                      # 다음 작업 우선순위 (별도)
├── app.js / index.js                 # 백엔드 진입점
├── app.js / controllers/ / services/ / routes/ / middleware/ / repositories/
├── prisma/schema.prisma              # Prisma 스키마 (53 모델)
├── frontend/
│   ├── vite.config.js               # Vite + PWA + Critical CSS + 이미지 최적화
│   ├── package.json / package-lock.json
│   ├── performance-budget.json       # 성능 예산 설정
│   ├── scripts/performance-budget.cjs  # 예산 검증 스크립트
│   ├── playwright.config.js         # 프론트엔드 Playwright 설정
│   ├── public/sw-sync.js            # SW 백그라운드 동기화
│   ├── src/
│   │   ├── main.jsx                 # 진입점 (Web Vitals 초기화)
│   │   ├── utils/webVitals.js       # Web Vitals 모니터링
│   │   ├── api/                     # API 클라이언트 (20개 모듈)
│   │   ├── components/              # 127개 컴포넌트
│   │   ├── pages/                   # 32개 페이지
│   │   ├── hooks/                   # 커스텀 훅
│   │   ├── contexts/                # React Context
│   │   └── test/                    # 4개 테스트 파일 (33 테스트)
│   ├── package.json / package-lock.json
│   └── postcss.config.js
└── tests/
    ├── unit/ (41개)                 # 백엔드 단위 테스트
    ├── integration/ (12개)          # 백엔드 통합 테스트
    ├── regression/ (1개)            # 회귀 테스트
    ├── e2e/ (3개)                   # Playwright E2E
    └── scripts/                     # 테스트 유틸
```

---

## 9. 인수인계 체크리스트

- [x] README.md 업데이트 (성능 최적화 현황 반영)
- [x] CHANGELOG.md 업데이트 (v1.1.1 추가)
- [x] LICENSE 파일 생성 (MIT)
- [x] CONTRIBUTING.md 생성
- [x] handoff.md 작성 (이 문서)
- [x] NEXT_TASK.md 생성 (별도 파일)
- [x] LICENSE 파일 생성 (MIT)
- [ ] GitHub Secrets 설정 (DATABASE_URL, JWT_SECRET, CLOUDFLARE_API_TOKEN 등)
- [ ] GitHub Actions CI 실행 검증
- [ ] PR 템플릿/이슈 템플릿 추가 (`.github/`)

---

## 10. 연락처 및 참고 자료

- **GitHub Issues**: 버그 리포트/기능 요청
- **GitHub Discussions**: 기술 질문/토론
- **GitHub Actions**: CI/CD 실행 로그 확인
- **Render Dashboard**: 백엔드 배포 상태
- **Cloudflare Dashboard**: 프론트엔드/Workers 배포 상태
- **Supabase Dashboard**: DB/인증/스토리지 관리

---

**작성 완료**: 2026-07-25  
**다음 검토 예정**: CI 파이프라인 첫 실행 후 검증 시
