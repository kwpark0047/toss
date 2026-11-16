-- Additive only: preserve existing rows. Unknown claims must not be resent automatically.
ALTER TABLE public.delivery_dispatches ADD COLUMN request_state varchar(20) NOT NULL DEFAULT 'confirmed';
ALTER TABLE public.delivery_webhook_events
 ADD COLUMN order_id integer,
 ADD COLUMN effect_status varchar(20),
 ADD COLUMN effect_reason varchar(300),
 ADD COLUMN effect_completed_at timestamp(3),
 ADD COLUMN effect_lease_until timestamp(3);
CREATE INDEX idx_delivery_webhook_pending_effects ON public.delivery_webhook_events(order_id) WHERE order_id IS NOT NULL AND effect_completed_at IS NULL;
CREATE TABLE public.delivery_order_effects (
 order_id integer PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
 loyalty_applied_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.delivery_order_effects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.delivery_order_effects FROM anon, authenticated;
