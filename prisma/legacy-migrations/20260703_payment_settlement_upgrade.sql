-- ============================================================
-- WeMarket 결제·정산 고도화 마이그레이션
-- 생성일: 2026-07-03
-- 적용: Supabase 대시보드 → SQL Editor에서 실행
-- ============================================================

-- ── stores 테이블: 사업자 정보 + 정산 설정 컬럼 추가 ──────────────────
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS business_number         TEXT,
  ADD COLUMN IF NOT EXISTS business_name           TEXT,
  ADD COLUMN IF NOT EXISTS ceo_name                TEXT,
  ADD COLUMN IF NOT EXISTS tax_invoice_email       TEXT,
  ADD COLUMN IF NOT EXISTS settlement_cycle        TEXT    DEFAULT 'MONTHLY',
  ADD COLUMN IF NOT EXISTS commission_rate         FLOAT   DEFAULT 0.03,
  ADD COLUMN IF NOT EXISTS vat_rate                FLOAT   DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS enabled_payment_methods TEXT    DEFAULT '["cash","store_card","transfer"]';

-- ── settlements 테이블: 법적 VAT 분리 + 세금계산서 컬럼 추가 ──────────
ALTER TABLE settlements
  ADD COLUMN IF NOT EXISTS commission_ex_vat        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_vat           INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_amount        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_rate_snapshot FLOAT,
  ADD COLUMN IF NOT EXISTS vat_rate_snapshot        FLOAT   DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS tax_invoice_number       TEXT,
  ADD COLUMN IF NOT EXISTS tax_invoice_issued_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_method_breakdown TEXT,
  ADD COLUMN IF NOT EXISTS paid_at                  TIMESTAMPTZ;

-- 기존 settlements의 vat_amount 컬럼이 없는 경우 추가
ALTER TABLE settlements
  ADD COLUMN IF NOT EXISTS vat_amount INTEGER DEFAULT 0;

-- ── 완료 확인 ────────────────────────────────────────────────────────────
SELECT
  'stores 신규 컬럼' AS 구분,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'stores'
  AND column_name IN (
    'business_number','business_name','ceo_name',
    'tax_invoice_email','settlement_cycle',
    'commission_rate','vat_rate','enabled_payment_methods'
  )
UNION ALL
SELECT
  'settlements 신규 컬럼',
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'settlements'
  AND column_name IN (
    'commission_ex_vat','commission_vat','commission_amount',
    'commission_rate_snapshot','vat_rate_snapshot',
    'tax_invoice_number','tax_invoice_issued_at',
    'payment_method_breakdown','paid_at'
  )
ORDER BY 구분, column_name;
