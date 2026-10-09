CREATE TABLE public.auth_sessions (
 id UUID PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 refresh_hash TEXT NOT NULL,
 expires_at TIMESTAMP(3) NOT NULL,
 revoked_at TIMESTAMP(3),
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX auth_sessions_user_expiry_idx ON public.auth_sessions(user_id,expires_at);
ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_sessions FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON public.auth_sessions FROM anon; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON public.auth_sessions FROM authenticated; END IF;
END $$;
