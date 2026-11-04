-- Migration: store_order_pace
-- Description: 매장 바쁨 모드. 손님 예상 시간에 더할 분과 QR 주문 일시정지 종료 시각을 저장한다.
-- 행이 없는 매장은 애플리케이션 기본값(추가 0분, 일시정지 없음)을 쓴다.
BEGIN;

CREATE TABLE IF NOT EXISTS public.store_order_pace (
  id                  serial PRIMARY KEY,
  store_id            integer NOT NULL,
  extra_wait_minutes  integer NOT NULL DEFAULT 0,
  orders_paused_until timestamp(3),
  updated_at          timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT store_order_pace_extra_wait_check CHECK (extra_wait_minutes BETWEEN 0 AND 60)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_store_order_pace_store ON public.store_order_pace(store_id);

ALTER TABLE public.store_order_pace
  ADD CONSTRAINT store_order_pace_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE ON UPDATE NO ACTION;

-- 다른 매장 설정 테이블과 같이 Supabase anon/authenticated 직접 접근은 막는다(서버 service role 전용).
ALTER TABLE public.store_order_pace ENABLE ROW LEVEL SECURITY;

COMMIT;
