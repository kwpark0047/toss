# WeMarket 고도화 분석·구현 보고서 (v8.0)

> 기준: 250105, HEAD `22d589a`, 배포 v1.3.0 | 날짜: 2026-09-23
> 이전 종합 보고서: `PROJECT_ANALYSIS_REPORT_v7.md` (기준 `2144a18`, 일부 내용 outdated)

## 1. 실행 요약

WeMarket(QR 메뉴 & 스마트 매장)의 7단계 분석을 완료하고, **실제 잔존 이슈만** 골라
v1.3.0 하드닝 배치를 구현했다. 기존 v7 보고서가 지적한 다수 P0(카드 마스킹, reports 권한,
rawBody 로그, 레이트리밋 미적용 등)는 **이미 해결·적용 상태**로 확인되어 재작업하지 않았다.

**이번 구현 결과 (모두 테스트 통과):**
- ✅ 신규 단위 테스트 **23개 추가** — 전체 **973개 / 112 스위트 전체 통과** (기준 950)
- ✅ 백엔드 ESLint 0 에러 / 프론트 수정 파일 0 에러

## 2. 주요 발견 (v7와의 차이)

| 항목 | v7 진단 | 실사 결과 | 조치 |
|---|---|---|---|
| 레이트리밋 | 미적용 의심 | `app.mts:102` 전역 + 라우터별 이미 적용 | 테스트로 고정 |
| AI 연동 | 스텁 의심 | 실제 Gemini + 폴백 모델 목록 | — |
| card 마스킹 / reports 권한 | 미해결 | 이미 적용됨 | — |
| console.log 잔재 | 7줄 | **전부 dev 가드(`import.meta.env.DEV`)의 의도적 로그** | 죽은 주석 2줄만 제거 |
| **웹훅 무인증 통과** | 식별 | **실제 결함 (deny-by-default 부재)** | **수정** |
| PDF 폰트 | 등록명 불일치 | `NanumGothic` 등록 + 볼드 미보유 시 Helvetica 폴백 버그 | **수정** |
| `firebase.js` 훅 | 미식별 | `useState`/`useEffect` **import 누락** (린트 에러·잠재 런타임 버그) | **수정** |

## 3. 이번 배치 구현 내역

### 3.1 웹훅 인증 deny-by-default (`middleware/tossWebhookAuth.js`)
**문제:** 검증 계층(시크릿/IP/레거시/서명)이 하나도 설정되지 않으면 운영에서 무조건 통과.

**변경:**
- 프로덕션 + 검증 계층 미설정 → `503 + Retry-After: 60` 거부 (토스가 재전송하므로 결제 유실 없음)
- `TOSS_WEBHOOK_ALLOW_UNSIGNED=true` 로 일시 옵트아웃 가능 (마이그레이션 안전장치)
- 레거시 `TOSS_SECRET_KEY` 도 설정 판정에 포함
- 개발/테스트 환경은 경고 후 통과 유지 (로컬 Swagger·테스트 호환)
- `.env.example` 에 `TOSS_WEBHOOK_ALLOW_UNSIGNED` 문서화

**배포 영향:** Render 환경에 `TOSS_WEBHOOK_SECRET`(= 토스 콘솔 웹훅 보안키) 또는
`TOSS_WEBHOOK_IPS` 설정이 없으면, 배포 직후 웹훅 콜백이 503 으로 거부된다.
→ **배포 전 토스 콘솔에서 공유 시크릿 발급 후 환경변수 설정 필수**, 또는 임시로
`TOSS_WEBHOOK_ALLOW_UNSIGNED=true` (권장 안 함).

### 3.2 테스트 추가
- `tests/unit/middleware/tossWebhookAuth.test.js` (**16개**) — HMAC 서명 검증(정상/위조/5분 만료/
  파싱 불가), deny-by-default(prod 503 / 옵트아웃 / dev 통과), 공유 시크릿(헤더·쿼리), IP CIDR
  (정확 매칭·범위·::ffff: 정규화·거부), 레거시 Basic.
- `tests/unit/middleware/rateLimiter.test.js` (**7개**) — Express+supertest 통합으로 generalLimiter
  (통과·health skip·100/분 429), orderLimiter(스토어 키 분리·30/분 429), authLimiter
  (skipSuccessfulRequests), paymentLimiter.

### 3.3 PDF 폰트 정합화 (`services/ReportPdfService.js`)
- 등록명 `NanumGothic` → 실제 계열 `NotoSans` 통일 (등록명은 임의 토큰이라 기능상 문제
  없었으나, 코드/파일 불일치 해소)
- **잠재 버그 수정:** 볼드 파일 미보유 시 `hasFont = regular && bold` 판정 때문에 전체가
  Helvetica(한글 깨짐)로 폴백되던 것을 → 볼드 미보유 시 regular 로 폴백(fake bold)하도록
  변경해 **한글 렌더 보장**.

### 3.4 프론트 정리
- `frontend/src/firebase.js`: `useState`/`useEffect` React import 누락 수정 (린트 에러 해소 +
  `useNotificationPermission` 사용 시 ReferenceError 예방. 현재 사용처 없음 = 죽은 코드)
- 죽은 주석 로그 2줄 제거 (`TogetherPaymentSheet.jsx`, `onMessageListener`)

## 4. 남은 로드맵 (권장 우선순위)

### 다음 배치 (v1.4.0 후보)
| 우선순위 | 과제 | 비고 |
|---|---|---|
| P1 | **토스 웹훅 보안키 운영 적용** | 위 3.1 배포 영향 해소 — 콘솔 발급 + Render env |
| P1 | i18n 커버리지 확대 시작 | 하드코딩 한국어 12,646줄 vs 키 90개 — 최대 규모, 단계적 전환 필요 |
| P2 | 대형 컴포넌트 분해 | `StoreSetupWizard.jsx` 1,417줄 등 |
| P2 | 미사용 코드 정리 | `useNotificationPermission` 등 데드코드 |
| P2 | 통합 테스트 전환 가이드 | `docker-compose.yml`·`jest.config.integration.js` 변경분(미커밋) 검토 후 문서화 |
| P3 | 테스트 커버리지 확대 | 현재 ~33% → 핵심 라우터(주문·결제) 중심 |

### 운영·CI
- **GitHub Actions 차단(빌링)** 은 코드 수준 해결 불가 — `ci-billing-guide.md` 참조,
  계정 `kwpark0047-iceu` 스펜딩 설정 확인 필요.

## 5. 구현 파일 & 검증

| 파일 | 변경 |
|---|---|
| `middleware/tossWebhookAuth.js` | deny-by-default + 레거시 포함 설정 판정 |
| `services/ReportPdfService.js` | 폰트 등록명 통일 + 볼드 폴백 |
| `frontend/src/firebase.js` | React 훅 import 추가 |
| `frontend/src/components/.../TogetherPaymentSheet.jsx` | 죽은 주석 제거 |
| `.env.example` | `TOSS_WEBHOOK_ALLOW_UNSIGNED` 문서화 |
| `tests/unit/middleware/tossWebhookAuth.test.js` | 신규 16개 |
| `tests/unit/middleware/rateLimiter.test.js` | 신규 7개 |

검증 명령 (전체 통과):
```bash
NODE_OPTIONS=--experimental-vm-modules npx jest --config jest.config.js tests/unit --forceExit
# → 112 suites / 973 tests passed
```