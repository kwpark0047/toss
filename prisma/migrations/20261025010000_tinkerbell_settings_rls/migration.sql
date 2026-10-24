-- Store settings are authorized by the Express API; the public Supabase
-- Data API must not bypass that authorization. Prisma uses the DB owner.
ALTER TABLE public.store_tinkerbell_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.store_tinkerbell_settings FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.store_tinkerbell_settings_id_seq FROM anon, authenticated;
