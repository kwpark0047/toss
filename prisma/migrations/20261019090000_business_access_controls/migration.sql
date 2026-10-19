BEGIN;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_business_access_status_check,
  ADD COLUMN IF NOT EXISTS business_access_note text,
  ADD COLUMN IF NOT EXISTS business_access_previous_status text,
  ADD COLUMN IF NOT EXISTS business_access_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS business_access_updated_by integer;

ALTER TABLE public.users
  ADD CONSTRAINT users_business_access_status_check
  CHECK (business_access_status IN ('trialing', 'approved', 'rejected', 'suspended', 'fraud_review'));

CREATE INDEX IF NOT EXISTS idx_users_business_access_updated
  ON public.users (business_access_status, business_access_updated_at DESC);

COMMIT;

