-- Supplier and purchase receipt ledger. This migration is prepared locally only.
CREATE TABLE public.suppliers (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  contact_name VARCHAR(80),
  phone VARCHAR(40),
  email VARCHAR(254),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_suppliers_store_name UNIQUE (store_id, name)
);
CREATE INDEX idx_suppliers_store_active ON public.suppliers(store_id, is_active);

CREATE TABLE public.purchase_orders (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  supplier_id INTEGER REFERENCES public.suppliers(id) ON DELETE SET NULL,
  order_number VARCHAR(40) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  total_amount INTEGER NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  ordered_at TIMESTAMPTZ,
  expected_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  notes TEXT,
  created_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_purchase_orders_store_number UNIQUE (store_id, order_number),
  CONSTRAINT purchase_orders_status_check CHECK (status IN ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'))
);
CREATE INDEX idx_purchase_orders_store_status ON public.purchase_orders(store_id, status, created_at DESC);

CREATE TABLE public.purchase_order_items (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES public.products(id) ON DELETE SET NULL,
  product_name VARCHAR(160) NOT NULL,
  unit VARCHAR(24) NOT NULL DEFAULT '개',
  ordered_quantity INTEGER NOT NULL CHECK (ordered_quantity > 0),
  received_quantity INTEGER NOT NULL DEFAULT 0 CHECK (received_quantity >= 0 AND received_quantity <= ordered_quantity),
  unit_cost INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_purchase_order_items_order ON public.purchase_order_items(purchase_order_id);
CREATE INDEX idx_purchase_order_items_product ON public.purchase_order_items(product_id);

CREATE TABLE public.purchase_receipts (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(200) NOT NULL,
  received_by INTEGER,
  received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  CONSTRAINT uq_purchase_receipts_idempotency UNIQUE (idempotency_key)
);
CREATE INDEX idx_purchase_receipts_order_time ON public.purchase_receipts(purchase_order_id, received_at DESC);

CREATE TABLE public.purchase_receipt_items (
  id SERIAL PRIMARY KEY,
  receipt_id INTEGER NOT NULL REFERENCES public.purchase_receipts(id) ON DELETE CASCADE,
  purchase_order_item_id INTEGER NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE RESTRICT,
  quantity_received INTEGER NOT NULL CHECK (quantity_received > 0),
  unit_cost INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_purchase_receipt_order_item UNIQUE (receipt_id, purchase_order_item_id)
);
CREATE INDEX idx_purchase_receipt_items_order_item ON public.purchase_receipt_items(purchase_order_item_id);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipt_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.suppliers, public.purchase_orders, public.purchase_order_items,
  public.purchase_receipts, public.purchase_receipt_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.suppliers_id_seq, public.purchase_orders_id_seq,
  public.purchase_order_items_id_seq, public.purchase_receipts_id_seq,
  public.purchase_receipt_items_id_seq FROM PUBLIC, anon, authenticated;
