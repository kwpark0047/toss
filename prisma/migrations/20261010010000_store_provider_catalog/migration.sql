-- Extend the existing encrypted credential store; keep global providers restricted.
ALTER TABLE public.provider_credentials DROP CONSTRAINT provider_credentials_provider_check;
ALTER TABLE public.provider_credentials DROP CONSTRAINT provider_credentials_check;
ALTER TABLE public.provider_credentials ADD CONSTRAINT provider_credentials_provider_check
CHECK (provider IN ('pos','table_order','baemin','online_order','naver','seoul','weather','tossplace','payhere','okpos','easypos','yogiyo','coupangeats','tosspayments'));
ALTER TABLE public.provider_credentials ADD CONSTRAINT provider_credentials_check
CHECK ((store_id IS NULL AND scope_key='global' AND provider IN ('naver','seoul','weather'))
OR (store_id IS NOT NULL AND scope_key='store:'||store_id::text AND provider IN ('pos','table_order','baemin','online_order','naver','tossplace','payhere','okpos','easypos','yogiyo','coupangeats','tosspayments')));
