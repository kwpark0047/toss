# WeMarket 프로젝트 종합 분석 리포트 v7

## 메타데이터
- 분석 일자: 2026-09-17
- 기준 커밋(HASH): `2144a18`
- 현재 버전: v1.3.0 (태그 `v1.0.0`, `v1.3.0` 존재 확인)
- 총 커밋 수: 771개
- 직전 분석(v6.0) 대비 커밋 수: 130개 (`af26c34..HEAD`)
- 총평: B-

## 0. ⚠️ 배포 차단 (P0)

- **GitHub Actions 실행 중단**: CI 워크플로우가 아래 원인으로 실행되지 않습니다.
  - `The job was not started because recent account payments have failed or your spending limit needs to be increased.`
- **조치**: GitHub 로그인 계정(`kwpark0047-iceu`)의 `Settings → Billing and plans`에서 결제 수단/스펜딩 한도 조치 필요 (코드 차원 해결 불가). `NEXT_TASK.md`(2026-08-24)에도 동일 이슈 기록됨.
- **배포 차단 기간 대응**: 로컬 테스트(`npm test`, `npx jest tests/unit/...`)로 CI를 대체해 품질 게이트를 유지합니다.

## 1. 개요

기술 스택(핵심만):

| 영역 | 스택 |
| --- | --- |
| 백엔드 | Node.js 22(`engines.node >= 22.22.0`) + Express 5 + Socket.IO + Prisma 5 + PostgreSQL(Supabase) |
| 프론트엔드 | React 19 + Vite 7 + Tailwind 4 + i18n (ko/en/ja/zh) |
| 배포 | Render(`wemarket.onrender.com`) + Cloudflare Workers(`toss.wemarket.workers.dev`, wrangler `4.119.0` 고정) + Vercel(프론트) |
| 결제·외부 | Toss Payments, Kakao Alimtalk, Gemini API, Naver Place, FCM |
| 모니터링 | Prometheus + Grafana + Loki + Alertmanager |
| 품질 | GitHub Actions 8 Jobs + Husky + Commitlint + Semgrep + Trivy |
| 문서·부가 | pdfkit(`^0.19.1`), Swagger 문서화 |

프로젝트 규모:

| 항목 | 수치 | 항목 | 수치 |
| --- | --- | --- | --- |
| API 라우트 | 67 | 모델(스키마) | 79 |
| 컨트롤러 | 65 | React 훅 | 15 |
| 서비스 | 60 | React 컴포넌트 | 137 |
| Repository | 28 | 페이지 | 36 |
| 미들웨어 | 14 | 문서 | 46 |
| 마이그레이션 | 22 | 테스트 | 147 |

- 경로/파일 수는 CLI로 분석한 `routes/`, `controllers/`, `services/`, `repositories/`, `middlewares/`, `prisma/` `models/`, `hooks/`, `components/`, `pages/`, `docs/`, `tests/` 기준입니다.

## 2. 최근 변경 사항

### 2.1 버전 이력

| 버전 | 일자 | 주요 변경 |
| --- | --- | --- |
| v1.3.0 | 2026-08-18 | **릴리스 준비 완료**: 릴리스 문서화(`38308c1`), 푸드트럭 테마 적용, 스토어 테마 설정 저장·메뉴판 적용, 권한·검증 강화, 정산 CSV, 공개 API, 알림·모니터링, 피처 플래그, 주문·CRM·재고 고도화, 테스트·품질 강화 |
| v1.2.0 | 2026-08-07 | 스토어 테마 설정 저장·메뉴판 적용 (테마 프리셋) |
| v1.1.0 | 2026-07-26 | 운영 안정화: 모니터링·알림·결제 검증 강화 (v6 분석 기준) |
| v1.0.0 | 2026-06-28 | 최초 생산 배포 (v6 분석 기준) |
| v0.9.0 | 2026-06-01 | MVP 기능 완성 (v6 분석 기준) |

### 2.2 최근 고도화 (v6 이후 130커밋, `af26c34..HEAD`)

