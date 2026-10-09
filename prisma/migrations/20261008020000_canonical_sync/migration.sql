-- Additive analytics domain; never changes native orders/payments or issues PG requests.
CREATE TABLE public.external_sync_accounts (
 id uuid PRIMARY KEY, store_id integer NOT NULL REFERENCES public.stores(id),
 connection_id uuid NOT NULL, provider text NOT NULL,
 credential_revision integer NOT NULL DEFAULT 0, credential_ciphertext text,
 state text NOT NULL DEFAULT 'unconfigured' CHECK(state IN ('unconfigured','configured','reauth_required','disabled')),
 verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,store_id), UNIQUE(connection_id),
 FOREIGN KEY(connection_id,store_id) REFERENCES public.integration_connections(id,store_id)
);
CREATE TABLE public.external_sync_jobs (
 id uuid PRIMARY KEY, account_id uuid NOT NULL, store_id integer NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','retry','completed','failed')),
 owner uuid, lease_until timestamptz, attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 window_start timestamptz NOT NULL, window_end timestamptz NOT NULL,
 cursor text, pages integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 CHECK(window_start<window_end),
 FOREIGN KEY(account_id,store_id) REFERENCES public.external_sync_accounts(id,store_id),
 UNIQUE(id,store_id)
);
CREATE UNIQUE INDEX external_sync_one_active ON public.external_sync_jobs(account_id)
 WHERE status IN ('queued','running','retry');
CREATE TABLE public.external_sync_cursors (
 account_id uuid PRIMARY KEY, store_id integer NOT NULL, cursor text,
 synced_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(account_id,store_id) REFERENCES public.external_sync_accounts(id,store_id)
);
CREATE TABLE public.external_canonical_records (
 account_id uuid NOT NULL, store_id integer NOT NULL, entity text NOT NULL,
 external_id text NOT NULL, version bigint NOT NULL CHECK(version>0),
 occurred_at timestamptz NOT NULL, data jsonb NOT NULL, payload_hash text NOT NULL,
 job_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(account_id,entity,external_id,version),
 FOREIGN KEY(account_id,store_id) REFERENCES public.external_sync_accounts(id,store_id),
 FOREIGN KEY(job_id,store_id) REFERENCES public.external_sync_jobs(id,store_id)
);
CREATE INDEX external_canonical_period ON public.external_canonical_records(store_id,occurred_at);
CREATE TABLE public.external_sync_errors (
 id uuid PRIMARY KEY, job_id uuid NOT NULL, store_id integer NOT NULL,
 code text NOT NULL, retryable boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(job_id,store_id) REFERENCES public.external_sync_jobs(id,store_id)
);
CREATE TABLE public.external_menu_mappings (
 account_id uuid NOT NULL, store_id integer NOT NULL, external_id text NOT NULL,
 product_id integer NOT NULL REFERENCES public.products(id), approved_by integer NOT NULL REFERENCES public.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(account_id,external_id),
 FOREIGN KEY(account_id,store_id) REFERENCES public.external_sync_accounts(id,store_id)
);
CREATE FUNCTION public.external_mapping_tenant_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=NEW.product_id AND store_id=NEW.store_id) THEN
  RAISE EXCEPTION 'mapping product must belong to account store' USING ERRCODE='23503';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER external_mapping_tenant_guard BEFORE INSERT OR UPDATE ON public.external_menu_mappings
 FOR EACH ROW EXECUTE FUNCTION public.external_mapping_tenant_guard();
-- SQL/API server must use its owner/service role; browser roles get no direct access.
DO $$ DECLARE t text; r text; BEGIN
 FOREACH t IN ARRAY ARRAY['external_sync_accounts','external_sync_jobs','external_sync_cursors','external_canonical_records','external_sync_errors','external_menu_mappings'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',t);
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON public.%I FROM %I',t,r); END IF;
  END LOOP;
 END LOOP;
END $$;
