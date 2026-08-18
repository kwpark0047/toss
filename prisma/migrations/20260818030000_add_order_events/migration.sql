CREATE TABLE "order_events" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "store_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "actor_user_id" INTEGER,
    "actor_role" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_order_events_order_time" ON "order_events"("order_id", "created_at");
CREATE INDEX "idx_order_events_store_time" ON "order_events"("store_id", "created_at");
CREATE INDEX "idx_order_events_type_time" ON "order_events"("event_type", "created_at");
