BEGIN;
-- Abort transaction on existing case-fold collisions; never merge or rewrite accounts.
CREATE UNIQUE INDEX users_email_casefold_key ON public.users(lower(email)) WHERE email IS NOT NULL;
ALTER TABLE public.users ADD COLUMN auth_status text NOT NULL DEFAULT 'active' CHECK(auth_status IN ('active','deletion_pending'));
ALTER TABLE public.users ADD COLUMN password_login_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN email_verified_at timestamptz;
CREATE TABLE public.auth_email_challenges (
 id uuid PRIMARY KEY, email text NOT NULL, purpose text NOT NULL CHECK(purpose IN ('signup','login','link','reauth')),
 user_id integer REFERENCES public.users(id), session_id uuid REFERENCES public.auth_sessions(id), browser_hash text NOT NULL, otp_hash text NOT NULL, link_hash text NOT NULL,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5), expires_at timestamptz NOT NULL,
 used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 dispatch_state text NOT NULL DEFAULT 'pending' CHECK(dispatch_state IN ('pending','sending','accepted','uncertain','failed')),
 dispatch_payload text, dispatch_started_at timestamptz
);
CREATE INDEX auth_email_challenge_rate ON public.auth_email_challenges(email,created_at DESC);
CREATE TABLE public.auth_oauth_flows (
 id uuid PRIMARY KEY, provider text NOT NULL CHECK(provider IN ('google','kakao')), state_hash text NOT NULL UNIQUE,
 browser_hash text NOT NULL, nonce text NOT NULL, verifier_ciphertext text NOT NULL,
 intent text NOT NULL CHECK(intent IN ('login','signup','link','reauth')), user_id integer REFERENCES public.users(id), session_id uuid REFERENCES public.auth_sessions(id),
 expires_at timestamptz NOT NULL, used_at timestamptz, result_ciphertext text, result_used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.auth_abuse_buckets (
 bucket_key text NOT NULL, window_start timestamptz NOT NULL, hits integer NOT NULL,
 PRIMARY KEY(bucket_key,window_start)
);
CREATE TABLE public.auth_recent_proofs (
 proof_hash text PRIMARY KEY, user_id integer NOT NULL REFERENCES public.users(id), session_id uuid NOT NULL REFERENCES public.auth_sessions(id),
 expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.auth_account_events (
 id uuid PRIMARY KEY, user_id integer NOT NULL REFERENCES public.users(id), event text NOT NULL,
 operation_id uuid NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.auth_mfa_challenges (
 id uuid PRIMARY KEY, user_id integer NOT NULL REFERENCES public.users(id), browser_hash text NOT NULL,
 purpose text NOT NULL DEFAULT 'login' CHECK(purpose IN ('login','reauth')), session_id uuid REFERENCES public.auth_sessions(id),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5), expires_at timestamptz NOT NULL, used_at timestamptz
);
ALTER TABLE public.auth_email_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_oauth_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_abuse_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_recent_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_account_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_mfa_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_email_challenges,public.auth_oauth_flows,public.auth_abuse_buckets,public.auth_recent_proofs,public.auth_account_events FROM PUBLIC;
REVOKE ALL ON public.auth_mfa_challenges FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
 REVOKE ALL ON public.auth_email_challenges,public.auth_oauth_flows,public.auth_abuse_buckets,public.auth_recent_proofs,public.auth_account_events FROM anon;
 REVOKE ALL ON public.auth_mfa_challenges FROM anon;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
 REVOKE ALL ON public.auth_email_challenges,public.auth_oauth_flows,public.auth_abuse_buckets,public.auth_recent_proofs,public.auth_account_events FROM authenticated;
 REVOKE ALL ON public.auth_mfa_challenges FROM authenticated;
 END IF;
END $$;
COMMIT;
