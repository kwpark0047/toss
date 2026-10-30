-- Fix the mutable search_path warning without changing the trigger's behavior.
-- The function already schema-qualifies public.products, so an empty search_path
-- prevents callers from shadowing objects while preserving its tenant check.
ALTER FUNCTION public.external_mapping_tenant_guard() SET search_path = '';
