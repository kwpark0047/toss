-- Repair migration: recreate baseline tables that were never applied to the
-- production database (admin_otps, food_trucks, news, social_accounts).
--
-- WHY: prod `_prisma_migrations` shows the baseline migration as applied, but a
-- previous deploy ran `prisma migrate resolve --applied` (or equivalent) without
-- executing the baseline DDL. The deployed client then fails with P2021
-- "table does not exist" for e.g. `food_trucks` (GET /api/foodtruck/active -> 500).
--
-- SAFETY: every statement is idempotent (IF NOT EXISTS). FK constraints are added
-- only when the constraint name is absent from pg_constraint. On environments where
-- the baseline already ran (local/dev/staging), this migration is a complete no-op.
--
-- Baseline DDL here is copied verbatim from
-- prisma/migrations/20260101000000_baseline/migration.sql. "food_trucks" is created
-- WITHOUT "design_theme" (added later by 20260818070000_add_food_truck_design_theme).

-- CreateTable
CREATE TABLE IF NOT EXISTS "food_trucks" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "is_active_session" BOOLEAN NOT NULL DEFAULT false,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "last_gps_updated_at" TIMESTAMP(3),
    "geocoded_address" TEXT,
    "is_sold_out_emergency" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_trucks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "social_accounts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "provider" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "profile_image" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "admin_otps" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "otp" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'LOGIN',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "news" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "category" TEXT,
    "summary" TEXT,
    "imageUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "food_trucks_store_id_key" ON "food_trucks"("store_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_food_trucks_store_active" ON "food_trucks"("store_id", "is_active_session");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_accounts_user_id_idx" ON "social_accounts"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_accounts_provider_idx" ON "social_accounts"("provider");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "social_accounts_provider_provider_id_key" ON "social_accounts"("provider", "provider_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admin_otps_user_id_purpose_idx" ON "admin_otps"("user_id", "purpose");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admin_otps_user_id_created_at_idx" ON "admin_otps"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "news_link_key" ON "news"("link");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "news_source_idx" ON "news"("source");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "news_publishedAt_idx" ON "news"("publishedAt" DESC);

-- AddForeignKey (idempotent: only when the constraint does not exist yet)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'food_trucks_store_id_fkey'
    ) THEN
        ALTER TABLE "food_trucks" ADD CONSTRAINT "food_trucks_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'social_accounts_user_id_fkey'
    ) THEN
        ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'admin_otps_user_id_fkey'
    ) THEN
        ALTER TABLE "admin_otps" ADD CONSTRAINT "admin_otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;