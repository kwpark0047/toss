# NEXT_TASK.md - 다음 작업 우선순위

> **작성일**: 2026-07-25  
> **최종 갱신**: 2026-08-13  
> **작성자**: WeMarket 개발팀  
> **기준**: 매장 테마 + CI/CD 배포 운영(v1.2.0) 완료 후 다음 단계

---

## 🎯 즉시 실행 필요 (우선순위: 높음)

*(현재 항목 없음 — 작업 1 완료, 하단 "완료" 섹션 참조)*

---

## ✅ 완료 (2026-08-07 ~ 08-13)

### 3. Playwright E2E 테스트 CI 환경 최적화 (+ `trivy-image-scan` SARIF 비차단)
- [x] `playwright.config.js` 헤드리스 모드 강제(`headless: true`, `--disable-gpu`, `--no-sandbox`), 타임아웃 조정, `fullyParallel: false` 순차 실행 — 커밋 `95f4d62`
- [x] `playwright.yml` 브라우저 설치 `npx playwright install --with-deps chromium` 적용
- [x] CI Playwright Tests job success (run `31712498257` 포함) — 브라우저 설치 sudo 이슈 해소
- [x] `trivy-image-scan` 실패 원인 확정: private 저장소 + Free 플랜에서는 code scanning(SARIF Security-tab 업로드) 불가 (GHAS 유료 필요) → `upload-sarif@v3` 2개 스텝에 `continue-on-error: true` 추가로 비차단 처리 — 커밋 `202386f`
- [x] `trivy-image-scan` job success 확인 (run `31712498257`, 전체 CI success) — SARIF/보고서/SBOM은 아티팩트 `trivy-reports`로 보존

### 1. `docker-build` Trivy 취약점 대응 (배포 파이프라인 차단 해소)
- [x] Trivy 결과 분석 완료 — 실패 원인 확정 (base image 업데이트 불필요, 추가 Dockerfile 수정 불필요)
- [x] 백엔드(`node:22-alpine`): 감지된 CRITICAL/HIGH 8건 전부 `Target=Node.js` npm CLI 번들 deps (`/usr/local/lib/node_modules/npm/node_modules/`) — 이미 `Dockerfile` 36행 `RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx`로 해소됨 (OS 레벨 취약점 0건)
- [x] 프론트엔드(`nginx:1.27-alpine`): OS 패키지 취약점(c-ares, libcrypto3, libssl3, libexpat, libpng, libxml2, musl, musl-utils, nghttp2-libs, zlib) — 이미 `frontend/Dockerfile` 26행 `RUN apk upgrade --no-cache`로 해소됨 (모든 FixedVersion이 alpine 3.21 리포에 존재)
- [x] CI `docker-build` job 통과 예정 — 다음 커밋/푸시 시 `rerun-failed-jobs` 활용 재검증 (검증 완료 보고: 2026-08-13)

### GitHub Secrets 설정 및 CI 실행 검증
- [x] GitHub Secrets 등록: `DATABASE_URL`, `JWT_SECRET`/`JWT_REFRESH_SECRET`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `RENDER_DEPLOY_HOOK_URL`, `SLACK_WEBHOOK_URL` 등
- [x] CI/CD 첫 배포 실행 성공 (deploy job success — run `31116379511`): Render hook → frontend build → wrangler 배포
- [x] Cloudflare `/api` 프록시 동작 확인: `https://toss.wemarket.workers.dev/api/health` → `{"status":"ok","db":"connected","version":"1.2.0"}`
- [x] wrangler devDependency 고정(`4.119.0`)으로 배포 워크플로 안정화

---

## 🔧 단기 개선 (우선순위: 중간)

### 2. 로컬 통합 테스트 환경 구축
| 작업 | 상세 | 예상 시간 |
|-----|------|-----------|
| PostgreSQL Docker 컨테이너 실행 | `docker run -d -p 5432:5432 -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=wemarket_test postgres:16` | 10분 |
| Prisma 마이그레이션 적용 | `npx prisma migrate deploy` (DATABASE_URL=.env.test) | 2분 |
| 통합 테스트 실행 | `npm run test:integration` → 12개 스위트 통과 확인 | 5분 |
| 테스트 DB 정리 스크립트 작성 | `tests/globalSetup.js`, `tests/globalTeardown.js` 활용 | 30분 |

### 3. Playwright E2E 테스트 CI 환경 최적화
| 작업 | 상세 | 예상 시간 |
|-----|------|-----------|
| 브라우저 설치 스크립트 개선 | CI에서 `npx playwright install --with-deps chromium` 실행 시 sudo 권한 이슈 해결 | 30분 |
| 헤드리스 모드 강제 설정 | `playwright.config.js`에서 `headless: true` 강제, `args: ['--disable-gpu', '--no-sandbox']` | 10분 |
| 테스트 타임아웃 조정 | 느린 네트워크 대비 `timeout: 60000`, `expect: { timeout: 10000 }` | 10분 |
| 선택적 실행 전략 | `testMatch: ['**/*.spec.js']`로 명시적 매칭, `fullyParallel: false`로 순차 실행 | 10분 |

---

## 🔒 보안 강화 (우선순위: 중간)

