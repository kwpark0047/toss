-- Remove stale duplicate READY rows before enforcing one active payment attempt per order.
WITH ranked_ready AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY id DESC) AS row_number
  FROM payments
  WHERE status = 'READY' AND order_id IS NOT NULL
)
DELETE FROM payments
USING ranked_ready
WHERE payments.id = ranked_ready.id
  AND ranked_ready.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS payments_one_ready_per_order_idx
ON payments (order_id)
WHERE status = 'READY' AND order_id IS NOT NULL;

WITH ranked_transactions AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY toss_transaction_id ORDER BY id DESC) AS row_number
  FROM payments
  WHERE toss_transaction_id IS NOT NULL
)
UPDATE payments
SET toss_transaction_id = NULL
FROM ranked_transactions
WHERE payments.id = ranked_transactions.id
  AND ranked_transactions.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS payments_toss_transaction_id_key
ON payments (toss_transaction_id);
