-- Existing production databases were baselined before this column was present.
-- IF NOT EXISTS keeps fresh databases safe because the baseline already creates it.
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;
