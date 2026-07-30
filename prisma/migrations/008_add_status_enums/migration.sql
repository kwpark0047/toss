-- Migration: add_status_enums
-- Description: 주문/결제 상태 String -> Native Enum 전환

-- 1. OrderStatus enum 생성 및 orders.status 마이그레이션
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled');

UPDATE "orders" SET "status" = 'pending' WHERE "status" NOT IN ('pending','confirmed','preparing','ready','completed','cancelled');

ALTER TABLE "orders"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "OrderStatus" USING ("status"::text::"OrderStatus"),
  ALTER COLUMN "status" SET DEFAULT 'pending';

-- 2. OrderPaymentStatus enum 생성 및 orders.payment_status 마이그레이션
CREATE TYPE "OrderPaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded');

UPDATE "orders" SET "payment_status" = 'pending' WHERE "payment_status" NOT IN ('pending','paid','failed','refunded');

ALTER TABLE "orders"
  ALTER COLUMN "payment_status" DROP DEFAULT,
  ALTER COLUMN "payment_status" TYPE "OrderPaymentStatus" USING ("payment_status"::text::"OrderPaymentStatus"),
  ALTER COLUMN "payment_status" SET DEFAULT 'pending';

-- 3. PaymentTxStatus enum 생성 및 payments.status 마이그레이션
-- NOTE: payments_one_ready_per_order_idx partial index on status='READY' blocks ALTER TYPE;
--       must drop before ALTER and recreate after.
DROP INDEX IF EXISTS payments_one_ready_per_order_idx;

CREATE TYPE "PaymentTxStatus" AS ENUM ('pending', 'READY', 'DONE', 'CANCELED', 'PARTIAL_CANCELED');

UPDATE "payments" SET "status" = 'pending' WHERE "status" NOT IN ('pending','READY','DONE','CANCELED','PARTIAL_CANCELED');

ALTER TABLE "payments"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "PaymentTxStatus" USING ("status"::text::"PaymentTxStatus"),
  ALTER COLUMN "status" SET DEFAULT 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS payments_one_ready_per_order_idx
  ON payments (order_id)
  WHERE status = 'READY' AND order_id IS NOT NULL;
