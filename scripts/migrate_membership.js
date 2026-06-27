const db = require('../config/database');

/**
 * [마케팅 강화 Phase 1 - DB 마이그레이션]
 */
function migrate() {
    console.log('[Migration] 등급제 멤버십 마이그레이션 시작...');

    // 1. store_customers 테이블에 tier 컬럼 추가
    try {
        db.exec("ALTER TABLE store_customers ADD COLUMN tier TEXT DEFAULT 'GENERAL'");
        console.log('✅ store_customers: tier 컬럼 추가 완료');
    } catch (e) {
        if (e.message.includes('duplicate column name')) {
            console.log('ℹ️ store_customers: tier 컬럼이 이미 존재합니다.');
        } else {
            console.error('❌ store_customers 컬럼 추가 실패:', e.message);
        }
    }

    // 2. store_tier_settings 테이블 생성
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS store_tier_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                store_id INTEGER NOT NULL,
                tier_name TEXT NOT NULL,
                min_spent INTEGER DEFAULT 0,
                earn_rate REAL DEFAULT 1.0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
                UNIQUE(store_id, tier_name)
            )
        `);
        db.exec("CREATE INDEX IF NOT EXISTS idx_tier_settings_store ON store_tier_settings(store_id)");
        console.log('✅ store_tier_settings 테이블 생성 완료');
    } catch (e) {
        console.error('❌ store_tier_settings 테이블 생성 실패:', e.message);
    }

    console.log('[Migration] 마이그레이션 종료.');
}

migrate();
