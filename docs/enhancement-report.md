# WeMarket 백엔드 보안/코드 정합성 개선 보고서

> **작성일**: 2026-09-09  
> **범위**: 카드번호 마스킹 정책 통일, OTP 만료 관리 상수화, 중복 모델 감사, 모니터링 인프라 현황  
> **성격**: 이번 작업(P0 카드마스킹/P1 문서화)에서 조사·정리된 개선 과제의 **현황 보고 및 후속 권고**

---

## 1. 카드번호 마스킹 정책 통일 (완료)

### 1.1 정책 결정
운영진 확정 정책: **앞 6자리(BIN) + 뒤 4자리 유지, 중간 6자리 `*` 마스킹**
- 형식: `123456******3456`
- 짧은 값(숫자 10자 미만, 예: 이미 마스킹된 값) → `****last4`
- `null`/빈 값 → `null` (평문 저장 방지)

### 1.2 중복 제거 결과
기존에 카드번호 마스킹 로직이 **3곳**에 각각 독립적으로 중복돼 있었고, **마스킹 형식이 서로 달랐다**:

| 파일 | 기존 동작 | 비고 |
|------|-----------|------|
| `services/PaymentService.js` | `앞6******뒤4` (L38-51) | 정책과 일치, 유지 |
| `repositories/Payment.js` | `****-****-****-1234` (L6-11) | **정책 불일치** → 공용 유틸로 교체 |
| `app/domain/models/Payment.js` | `****-****-****-1234` (L37-42) | **정책 불일치** → 공용 유틸로 교체 |
| `scripts/mask_card_numbers.js` | 자체 함수 사용 | → 공용 유틸로 교체 |

### 1.3 공용 유틸 신설
`utils/cardMask.js` (신규)
- `maskCardNumber(cardNumber)` — 앞6-뒤4 정책
- `maskPaymentKey(paymentKey)` — 결제키 후 8자리 유지
- `isValidMaskedCard(masked)` — 마스킹 형식 검증 (평문 카드번호 거부)

**개선 효과**
- 마스킹 형식이 한 곳에서 관리 → 정책 변경 시 단일 지점 수정
- `repositories/Payment.js`·`app/domain/models/Payment.js`의 정책 불일치(전부 마스킹) 제거
- `isValidMaskedCard`로 평문 카드번호 유입(재마스킹 누락)을 검출 가능

---

## 2. OTP 만료시간 상수화 (완료)

### 2.1 기존 문제
OTP 만료시간(5분)이 **3개 파일**에 하드코딩되어 있었다:
- `controllers/authController.js` L66
- `controllers/admin2faController.js` L68, L162
- `services/TwoFactorService.js` L150

만료시간 정책을 바꾸려면 4곳을 모두 찾아 수정해야 하는 산재 문제.

### 2.2 개선
`config/authConstants.js` (신규) 신설:

```js
const OTP_EXPIRY_MS = Number(process.env.OTP_EXPIRY_MS) || 5 * 60 * 1000;
```

- 기본 5분, 환경변수 `OTP_EXPIRY_MS`(ms 단위)로 **런타임 오버라이드 가능**
- 4곳 모두 `OTP_EXPIRY_MS` 참조로 교체
- 만료 검증(소비 시점)은 기존 로직(`expires_at` 비교) 그대로 유지 → 만료 강제

> ✅ **검증**: OTP 발급·검증 경로 모두에서 `expires_at` 만료가 강제됨을 확인
> (authController 검증, admin2fa 검증, TwoFactorService.verifySmsOtp)

---

## 3. 중복 모델 감사 (AC7, 조사 완료 — 코드 정리 불필요)

### 3.1 판단: `posts` vs `community_posts`
스키마상 두 모델은 **개념적으로 별개**이며 모두 활발히 사용 중:

| 모델 | 역할 | 사용처 |
|------|------|--------|
| `posts` | 일반 게시판(공지/뉴스) | `repositories/Board.js`, `services/newsCollectorService.js`, `scripts/seed_board.js` |
| `community_posts` | 매장 스코프 커뮤니티 게시글 | `services/CommunityService.js`, `services/StoreService.js`, `app/infrastructure/prisma/StoreRepository.js` |

**결론**: 중복 모델이 아니라 서로 다른 도메인(전사 게시판 vs 매장 커뮤니티).  
하드 제약(코드 수준만, 스키마 변경 금지)에 따라 **스키마/코드 정리 불필요**로 판단. 문서화만 수행.

### 3.2 기타 관찰
- `staff` 모델 단일 존재(중복 `store_staff` 없음) — 확인
- `payments` L168 단일 — 86개 모델 중 결제 관련 중복 없음

---

## 4. 모니터링 인프라 현황 (AC10, 로드맵은 별도 문서)

| 구성요소 | 상태 | 위치 |
|----------|------|------|
| `prom-client` 기반 메트릭 모듈 | ✅ 존재 | `metrics/PrometheusMetrics.mts` |
| HTTP 미들웨어 수집 | ✅ `app.mts` L101 등록 | `metricsMiddleware` |
| `/api/metrics` 스크랩 엔드포인트 | ✅ `app.mts` L384 등록 | `metrics/metricsRouter.mts` |
| `middleware/performanceMonitor.js` | ✅ 레거시 단순 로그 | duration만 기록, 메트릭 미연동 |
| Prometheus 서버 스크랩 | ❌ 미구축 | 로드맵 대상 |
| Grafana 대시보드/얼럿 | ❌ 미구축 | 로드맵 대상 |

> 상세 롤아웃 계획은 `docs/observability-roadmap.md` 참조.

---

## 5. 권고(후속 과제) 요약

| 우선순위 | 과제 | 근거 |
|----------|------|------|
| P1 | Prometheus 서버 도입 + Grafana 대시보드 | 코드는 완비, 인프라 연동만 남음 |
| P1 | 평문 카드번호 재유입 방지 검증 강화 | `isValidMaskedCard`를 CP write 경로에 적용 |
| P2 | 레거시 `performanceMonitor.js` 통합/폐기 | 신규 메트릭과 이원화 |
| P2 | OTP 재시도/레이저 리밋 상수화 | 만료와 유사하게 산재 예상 |
