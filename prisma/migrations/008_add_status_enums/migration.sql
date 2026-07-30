-- Migration: add_status_enums
-- Description: 주문/결제 상태 String -> Native Enum 전환

-- 1. OrderStatus enum 생성 및 orders.status 마이그레이션
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled');

ALTER TABLE "orders"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "OrderStatus"
    USING (COALESCE("status", 'pending')::text::"OrderStatus"),
  ALTER COLUMN "status" SET DEFAULT 'pending';

-- 2. OrderPaymentStatus enum 생성 및 orders.payment_status 마이그레이션
CREATE TYPE "OrderPaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded');

ALTER TABLE "orders"
  ALTER COLUMN "payment_status" DROP DEFAULT,
  ALTER COLUMN "payment_status" TYPE "OrderPaymentStatus"
    USING (COALESCE("payment_status", 'pending')::text::"OrderPaymentStatus"),
  ALTER COLUMN "payment_status" SET DEFAULT 'pending';

-- 3. PaymentTxStatus enum 생성 및 payments.status 마이그레이션
CREATE TYPE "PaymentTxStatus" AS ENUM ('pending', 'READY', 'DONE', 'CANCELED', 'PARTIAL_CANCELED');

ALTER TABLE "payments"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "PaymentTxStatus"
    USING (COALESCE("status", 'pending')::text::"PaymentTxStatus"),
  ALTER COLUMN "status" SET DEFAULT 'pending';
