require('dotenv').config();
const { Client } = require('pg');

const sql = `
-- 1. notifications 테이블
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

CREATE INDEX IF NOT EXISTS idx_notifications_store_read ON notifications(store_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_store_time ON notifications(store_id, created_at DESC);

-- 2. products 테이블에 재고 컬럼 추가
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity      INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5;

-- 3. stock_history 테이블
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

CREATE INDEX IF NOT EXISTS idx_stock_history_product ON stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_store_time ON stock_history(store_id, created_at DESC);
`;

async function run() {
    // DATABASE_URL 우선 사용 (pgbouncer=true 포함된 트랜잭션 풀러)
    const connectionString = process.env.DATABASE_URL;
    console.log('[migrate] 연결 중:', connectionString?.replace(/:.*@/, ':***@'));

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false },
        family: 4,
        connectionTimeoutMillis: 10000
    });

    try {
        await client.connect();
        console.log('[migrate] 연결 성공. SQL 실행 중...');
        await client.query(sql);
        console.log('[migrate] ✅ 마이그레이션 완료!');

        const check = await client.query(`
            SELECT
                (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'notifications')::int AS notifications_table,
                (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'stock_quantity')::int AS stock_quantity_col,
                (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'stock_history')::int AS stock_history_table
        `);
        console.log('[migrate] 확인 결과:', check.rows[0]);
    } catch (err) {
        console.error('[migrate] ❌ 오류:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
