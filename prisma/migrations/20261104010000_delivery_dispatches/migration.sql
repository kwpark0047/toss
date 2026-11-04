-- Migration: delivery_dispatches
-- Description: 배달대행 배차 이력과 대행사 상태 웹훅 중복 방지 기록, 매장 배달대행 설정을 저장한다.
-- 대행사 계약·API 연동 전에도 테이블만 만들어 두며, 기존 직접 배달 동작은 바뀌지 않는다.
BEGIN;

ALTER TABLE public.store_order_channels
  ADD COLUMN IF NOT EXISTS agency_provider      varchar(20),
  ADD COLUMN IF NOT EXISTS agency_auto_dispatch boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.delivery_dispatches (
  id             serial PRIMARY KEY,
  order_id       integer NOT NULL,
  store_id       integer NOT NULL,
  provider       varchar(20) NOT NULL,
  external_id    varchar(100),
  status         varchar(20) NOT NULL DEFAULT 'requested',
  fee            integer,
  rider_name     varchar(50),
  rider_phone    varchar(30),
  tracking_url   varchar(500),
  failure_reason varchar(300),
  requested_at   timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_at    timestamp(3),
  picked_up_at   timestamp(3),
  delivered_at   timestamp(3),
  canceled_at    timestamp(3),
  updated_at     timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT delivery_dispatches_status_check
    CHECK (status IN ('requested', 'assigned', 'picked_up', 'delivered', 'canceled', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_delivery_dispatches_order ON public.delivery_dispatches(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_dispatches_store_status ON public.delivery_dispatches(store_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_dispatches_provider_external
  ON public.delivery_dispatches(provider, external_id);

ALTER TABLE public.delivery_dispatches
  DROP CONSTRAINT IF EXISTS delivery_dispatches_order_id_fkey,
  ADD CONSTRAINT delivery_dispatches_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE public.delivery_dispatches
  DROP CONSTRAINT IF EXISTS delivery_dispatches_store_id_fkey,
  ADD CONSTRAINT delivery_dispatches_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE ON UPDATE NO ACTION;

-- 같은 대행사 이벤트가 다시 와도 한 번만 처리한다.
CREATE TABLE IF NOT EXISTS public.delivery_webhook_events (
  id          serial PRIMARY KEY,
  provider    varchar(20) NOT NULL,
  event_id    varchar(150) NOT NULL,
  store_id    integer,
  received_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_webhook_events ON public.delivery_webhook_events(provider, event_id);

COMMIT;

-- Dispatch data is authorized by the Express API; the public Supabase Data API must not bypass it.
ALTER TABLE public.delivery_dispatches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.delivery_dispatches FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.delivery_dispatches_id_seq FROM anon, authenticated;
ALTER TABLE public.delivery_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.delivery_webhook_events FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.delivery_webhook_events_id_seq FROM anon, authenticated;
