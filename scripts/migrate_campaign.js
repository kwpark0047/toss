const db = require('../config/database');

/**
 * [마케팅 강화 Phase 2 - 쿠폰 & 캠페인 마이그레이션]
 */
function migrate() {
    console.log('[Migration] 쿠폰 및 캠페인 시스템 마이그레이션 시작...');

    // 1. coupons 테이블 생성
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS coupons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                store_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                amount INTEGER NOT NULL,
                min_order_amount INTEGER DEFAULT 0,
                valid_days INTEGER DEFAULT 30,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
            )
        `);
        db.exec("CREATE INDEX IF NOT EXISTS idx_coupons_store ON coupons(store_id)");
        console.log('✅ coupons 테이블 생성 완료');
    } catch (e) {
        console.error('❌ coupons 테이블 생성 실패:', e.message);
    }

    // 2. user_coupons 테이블 생성
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS user_coupons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_phone TEXT NOT NULL,
                coupon_id INTEGER NOT NULL,
                status TEXT DEFAULT 'UNUSED',
                used_at DATETIME,
                expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE
            )
        `);
        db.exec("CREATE INDEX IF NOT EXISTS idx_user_coupons_phone ON user_coupons(customer_phone)");
        console.log('✅ user_coupons 테이블 생성 완료');
    } catch (e) {
        console.error('❌ user_coupons 테이블 생성 실패:', e.message);
    }

    // 3. campaign_settings 테이블 생성
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS campaign_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                store_id INTEGER NOT NULL,
                trigger_type TEXT NOT NULL,
                target_tier TEXT,
                coupon_id INTEGER NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
                FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE
            )
        `);
        db.exec("CREATE INDEX IF NOT EXISTS idx_campaigns_store ON campaign_settings(store_id)");
        console.log('✅ campaign_settings 테이블 생성 완료');
    } catch (e) {
        console.error('❌ campaign_settings 테이블 생성 실패:', e.message);
    }

    console.log('[Migration] Phase 2 마이그레이션 종료.');
}

migrate();
