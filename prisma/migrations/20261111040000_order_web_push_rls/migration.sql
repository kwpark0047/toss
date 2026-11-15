-- Subscription endpoints and encryption keys are backend-only data.
ALTER TABLE "public"."order_push_subscriptions" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "public"."order_push_subscriptions" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "public"."order_push_subscriptions" FROM authenticated;
  END IF;
END $$;
