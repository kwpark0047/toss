# WeMarket 프로젝트 종합 분석 리포트 v5.0

**분석일**: 2026-09-11
**프로젝트**: WeMarket - SaaS QR Menu & Store Management Platform
**버전**: v1.3.0 (커밋 `8255195` 기준, 미커밋 워크트리 22파일 포함)
**스택**: Express 5.2 / Prisma / PostgreSQL (Supabase) + Vite 7 + React 19 + Tailwind 4
**형식**: 진행 상황 / 문제점 / 추가 기능 제안 3축

---

## 1. 진행 상황

### 1.1 이번 세션: 구독 결제수단 등록 API + Toss 웹훅 강화

| 항목 | 상태 | 설명 |
|------|------|------|
| **구독 결제수단 등록** | ✅ | `POST /api/stores/:id/subscription/payment-method` (`controllers/subscriptionController.js` 신규) |
| **Toss 빌링키 발급** | ✅ | `TossAPI.issueBillingKey` — customerKey=`sub-${sha256(storeId)}` 해시 키 사용 |
| **Mock 결제 가드** | ✅ | `mock_` 접두 빌링키는 정기결제 예약(`createSubscription`) 생략, `ALLOW_MOCK_PAYMENTS` 가드 준수 |
| **구독 웹훅 조기 라우팅** | ✅ | `controllers/paymentController.js` — `eventType`이 `Subscription.` 접두면 즉시 전용 헨들러로 분기 (성공 200 `{success:true}` / 인프라 오류 500 재전송 유도 / 영구 조건 200 `handled:false`) |
| **구독 웹훅 핸들러** | ✅ | `handlers/subscriptionWebhook.js` — `StoreSubscriptionRepository` 직접 사용, 텍스트역매핑·타입별 분기(SUCCEEDED/FAILED 등) |
| **구독 저장소** | ✅ | `repositories/StoreSubscription.js` 신규 — `findByStoreId` / `findBySubscriptionId` / `upsertByStore` (`store_id` 유니크) |
| **라우트·검증 배선** | ✅ | `routes/stores.js` 라우트 추가, `src/validation/schemas/store.js` `subscriptionPaymentMethodSchema` 추가, `routes/payments.js` body 파서 보존 |
| **단위 테스트** | ✅ | `tests/unit/controllers/subscriptionController.test.js` 신규 — 5/5 통과 |

### 1.2 전체 검증 결과 (2026-09-11 재실행)

| 검증 | 결과 |
|------|------|
| **전체 테스트** | ✅ 127 suites / 1080건 통과 (커버리지 포함) |
| **lint** | ✅ 0 에러 / 62 경고 (기존 수준, 신규 에러 없음) |
| **구독 결제수단 테스트** | ✅ `tests/unit/controllers/subscriptionController.test.js` 5/5 |

### 1.3 마일스톤

| 항목 | 상태 |
|------|------|
| **Q4 완료** (v1.3.0) | ✅ 커밋 `88640da` |
| **카드번호 마스킹 AC 전건** | ✅ 커밋 `8255195`까지 반영 |
| **구독 결제수단 등록 API** | ✅ 진행 중 (미커밋 → 정리 대상) |
| **CI 빌링** | 🔴 GitHub Actions 지출 한도 초과로 중단 (코드 무관, 사용자 조치 필요) |

---

## 2. 문제점 분석

우선순위: 🔴 높음 / 🟡 중간 / 🟢 낮음

