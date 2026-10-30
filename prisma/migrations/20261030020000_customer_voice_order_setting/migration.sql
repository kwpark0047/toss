-- 사업자가 매장별 고객 음성 주문 버튼을 제어할 수 있도록 한다.
-- 기존 매장은 기본 true로 유지해 기존 고객 메뉴 동작을 보존한다.
ALTER TABLE public.store_tinkerbell_settings
  ADD COLUMN IF NOT EXISTS voice_order_enabled boolean NOT NULL DEFAULT true;
