-- 관리자 포인트/쿠폰 지급 기능

-- ── 슈퍼관리자 포인트 지급 이력 ──────────────────────────────
CREATE TABLE IF NOT EXISTS "point_grant_history" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "target_phone" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_before" INTEGER,
    "balance_after" INTEGER,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "point_grant_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_point_grant_history_store" ON "point_grant_history"("store_id");
CREATE INDEX IF NOT EXISTS "idx_point_grant_history_admin" ON "point_grant_history"("admin_id");
CREATE INDEX IF NOT EXISTS "idx_point_grant_history_time" ON "point_grant_history"("created_at" DESC);

ALTER TABLE "point_grant_history" ADD CONSTRAINT "point_grant_history_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "point_grant_history" ADD CONSTRAINT "point_grant_history_admin_id_fkey"
    FOREIGN KEY ("admin_id") REFERENCES "users"("id");

-- ── 슈퍼관리자 쿠폰 발급 이력 ──────────────────────────────
CREATE TABLE IF NOT EXISTS "coupon_issue_history" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "coupon_id" INTEGER NOT NULL,
    "target_phone" TEXT NOT NULL,
    "user_coupon_id" INTEGER,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coupon_issue_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_coupon_issue_history_store" ON "coupon_issue_history"("store_id");
CREATE INDEX IF NOT EXISTS "idx_coupon_issue_history_admin" ON "coupon_issue_history"("admin_id");
CREATE INDEX IF NOT EXISTS "idx_coupon_issue_history_time" ON "coupon_issue_history"("created_at" DESC);

ALTER TABLE "coupon_issue_history" ADD CONSTRAINT "coupon_issue_history_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "coupon_issue_history" ADD CONSTRAINT "coupon_issue_history_admin_id_fkey"
    FOREIGN KEY ("admin_id") REFERENCES "users"("id");
ALTER TABLE "coupon_issue_history" ADD CONSTRAINT "coupon_issue_history_coupon_id_fkey"
    FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id");
