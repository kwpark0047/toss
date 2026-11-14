-- Migration: store_order_channels
-- Description: 매장별 주문 유형 스위치(매장 식사/포장/배달)와 직접 배달 설정, 매장 부가기능(온라인 주문),
-- 배달 주문 정보를 저장한다. 행이 없는 매장은 애플리케이션 기본값(매장 식사·포장 ON, 배달 OFF)을 쓴다.
BEGIN;

CREATE TABLE IF NOT EXISTS public.store_order_channels (
  id                   serial PRIMARY KEY,
  store_id             integer NOT NULL,
  dine_in_enabled      boolean NOT NULL DEFAULT true,
  takeout_enabled      boolean NOT NULL DEFAULT true,
  delivery_enabled     boolean NOT NULL DEFAULT false,
  pickup_guide         varchar(200),
  hide_exact_address   boolean NOT NULL DEFAULT false,
  delivery_fulfillment varchar(16) NOT NULL DEFAULT 'self',
  delivery_area_mode   varchar(16) NOT NULL DEFAULT 'radius',
  delivery_radius_km   double precision NOT NULL DEFAULT 3,
  delivery_areas       jsonb NOT NULL DEFAULT '[]'::jsonb,
  min_order_amount     integer NOT NULL DEFAULT 0,
  delivery_fee         integer NOT NULL DEFAULT 0,
  delivery_est_minutes integer NOT NULL DEFAULT 40,
  updated_at           timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT store_order_channels_fulfillment_check CHECK (delivery_fulfillment IN ('self', 'agency')),
  CONSTRAINT store_order_channels_area_mode_check CHECK (delivery_area_mode IN ('radius', 'areas')),
  CONSTRAINT store_order_channels_one_enabled_check
    CHECK (dine_in_enabled OR takeout_enabled OR delivery_enabled)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_store_order_channels_store ON public.store_order_channels(store_id);

ALTER TABLE public.store_order_channels
  DROP CONSTRAINT IF EXISTS store_order_channels_store_id_fkey,
  ADD CONSTRAINT store_order_channels_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE ON UPDATE NO ACTION;

-- 매장 부가기능. 온라인 주문(online_ordering)은 현재 무료(price 0)라 청구 없이 켜기/끄기만 기록한다.
CREATE TABLE IF NOT EXISTS public.store_addons (
  id            serial PRIMARY KEY,
  store_id      integer NOT NULL,
  addon_key     varchar(40) NOT NULL,
  status        varchar(16) NOT NULL DEFAULT 'active',
  price         integer NOT NULL DEFAULT 0,
  billing_cycle varchar(16),
  started_at    timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  canceled_at   timestamp(3),
  expires_at    timestamp(3),
  updated_at    timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT store_addons_status_check CHECK (status IN ('active', 'trialing', 'canceled', 'expired'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_store_addons_store_key ON public.store_addons(store_id, addon_key);

ALTER TABLE public.store_addons
  DROP CONSTRAINT IF EXISTS store_addons_store_id_fkey,
  ADD CONSTRAINT store_addons_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE ON UPDATE NO ACTION;

-- 배달 주문 정보. 배달 진행은 주문 상태(OrderStatus)와 별도로 delivery_status에 둔다.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_fee        integer,
  ADD COLUMN IF NOT EXISTS delivery_memo       varchar(500),
  ADD COLUMN IF NOT EXISTS delivery_status     varchar(16),
  ADD COLUMN IF NOT EXISTS delivery_started_at timestamp(3),
  ADD COLUMN IF NOT EXISTS delivered_at        timestamp(3);

COMMIT;

-- Store settings are authorized by the Express API; the public Supabase
-- Data API must not bypass that authorization. Prisma uses the DB owner.
ALTER TABLE public.store_order_channels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.store_order_channels FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.store_order_channels_id_seq FROM anon, authenticated;
ALTER TABLE public.store_addons ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.store_addons FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.store_addons_id_seq FROM anon, authenticated;
