-- Migration: fix_schema_drift
-- Description: 누락된 컬럼 추가 (스키마 드리프트 복구)

-- 1. store_link_requests.admin_note (관리자 거부 사유)
ALTER TABLE "store_link_requests"
  ADD COLUMN IF NOT EXISTS "admin_note" TEXT;

-- 2. store_customers.fcm_token (Firebase Cloud Messaging 토큰)
ALTER TABLE "store_customers"
  ADD COLUMN IF NOT EXISTS "fcm_token" TEXT;
