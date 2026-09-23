-- CreateTable
CREATE TABLE "public"."ai_usage_logs" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "cost_usd" DOUBLE PRECISION,
    "status_code" INTEGER,
    "duration_ms" INTEGER,
    "cache_hit" BOOLEAN NOT NULL DEFAULT false,
    "fallback_used" BOOLEAN NOT NULL DEFAULT false,
    "store_id" INTEGER,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_ai_usage_logs_store_created" ON "public"."ai_usage_logs"("store_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_ai_usage_logs_provider_created" ON "public"."ai_usage_logs"("provider", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "public"."ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;