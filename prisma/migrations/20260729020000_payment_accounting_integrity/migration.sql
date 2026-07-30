-- Settlement rows are financial records and must not be silently merged or deleted.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM settlements
    GROUP BY store_id, period_start, period_end
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate settlement periods exist; reconcile them before applying this migration.';
  END IF;
END $$;

ALTER TABLE "payments"
ADD COLUMN "refunded_amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "confirmation_status" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN "confirmation_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "confirmation_error" TEXT;

-- Carry forward legacy refunds so deploys cannot refund the same captured amount again.
UPDATE payments
SET refunded_amount = LEAST(
  payments.amount,
  legacy_refunds.total_refunded
)
FROM (
  SELECT payment_id, SUM(ABS(amount))::INTEGER AS total_refunded
  FROM ledger
  WHERE type = 'REFUND' AND payment_id IS NOT NULL
  GROUP BY payment_id
) AS legacy_refunds
WHERE payments.id = legacy_refunds.payment_id;

ALTER TABLE "ledger" ADD COLUMN "event_key" TEXT;

CREATE TABLE "payment_refunds" (
  "id" SERIAL NOT NULL,
  "payment_id" INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "provider_reference" TEXT,
  "amount" INTEGER NOT NULL,
  "refundable_balance_after" INTEGER NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "provider_response" TEXT,
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_refunds_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "payment_refunds_balance_nonnegative" CHECK ("refundable_balance_after" >= 0),
  CONSTRAINT "payment_refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "uq_payment_refunds_idempotency_key" ON "payment_refunds"("idempotency_key");
CREATE UNIQUE INDEX "uq_payment_refunds_provider_reference" ON "payment_refunds"("provider_reference");
CREATE INDEX "idx_payment_refunds_payment_status" ON "payment_refunds"("payment_id", "status");
CREATE UNIQUE INDEX "uq_ledger_event_key" ON "ledger"("event_key");

-- Preserve the oldest event reference if legacy data already contains duplicates.
WITH ranked_point_references AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY reference_id ORDER BY id) AS row_number
  FROM point_transactions
  WHERE reference_id IS NOT NULL
)
UPDATE point_transactions
SET reference_id = NULL
FROM ranked_point_references
WHERE point_transactions.id = ranked_point_references.id
  AND ranked_point_references.row_number > 1;

CREATE UNIQUE INDEX "uq_point_transactions_reference_id" ON "point_transactions"("reference_id");
CREATE UNIQUE INDEX "uq_settlements_store_period" ON "settlements"("store_id", "period_start", "period_end");

ALTER TABLE "payments"
ADD CONSTRAINT "payments_refunded_amount_valid" CHECK ("refunded_amount" >= 0 AND "refunded_amount" <= "amount");
