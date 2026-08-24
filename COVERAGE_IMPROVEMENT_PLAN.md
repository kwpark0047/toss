# 테스트 커버리지 80% 달성 계획

## 현재 상태 (2026-08-24)

| 영역 | Statements | Branches | Functions | Lines | 목표(80%) |
|------|------------|----------|-----------|-------|-----------|
| routes | 6.56% | 12.15% | 4.00% | 6.79% | +73% |
| controllers | 15.46% | 12.64% | 18.78% | 15.94% | +64% |
| services | 36.55% | 27.37% | 35.57% | 38.13% | +43% |
| middleware | 55.30% | 45.57% | 40.00% | 55.77% | +25% |
| utils | 32.73% | 29.19% | 25.38% | 32.53% | +47% |
| repositories | 4.97% | 2.06% | 1.84% | 5.55% | +75% |
| app | 13.80% | 0.00% | 8.12% | 14.41% | +66% |
| **TOTAL** | **31%** | **27.45%** | **26.88%** | **32.14%** | **+49%** |

---

## Phase별 개선 계획

### Phase 1: High Impact (1주) - middleware, utils, services

| 파일 | 현재 | 목표 | 예상 테스트 수 |
|------|------|------|----------------|
| middleware/validate.ts | 0% | 90% | 15 |
| middleware/rateLimiter.ts | 45% | 90% | 10 |
| middleware/auth.ts | 50% | 90% | 12 |
| middleware/cspNonce.ts | 0% | 80% | 8 |
| utils/redisCache.ts | 11% | 80% | 20 |
| utils/dataLoaders.ts | 0% | 80% | 25 |
| utils/cache.ts | 17% | 80% | 15 |
| services/OrderService.ts | 35% | 85% | 30 |
| services/notificationService.ts | 30% | 85% | 20 |
| services/printService.ts | 0% | 80% | 15 |

### Phase 2: Medium Impact (1주) - controllers, routes

| 파일 | 현재 | 목표 | 예상 테스트 수 |
|------|------|------|----------------|
| controllers/orderController.ts | 15% | 80% | 25 |
| controllers/storeController.ts | 10% | 80% | 20 |
| controllers/authController.ts | 12% | 80% | 20 |
| routes/orders.ts | 6% | 80% | 30 |
| routes/stores.ts | 5% | 80% | 25 |
| routes/auth.ts | 7% | 80% | 20 |

### Phase 3: Low Impact (1주) - repositories, app, routes

| 파일 | 현재 | 목표 | 예상 테스트 수 |
|------|------|------|----------------|
| repositories/Order.ts | 5% | 80% | 20 |
| repositories/Product.ts | 3% | 80% | 15 |
| repositories/User.ts | 2% | 80% | 15 |
| app.js | 13% | 80% | 10 |

---

## 즉시 실행 가능한 테스트 추가 (Quick Wins)

### 1. middleware/validate.ts - Zod 검증 미들웨어

```typescript
// tests/middleware/validate.test.ts
describe('validate middleware', () => {
  it('유효한 body로 통과', async () => { ... });
  it('잘못된 email로 400 반환', async () => { ... });
  it('필수 필드 누락 시 400 반환', async () => { ... });
  it('passwordConfirm 불일치 시 400 반환', async () => { ... });
  it('query 파라미터 검증', async () => { ... });
  it('params 파라미터 검증', async () => { ... });
});
```

### 2. utils/redisCache.ts - Redis 캐시

```typescript
// tests/utils/redisCache.test.ts
describe('RedisCache', () => {
  it('set/get 기본 동작', async () => { ... });
  it('TTL 만료 후 null 반환', async () => { ... });
  it('태그 기반 무효화', async () => { ... });
  it('패턴 기반 무효화', async () => { ... });
  it('연결 실패 시 graceful degradation', async () => { ... });
});
```

### 3. utils/dataLoaders.ts - DataLoader

```typescript
// tests/utils/dataLoaders.test.ts
describe('DataLoader', () => {
  it('배치 로딩으로 N+1 방지', async () => { ... });
  it('캐시 히트 시 DB 조회 안 함', async () => { ... });
  it('clearAll 후 재조회', async () => { ... });
  it('orderLoader 동작', async () => { ... });
  it('productLoader 동작', async () => { ... });
});
```

---

## 실행 명령어

```bash
# 커버리지 측정
npm run test:coverage

# 특정 파일 커버리지
npm run test:coverage -- --collectCoverageFrom="middleware/validate.ts"

# 커버리지 리포트 상세
npm run test:coverage -- --coverageReporters=text-summary --coverageReporters=lcov
```

---

## 진행 상태 트래킹

| Phase | 상태 | 완료일 | 비고 |
|-------|------|--------|------|
| Phase 1: High Impact | ⏳ 대기 | - | validate, redisCache, dataLoaders 우선 |
| Phase 2: Medium Impact | ⏳ 대기 | - | controllers, routes |
| Phase 3: Low Impact | ⏳ 대기 | - | repositories, app |
| **80% 달성** | ⏳ 대기 | - | 모든 임계값 ≥ 80% |

---

## 임계값 업데이트 규칙

1. 테스트 추가 후 `npm run test:coverage` 실행
2. 실측치가 임계값 초과 시 `jest.config.js`의 `coverageThreshold` **위로만** 조정
2. 절대 내려가지 않음 (래칫 원칙)
4. PR에 커버리지 리포트 포함 필수