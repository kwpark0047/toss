-- Additive only. Apply before releasing this Prisma client. No production activation.
ALTER TABLE public.orders
  ADD COLUMN delivery_road_address varchar(100),
  ADD COLUMN delivery_address_detail varchar(100);
ALTER TABLE public.delivery_dispatches ADD COLUMN provider_changed_at bigint;