| 구분 | 커밋 | 내용 |
| --- | --- | --- |
| 릴리스 | `38308c1` | 릴리스 문서화 (v1.3.0) |
| 푸드트럭 테마 | `0c3e016`, `c16517c`, `1a41bfe` | 푸드트럭 테마 개선·적용 |
| 권한·검증 | `46445ca`, `b9756ce`, `77edc13`, `983cd7b`, `7518699`, `db4180e` | OpenAPI 권한 강화, 교차 매장 접근 차단, 사업자·계좌 검증, 동적 가격 검증, 영수증 화이트리스트 |
| 정산·공개 API | `c9299be`, `b8b0402` | 정산 CSV, 공개(매장) API |
| 알림·모니터링 | `7ec3ded`, `89aa937`, `61c8a8d` | 프린트 재시도, 프린트 실패 알림, 알림톡 이력 |
| 피처 플래그 | `d86681f`, `2cb72c7`, `a418acc`, `f8d4f93`, `969665c`, `be972ff` | 피처 플래그 도입·scoped rollout |
| 주문·CRM·재고 | `9b4666a`, `4397251`, `d1cf9ef`, `9251d33`, `ca08d1f`, `4e947d6`, `0fd8edd` | 주문 이력, CRM 승인 절차, 재고 발주 |
| 테스트·품질 | `27c6cfd`, `88dbf1a`, `89c311b`, `017583d`, `0e2623d`, `f9a0c8f` | Jest→Vitest 격리, 배포 게이트+주문 상태 중앙화, 계정 하드닝, AI confidence |

### 2.3 미커밋 변경 (분석 시점, 2026-09-17)

- 작업 트리(`git status` 기준): ` M frontend/package-lock.json`, ` M package.json`, ` M tasks.md`, `?? frontend/dist-probe/`
- 동적 가격/웨이팅 등 `tasks.md` 항목이 체크된 것에 비해 커밋이 일부 지연된 상태이며, 다음 릴리스 시 반영이 필요합니다.

## 3. 발견된 이슈

### 3.1 해결된 이슈 (v6 이후)

| 이슈 | 해결 커밋 |
| --- | --- |
| ReportPdf 생성 실패 | `38308c1` 릴리스 검증 커밋군 |
| OpenAPI 권한 검증 누락 | `46445ca`, `b9756ce` |
| 프린트 재시도 부재 | `89aa937`, `7ec3ded` |
| 알림톡 발송 이력 부재 | `61c8a8d` |
| 영수증 화이트리스트 | `db4180e` |
| 사업자·계좌 검증 누락 | `983cd7b` |
| 교차 매장 접근 | `77edc13` |
| 주문 이력 관리 | `9b4666a`, `4397251` |
| CRM 승인 절차 | `d1cf9ef`, `9251d33` |
| 재고 발주 | `0fd8edd` |
| 피처 플래그 scoped rollout | `d86681f`, `2cb72c7` |
| Jest 테스트 격리 (Vitest 전환) | `88dbf1a`, `89c311b` |
| 배포 게이트 + 주문 상태 중앙화 | `017583d` |
| 계정 하드닝 | `0e2623d` |

### 3.2 심각 (우선 해결 필요)

| # | 이슈 | 상세 | 우선순위 |
| --- | --- | --- | --- |
| 3.2.1 | **Trivy CI 차단** | CI 워크플로우가 Trivy 무결성/빌링 문제로 실행이 중단됩니다. GH Actions가 배포 차단된 상태라 시급하게 해소해야 합니다. | 최우선 |
| 3.2.2 | **기존 `payments.card_number` 평문 백필** | 마스킹 기능은 신규 데이터만 적용되고 기존 데이터가 평문으로 남아 있습니다. 백필 마이그레이션이 필요합니다. | 높음 |
| 3.2.3 | **Toss 웹훅 원본 로깅 민감정보 노출** | `processApproval`에 `sanitizeRawResponse`가 적용됐으나, 웹훅 **원본** 로깅 경로에는 민감정보(`card_number` 등)가 그대로 남습니다. | 높음 |
| 3.2.4 | **AI 기능 스텁 (동적 가격/추천/수요 예측)** | `aiRecommendationsController.js`, `demandForecastController.js`가 스텁이며 동적 가격 규칙 CRUD만 동작합니다. Gemini 연동 실 로직이 없습니다. | 보통 |
| 3.2.5 | **`/api/reports/all` 사용자 권한 검사 부재** | `authMiddleware`만 적용되어 있어 슈퍼어드민(admin) 검사 없이 매출 보고서 전체를 조회할 수 있습니다. | 높음 |

### 3.3 중간 (리팩토링 필요)

