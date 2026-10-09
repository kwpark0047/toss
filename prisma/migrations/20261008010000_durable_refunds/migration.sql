-- Additive migration. No automatic rewriting of historical financial records.
CREATE TABLE public.refund_operations (
 id uuid PRIMARY KEY, operation_key text NOT NULL UNIQUE,
 payment_id integer NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 store_id integer NOT NULL, amount integer NOT NULL CHECK (amount > 0),
 baseline_balance integer NOT NULL CHECK (baseline_balance >= amount),
 reason text NOT NULL, status text NOT NULL CHECK (status IN ('processing','unknown','confirmed')),
 owner uuid, lease_until timestamptz, attempts integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), confirmed_at timestamptz
);
CREATE INDEX refund_operations_payment_id_status_idx ON public.refund_operations(payment_id,status);
-- Only one unresolved external effect may exist per payment, including across replicas.
CREATE UNIQUE INDEX refund_operations_unresolved_payment ON public.refund_operations(payment_id)
 WHERE status IN ('processing','unknown');
-- Financial intents are server-only. The backend DB role must own this table or
-- use its explicitly reviewed service role; never grant browser/public-role access.
ALTER TABLE public.refund_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.refund_operations FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON TABLE public.refund_operations FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON TABLE public.refund_operations FROM authenticated;
  END IF;
END $$;
