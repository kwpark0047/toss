# WeMarket 프로젝트 종합 분석 리포트 v4.0

**분석일**: 2026-09-09
**프로젝트**: WeMarket - SaaS QR Menu & Store Management Platform
**버전**: v1.3.0 (Q4 완료, 커밋 `88640da`)
**스택**: Express 5.2 / Prisma / PostgreSQL (Supabase) + Vite 7 + React 19 + Tailwind 4
**형식**: 진행 상황 / 문제점 / 추가 기능 제안 3축 + AC9 확정

---

## 1. 진행 상황

### 1.1 개발 규모

| 구분 | 수치 |
|------|------|
| **백엔드** | routes 68 / controllers 68 / services 65 / repositories 28 (총 244) |
| **프론트엔드** | 259파일 / 약 60,500줄 / 라우트 92개 |
| **Prisma 모델** | 86개 |
| **테스트** | unit 967 (116 suites), regression 21/21, clean-arch 14/14 |

### 1.2 마일스톤

| 항목 | 상태 |
|------|------|
| **Q4 완료** (v1.3.0) | ✅ 커밋 `88640da` |
| **AC1 ~ AC10** (카드번호 보관 최소화·마스킹) | ✅ 전건 처리 |
| **CI 보안 게이트** | ✅ Semgrep ERROR 게이트·Docker multi-stage·`validate:jsx` 가드 |
| **CI 빌링** | 🔴 GitHub Actions 지출 한도 초과로 중단 (코드 무관) |
| **아이콘 복구** | ✅ 커밋 `320bb00` |
| **카드 마스킹 백필** | ✅ `scripts/mask_card_numbers.js` |

### 1.3 핵심 구현 완료 (AC 요약)

- 카드번호 저장 시 **저장 직전 마스킹 가드** (`app/infrastructure/prisma/PaymentRepository.js`)
- **멱등 마스킹 유틸** (`utils/cardMask.js`) — 이미 마스킹된 값은 재처리해도 동일 값 유지
- 멱등성 전용 테스트 (`tests/unit/clean-arch/PaymentRepository.mask.test.js`) **5/5 통과**
- 결제·카드 모델에서 평문 카드번호 보관 경로 차단

---

## 2. 문제점 분석

우선순위: 🔴 높음(반드시 개선) / 🟡 중간(개선 권장) / 🟢 낮음(점진 개선)

| # | 문제 | 우선순위 | 실사 근거 |
|---|------|---------|-----------|
| ① | **clean-arch(`app/`) 대부분 dead code** — orders/payments/stores/customers use case는 DI 컨테이너 등록만 되고 HTTP 배선은 `/api/monitoring` 하나뿐 | 🔴 | `docs/ARCHITECTURE_DECISION.md` M-3 |
| ② | **`.mjs`/`.js` 이중 파일 공존** — 6~8쌍, 모듈 시스템 혼선 | 🔴 | 동명 파일 쌍 조사 |
| ③ | **카드번호 평문 입력 수용** — `src/validation/schemas/order.js:48,161`에서 평문 `cardNumber` 허용, 마스킹은 저장 직전에만 | 🔴 | 코드 실사 |
| ④ | **키·시크릿 노출 위험** — `frontend/hooks/useTossPayment.js:11` Toss 테스트 키 하드코딩, `.env.local`에 `VERCEL_OIDC_TOKEN` 노출 | 🔴 | 코드 실사 |
| ⑤ | **검증 레이어 비일관** — Zod가 6/68 라우트에만 적용, Joi는 사장 상태, field-level 검증과 공존 | 🟡 | 라우트 전수 조사 |
| ⑥ | **대형 파일 집중** — `services/PaymentService.js` 1,240줄, `services/aiService.js` 881줄, `repositories/Order.js` 855줄, `routes/admin` 821줄, 프론트 1,000줄 초과 8개·400줄 초과 42개 | 🟡 | 줄 수 집계 |
| ⑦ | **키 재사용 체인** — `phoneEncryption`·`tokenEncryption`·`orderCapability`가 `JWT_SECRET` 폴백, `JWT_REFRESH_SECRET` 미설정 시 동일 키, `.env` 기본값 `change-me-...` | 🟡 | `.env`·설정 조사 |
| ⑧ | **프론트 중복 코드** — token refresh가 `api/client.js:80-108`와 `AuthContext.jsx:25-53` 두 곳, `useApi`는 deprecated | 🟢 | 프론트 조사 |
| ⑨ | **접근성 누락** — 대시보드/어드민 주요 컴포넌트 aria/키보드 내비게이션 부재 | 🟢 | 컴포넌트 점검 |

