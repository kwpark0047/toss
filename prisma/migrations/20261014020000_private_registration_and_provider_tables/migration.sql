BEGIN;
-- Express uses its server DB role. These tables must never be writable/readable via public Data API roles.
ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phone_otps,public.provider_credentials FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON public.phone_otps,public.provider_credentials FROM anon;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  REVOKE ALL ON public.phone_otps,public.provider_credentials FROM authenticated;
 END IF;
END $$;
COMMIT;