| # | 문제 | 우선순위 | 실사 근거 |
|---|------|---------|-----------|
| ① | **워크트리 미정리 상태 잔존** — 세션 작업 8파일 + 세션 무관 14파일(총 22개, +605/−599)이 단일 워크트리에 뒤섞여 있음. 기능별 커밋 분리 필요 | 🔴 | `git status` 전수 조사 |
| ② | **NanumGothic woff2는 404 에러 페이지 HTML이었음** — `fonts/NanumGothic-*.woff2`가 Google 폰트 404 응답(HTML)으로 추적 중 → `ReportPdfService` 한글 폰트 로드 실패, 실제 NotoSans 폰트로 교체 필수 | 🔴 | 파일 헤더 실사 (`Error 404 (Not Found)!!1` baidu CSS 포함) |
| ③ | **검증 레이어 비일관** — Zod 이행 진행 중이나 `utils/validationSchemas.js`는 Joi→Zod로 대폭 변경(376줄)된 상태, Joi 제거(de 보조) | 🔴 | 코드 실사, `package.json` `joi` 의존 제거 |
| ④ | **jest 30 + TS 테스트 변환** — ts-jest 29는 jest 30과 버전 불일치, babel-jest + `@babel/preset-typescript`로 전환됨 | 🟡 | `jest.config.js` 실사 |
| ⑤ | **prom-client v15 API 변경** — `Gauge.get()` async 반환, `labels()`는 observe만 노출 → 기존 동기 단언 테스트 실패, async 재작성 필요 | 🟡 | `tests/unit/metrics/prometheusMetrics.test.ts` 실사 |
| ⑥ | **죽은 코드 제거 필요** — `utils/validationSchemas.ts`(222줄) 삭제, `.mjs`/`.js` 이중화 잔존 (v4 ②번 이슈 지속) | 🟡 | 파일 실사 |

---

## 3. 추가 기능 제안

### P0 (즉시 개선, 2건)

1. **워크트리 정리 — 기능별 커밋 분리** (본 보고서와 함께 진행)

   | # | 커밋 단위 | 포함 파일 |
   |---|----------|-----------|
   | A | 구독 결제수단 등록 + 웹훅 강화 | 세션 작업 8파일 (`controllers/subscriptionController.js`, `repositories/StoreSubscription.js`, `tests/unit/controllers/subscriptionController.test.js`, `controllers/paymentController.js`, `handlers/subscriptionWebhook.js`, `routes/payments.js`, `routes/stores.js`, `src/validation/schemas/store.js`) |
   | B | 구독 동기화 `store_subscriptions` 이관 | `services/SubscriptionService.js` + `tests/unit/services/SubscriptionService.test.js` (A의 `StoreSubscription.js`에 의존 → A 이후 커밋) |
   | C | 검증 레이어 Joi→Zod + jest TS 인프라 | `utils/validationSchemas.js`, `utils/validationSchemas.ts`(삭제), `jest.config.js`, `package.json`, `package-lock.json`, `tests/integration/setupIntegration.js`, `tests/unit/utils/toss.test.js` |
   | D | prom-client v15 메트릭 테스트 대응 | `tests/unit/metrics/prometheusMetrics.test.ts` |
   | E | PDF 한글 폰트 오류 수정 | `fonts/` 5개(NotoSans 3 교체 + NanumGothic 2 삭제), `services/ReportPdfService.js` |
   | F | API 계약 검증 스크립트 정리 | `scripts/validate-api-contract.js` |

2. **커밋 후 전체 재검증** — `npm test`(127/1080) + lint(0/62) 1회 재실행으로 최종 상태 확정

### P1 (중기 개선, 4건)

3. **Zod 전면 확대** — 아직 미적용 라우트에 zod 스키마 도입 (v4 ④ 이슈)
4. **대형 컴포넌트 분해** — 1,000줄 초과 파일 분해
5. **번들 최적화** — 코드 스플리팅·청크 분리
6. **DB 인덱스 추가** — 고빈도 쿼리(`store_subscriptions.store_id` 등) 인덱스 설계

### P2 (전략 제안, 3건)

7. **AI 매출 예측** — 주문·웨이팅 데이터 기반 시계열 예측
8. **프랜차이즈 자원 공유** — 피크 시간대 부하 밸런싱
9. **키오스크 오프라인 모드** — 네트워크 단절 시 주문 버퍼링

---

## 4. 결론

- **구독 결제수단 등록 API + Toss 웹훅 라우팅**이 테스트로 검증됨(127/1080 전체 통과).
- **워크트리 22개 파일**을 A~F 6단위로 분리해 기능별 커밋으로 정리하면, 세션 작업과 세션 무관 정비(폰트 404 수정, Joi→Zod, jest TS, prom-client v15)가 명확히 구분된다.
- **CI 빌링**은 코드와 무관한 계정 문제로 사용자 외부 조치가 필요하다.