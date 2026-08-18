UPDATE "feature_flags" SET "store_id" = 0 WHERE "store_id" IS NULL;
ALTER TABLE "feature_flags" ALTER COLUMN "store_id" SET DEFAULT 0;
ALTER TABLE "feature_flags" ALTER COLUMN "store_id" SET NOT NULL;
DROP INDEX IF EXISTS "feature_flags_key_key";
CREATE UNIQUE INDEX "uq_feature_flags_scope" ON "feature_flags"("key", "environment", "store_id");