| # | 이슈 | 상세 | 우선순위 |
| --- | --- | --- | --- |
| 3.3.1 | `orders.status`, `payments.status` 문자열 | enum/상수화가 되어 있지 않아 오타·불일치 발생 가능성이 있습니다. | 보통 |
| 3.3.2 | **일반 사용자 2FA 미적용** | 관리자 TOTP만 적용되고, 일반 사용자(매장 대표) 2FA는 미적용입니다. | 보통 |
| 3.3.3 | `stores` 모델 비대 | 500+줄, 30+ relation으로 분할이 필요합니다. | 보통 |
| 3.3.4 | `render.yaml` env var 누락 이력 | 누락될 경우 배포 실패 이력이 있으며, `.env.example`과 `.env` 불일치 가능성이 있습니다. | 보통 |
| 3.3.5 | i18n 4 locale | ko/en/ja/zh를 지원하지만, 알림톡·영수증·법적 문서는 한국어 고정입니다. | 낮음 |
| 3.3.6 | **리포트 PDF 한글 폰트 미지원** | pdfkit 한글 폰트(예: NanumGothic) 미등록으로 리포트 PDF가 영문 레이아웃으로 나오고, PDF 테스트가 부재입니다. | 보통 |
| 3.3.7 | ~~태그 불일치~~ | **실제 git에 `v1.3.0` 태그 존재 확인 완료 → 해소.** 다만 향후 릴리스 시 `git tag v1.3.0 && git push --tags` 절차를 정립해야 합니다. | 해소 |

### 3.4 경미 (스타일/구성)

| # | 이슈 | 상세 |
| --- | --- | --- |
| 3.4.1 | Jest+Vitest 이원화 | 테스트 러너가 혼재(Jest 일부 + Vitest)되어 일관성이 낮습니다. |
| 3.4.2 | API prefix 케이스 불일치 | `dynamic-pricing`(kebab-case) vs `dynamicPricing`(camelCase) 혼용. |
| 3.4.3 | 유틸/미들웨어 분산 | 10줄 미만 미들웨어/utils가 여러 곳에 흩어져 있습니다. |
| 3.4.4 | `ReportPdfService.js` 케이스 불일치 | 일부 파일명 대소문자 규칙 불일치. |
| 3.4.5 | `apply-food-truck-design.js` 미추적 | v6 시점 잔존하던 untracked 파일. |

## 4. 추가 기능 제안

### 🔥 P0 (안정성·보안 필수)

1. **Trivy CI 해소** — GH Actions 빌링 이슈 해결 후 무결성 검증 재가동.
2. **카드 번호 백필 마스킹** — 기존 `payments.card_number` 평문 데이터 백필 마이그레이션.
3. **Toss 웹훅 민감정보 로깅 방지** — 원본 로그 필터링 + 웹훅 서명 검증.
4. **`/api/reports/all` 권한 보강 + PDF 한글 폰트** — 슈퍼어드민 검사 + NanumGothic 폰트 등록.

### ⬆️ P1 (비즈니스)

5. 동적 가격 Gemini AI 연동 실제화.
6. 주문/결제 status enum 마이그레이션.
7. 일반 사용자 2FA(TOTP).
8. 버전 태깅 자동화 (`v1.3.0` 릴리스 절차).
9. Redis 캐싱 (주요 조회 경로).
10. AI 추천/수요 예측 실제 로직 구현.

### 🔵 P2 (UX/운영)

11. 리포트 PDF 고도화 (차트, 전년도 비교).
12. 실시간 대시보드 (WebSocket).
13. Alimtalk 템플릿 DB 관리.
14. 결제 수단별 수수료 표시.
15. 예약 시간대 커스텀/웨이팅 FCM.

### 🟣 P3 (확장)

16. 멤버십/구독.
17. 푸드트럭 실시간 위치.
18. 리뷰 사진 + 운영자 답변.
19. 다국어 알림톡/영수증 (zh-TW, vi, th).
20. DB 인덱스 최적화.
21. Docker 멀티스테이지 빌드.

## 5. 아키텍처

### 계층 구조

- **Controller** → **Service** → **Repository** 3계층 패턴.
- Prisma 모델(79개)이 PostgreSQL 스키마와 매핑되고, 미들웨어(14개)가 인증·권한·검증·레이트리밋을 담당합니다.

### 주요 흐름 시퀀스 (주문 생성)

```
클라이언트 → authMiddleware(토큰 검증) → 주문 Controller
          → 주문 Service(검증·재고 확인) → Repository(DB 반영)
          → Toss Payments 결제 요청 → 결제 콜백/웹훅
          → 알림톡/프린트 이벤트 → Socket.IO 실시간 발행
```

### 강점

- 컨트롤러/서비스/리포지토리 분리로 관심사가 명확하고 테스트가 용이합니다.
- 배포: Render(백엔드) + Cloudflare Workers(프론트) + Vercel(프론트) 3채널 이중화.
- 결제(Toss), 알림(Alimtalk), AI(Gemini), 지도(Naver Place) 외부 연동이 모듈화되어 있습니다.

