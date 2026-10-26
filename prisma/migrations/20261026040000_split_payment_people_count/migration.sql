ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS split_people_count INTEGER;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS split_participant_key TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_split_people_count_range'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_split_people_count_range
      CHECK (split_people_count IS NULL OR split_people_count BETWEEN 2 AND 10);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS payments_order_split_participant_key_key
  ON public.payments (order_id, split_participant_key);

