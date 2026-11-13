const MARKER = 'wm-numbered-test-menu-v1';
const CATEGORY = '주문·결제 테스트';
function assertTargets(stores, ids) {
  if (!ids.length || new Set(ids).size !== ids.length ||
      stores.length !== ids.length || new Set(stores.map(s => s.id)).size !== ids.length ||
      stores.some(s => !ids.includes(s.id))) throw Error('TEST_STORE_SNAPSHOT_MISMATCH');
}
function buildMenuPlan(stores) {
  return stores.flatMap(s => Array.from({ length: 10 }, (_, i) => ({
    storeId: s.id, name: `테스트 ${i + 1}`, price: (i + 1) * 1000,
    sortOrder: i + 1, marker: MARKER,
  })));
}
module.exports = { MARKER, CATEGORY, assertTargets, buildMenuPlan };

if (require.main === module) {
  (async () => {
    const fs = require('node:fs');
    const { Client } = require('pg');
    const env = require('dotenv').parse(fs.readFileSync(process.env.SEED_ENV_FILE || '.env'));
    const url = env.DIRECT_URL || env.DATABASE_URL;
    const args = process.argv.slice(2), apply = args.includes('--apply');
    const rawIds = args.find(a => a.startsWith('--store-ids='))?.slice(12);
    const ids = (rawIds || '').split(',').filter(Boolean).map(Number);
    if (!ids.length || ids.some(id => !Number.isSafeInteger(id) || id < 1)) throw Error('EXPLICIT_TEST_STORE_IDS_REQUIRED');
    if (!url) throw Error('DATABASE_URL_REQUIRED');
    const host = new URL(url).hostname;
    if (apply && !args.includes('--test-data-only')) throw Error('TEST_DATA_ONLY_CONFIRMATION_REQUIRED');
    if (apply && !['localhost', '127.0.0.1', '::1'].includes(host) && !args.includes('--allow-remote')) throw Error('REMOTE_APPLY_REQUIRES_ALLOW_REMOTE');
    const db = new Client({ connectionString: url });
    await db.connect();
    try {
      await db.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
      if (apply) await db.query("SELECT pg_advisory_xact_lock(20261113, 130)");
      const stores = (await db.query('SELECT id,name FROM stores WHERE id=ANY($1::int[]) ORDER BY id', [ids])).rows;
      assertTargets(stores, ids);
      const plan = buildMenuPlan(stores);
      const existing = (await db.query('SELECT id,store_id,name,tags FROM products WHERE store_id=ANY($1::int[]) AND name=ANY($2::text[])', [ids, plan.slice(0, 10).map(p => p.name)])).rows;
      for (const p of plan) {
        const matches = existing.filter(e => e.store_id === p.storeId && e.name === p.name);
        if (matches.length > 1 || matches.some(e => e.tags !== MARKER)) throw Error('EXISTING_MENU_COLLISION_' + p.storeId + '_' + p.name);
      }
      let created = 0, updated = 0;
      if (apply) for (const store of stores) {
        let categories = (await db.query('SELECT id FROM categories WHERE store_id=$1 AND name=$2', [store.id, CATEGORY])).rows;
        if (categories.length > 1) throw Error('DUPLICATE_TEST_CATEGORY');
        if (!categories.length) categories = (await db.query('INSERT INTO categories(store_id,name,sort_order) VALUES($1,$2,-100) RETURNING id', [store.id, CATEGORY])).rows;
        for (const p of plan.filter(p => p.storeId === store.id)) {
          const old = existing.find(e => e.store_id === p.storeId && e.name === p.name);
          const values = [categories[0].id, p.price, p.sortOrder, MARKER, '테스트 전용 메뉴 · 실제 고객정보 없이 현금 또는 Toss 테스트 결제로 확인하세요.'];
          if (old) {
            await db.query('UPDATE products SET category_id=$1,price=$2,sort_order=$3,tags=$4,description=$5,is_active=true,is_sold_out=false,stock_quantity=NULL,updated_at=NOW() WHERE id=$6', [...values, old.id]); updated++;
          } else {
            await db.query('INSERT INTO products(category_id,price,sort_order,tags,description,store_id,name,is_active,is_sold_out,stock_quantity) VALUES($1,$2,$3,$4,$5,$6,$7,true,false,NULL)', [...values, store.id, p.name]); created++;
          }
        }
      }
      await db.query('COMMIT');
      console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', host, stores, menuCount: plan.length, prices: plan.slice(0, 10).map(p => p.price), created, updated, existingMenusPreserved: true }));
    } catch (e) { await db.query('ROLLBACK'); throw e; }
    finally { await db.end(); }
  })().catch(e => { console.error(e.message); process.exitCode = 1; });
}
