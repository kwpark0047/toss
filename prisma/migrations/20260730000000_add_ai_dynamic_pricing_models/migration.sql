-- 9개 AI/동적가격/수요예측 모델 추가

-- ============================================================
-- 동적 가격 규칙 (Dynamic Pricing Rules)
-- ============================================================
CREATE TABLE "dynamic_pricing_rules" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "rule_name" TEXT NOT NULL,
    "rule_type" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "min_price" INTEGER NOT NULL,
    "max_price" INTEGER NOT NULL,
    "base_price" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dynamic_pricing_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_dynamic_pricing_store_product" ON "dynamic_pricing_rules"("store_id", "product_id");
CREATE INDEX "idx_dynamic_pricing_active" ON "dynamic_pricing_rules"("is_active");

ALTER TABLE "dynamic_pricing_rules" ADD CONSTRAINT "dynamic_pricing_rules_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "dynamic_pricing_rules" ADD CONSTRAINT "dynamic_pricing_rules_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;

-- ============================================================
-- 동적 가격 변경 로그 (Dynamic Price Logs)
-- ============================================================
CREATE TABLE "dynamic_price_logs" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "rule_id" INTEGER,
    "old_price" INTEGER NOT NULL,
    "new_price" INTEGER NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "trigger_data" JSONB,
    "ai_reasoning" TEXT,
    "confidence_score" DOUBLE PRECISION,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "applied_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dynamic_price_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_dynamic_price_logs_store_product_time" ON "dynamic_price_logs"("store_id", "product_id", "created_at" DESC);
CREATE INDEX "idx_dynamic_price_logs_rule" ON "dynamic_price_logs"("rule_id");
CREATE INDEX "idx_dynamic_price_logs_applied" ON "dynamic_price_logs"("applied");

ALTER TABLE "dynamic_price_logs" ADD CONSTRAINT "dynamic_price_logs_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "dynamic_price_logs" ADD CONSTRAINT "dynamic_price_logs_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;
ALTER TABLE "dynamic_price_logs" ADD CONSTRAINT "dynamic_price_logs_rule_id_fkey"
    FOREIGN KEY ("rule_id") REFERENCES "dynamic_pricing_rules"("id") ON DELETE SET NULL;

-- ============================================================
-- 경쟁사 가격 정보 (Competitor Prices)
-- ============================================================
CREATE TABLE "competitor_prices" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "product_name" TEXT NOT NULL,
    "competitor_name" TEXT NOT NULL,
    "competitor_price" INTEGER NOT NULL,
    "competitor_url" TEXT,
    "last_checked" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "competitor_prices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_competitor_prices_store_product" ON "competitor_prices"("store_id", "product_name");
CREATE INDEX "idx_competitor_prices_active" ON "competitor_prices"("is_active");

ALTER TABLE "competitor_prices" ADD CONSTRAINT "competitor_prices_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;

-- ============================================================
-- 고객 세그먼트 (Customer Segments)
-- ============================================================
CREATE TABLE "customer_segments" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "segment_name" TEXT NOT NULL,
    "segment_type" TEXT NOT NULL,
    "segment_description" TEXT,
    "characteristics" JSONB NOT NULL,
    "size" INTEGER NOT NULL,
    "revenue_contribution" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_segments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_customer_segments_store_type" ON "customer_segments"("store_id", "segment_type");
CREATE INDEX "idx_customer_segments_active" ON "customer_segments"("is_active");

ALTER TABLE "customer_segments" ADD CONSTRAINT "customer_segments_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;

-- ============================================================
-- 고객 개인화 (Customer Personalizations)
-- ============================================================
CREATE TABLE "customer_personalizations" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "segment_id" INTEGER,
    "preferences" JSONB NOT NULL,
    "custom_discount" DOUBLE PRECISION NOT NULL,
    "special_offers" JSONB NOT NULL,
    "last_order_date" TIMESTAMPTZ,
    "lifetime_value" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_personalizations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_customer_personalizations_store_phone" ON "customer_personalizations"("store_id", "customer_phone");
CREATE INDEX "idx_customer_personalizations_segment" ON "customer_personalizations"("segment_id");

ALTER TABLE "customer_personalizations" ADD CONSTRAINT "customer_personalizations_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "customer_personalizations" ADD CONSTRAINT "customer_personalizations_segment_id_fkey"
    FOREIGN KEY ("segment_id") REFERENCES "customer_segments"("id") ON DELETE SET NULL;

-- ============================================================
-- AI 추천 (AI Recommendations)
-- ============================================================
CREATE TABLE "ai_recommendations" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "customer_phone" TEXT,
    "segment_id" INTEGER,
    "recommendation_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "target_product_ids" JSONB NOT NULL,
    "discount_percent" DOUBLE PRECISION,
    "valid_from" TIMESTAMPTZ NOT NULL,
    "valid_to" TIMESTAMPTZ NOT NULL,
    "click_through_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversion_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_ai_recommendations_store_type" ON "ai_recommendations"("store_id", "recommendation_type");
CREATE INDEX "idx_ai_recommendations_created" ON "ai_recommendations"("created_at" DESC);

ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_segment_id_fkey"
    FOREIGN KEY ("segment_id") REFERENCES "customer_segments"("id") ON DELETE SET NULL;

-- ============================================================
-- 개인화 분석 (Personalization Analytics)
-- ============================================================
CREATE TABLE "personalization_analytics" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "segment_id" INTEGER,
    "date" TIMESTAMPTZ NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "click_throughs" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue_from_segment" INTEGER NOT NULL DEFAULT 0,
    "avg_order_value" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "personalization_analytics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_personalization_analytics_store_segment_date" ON "personalization_analytics"("store_id", "segment_id", "date");
CREATE INDEX "idx_personalization_analytics_store_date" ON "personalization_analytics"("store_id", "date" DESC);

ALTER TABLE "personalization_analytics" ADD CONSTRAINT "personalization_analytics_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "personalization_analytics" ADD CONSTRAINT "personalization_analytics_segment_id_fkey"
    FOREIGN KEY ("segment_id") REFERENCES "customer_segments"("id") ON DELETE SET NULL;

-- ============================================================
-- 수요 예측 (Demand Forecasts)
-- ============================================================
CREATE TABLE "demand_forecasts" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "forecast_date" TIMESTAMPTZ NOT NULL,
    "predicted_demand" INTEGER NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "factors" JSONB NOT NULL,
    "model_version" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "demand_forecasts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_demand_forecast_store_product_date" ON "demand_forecasts"("store_id", "product_id", "forecast_date");
CREATE INDEX "idx_demand_forecast_store_date" ON "demand_forecasts"("store_id", "forecast_date");

ALTER TABLE "demand_forecasts" ADD CONSTRAINT "demand_forecasts_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "demand_forecasts" ADD CONSTRAINT "demand_forecasts_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;

-- ============================================================
-- 가격 최적화 작업 (Pricing Optimization Jobs)
-- ============================================================
CREATE TABLE "pricing_optimization_jobs" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "job_type" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "error_message" TEXT,
    "result_summary" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pricing_optimization_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_pricing_jobs_store_status" ON "pricing_optimization_jobs"("store_id", "status");
CREATE INDEX "idx_pricing_jobs_created" ON "pricing_optimization_jobs"("created_at" DESC);

ALTER TABLE "pricing_optimization_jobs" ADD CONSTRAINT "pricing_optimization_jobs_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