### 약점

- `stores` 모델 비대(500+줄, 30+ relation)로 리팩토링이 필요합니다.
- AI 컨트롤러가 스텁 상태로 실제 비즈니스 로직이 없습니다.
- 미들웨어/유틸 10줄 미만 파일이 분산되어 있습니다.

## 6. 보안

### 6.1 적용된 보안

- HTTPS(Cloudflare) + helmet + CSP(nonce).
- JWT(access + refresh) + 관리자 2FA(TOTP).
- Joi 입력 검증 + XSS sanitizer + rate limiter.
- 주요 결제 필드 AES-256-CBC 암호화(`payer_phone`, `toss_pay_token`) + `card_number` 마스킹.
- `raw_response` 민감필드 제거 (sanitize 적용).
- 권한: authMiddleware + adminOnly + checkStorePermission + OpenAPI scoped + 매장 접근 제어.
- 정적 분석: Semgrep, Trivy, Sentry, AnomalyDetectionService, 감사 로그 UI, 알림톡 이력.
- 운영: SLO 기반 프린트 실패 알림, 릴리스 게이트, 피처 플래그 scoped rollout, 계정 하드닝.

### 6.2 미적용/취약점

| 항목 | 수준 |
| --- | --- |
| 일반 사용자 2FA | 중간 |
| API 키 권한 세분화 | 중간 |
| Toss 웹훅 서명 검증 | 높음 |
| `/api/reports/all` 슈퍼어드민 검사 미적용 | 높음 |
| PCI DSS(카드 마스킹 완료, 정기 감사 필요) | 높음 |
| DB 암호화 키 순환 정책 부재 | 중간 |

## 7. 권장 실행 순서

| 주차 | 목표 | day-1 | day-2 | day-3 | day-4 | day-5 |
| --- | --- | --- | --- | --- | --- | --- |
| 1주차 | **배포 차단 해제 + 보안 마무리** | Trivy(빌링) 해소 | `/api/reports/all` 권한 + PDF 한글 폰트 | `card_number` 백필 마스킹 | Toss 웹훅 서명 검증 + 로깅 필터 | `.env.example` 동기화 + `render.yaml` 검증 + `v1.3.0` tag |
| 2주차 | **AI 기능 실제 구현** | Gemini 추천 엔진 | 추천 로직 고도화 | 수요 예측 ML 파이프라인 | 예측 로직 테스트 | 프론트 AI 추천 UI |
| 3주차 | **테스트 + enum 마이그레이션** | 서비스 테스트 확대(ReportPdfService 포함) | 테스트 코드 리뷰 | 주문/결제 enum 마이그레이션 | 마이그레이션 검증 | 통합 테스트 + PDF 테스트 |
| 4주차+ | **고도화** | 리포트 PDF 고도화(차트, 전년도 비교) 이후: 실시간 대시보드(WebSocket) · Redis 캐싱 확대 · Alimtalk 템플릿 DB 관리 · `stores` 모델 분할 리팩토링 · 멀티스테이지 Docker 빌드 | | | | |

## 8. 참고 문서 및 총평

| 문서 | 내용 |
| --- | --- |
| `ARCHITECTURE.md` | 전체 아키텍처 상세 (576 lines) |
| `NEXT_TASK.md` | 다음 작업 우선순위: **Trivy 차단 최우선**, 로컬 통합테스트, Playwright E2E |
| `feature-analysis.md` | 기능 분석 29개 |
| `CHANGELOG.md` | v1.3.0 (2026-08-18) |
| `docs/ANALYSIS_REPORT_v3.0.md` | 이전 분석 리포트 |
| `docs/DEPLOYMENT.md` | 배포 가이드 |
| `.github/workflows/ci.yml` | CI (Trivy 포함) |
| `monitoring/` | Prometheus/Grafana/Loki/Alertmanager 설정 |

### 총평

- v6 대비 130개의 커밋으로 푸드트럭 테마, 권한·검증 강화, 정산 CSV, 공개 API, 피처 플래그, 재고 발주, 테스트 격리(Vitest 전환), 계정 하드닝 등 운영 안정성이 크게 개선됐습니다.
- 그러나 **GH Actions 빌링 차단(P0)**과 **`/api/reports/all` 권한 누락(P0)**, **카드 번호 백필 마스킹(P0)**, **Toss 웹훅 로깅(P0)** 실해결이 우선이며, AI 기능 실체화와 enum 마이그레이션 순으로 진행하면 다음 릴리스(v1.4.0) 전에 B+ 수준으로 끌어올릴 수 있습니다.
- 총평: **B-**