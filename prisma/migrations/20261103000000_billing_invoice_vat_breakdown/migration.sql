-- 구독 청구서에 공급가·부가세·면세 금액을 구분해 저장한다.
-- 구독 요금은 VAT 포함 가격으로 청구하고(토스 taxFreeAmount 0) 결제 확정 시 값을 기록한다.
ALTER TABLE "public"."BillingInvoice"
  ADD COLUMN IF NOT EXISTS "supply_amount" INTEGER,
  ADD COLUMN IF NOT EXISTS "vat_amount" INTEGER,
  ADD COLUMN IF NOT EXISTS "tax_free_amount" INTEGER;

-- 이미 결제된 청구서는 같은 기준(부가세 = 금액 / 11, 반올림)으로 채운다.
UPDATE "public"."BillingInvoice"
SET "vat_amount" = ROUND("amount" / 11.0)::integer,
    "supply_amount" = "amount" - ROUND("amount" / 11.0)::integer,
    "tax_free_amount" = 0
WHERE "status" = 'paid' AND "vat_amount" IS NULL;
