BEGIN;
CREATE TABLE business_support_enrollments (
 store_id integer PRIMARY KEY REFERENCES stores(id), owner_id integer NOT NULL REFERENCES users(id),
 enabled boolean NOT NULL DEFAULT false, consent_version text NOT NULL DEFAULT '2026-10-14-v1',
 consented_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE business_support_cases (
 sequence bigserial UNIQUE NOT NULL,
 id uuid PRIMARY KEY, store_id integer NOT NULL REFERENCES stores(id),
 snapshot_id uuid NOT NULL, action_id uuid,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','changes_requested','deferred','rejected','approved','running','stopped','completed')),
 priority integer NOT NULL CHECK(priority BETWEEN 1 AND 3), evidence jsonb NOT NULL,
 note text NOT NULL DEFAULT '', assignee_id integer REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(store_id,id), UNIQUE(store_id,snapshot_id),
 FOREIGN KEY(store_id,snapshot_id) REFERENCES manager_snapshots(store_id,id),
 FOREIGN KEY(store_id,action_id) REFERENCES manager_actions(store_id,id)
);
CREATE INDEX business_support_queue ON business_support_cases(priority,created_at,id);
CREATE INDEX business_support_store ON business_support_cases(store_id,created_at,id);
CREATE TABLE business_support_events (
 id uuid PRIMARY KEY, store_id integer NOT NULL, case_id uuid NOT NULL,
 actor_id integer NOT NULL REFERENCES users(id), operation_id uuid NOT NULL UNIQUE,
 event text NOT NULL, from_status text, to_status text NOT NULL, note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(store_id,case_id) REFERENCES business_support_cases(store_id,id)
);
CREATE INDEX business_support_event_case ON business_support_events(store_id,case_id,created_at);
CREATE TABLE business_support_jobs (
 store_id integer PRIMARY KEY REFERENCES business_support_enrollments(store_id),
 generation integer NOT NULL DEFAULT 1, attempts integer NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','done','dead')),
 available_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz, lease_id uuid,
 last_error text, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX business_support_job_claim ON business_support_jobs(status,available_at);
ALTER TABLE business_support_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_support_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_support_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_support_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON business_support_enrollments,business_support_cases,business_support_events,business_support_jobs FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
 REVOKE ALL ON business_support_enrollments,business_support_cases,business_support_events,business_support_jobs FROM anon;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
 REVOKE ALL ON business_support_enrollments,business_support_cases,business_support_events,business_support_jobs FROM authenticated;
 END IF;
END $$;
COMMIT;
