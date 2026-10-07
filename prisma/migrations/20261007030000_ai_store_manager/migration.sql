CREATE TABLE "public"."manager_snapshots" (
  id UUID PRIMARY KEY, store_id INTEGER NOT NULL REFERENCES "public"."stores"(id) ON DELETE CASCADE,
  snapshot_key TEXT NOT NULL, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id,snapshot_key), UNIQUE(store_id,id)
);
CREATE TABLE "public"."manager_actions" (
  id UUID PRIMARY KEY, store_id INTEGER NOT NULL REFERENCES "public"."stores"(id) ON DELETE CASCADE,
  snapshot_id UUID NOT NULL, dedupe_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('menu_feature','time_promotion')),
  product_id INTEGER NOT NULL REFERENCES "public"."products"(id) ON DELETE CASCADE,
  payload JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','approved','running','stopped','completed','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), approved_by INTEGER, approved_at TIMESTAMPTZ,
  executed_by INTEGER, started_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, stopped_at TIMESTAMPTZ,
  FOREIGN KEY(store_id,snapshot_id) REFERENCES "public"."manager_snapshots"(store_id,id) ON DELETE CASCADE,
  UNIQUE(store_id,dedupe_key), UNIQUE(store_id,id)
);
CREATE INDEX manager_actions_active ON "public"."manager_actions"(store_id,status,ends_at);
CREATE TABLE "public"."manager_action_events" (
  id UUID PRIMARY KEY, store_id INTEGER NOT NULL, action_id UUID NOT NULL, actor_id INTEGER NOT NULL,
  event TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY(store_id,action_id) REFERENCES "public"."manager_actions"(store_id,id) ON DELETE CASCADE
);
CREATE TABLE "public"."manager_evaluations" (
  id UUID PRIMARY KEY, store_id INTEGER NOT NULL, action_id UUID NOT NULL, payload JSONB NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(store_id,action_id),
  FOREIGN KEY(store_id,action_id) REFERENCES "public"."manager_actions"(store_id,id) ON DELETE CASCADE
);
CREATE TABLE "public"."manager_ai_requests" (
  id UUID PRIMARY KEY, store_id INTEGER NOT NULL REFERENCES "public"."stores"(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','completed','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX manager_ai_requests_quota ON "public"."manager_ai_requests"(store_id,created_at);