---

## 3. 추가 기능 제안

### P0 (즉시 개선, 3건)

1. **결제 응답 `card?.number` 서버 보관 폐기** — Toss 결제키(billing) 중심 재결제·부분취소 전환, DB 평문 미보관
2. **`app/` 정리 방향 확정** — 미사용 use case 제거 + `.mjs`/`.js` 이중화 해소 + `ARCHITECTURE_DECISION.md` 갱신
3. **키 분리 + CI 해소** — `JWT_REFRESH_SECRET`·pepper 등 키 세분화, `.env` 기본값 제거, GitHub Billings 조치(사용자 개입 필요)

### P1 (중기 개선, 4건)

4. **Zod 전면 확대** — 62개 미적용 라우트에 zod 스키마 도입
5. **대형 컴포넌트 분해** — 1,000줄 초과 8개 파일 분해 (+Storybook 도입)
6. **번들 최적화** — 코드 스플리팅·청크 분리
7. **DB 인덱스 추가** — 고빈도 쿼리(주문·대기열) 인덱스 설계

### P2 (전략 제안, 5건)

8. **AI 매출 예측** — 주문·웨이팅 데이터 기반 시계열 예측
9. **프랜차이즈 자원 공유** — 피크 시간대 부하 편차를 매장 간 밸런싱
10. **KDS 부하 밸런싱** — 주방 디스플레이 메뉴 카테고리 자동 분배
11. **`IssueCoupon` 재활용** — 발급·소진 상태 통합 관리
12. **키오스크 오프라인 모드** — 네트워크 단절 시 주문 버퍼링

---

## 4. AC9 확정: 카드번호 마스킹 멱등 재처리 규칙

**결정**: "이미 마스킹된 값도 멱등 재처리 보장"을 **확정 규칙**으로 명문화한다.

### 4.1 규칙 정의

| 조건 | 처리 | 예시 |
|------|------|------|
| `null` / 빈 값 | 그대로 `null` | `null` → `null` |
| 숫자 10자리 이상 | `앞6 + ****** + 뒤4` | `1234567890123456` → `123456******3456` |
| 숫자 10자리 미만 (이미 마스킹된 값) | `**** + 뒤4` 유지 | `12345678` → `****5678` |

### 4.2 근거

- `utils/cardMask.js:27-42` — `maskCardNumber`는 입력값을 **비파괴 처리** (숫자만 추출 후 새 문자열 반환)
- `app/infrastructure/prisma/PaymentRepository.js` — `maskCardNumberIfPresent` 헬퍼가 원본 페이로드를 변경하지 않고 **spread 복사 후** 마스킹 값만 저장
- **테스트 5/5 통과** (2026-09-09 실행):
  - create: 평문 → 마스킹 저장 + 원본 비변형
  - update: 평문 → 마스킹 저장 + 원본 비변형
  - create: 이미 마스킹된 값 그대로 유지 (**멱등**)
  - create: card_number 없음 → 그대로 전달
  - update: `card_number: null` → 그대로 전달

### 4.3 파급 효과

- 재처리 파이프라인(`scripts/mask_card_numbers.js`, 백필)에서 이미 마스킹된 레코드를 **무한 재마스킹 없이 안전하게** 재실행 가능
- `maskCardNumber` → 저장 가드 → 백필의 전 구간이 멱등 → **반복 실행이 데이터를 훼손하지 않음**

---

## 부록: 좌표 (진행/문제/제안 종합)

- **진행 상황**: Q4 완료, 보안·테스트·인프라 게이트 완성, 카드 마스킹 AC 전건 완료 — 안정 단계
- **주요 리스크**: CI 빌링 중단(사용자 조치 필요) + 카드 평문 입력 수용 경로 잔존
- **다음 액션**: P0 3건 실행 계획 (`docs/p0-execution-plan.md`) 참조