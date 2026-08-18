CREATE TABLE "inventory_reorder_candidates" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "current_quantity" INTEGER NOT NULL,
    "suggested_quantity" INTEGER NOT NULL,
    "average_daily_sales" DOUBLE PRECISION NOT NULL,
    "reorder_point" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_reorder_candidates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_reorder_candidate_status" ON "inventory_reorder_candidates"("store_id", "product_id", "status");
CREATE INDEX "idx_reorder_candidates_store_status" ON "inventory_reorder_candidates"("store_id", "status", "created_at");
CREATE INDEX "idx_reorder_candidates_product_status" ON "inventory_reorder_candidates"("product_id", "status");
