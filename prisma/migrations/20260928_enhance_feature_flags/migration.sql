-- Migration: Add missing columns to feature_flags table
-- Date: 2026-09-28
-- Description: Add value, default_value, type, targeting, store_overrides, created_by, updated_by columns

-- Add new columns with defaults
ALTER TABLE "feature_flags"
ADD COLUMN IF NOT EXISTS "value" JSONB NOT NULL DEFAULT 'true',
ADD COLUMN IF NOT EXISTS "default_value" JSONB NOT NULL DEFAULT 'false',
ADD COLUMN IF NOT EXISTS "type" VARCHAR(20) NOT NULL DEFAULT 'boolean',
ADD COLUMN IF NOT EXISTS "targeting" JSONB,
ADD COLUMN IF NOT EXISTS "store_overrides" JSONB,
ADD COLUMN IF NOT EXISTS "created_by" INTEGER,
ADD COLUMN IF NOT EXISTS "updated_by" INTEGER;

-- Rename rollout_percent to rollout_percentage for consistency (optional)
-- ALTER TABLE "feature_flags" RENAME COLUMN "rollout_percent" TO "rollout_percentage";

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_feature_flags_type ON "feature_flags"("type");
CREATE INDEX IF NOT EXISTS idx_feature_flags_targeting ON "feature_flags" USING GIN ("targeting");

-- Add foreign key constraints for created_by/updated_by (optional, if users table exists)
-- ALTER TABLE "feature_flags" ADD CONSTRAINT fk_feature_flags_created_by FOREIGN KEY ("created_by") REFERENCES "users"("id");
-- ALTER TABLE "feature_flags" ADD CONSTRAINT fk_feature_flags_updated_by FOREIGN KEY ("updated_by") REFERENCES "users"("id");