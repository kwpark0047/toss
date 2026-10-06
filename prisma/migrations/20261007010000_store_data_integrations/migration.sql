-- Additive integration ingestion; no changes to operational orders/payments/customers.
CREATE TABLE "public"."integration_connections" (
  "id" UUID PRIMARY KEY,
  "store_id" INTEGER NOT NULL REFERENCES "public"."stores"("id") ON DELETE CASCADE,
  "channel" TEXT NOT NULL CHECK ("channel" IN ('pos','table_order','point_device','card_terminal','baemin','online_order')),
  "provider" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "method" TEXT NOT NULL CHECK ("method" IN ('csv','api')),
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "last_ingested_at" TIMESTAMPTZ,
  CONSTRAINT "integration_connections_id_store_key" UNIQUE ("id","store_id")
);
CREATE INDEX "integration_connections_store_idx" ON "public"."integration_connections"("store_id");
CREATE TABLE "public"."integration_events" (
  "id" UUID PRIMARY KEY,
  "store_id" INTEGER NOT NULL REFERENCES "public"."stores"("id") ON DELETE CASCADE,
  "connection_id" UUID NOT NULL,
  "event_id" TEXT NOT NULL,
  "record_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('order','payment','refund','loyalty')),
  "version" INTEGER NOT NULL CHECK ("version">0),
  "occurred_at" TIMESTAMPTZ NOT NULL,
  "amount" BIGINT NOT NULL,
  "refund_amount" BIGINT NOT NULL DEFAULT 0 CHECK ("refund_amount">=0),
  "status" TEXT NOT NULL CHECK ("status" IN ('pending','paid','cancelled','completed')),
  "currency" TEXT NOT NULL CHECK ("currency" IN ('KRW','POINT')),
  "order_key" TEXT NOT NULL,
  "native_order_id" INTEGER REFERENCES "public"."orders"("id") ON DELETE SET NULL,
  "customer_key" TEXT,
  "marketing_consent" TEXT NOT NULL DEFAULT 'unknown' CHECK ("marketing_consent" IN ('unknown','granted','withdrawn')),
  "consent_at" TIMESTAMPTZ,
  "consent_source" TEXT,
  "payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "integration_events_connection_store_fkey" FOREIGN KEY ("connection_id","store_id") REFERENCES "public"."integration_connections"("id","store_id") ON DELETE CASCADE,
  CONSTRAINT "integration_events_connection_event_key" UNIQUE ("connection_id","event_id"),
  CONSTRAINT "integration_events_snapshot_key" UNIQUE ("connection_id","kind","record_id","version"),
  CONSTRAINT "integration_events_amount_check" CHECK (("kind"='loyalty' AND "currency"='POINT' AND "refund_amount"=0) OR ("kind"!='loyalty' AND "currency"='KRW' AND "amount">=0 AND "refund_amount"<="amount"))
);
CREATE INDEX "integration_events_store_date_idx" ON "public"."integration_events"("store_id","occurred_at");
CREATE INDEX "integration_events_store_order_idx" ON "public"."integration_events"("store_id","order_key");
