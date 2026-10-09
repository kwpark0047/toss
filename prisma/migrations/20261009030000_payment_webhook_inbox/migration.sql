CREATE TABLE public.payment_webhook_inbox (
 id TEXT PRIMARY KEY,kind TEXT NOT NULL DEFAULT 'webhook',event_type TEXT NOT NULL,payload_hash TEXT NOT NULL,payload_encrypted TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,owner UUID,lease_until TIMESTAMP(3),
 result JSONB,error_code TEXT,next_retry_at TIMESTAMP(3),created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT payment_webhook_kind CHECK(kind IN ('webhook','auto_cancel')),
 CONSTRAINT payment_webhook_status CHECK(status IN ('pending','processing','processed','failed','manual_review')),
 CONSTRAINT payment_webhook_attempts CHECK(attempts>=0)
);
CREATE INDEX payment_webhook_queue_idx ON public.payment_webhook_inbox(status,lease_until);
ALTER TABLE public.payment_webhook_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_webhook_inbox FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON public.payment_webhook_inbox FROM anon; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON public.payment_webhook_inbox FROM authenticated; END IF;
END $$;
