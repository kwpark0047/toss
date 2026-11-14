BEGIN;

-- Cash and bank transfer are the currently supported customer checkout methods.
ALTER TABLE public.store_settlement_config
  ALTER COLUMN enabled_payment_methods SET DEFAULT '["cash","transfer"]'::jsonb;

-- Normalize existing per-store settings and fill the child settings table for
-- stores whose legacy settings were never migrated into store_settlement_config.
INSERT INTO public.store_settlement_config (store_id, enabled_payment_methods)
SELECT s.id, '["cash","transfer"]'::jsonb
FROM public.stores AS s
ON CONFLICT (store_id) DO UPDATE
SET enabled_payment_methods = EXCLUDED.enabled_payment_methods,
    updated_at = now();

-- Keep the legacy column in sync for older deployed readers that may still use it.
UPDATE public.stores
SET enabled_payment_methods = '["cash","transfer"]'
WHERE enabled_payment_methods IS DISTINCT FROM '["cash","transfer"]';

COMMIT;
