-- Staging preparation only. Nullable snapshot; existing immediate orders remain NULL.
-- Apply only with separate production authorization before a future release.
ALTER TABLE public.orders ADD COLUMN delivery_reservation jsonb;
