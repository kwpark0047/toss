-- Migration: store_tinkerbell_settings
-- Description: 매장별 AI 팅커벨 도우미 설정을 서버에 저장한다.
-- 행이 없는 매장은 애플리케이션 기본값(도우미 표시 ON, AI 추천 OFF)을 쓴다.
BEGIN;

CREATE TABLE public.store_tinkerbell_settings (
  id                serial PRIMARY KEY,
  store_id          integer NOT NULL,
  enabled           boolean NOT NULL DEFAULT true,
  lang              text NOT NULL DEFAULT 'ko',
  voice_enabled     boolean NOT NULL DEFAULT true,
  large_font        boolean NOT NULL DEFAULT false,
  custom_msg        varchar(80),
  ai_recommendation boolean NOT NULL DEFAULT false,
  updated_at        timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT store_tinkerbell_settings_lang_check CHECK (lang IN ('ko', 'en', 'ja', 'zh'))
);

CREATE UNIQUE INDEX uq_store_tinkerbell_settings_store ON public.store_tinkerbell_settings(store_id);

ALTER TABLE public.store_tinkerbell_settings
  ADD CONSTRAINT store_tinkerbell_settings_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE ON UPDATE NO ACTION;

COMMIT;
