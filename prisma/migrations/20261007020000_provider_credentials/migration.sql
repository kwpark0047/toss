CREATE TABLE "public"."provider_credentials" (
  "id" UUID PRIMARY KEY,
  "scope_key" TEXT NOT NULL,
  "store_id" INTEGER REFERENCES "public"."stores"("id") ON DELETE CASCADE,
  "provider" TEXT NOT NULL CHECK ("provider" IN ('pos','table_order','baemin','online_order','naver','seoul','weather')),
  "secret_ciphertext" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "updated_by" INTEGER NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "last_test_status" TEXT NOT NULL DEFAULT 'untested',
  "last_test_at" TIMESTAMPTZ,
  UNIQUE("scope_key","provider"),
  CHECK (("store_id" IS NULL AND "scope_key"='global' AND "provider" IN ('naver','seoul','weather')) OR ("store_id" IS NOT NULL AND "scope_key"='store:'||"store_id"::text AND "provider" IN ('pos','table_order','baemin','online_order','naver')))
);
