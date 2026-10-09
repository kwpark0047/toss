-- Run only in the isolated migration fixture database after applying the actual migration.
BEGIN;
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.refund_operations'::regclass) THEN
    RAISE EXCEPTION 'Financial intents must be server-only with RLS enabled';
  END IF;
END $$;
INSERT INTO public.payments(id) VALUES (1);
INSERT INTO public.refund_operations(id,operation_key,payment_id,store_id,amount,baseline_balance,reason,status)
 VALUES ('00000000-0000-4000-8000-000000000001','first',1,1,100,100,'fixture','unknown');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wemarket_refund_public_test') THEN
    CREATE ROLE wemarket_refund_public_test NOLOGIN;
  END IF;
END $$;
GRANT SELECT ON public.refund_operations TO wemarket_refund_public_test;
SET LOCAL ROLE wemarket_refund_public_test;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.refund_operations) THEN
    RAISE EXCEPTION 'An ordinary public role must not see financial intent rows';
  END IF;
END $$;
RESET ROLE;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.refund_operations(id,operation_key,payment_id,store_id,amount,baseline_balance,reason,status)
      VALUES ('00000000-0000-4000-8000-000000000002','second',1,1,100,100,'fixture','processing');
    RAISE EXCEPTION 'Expected unresolved-payment unique constraint';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.refund_operations(id,operation_key,payment_id,store_id,amount,baseline_balance,reason,status)
      VALUES ('00000000-0000-4000-8000-000000000003','invalid-amount',1,1,101,100,'fixture','confirmed');
    RAISE EXCEPTION 'Expected refund balance check constraint';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.refund_operations(id,operation_key,payment_id,store_id,amount,baseline_balance,reason,status)
      VALUES ('00000000-0000-4000-8000-000000000004','invalid-fk',999,1,100,100,'fixture','confirmed');
    RAISE EXCEPTION 'Expected payment foreign-key constraint';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;
ROLLBACK;
