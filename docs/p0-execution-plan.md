# P0 실행 계획 — 카드번호 미보관 / app 정리 / 키 분리 + CI 해소

**작성일**: 2026-09-09
**대상 버전**: v1.3.0
**상위 문서**: `docs/ANALYSIS_REPORT_v4.0.md` (3축 분석)
**전제**: git 커밋·외부 플랫폼(GitHub/Render/Toss) 실변경 금지 — 본 계획은 **실행 시나리오**이며 코드 변경은 별도 승인 후 진행.

---

## P0-1. 결제 응답 카드번호 서버 보관 폐기

### 배경
Toss 결제 성공 응답의 `card.number`가 서버 경로에 평문으로 유입될 수 있다.
`src/validation/schemas/order.js:48,161`이 평문 `cardNumber`를 수용하고, 마스킹은 저장 직전
(`app/infrastructure/prisma/PaymentRepository.js`의 `maskCardNumberIfPresent`)에서만 수행된다.
재결제·부분취소·자동결제에 필요한 정보는 Toss가 결제키(billing)로 보유하므로 서버는 카드번호 원본을 보관할 이유가 없다.

### 목표
- DB에 카드번호 **평문 미보관** (기본 원칙)
- API 요청·응답에서도 평문 미노출
- 기존 평문 잔존분 전량 마스킹 백필

### 단계
| # | 작업 | 완료 정의 |
|---|------|-----------|
| 1 | 주문·결제 검증 스키마에서 평문 `cardNumber` 수용 제거 (또는 마스킹 전용 포맷만 허용) | `order.js:48,161`에 평문 수용 경로 없음 |
| 2 | `PaymentRepository` 마스킹 가드 유지·추가 (현재 테스트 5/5 유지) | 멱등 테스트 계속 통과 |
| 3 | 기존 평문 잔존분 점검 — `prisma.payments.card_number` 조회 | 평문 패턴(숫자 15~16자리) 0건 |
| 4 | `scripts/mask_card_numbers.js`로 전량 백필 (멱등 규칙 준수 — `docs/ANALYSIS_REPORT_v4.0.md` §4) | 백필 후 재조회 평문 0건 |
| 5 | 응답 포맷터(`responseFormatter`)에서 `card.number` 필드는 마스킹 값 또는 `undefined`로 직렬화 | API 스냅샷 테스트로 평문 미노출 확인 |

### 리스크
- 검증 스키마 변경 시 기존 프런트/사용자 주문 플로우 회귀 → **회귀 테스트 21건 유지**가 게이트
- 백필은 `lax` 모드로 유예 기간 운영 후 강제 전환 (Toss 재결제 흐름 파악 후 결정)

---

## P0-2. `app/` (clean-arch) 정리 방향

### 배경
`docs/ARCHITECTURE_DECISION.md`(M-3) 기준 3스타일 공존. Style B(`app/`)의 orders/payments/stores/customers
use case는 DI 컨테이너에 등록만 되어 있고 HTTP 배선은 `/api/monitoring` 하나뿐 → 대부분 **dead code**.
또한 `.mjs`/`.js` 이중 파일 6~8쌍이 모듈 시스템 혼선을 유발한다.

### 결정 옵션
| 옵션 | 내용 | 비용 | 리스크 |
|------|------|------|--------|
| A | `app/` 유지 + 레거시 라우트를 clean-arch로 **점진 이전** | 높음 | 중 (기능 동작 중 이전) |
| B | 미사용 use case 제거, `app/`은 monitoring 중심으로 **축소** | 중 | 낮음 |
| C | `app/` **전체 제거** + 레거시 스타일(A)로 통일 | 낮음 | 낮음 (dead code 제거) |

### 권장
- **단기**: 옵션 C — 미사용 clean-arch 제거, `ARCHITECTURE_DECISION.md`를 2스타일(A 전통 + C 잔재 정리)로 갱신.
  추적 불가능한 dead code가 유지보수 비용을 높이므로 **제거가 최우선**.
- **중기**: 신규 기능(예: P1의 AI 예측)을 clean-arch로 시범 도입하고, 정착 시 A→B 전환 로드맵 수립.

### `.mjs`/`.js` 이중화 해소
1. 이중 파일 쌍 목록화 (동명 `.mjs`+`.js`)
2. import 빈도·런타임 사용처 조사 → 실제 사용되는 사양으로 **단일화** (CJS 우선)
3. 미사용 쪽 삭제 + 해당 테스트 통과 확인

### 완료 정의
- `app/` 중 monitoring 이외 dead code 레퍼런스 0건
- `.mjs`/`.js` 이중 파일 0쌍
- `ARCHITECTURE_DECISION.md` 갱신 완료

---

## P0-3. 키 분리 + GitHub Billing 해소

### 배경
- `phoneEncryption`·`tokenEncryption`·`orderCapability`가 `JWT_SECRET` 폴백 (키 재사용 — 하나가 털리면 전부 위험)
- `JWT_REFRESH_SECRET` 미설정 시 refresh 토큰도 동일 키 서명
- `.env`에 `change-me-...` 기본값 존재 → 프로덕션 오기동 가능
- `frontend/hooks/useTossPayment.js:11` Toss 테스트 키 하드코딩, `.env.local` `VERCEL_OIDC_TOKEN` 노출
- GitHub Actions Billing: 계정 `kwpark0047-iceu` 지출 한도 초과로 CI 중단 — **코드로 해결 불가**

### 단계
| # | 작업 | 구분 |
|---|------|------|
| 1 | `.env`: `JWT_REFRESH_SECRET`·`PHONE_PEPPER` 등 개별 키 발급·분리 | 개발자 (코드) |
| 2 | `.env`: `change-me-...` 기본값 제거 + 미설정 시 기동 거부(`assert`/시작 검증) | 개발자 (코드) |
| 3 | `useTossPayment.js:11` 테스트 키 제거 → 환경변수/서버 토큰 주입 | 개발자 (코드) |
| 4 | `.env.local`의 `VERCEL_OIDC_TOKEN` 정리 (민감값 로컬·리포 보관 금지) | 개발자 (코드) |
| 5 | GitHub `kwpark0047-iceu` 계정 결제 수단·지출 한도 조정 또는 퍼블릭 리포 프리티어 확인 | **사용자 조치** |
| 6 | CI 재가동 후 빌링 가드(빌드 시간·캐시) 재확인 | 개발자 + 사용자 |

### 완료 정의
- `.env` default secret 0건, 키 세분화 완료
- 저장소 내 테스트 키·OIDC 토큰 0건
- CI 파이프라인 재가동 성공

---

## 실행 순서 요약

1. **P0-1** (카드번호 폐기) — 기존 AC10·마스킹 AC와 연속, 즉시 실행 가능, 테스트 게이트 존재
2. **P0-2** (app/ 정리) — 계획 수립 후 결정 승인 필요 (dead code 제거는 신중한 검토)
3. **P0-3** (키 분리 + CI) — 코드 작업 1~4 완료 후 사용자 조치 5~6 요청

> ⚠️ 본 계획의 코드 변경은 **별도 승인** 후 진행해야 하며, 현재 세션은 문서화까지만 범위로 한다.