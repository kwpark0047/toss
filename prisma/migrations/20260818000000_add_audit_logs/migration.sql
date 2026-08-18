CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "actor_user_id" INTEGER,
    "actor_role" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" INTEGER,
    "store_id" INTEGER,
    "before_data" JSONB,
    "after_data" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_audit_logs_store_time" ON "audit_logs"("store_id", "created_at");
CREATE INDEX "idx_audit_logs_actor_time" ON "audit_logs"("actor_user_id", "created_at");
CREATE INDEX "idx_audit_logs_resource" ON "audit_logs"("resource_type", "resource_id");
