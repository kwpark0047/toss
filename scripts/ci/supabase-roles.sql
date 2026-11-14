-- Disposable PostgreSQL CI services do not provide Supabase's built-in roles.
-- Match the production role names so applied security migrations run unchanged.
-- These roles cannot log in and receive no privileges here.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;
