-- Additive only: no historical ledger updates, no inferred consent grants.
CREATE TABLE public.customer_ai_consents (
 store_id integer NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
 user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 verified_phone text NOT NULL CHECK (verified_phone LIKE 'enc:%'),
 verified_at timestamptz NOT NULL, consent_at timestamptz NOT NULL,
 revoked_at timestamptz, PRIMARY KEY(store_id,user_id)
);
ALTER TABLE public.refund_operations ADD COLUMN provider_result jsonb;
CREATE TABLE public.inventory_compensations (
 order_id integer PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
 store_id integer NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed')),
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE INDEX inventory_compensations_store_id_status_idx ON public.inventory_compensations(store_id,status);
ALTER TABLE public.stock_history ADD COLUMN compensation_key text;
CREATE UNIQUE INDEX stock_history_compensation_key_key ON public.stock_history(compensation_key);
ALTER TABLE public.customer_ai_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_compensations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_ai_consents, public.inventory_compensations FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON public.customer_ai_consents, public.inventory_compensations FROM anon;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  REVOKE ALL ON public.customer_ai_consents, public.inventory_compensations FROM authenticated;
 END IF;
END $$;
