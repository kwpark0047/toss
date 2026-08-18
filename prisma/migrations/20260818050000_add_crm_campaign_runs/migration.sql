CREATE TABLE "crm_campaign_runs" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "segment_name" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL DEFAULT 'MANUAL',
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "target_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" INTEGER,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_campaign_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_crm_campaign_runs_store_status" ON "crm_campaign_runs"("store_id", "status", "created_at");
CREATE INDEX "idx_crm_campaign_runs_segment" ON "crm_campaign_runs"("store_id", "segment_name", "created_at");
