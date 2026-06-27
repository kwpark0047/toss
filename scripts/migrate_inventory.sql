-- WeMarket 재고 관리 및 알림 센터 DB 마이그레이션
-- Supabase SQL Editor에서 순서대로 실행하세요.
-- 실행 일자: 2026-06-23

-- ============================================================
-- 1. notifications 테이블 (알림 센터)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id           SERIAL PRIMARY KEY,
    store_id     INTEGER NOT NULL,
    type         TEXT NOT NULL,
    title        TEXT NOT NULL,
    message      TEXT NOT NULL,
    data         TEXT,
    is_read      BOOLEAN NOT NULL DEFAULT false,
    priority     TEXT NOT NULL DEFAULT 'normal',
    link         TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_notifications_store
        FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_store_read
    ON notifications(store_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_store_time
    ON notifications(store_id, created_at DESC);

-- ============================================================
-- 2. products 테이블에 재고 컬럼 추가
-- ============================================================
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS stock_quantity      INTEGER,
    ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5;

-- ============================================================
-- 3. stock_history 테이블 (재고 변동 이력)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_history (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER NOT NULL,
    store_id    INTEGER NOT NULL,
    change      INTEGER NOT NULL,
    qty_after   INTEGER NOT NULL,
    reason      TEXT NOT NULL,
    order_id    INTEGER,
    note        TEXT,
    created_by  INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_stock_history_product
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stock_history_product
    ON stock_history(product_id);

CREATE INDEX IF NOT EXISTS idx_stock_history_store_time
    ON stock_history(store_id, created_at DESC);

-- ============================================================
-- 완료 확인
-- ============================================================
SELECT
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'notifications') AS notifications_table,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'stock_quantity') AS stock_quantity_col,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'stock_history') AS stock_history_table;
