BEGIN;

CREATE TABLE business_support_messages (
  id uuid PRIMARY KEY,
  store_id integer NOT NULL,
  case_id uuid NOT NULL,
  author_id integer NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  author_role text NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('owner', 'internal')),
  operation_id uuid NOT NULL UNIQUE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (store_id, case_id)
    REFERENCES business_support_cases(store_id, id) ON DELETE NO ACTION
);

CREATE INDEX business_support_message_thread
  ON business_support_messages(store_id, case_id, created_at, id);

ALTER TABLE business_support_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON business_support_messages FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON business_support_messages FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON business_support_messages FROM authenticated;
  END IF;
END $$;

COMMIT;
