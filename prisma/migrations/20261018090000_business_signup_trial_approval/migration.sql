BEGIN;

-- Existing accounts remain approved; only newly created direct-signup accounts
-- are assigned the one-month trial state by the signup service.
ALTER TABLE public.users
  ADD COLUMN business_access_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN trial_started_at timestamptz,
  ADD COLUMN trial_ends_at timestamptz,
  ADD COLUMN business_approved_at timestamptz,
  ADD COLUMN business_approved_by integer;

ALTER TABLE public.users
  ADD CONSTRAINT users_business_access_status_check
  CHECK (business_access_status IN ('trialing', 'approved', 'rejected'));

CREATE INDEX idx_users_business_trial_status_end
  ON public.users (business_access_status, trial_ends_at);

COMMIT;