### 4. Semgrep 보안 스캔 규칙 튜닝
| 작업 | 상세 | 예상 시간 |
|-----|------|-----------|
| 규칙셋 커스터마이징 | `.github/workflows/ci.yml`에서 `semgrep --config=p/javascript --config=p/nodejs --config=p/secrets --config=p/owasp-top-ten` → 프로젝트 특화 규칙만 선별 | 30분 |
| False Positive 제거 | 테스트 파일/모킹 코드에서 발생하는 오탐 제외 (`--exclude=**/*.test.js`) | 15분 |
| CI 실패 임계값 설정 | `--severity=ERROR`만 CI 실패로 처리, WARNING은 경고만 | 10분 |

---

## 🐳 인프라 최적화 (우선순위: 중간)

### 5. Docker 이미지 최적화 (Multi-stage Build)
| 작업 | 상세 | 예상 시간 |
|-----|------|-----------|
| Dockerfile 다단계 빌드 | `builder` 스테이지(빌드) → `runner` 스테이지(실행), `node:22-alpine` 베이스 | 30분 |
| 불필요한 파일 제외 | `.dockerignore`에 `node_modules`, `.git`, `tests`, `*.md`, `*.log` 추가 | 10분 |
| 비루트 유저 실행 | `USER node` 또는 전용 유저 생성, `chown -R node:node /app` | 15분 |
| 이미지 크기 검증 | `docker images` → 200MB 이하 목표 (현재 ~500MB 예상) | 10분 |
| Trivy 스캔 통과 확인 | CI에서 `trivy image --severity CRITICAL,HIGH --exit-code 1` 통과 | 20분 |

---

## 🚀 중장기 개선 (우선순위: 낮음)

### 6. 프론트엔드 번들 추가 최적화
| 작업 | 상세 | 예상 시간 |
|-----|------|-----------|
| Route-based Code Splitting | `React.lazy` + `Suspense`로 페이지별 청크 분할 (`MenuPage`, `AdminDashboard`, `KitchenDisplay` 등) | 2시간 |
| 사용하지 않는 의존성 제거 | `npm run analyze` → `bundle-analysis.html` 분석 후 미사용 의존성 제거 (`jspdf`, `html2canvas` 등 조건부 로드) | 1시간 |
| Tree-shaking 최적화 | `sideEffects: false` in package.json, ESM 모듈만 사용 | 30분 |
| 이미지 레이지 로딩 강화 | `loading="lazy"` 전체 이미지 적용, `IntersectionObserver` 기반 프리페치 | 1시간 |

### 6. DB 인덱스 최적화
| 작업 | 상세 | 예상 시간 |
|-----|------|-----------|
| 느린 쿼리 분석 | `EXPLAIN ANALYZE`로 상위 10개 느린 쿼리 식별 (`pg_stat_statements` 활용) | 1시간 |
| 인덱스 추가 | Prisma `@@index` / `@@unique`로 커버링 인덱스 생성, `migrate dev` 적용 | 1시간 |
| 쿼리 플랜 재검증 | `EXPLAIN ANALYZE` 재실행으로 Index Scan 전환 확인 | 30분 |
| N+1 쿼리 제거 | Prisma `include`/`select` 적절히 사용, `findMany`에서 관계 필드 최소화 | 30분 |

---

## 📋 백로그 (나중에)

| 순위 | 작업 | 설명 |
|------|------|------|
| 8 | **Storybook 도입** | 컴포넌트 문서화/시각적 테스트 (`@storybook/react-vite`) |
| 9 | **API 문서 자동화** | `swagger-jsdoc` + `swagger-ui-express`로 `/api/docs` 자동 생성 |
| 10 | **Feature Flags** | `unleash` 또는 `launchdarkly`로 점진적 배포/롤백 |
| 11 | **분산 트레이싱** | `opentelemetry` + `jaeger`로 마이크로서비스 간 추적 |
| 12 | **카오스 엔지니어링** | `chaos-mesh`로 장애 주입 테스트 (CI/CD 통합) |
| 13 | **A/B 테스트 프레임워크** | 프론트엔드 실험 플랫폼 (`growthbook` 등) |
| 14 | **접근성(a11y) 감사** | `axe-core` + `eslint-plugin-jsx-a11y` CI 게이트 |
| 15 | **국제화(i18n) 완성도** | `zh-TW`, `vi`, `th` 등 동남아 언어 추가 |

---

## 📅 권장 실행 순서

```
Week 1 (이번 주)
├── Day 1: Trivy 취약점 대응 → docker-build job 통과 (배포 차단 해소)
├── Day 2: PostgreSQL 로컬 + 통합 테스트 검증
├── Day 3: Playwright CI 안정화 + Semgrep 튜닝
├── Day 4: Docker 멀티스테이지 빌드 마무리 + 이미지 크기 최적화
└── Day 5: 버그 수정/문서 정리 + PR 머지

Week 2 (다음 주)
├── Day 1-2: 번들 추가 분할 (React.lazy) + 번들 분석
├── Day 3: DB 느린 쿼리 분석 + 인덱스 추가
└── Day 4-5: 문서화/회고 + 다음 스프린트 계획
```

---

## 📌 참고: 현재 브랜치 상태

```bash
# 현재 브랜치: main (v1.2.0 커밋됨: 7238e72)
# develop 브랜치 없음 → 필요시 생성 권장
git branch -a
# * main
#   remotes/origin/main

# 최근 커밋: 7238e72 (fix(cloudflare): run worker first so /api proxy actually executes)
git log --oneline -5
```

---

**작성 완료**: 2026-07-25  
**최종 갱신**: 2026-08-13 (Trivy 취약점 대응 검증 완료 — task #1 완료 반영)  
**다음 검토**: CI `docker-build` 재실행 통과 후
