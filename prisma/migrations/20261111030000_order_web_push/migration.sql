CREATE TABLE "public"."order_push_subscriptions" (
  "id" SERIAL PRIMARY KEY,
  "order_id" INTEGER NOT NULL REFERENCES "public"."orders"("id") ON DELETE CASCADE,
  "endpoint_hash" VARCHAR(64) NOT NULL,
  "encrypted_payload" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "sent_at" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_until" TIMESTAMP(3),
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "last_error" VARCHAR(32),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "order_push_subscriptions_order_id_endpoint_hash_key" ON "public"."order_push_subscriptions"("order_id", "endpoint_hash");
CREATE INDEX "order_push_subscriptions_enabled_next_attempt_at_idx" ON "public"."order_push_subscriptions"("enabled", "next_attempt_at");
