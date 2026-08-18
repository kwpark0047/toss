CREATE TABLE "feature_flags" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rollout_percent" INTEGER NOT NULL DEFAULT 100,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "store_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");
CREATE INDEX "idx_feature_flags_environment_enabled" ON "feature_flags"("environment", "enabled");
CREATE INDEX "idx_feature_flags_store" ON "feature_flags"("store_id");
