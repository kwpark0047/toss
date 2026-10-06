-- Match nullable fields already defined in the Prisma users model.
-- Preserve existing accounts and the two_factor_enabled flag.
ALTER TABLE "public"."users"
  ADD COLUMN IF NOT EXISTS "two_factor_secret" TEXT,
  ADD COLUMN IF NOT EXISTS "two_factor_backup_codes" TEXT;
