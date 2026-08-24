# TypeScript 마이그레이션 가이드 (WeMarket)

## 개요

- **목표**: JavaScript(CommonJS) → TypeScript(ESM) 완전 마이그레이션
- **전략**: `ts-migrate`로 1차 변환 → 점진적 `any` 제거 → Strict Mode 완성
- **일정**: 2~3주 (Phase 1: 1주, Phase 2: 1~2주)

---

## Phase 1: 초기 변환 (1주)

### 1.1 의존성 설치

```bash
npm install -D typescript ts-migrate @types/node @types/express @types/jest @types/jsonwebtoken @types/bcryptjs @types/cookie-parser @types/multer @types/qrcode @types/uuid @types/ws @types/pg @types/socket.io @types/qrcode
```

### 1.2 ts-migrate 실행

```bash
# 1. 백업
git commit -am "pre-ts-migration backup"

# 2. ts-migrate 실행 (자동 변환)
npx ts-migrate-full

# 3. 생성된 tsconfig.json 확인 및 병합
# 우리 tsconfig.json과 병합 필요
```

### 1.3 자동 변환 후 수동 수정 필수 사항

| 항목 | 설명 |
|------|------|
| `require()` → `import` | 모든 CommonJS import 변환 |
| `module.exports` → `export` | 모든 export 변환 |
| `__dirname`/`__filename` | `import.meta.dirname` / `import.meta.filename` |
| `require.resolve` | `import.meta.resolve` |
| Dynamic import | `import()` 구문 유지 |
| `.js` 확장자 | import 경로에 `.js` 명시 (NodeNext 필요) |

---

## Phase 2: 타입 정제 (1~2주)

### 2.1 단계별 `any` 제거 순서

```
1단계: config/*, utils/logger.ts, utils/errorHandler.ts
2단계: middleware/*, config/prisma.ts
3단계: repositories/* (Prisma 타입 활용)
4단계: services/* (비즈니스 로직 타입)
5단계: controllers/* (Request/Response 타입)
6단계: routes/* (라우터 핸들러 타입)
7단계: utils/dataLoaders.ts, utils/redisCache.ts
```

### 2.2 타입 정의 우선순위

| 우선순위 | 파일 | 이유 |
|----------|------|------|
| P0 | `types/global.d.ts` | Express 확장, 공통 타입 |
| P0 | `types/prisma-extensions.d.ts` | Prisma 모델 확장 |
| P1 | `utils/redisCache.ts` | 캐시 인터페이스 |
| P1 | `utils/dataLoaders.ts` | DataLoader 팩토리 타입 |
| P1 | `middleware/validate.ts` | Zod 스키마 타입 |
| P1 | `services/OrderService.ts` | 핵심 비즈니스 로직 |
| P2 | `controllers/*` | 요청/응답 타입 |
| P2 | `routes/*` | 라우터 핸들러 타입 |

### 2.3 Prisma 타입 활용

```typescript
// repositories/Order.ts 예시
import { Prisma, Order, OrderItem, Payment } from '@prisma/client';

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    items: { include: { product: true; options: true } };
    payments: true;
    store: true;
    customer: true;
    table: true;
  }>;

export type CreateOrderInput = Prisma.OrderCreateInput;
export type UpdateOrderInput = Prisma.OrderUpdateInput;
```

---

## Phase 3: ESM 마이그레이션 및 검증 (마지막 주)

### 3.1 package.json 수정

```json
{
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch index.ts",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  }
}
```

### 3.2 검증 체크리스트

- [ ] `npm run typecheck` → 0 에러
- [ ] `npm run build` → 성공
- [ ] `npm run test:unit` → 전체 통과
- [ ] `npm run test:coverage` → 임계값 통과
- [ ] `npm run validate:all` → 전체 통과
- [ ] `npm run dev:docker` → 로컬 기동 확인

---

## 자주 발생하는 문제와 해결

### 1. `require()` 순환 참조
```typescript
// Before (JS)
const A = require('./a');
const B = require('./b');

// After (TS) - dynamic import로 지연 로드
const getA = () => import('./a');
const getB = () => import('./b');
```

### 2. Prisma Client 타입
```typescript
// config/prisma.ts
import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;
```

### 3. Express Request 확장
```typescript
// types/global.d.ts 에 정의된 타입 활용
// controllers에서 사용:
const userId = req.user!.id; // non-null assertion
const storeId = req.storeId; // 미들웨어에서 설정됨
```

### 4. Zod 스키마 타입 추론
```typescript
// src/validation/schemas/order.ts
import { z } from 'zod';

export const createOrderSchema = z.object({
  storeId: z.number().int().positive(),
  // ...
});

// 타입 추론
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
```

---

## 마이그레이션 진행 상태 트래킹

| 단계 | 상태 | 완료일 |
|------|------|--------|
| Phase 1: ts-migrate 실행 | ⏳ 대기 | - |
| Phase 2.1: config/utils/middleware 타입 | ⏳ 대기 | - |
| Phase 2.2: repositories 타입 | ⏳ 대기 | - |
| Phase 2.3: services 타입 | ⏳ 대기 | - |
| Phase 2.4: controllers/routes 타입 | ⏳ 대기 | - |
| Phase 3: ESM 빌드 및 검증 | ⏳ 대기 | - |
| **전체 완료** | ⏳ 대기 | - |

---

## 실행 명령어 요약

```bash
# 1. 초기 설정
npm install -D typescript ts-migrate @types/...

# 2. 자동 변환
npx ts-migrate-full

# 3. 타입 정제 (점진적)
# - any 제거
# - 타입 정의 추가
# - import/export 변환

# 4. 검증
npm run typecheck
npm run build
npm run test:unit
npm run validate:all
```

---

## 참고 자료

- [ts-migrate 공식 가이드](https://github.com/airbnb/ts-migrate)
- [TypeScript ESM 마이그레이션](https://nodejs.org/api/esm.html)
- [Prisma TypeScript 베스트 프랙티스](https://www.prisma.io/docs/orm/prisma-client/type-safety)
- [Zod + TypeScript](https://zod.dev/?id=typescript)