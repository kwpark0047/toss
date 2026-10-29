ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS customer_entry_mode VARCHAR(16) NOT NULL DEFAULT 'menu';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stores_customer_entry_mode_check'
      AND conrelid = 'public.stores'::regclass
  ) THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_customer_entry_mode_check
      CHECK (customer_entry_mode IN ('menu', 'intro'));
  END IF;
END $$;
