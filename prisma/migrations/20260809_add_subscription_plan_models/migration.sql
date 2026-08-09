-- Migration: add_subscription_plan_models
-- Description: 플랜 정의(Plan), 구독(Subscription) 모델 추가 및 stores 구독 필드 확장

-- 1. Plan 테이블 생성
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "price_monthly" INTEGER NOT NULL DEFAULT 0,
    "price_yearly" INTEGER NOT NULL DEFAULT 0,
    "features" JSONB NOT NULL,
    "limits" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "trial_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");
CREATE INDEX "idx_plan_active" ON "Plan"("is_active");

-- 2. Subscription 테이블 생성
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "store_id" INTEGER NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "billing_cycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "current_period_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "trial_ends_at" TIMESTAMP(3),
    "cancel_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "payment_method_id" TEXT,
    "last_payment_at" TIMESTAMP(3),
    "next_payment_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_subscription_store" ON "Subscription"("store_id");
CREATE INDEX "idx_subscription_status" ON "Subscription"("status");
CREATE INDEX "idx_subscription_plan" ON "Subscription"("plan_id");

-- 3. stores 테이블에 구독 관련 컬럼 추가
ALTER TABLE "stores"
    ADD COLUMN IF NOT EXISTS "subscription_id" TEXT,
    ADD COLUMN IF NOT EXISTS "billing_cycle" TEXT DEFAULT 'MONTHLY',
    ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "plan_expires_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "auto_renew" BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS "payment_method_id" TEXT,
    ADD COLUMN IF NOT EXISTS "last_payment_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "next_payment_at" TIMESTAMP(3);

-- 4. stores에 subscription_id 유니크 인덱스 추가
CREATE UNIQUE INDEX IF NOT EXISTS "uq_stores_subscription_id" ON "stores"("subscription_id");

-- 5. stores에 subscription relation 추가
ALTER TABLE "stores"
    ADD CONSTRAINT "fk_stores_subscription"
    FOREIGN KEY ("subscription_id") REFERENCES "Subscription"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Subscription 테이블에 plan_id, store_id FK 추가
ALTER TABLE "Subscription"
    ADD CONSTRAINT "fk_subscription_plan"
    FOREIGN KEY ("plan_id") REFERENCES "Plan"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Subscription"
    ADD CONSTRAINT "fk_subscription_store"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. 기본 플랜 데이터 삽입
INSERT INTO "Plan" ("id", "name", "display_name", "description", "price_monthly", "price_yearly", "features", "limits", "is_active", "sort_order", "trial_days")
VALUES
    ('plan_free', 'free', 'Free', '기본 매장 운영 및 QR 코드 생성', 0, 0,
     '{"maxMenus": 50, "maxStaff": 1, "aiRecommendations": false, "brandpay": false, "analytics": "basic", "customDomain": false}'::jsonb,
     '{"menuItems": 50, "staff": 1, "ordersPerMonth": 1000}'::jsonb,
     true, 0, 0),
    ('plan_pro', 'pro', 'Pro', '실시간 결제 및 부가 편의 기능', 20000, 200000,
     '{"maxMenus": 200, "maxStaff": 10, "aiRecommendations": true, "brandpay": true, "analytics": "advanced", "customDomain": true}'::jsonb,
     '{"menuItems": 200, "staff": 10, "ordersPerMonth": 10000}'::jsonb,
     true, 1, 14),
    ('plan_enterprise', 'enterprise', 'Enterprise', '프리미엄 통합 매장 운영', 50000, 500000,
     '{"maxMenus": -1, "maxStaff": -1, "aiRecommendations": true, "brandpay": true, "analytics": "premium", "customDomain": true, "dedicatedManager": true, "apiAccess": true}'::jsonb,
     '{"menuItems": -1, "staff": -1, "ordersPerMonth": -1}'::jsonb,
     true, 2, 30)
ON CONFLICT ("name") DO NOTHING;

-- 8. 기존 stores의 plan 값을 기준으로 Subscription 레코드 생성
INSERT INTO "Subscription" ("id", "store_id", "plan_id", "status", "billing_cycle", "current_period_start", "current_period_end", "created_at", "updated_at")
SELECT 
    gen_random_uuid()::text,
    s.id,
    CASE 
        WHEN s.plan = 'pro' THEN 'plan_pro'
        WHEN s.plan = 'enterprise' THEN 'plan_enterprise'
        ELSE 'plan_free'
    END,
    'active',
    'MONTHLY',
    s.created_at,
    s.created_at + interval '1 month',
    s.created_at,
    now()
FROM "stores" s
WHERE NOT EXISTS (SELECT 1 FROM "Subscription" sub WHERE sub.store_id = s.id);

-- 9. stores.subscription_id 업데이트
UPDATE "stores" s
SET "subscription_id" = sub.id
FROM "Subscription" sub
WHERE sub.store_id = s.id
  AND s.subscription_id IS NULL;
