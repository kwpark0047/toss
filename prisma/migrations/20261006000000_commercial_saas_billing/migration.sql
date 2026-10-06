-- Existing subscriptions must not start automatic charging without renewed consent.
ALTER TABLE "public"."Subscription" ADD COLUMN "auto_renew" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "public"."BillingInvoice" (
  "id" TEXT NOT NULL,
  "subscription_id" TEXT NOT NULL,
  "store_id" INTEGER NOT NULL,
  "plan_id" TEXT NOT NULL,
  "billing_cycle" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL CHECK ("amount" > 0),
  "currency" TEXT NOT NULL DEFAULT 'KRW',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_retry_at" TIMESTAMP(3),
  "claimed_at" TIMESTAMP(3),
  "payment_key" TEXT,
  "receipt_url" TEXT,
  "failure_code" TEXT,
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BillingInvoice_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BillingInvoice_order_id_key" ON "public"."BillingInvoice"("order_id");
CREATE UNIQUE INDEX "BillingInvoice_subscription_id_period_start_key" ON "public"."BillingInvoice"("subscription_id", "period_start");
CREATE INDEX "BillingInvoice_status_next_retry_at_idx" ON "public"."BillingInvoice"("status", "next_retry_at");
CREATE INDEX "BillingInvoice_store_id_created_at_idx" ON "public"."BillingInvoice"("store_id", "created_at");

CREATE TABLE "public"."IdempotencyRecord" (
  "id" TEXT NOT NULL,
  "body_hash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'processing',
  "status_code" INTEGER,
  "response" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IdempotencyRecord_created_at_idx" ON "public"."IdempotencyRecord"("created_at");

ALTER TABLE "public"."point_transactions" ADD COLUMN "reversal_of" INTEGER;
CREATE UNIQUE INDEX "point_transactions_reversal_of_key" ON "public"."point_transactions"("reversal_of");
