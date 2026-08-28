-- Migration: split_stores_model
-- Description: stores 모델을 도메인별로 분할 (단일 책임 원칙 적용)
-- 핵심 stores 모델만 유지하고, 구독/사업자정보/법적문서/정산/친환경/영업시간을 별도 모델로 분리

-- ============================================================
-- 1. 새 도메인 모델 테이블 생성
-- ============================================================

-- 구독/멤버십 정보
CREATE TABLE "store_subscriptions" (
    "id" SERIAL PRIMARY KEY,
    "store_id" INTEGER NOT NULL UNIQUE,
    "subscription_id" VARCHAR(255) UNIQUE,
    "plan" VARCHAR(50) DEFAULT 'free',
    "billing_cycle" VARCHAR(20) DEFAULT 'MONTHLY',
    "trial_ends_at" TIMESTAMP,
    "plan_expires_at" TIMESTAMP,
    "auto_renew" BOOLEAN DEFAULT true,
    "payment_method_id" VARCHAR(255),  -- Toss brandpay billingKey
    "last_payment_at" TIMESTAMP,
    "next_payment_at" TIMESTAMP,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW(),
    CONSTRAINT "fk_store_subscriptions_store" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_store_subscriptions_store" ON "store_subscriptions"("store_id");
CREATE INDEX "idx_store_subscriptions_subscription_id" ON "store_subscriptions"("subscription_id");

-- 사업자/법적 정보
CREATE TABLE "store_business_info" (
    "id" SERIAL PRIMARY KEY,
    "store_id" INTEGER NOT NULL UNIQUE,
    "business_type" VARCHAR(50),
    "business_number" VARCHAR(50),      -- 사업자등록번호 (000-00-00000)
    "business_name" VARCHAR(255),       -- 법인명/상호명
    "ceo_name" VARCHAR(100),            -- 대표자명
    "tax_invoice_email" VARCHAR(255),   -- 세금계산서 수신 이메일
    "mail_order_number" VARCHAR(50),    -- 통신판매업신고번호
    "business_address" TEXT,            -- 사업장 소재지 (도로명)
    "customer_service_phone" VARCHAR(50), -- 고객센터 전화번호
    "customer_service_email" VARCHAR(255), -- 고객센터 이메일
    "pg_company" VARCHAR(100) DEFAULT '토스페이먼츠',
    "pg_business_number" VARCHAR(50) DEFAULT '214-88-00591',
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW(),
    CONSTRAINT "fk_store_business_info_store" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_store_business_info_store" ON "store_business_info"("store_id");
CREATE INDEX "idx_store_business_info_business_number" ON "store_business_info"("business_number");

-- 법적 동의 문서
CREATE TABLE "store_legal_documents" (
    "id" SERIAL PRIMARY KEY,
    "store_id" INTEGER NOT NULL UNIQUE,
    "terms_of_service" TEXT,      -- 이용약관
    "privacy_policy" TEXT,        -- 개인정보처리방침
    "refund_policy" TEXT,         -- 환불·취소 정책
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW(),
    CONSTRAINT "fk_store_legal_documents_store" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_store_legal_documents_store" ON "store_legal_documents"("store_id");

-- 정산 설정
CREATE TABLE "store_settlement_config" (
    "id" SERIAL PRIMARY KEY,
    "store_id" INTEGER NOT NULL UNIQUE,
    "settlement_cycle" VARCHAR(20) DEFAULT 'MONTHLY',  -- DAILY|WEEKLY|MONTHLY|MANUAL
    "commission_rate" DECIMAL(5,4) DEFAULT 0.03,       -- 플랫폼 수수료율 (기본 3%)
    "vat_rate" DECIMAL(5,4) DEFAULT 0.10,              -- 부가세율 (법정 10%)
    "enabled_payment_methods" JSONB DEFAULT '["cash","store_card","transfer"]',
    "store_account_id" INTEGER,  -- store_accounts 참조
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW(),
    CONSTRAINT "fk_store_settlement_config_store" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_store_settlement_config_store" ON "store_settlement_config"("store_id");

-- 친환경 뱃지
CREATE TABLE "store_eco_badge" (
    "id" SERIAL PRIMARY KEY,
    "store_id" INTEGER NOT NULL UNIQUE,
    "level" VARCHAR(50) DEFAULT 'GREEN_BEGINNER',  -- GREEN_BEGINNER|ECO_FRIENDLY|ECO_PRO|ECO_MASTER
    "title" VARCHAR(100) DEFAULT '그린 파트너 🌿',
    "carbon_saved_kg" DECIMAL(10,2) DEFAULT 0,
    "orders_count" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW(),
    CONSTRAINT "fk_store_eco_badge_store" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_store_eco_badge_store" ON "store_eco_badge"("store_id");

-- 영업시간 설정
CREATE TABLE "store_operating_hours" (
    "id" SERIAL PRIMARY KEY,
    "store_id" INTEGER NOT NULL UNIQUE,
    "open_time" VARCHAR(10),          -- HH:MM
    "close_time" VARCHAR(10),         -- HH:MM
    "business_hours" JSONB,           -- 요일별 영업시간 상세 JSON
    "timezone" VARCHAR(50) DEFAULT 'Asia/Seoul',
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW(),
    CONSTRAINT "fk_store_operating_hours_store" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_store_operating_hours_store" ON "store_operating_hours"("store_id");

-- ============================================================
-- 2. 기존 stores 테이블에서 데이터 마이그레이션
-- ============================================================

-- store_subscriptions 데이터 이관
INSERT INTO "store_subscriptions" (
    "store_id", "subscription_id", "plan", "billing_cycle", 
    "trial_ends_at", "plan_expires_at", "auto_renew", 
    "payment_method_id", "last_payment_at", "next_payment_at"
)
SELECT 
    "id", "subscription_id", "plan", "billing_cycle",
    "trial_ends_at", "plan_expires_at", "auto_renew",
    "payment_method_id", "last_payment_at", "next_payment_at"
FROM "stores"
WHERE "subscription_id" IS NOT NULL;

-- store_business_info 데이터 이관
INSERT INTO "store_business_info" (
    "store_id", "business_type", "business_number", "business_name",
    "ceo_name", "tax_invoice_email", "mail_order_number",
    "business_address", "customer_service_phone", "customer_service_email",
    "pg_company", "pg_business_number"
)
SELECT 
    "id", "business_type", "business_number", "business_name",
    "ceo_name", "tax_invoice_email", "mail_order_number",
    "business_address", "customer_service_phone", "customer_service_email",
    "pg_company", "pg_business_number"
FROM "stores"
WHERE "business_number" IS NOT NULL 
   OR "business_name" IS NOT NULL
   OR "ceo_name" IS NOT NULL
   OR "tax_invoice_email" IS NOT NULL
   OR "mail_order_number" IS NOT NULL
   OR "business_address" IS NOT NULL
   OR "customer_service_phone" IS NOT NULL
   OR "customer_service_email" IS NOT NULL;

-- store_legal_documents 데이터 이관
INSERT INTO "store_legal_documents" (
    "store_id", "terms_of_service", "privacy_policy", "refund_policy"
)
SELECT "id", "terms_of_service", "privacy_policy", "refund_policy"
FROM "stores"
WHERE "terms_of_service" IS NOT NULL 
   OR "privacy_policy" IS NOT NULL 
   OR "refund_policy" IS NOT NULL;

-- store_settlement_config 데이터 이관
INSERT INTO "store_settlement_config" (
    "store_id", "settlement_cycle", "commission_rate", "vat_rate",
    "enabled_payment_methods"
)
SELECT 
    "id", "settlement_cycle", "commission_rate", "vat_rate",
    "enabled_payment_methods"::jsonb
FROM "stores"
WHERE "settlement_cycle" IS NOT NULL 
   OR "commission_rate" IS NOT NULL 
   OR "vat_rate" IS NOT NULL
   OR "enabled_payment_methods" IS NOT NULL;

-- store_eco_badge 데이터 이관
INSERT INTO "store_eco_badge" (
    "store_id", "level", "title", "carbon_saved_kg", "orders_count"
)
SELECT "id", "eco_badge_level", "eco_badge_title", "eco_carbon_saved_kg", "eco_orders_count"
FROM "stores"
WHERE "eco_badge_level" IS NOT NULL 
   OR "eco_badge_title" IS NOT NULL
   OR "eco_carbon_saved_kg" IS NOT NULL
   OR "eco_orders_count" IS NOT NULL;

-- store_operating_hours 데이터 이관
INSERT INTO "store_operating_hours" (
    "store_id", "open_time", "close_time", "business_hours"
)
SELECT "id", "open_time", "close_time", "business_hours"::jsonb
FROM "stores"
WHERE "open_time" IS NOT NULL 
   OR "close_time" IS NOT NULL 
   OR "business_hours" IS NOT NULL;

-- ============================================================
-- 3. 기존 stores 테이블에서 컬럼 제거 (마이그레이션 검증 후 실행)
-- ============================================================
-- 주의: 아래 컬럼 제거는 데이터 이관 검증 완료 후 별도 단계에서 실행
-- ALTER TABLE "stores" DROP COLUMN IF EXISTS "subscription_id",
--                      DROP COLUMN IF EXISTS "billing_cycle",
--                      DROP COLUMN IF EXISTS "trial_ends_at",
--                      DROP COLUMN IF EXISTS "plan_expires_at",
--                      DROP COLUMN IF EXISTS "auto_renew",
--                      DROP COLUMN IF EXISTS "payment_method_id",
--                      DROP COLUMN IF EXISTS "last_payment_at",
--                      DROP COLUMN IF EXISTS "next_payment_at",
--                      DROP COLUMN IF EXISTS "business_type",
--                      DROP COLUMN IF EXISTS "business_number",
--                      DROP COLUMN IF EXISTS "business_name",
--                      DROP COLUMN IF EXISTS "ceo_name",
--                      DROP COLUMN IF EXISTS "tax_invoice_email",
--                      DROP COLUMN IF EXISTS "mail_order_number",
--                      DROP COLUMN IF EXISTS "business_address",
--                      DROP COLUMN IF EXISTS "customer_service_phone",
--                      DROP COLUMN IF EXISTS "customer_service_email",
--                      DROP COLUMN IF EXISTS "pg_company",
--                      DROP COLUMN IF EXISTS "pg_business_number",
--                      DROP COLUMN IF EXISTS "terms_of_service",
--                      DROP COLUMN IF EXISTS "privacy_policy",
--                      DROP COLUMN IF EXISTS "refund_policy",
--                      DROP COLUMN IF EXISTS "settlement_cycle",
--                      DROP COLUMN IF EXISTS "commission_rate",
--                      DROP COLUMN IF EXISTS "vat_rate",
--                      DROP COLUMN IF EXISTS "enabled_payment_methods",
--                      DROP COLUMN IF EXISTS "eco_badge_level",
--                      DROP COLUMN IF EXISTS "eco_badge_title",
--                      DROP COLUMN IF EXISTS "eco_carbon_saved_kg",
--                      DROP COLUMN IF EXISTS "eco_orders_count",
--                      DROP COLUMN IF EXISTS "open_time",
--                      DROP COLUMN IF EXISTS "close_time",
--                      DROP COLUMN IF EXISTS "business_hours";

-- ============================================================
-- 4. 핵심 stores 모델에 남길 필드만 유지
-- ============================================================
-- id, user_id, name, description, address, phone, theme, 
-- is_active, can_send_sms, created_at, plan, latitude, longitude
-- (구독/사업자/법적/정산/친환경/영업시간 관련 필드 모두 제거)