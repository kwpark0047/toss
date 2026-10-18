BEGIN;

-- Persist the exact consent version with each signup challenge so a challenge
-- started before the age/policy gate cannot create an account after rollout.
ALTER TABLE public.auth_email_challenges
  ADD COLUMN consent_version text;
ALTER TABLE public.auth_oauth_flows
  ADD COLUMN consent_version text;

ALTER TABLE public.auth_email_challenges
  ADD CONSTRAINT auth_email_signup_consent_version_check
  CHECK (purpose <> 'signup' OR consent_version IS NULL OR consent_version = 'platform-terms-privacy-2026-10-17-age14-v1');
ALTER TABLE public.auth_oauth_flows
  ADD CONSTRAINT auth_oauth_signup_consent_version_check
  CHECK (intent <> 'signup' OR consent_version IS NULL OR consent_version = 'platform-terms-privacy-2026-10-17-age14-v1');

COMMIT;

