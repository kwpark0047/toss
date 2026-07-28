# 아키텍처 현황 및 단일화 로드맵

> 최종 갱신: 2026-07-29
> 관련 이슈: **M-3 (아키텍처 3중 병존)**

---

## 1. 현재 상태 — 3개 스타일이 동시에 존재한다

이 코드베이스에는 서로 다른 3개의 아키텍처 스타일이 공존한다.
신규 개발자가 "어디에 코드를 써야 하는가"를 판단할 수 없고, 같은 도메인 로직이
두 곳에 존재할 위험이 있으므로 단일화가 필요하다.

### 스타일 A — 전통적 레이어드 (지배적, ~90%)

```
routes/*.js  →  controllers/*Controller.js  →  services/*Service.js  →  repositories/*.js  →  config/prisma
```

| 항목 | 값 |
|---|---|
| 라우트 | 51개 |
| 컨트롤러 | 48개 |
| 서비스 | 38개 |
| 리포지토리 | 24개 |

대부분의 도메인(주문, 상품, 매장, 쿠폰, 웨이팅, KDS, CRM, AI …)이 여기에 있다.
**이것이 사실상의 표준이다.**

### 스타일 B — Clean Architecture + DI (`app/`, 부분 적용)

```
app/interfaces/http/*Router.js
  → app/interfaces/http/*Controller.js   (팩토리 함수, awilix 로 주입)
    → app/application/<도메인>/<UseCase>.js
      → app/domain/interfaces/I*Repository.js  (인터페이스)
        → app/infrastructure/prisma/*Repository.js  (구현)
```

- DI 컨테이너: `app/infrastructure/di/container.js` (awilix, PROXY 모드)
- **실제로 HTTP 경로에 연결된 것은 `/api/monitoring` 하나뿐**이다.
- orders / payments / stores / customers 유스케이스 클래스는 작성되어 있으나
  **어떤 라우트에도 연결되어 있지 않다** (컨테이너에는 등록됨).

즉 마이그레이션이 monitoring 에서 멈췄고, 나머지는 **미사용 코드**다.

### 스타일 C — 레거시 잔재

- `utils/notifications.js` — `@deprecated`, `services/notificationService.js` 로 이관 중
- `models/` 디렉터리 — 이미 제거됨 (Prisma 전환 완료)

---

## 2. 문제

| # | 문제 | 영향 |
|---|---|---|
| 1 | 같은 도메인(order/payment)의 로직이 `services/OrderService.js` 와 `app/application/orders/CreateOrder.js` 두 곳에 존재 | 한쪽만 고치는 버그 발생, 실제로 어느 쪽이 실행되는지 추적 비용 |
| 2 | `app/application/*` 대부분이 라우트에 미연결 | 죽은 코드가 커버리지·빌드·리뷰 비용을 잠식 (현재 `app/` 커버리지 13.8%) |
| 3 | `app/infrastructure/prisma/*Repository.js` 가 자체 PrismaClient 를 생성했었음 | 커넥션 풀 중복 — **2026-07-29 공유 싱글턴으로 수정 완료** |
| 4 | 신규 기능을 어느 스타일로 써야 할지 규약이 없음 | 스타일이 계속 늘어남 |

---

## 3. 결정 (ADR)

> **결정: 스타일 A(레이어드)를 표준으로 확정한다. `app/` Clean Architecture 는 축소한다.**

근거:

1. **비용 대비 효과** — 전체의 90%가 이미 A 스타일이다. B 로 전면 이전하려면
   48개 컨트롤러 + 38개 서비스를 다시 써야 하는데, 그만한 이득(테스트 용이성)은
   A 스타일에 인터페이스를 도입하는 것으로도 상당 부분 달성된다.
2. **B 가 완결되지 않았다** — 2년 가까이 monitoring 하나만 이전된 상태다.
   완결될 가능성이 낮은 마이그레이션은 유지 비용만 남긴다.
3. **팀 규모** — DI 컨테이너의 이점은 다수의 구현 교체가 필요한 대규모 조직에서
   두드러진다. 현재 규모에서는 `require` 로 충분하다.

---

## 4. 단계별 정리 계획

### Phase 1 — 미사용 코드 격리 (즉시)

- [x] `routes/monitoring.js` 중복 라우터 제거
- [x] `app/infrastructure/prisma/*` PrismaClient 싱글턴화
- [ ] `app/application/{orders,payments,stores,customers}/*` 에 `@unused` 주석 부착
      후 다음 릴리스에서 제거 여부 판단 (누군가 이어서 쓸 계획이면 여기서 중단)

### Phase 2 — monitoring 을 표준 스타일로 회수 (1 스프린트)

`/api/monitoring` 은 유일하게 B 스타일에 남은 실사용 경로다.

```
app/interfaces/http/monitoringRouter.js  →  routes/monitoring.js
app/interfaces/http/MonitoringController.js → controllers/monitoringController.js
app/application/monitoring/*             →  services/MonitoringService.js
app/infrastructure/prisma/MonitoringRepository.js → repositories/Monitoring.js (이미 존재)
```

주의: 이전 시 **인증(super_admin) 미들웨어를 반드시 함께 옮긴다.**
(H-1 에서 추가한 `authMiddleware + adminOnly`)

### Phase 3 — DI 컨테이너 제거 (Phase 2 완료 후)

- `awilix` 의존성 제거
- `app.js` 의 `diContainer` 초기화 블록 제거 (약 20줄)
- `app/` 디렉터리 삭제

### Phase 4 — 레이어드 스타일 규약 문서화

`CONTRIBUTING.md` 에 아래를 명시한다.

```
routes/       HTTP 계약만. 미들웨어 조립(인증/권한/검증/멱등성) + Swagger 주석.
              비즈니스 로직 금지.
controllers/  요청 파싱 → 서비스 호출 → 응답 직렬화. 트랜잭션/도메인 규칙 금지.
services/     비즈니스 규칙, 트랜잭션 경계, 외부 연동 오케스트레이션.
repositories/ Prisma 접근 전담. 다른 리포지토리를 호출하지 않는다.
config/prisma 유일한 PrismaClient. 어디서도 new PrismaClient() 금지.
```

---

## 5. 신규 개발자 가이드 (지금 당장 따를 것)

**새 기능을 추가한다면 스타일 A 를 쓴다.** `app/` 아래에는 아무것도 추가하지 않는다.

```
1. prisma/schema.prisma 수정 → npm run db:migrate -- --name <설명>
2. repositories/<Domain>.js       — 데이터 접근
3. services/<Domain>Service.js    — 비즈니스 규칙 + 트랜잭션
4. controllers/<domain>Controller.js — 요청/응답 변환
5. routes/<domain>.js             — 인증/권한/검증 미들웨어 + Swagger
6. app.js 의 routes 맵에 등록 **하고 app.use 로 마운트까지 한다**
   (마운트 누락은 tests/unit/routeMounting.test.js 가 잡아낸다)
7. tests/unit/... 단위 테스트 + 보안 경계는 tests/routes/... 에 추가
```
