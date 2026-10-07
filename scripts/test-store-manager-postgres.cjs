// Independent CI database only. Never accepts an operating DB URL.
const { Client, Pool } = require('pg');
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const url = new URL(process.env.DATABASE_URL || 'postgresql://localhost:5432/wemarket_test');
if (!['localhost','127.0.0.1'].includes(url.hostname) || url.pathname !== '/wemarket_test') throw new Error('Only local wemarket_test is allowed.');
const schema = 'manager_test_' + crypto.randomBytes(6).toString('hex');
const client = new Client({ connectionString: url.toString() }), pool = new Pool({ connectionString: url.toString(), max: 4 });
const adapter = pg => ({ $queryRawUnsafe: async (sql, ...values) => (await pg.query(sql, values)).rows, $executeRawUnsafe: async (sql, ...values) => (await pg.query(sql, values)).rowCount });
async function main() {
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`); await client.query(`SET search_path TO "${schema}"`);
    await client.query(`CREATE TABLE stores(id int PRIMARY KEY,name text,is_active boolean); CREATE TABLE products(id int PRIMARY KEY,store_id int,name text,price int,is_active boolean,is_sold_out boolean,stock_quantity int);
      CREATE TABLE orders(id serial PRIMARY KEY,store_id int,total_amount int,payment_status text,status text,created_at timestamp);
      CREATE TABLE order_items(id serial,order_id int,product_id int,quantity int); CREATE TABLE ledger(id serial,store_id int,order_id int,type text,amount int);
      CREATE TABLE reviews(id serial,store_id int,rating int,created_at timestamp); CREATE TABLE store_customers(id int,store_id int);
      INSERT INTO stores VALUES(3,'검증 매장',true),(4,'다른 매장',true); INSERT INTO products VALUES(1,3,'추천 메뉴',10000,true,false,NULL),(2,4,'다른 매장 메뉴',20000,true,false,NULL);`);
    for (const name of ['20261007010000_store_data_integrations','20261007030000_ai_store_manager']) await client.query(fs.readFileSync(`prisma/migrations/${name}/migration.sql`, 'utf8').replaceAll('"public".', `"${schema}".`));
    const now = new Date('2026-10-07T07:30:00Z');
    for (let day = 1; day <= 28; day++) {
      const at = new Date(now.getTime() - day * 86400000); at.setUTCHours(1,0,0,0);
      const row = (await client.query("INSERT INTO orders(store_id,total_amount,payment_status,status,created_at) VALUES(3,10000,'paid','completed',$1) RETURNING id", [at])).rows[0];
      await client.query('INSERT INTO order_items(order_id,product_id,quantity) VALUES($1,1,2)', [row.id]);
      const second = new Date(at); second.setUTCHours(3); const r = (await client.query("INSERT INTO orders(store_id,total_amount,payment_status,status,created_at) VALUES(3,10000,'paid','completed',$1) RETURNING id", [second])).rows[0];
      await client.query('INSERT INTO order_items(order_id,product_id,quantity) VALUES($1,1,1)', [r.id]);
    }
    const db = adapter(client);
    db.$transaction = async work => { const tx = await pool.connect(); try { await tx.query('BEGIN'); await tx.query(`SET LOCAL search_path TO "${schema}"`); const result = await work(adapter(tx)); await tx.query('COMMIT'); return result; } catch (error) { await tx.query('ROLLBACK'); throw error; } finally { tx.release(); } };
    let aiCalls = 0;
    const context = { process: { env: {} }, setTimeout, clearTimeout, module: { exports: {} }, require: name => {
      if (name === '../config/prisma') return db;
      if (name === '../utils/errorHandler') return require('../utils/errorHandler');
      if (name === '../utils/storeManagerAnalysis') return require('../utils/storeManagerAnalysis');
      if (name === './StoreIntegrationService') return require('../services/StoreIntegrationService');
      if (name === './aiService') return { generateWithFallback: async prompt => { aiCalls++; assert.ok(!prompt.includes('PRIVATE_PROMPT_SECRET')); return '{"opening_index":0}'; } };
      return require(name);
    } };
    vm.runInNewContext(fs.readFileSync('services/StoreManagerService.js', 'utf8'), context);
    const service = new context.module.exports(db);
    const briefing = await service.briefing(3, now); assert.equal(briefing.store.id, 3); assert.ok(briefing.actions.length >= 1);
    const action = briefing.actions.find(a => a.kind === 'menu_feature'); assert.ok(action);
    assert.equal((await service.briefing(3, now)).snapshot_id, briefing.snapshot_id);
    await assert.rejects(service.transition(4, action.id, 'approve', 7, now), error => error.statusCode === 404);
    await assert.rejects(service.transition(3, action.id, 'execute', 7, now), error => error.statusCode === 409);
    await service.transition(3, action.id, 'approve', 7, now);
    const execution = await Promise.all([service.transition(3, action.id, 'execute', 7, now), service.transition(3, action.id, 'execute', 7, now)]);
    assert.equal(execution.filter(r => r.already_applied).length, 1);
    assert.equal((await service.featured(3, now)).length, 1); assert.equal((await service.featured(4, now)).length, 0);
    assert.equal((await service.evaluate(3, action.id, now)).verdict, 'pending');
    const finished = new Date(now.getTime() + 8 * 86400000);
    assert.equal((await service.featured(3, finished)).length, 0);
    const evaluation = await service.evaluate(3, action.id, finished); assert.equal(evaluation.verdict, 'insufficient'); assert.equal(evaluation.causal, false);
    assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM manager_action_events WHERE action_id=$1 AND event='execute'", [action.id])).rows[0].count, 1);
    const other = briefing.actions.find(a => a.kind === 'time_promotion');
    if (other) { await service.transition(3, other.id, 'approve', 7, now); await service.transition(3, other.id, 'execute', 7, now); await service.transition(3, other.id, 'stop', 7, now); assert.equal((await service.featured(3, now)).length, 0); assert.equal((await service.evaluate(3, other.id, finished)).verdict, 'stopped'); }
    const chat = await service.chat(3, '메뉴 추천', now); assert.equal(chat.engine, 'verified_rules'); assert.ok(chat.reply.includes('추천 메뉴'));
    context.process.env.GEMINI_API_KEY = 'fixture-no-network';
    for (let i = 0; i < 7; i++) await service.chat(3, '오늘 문제 PRIVATE_PROMPT_SECRET', now);
    assert.equal(aiCalls, 5);
    assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM manager_ai_requests WHERE store_id=3')).rows[0].count, 5);
    console.log(JSON.stringify({ passed: true, realPostgres: true, snapshots: true, tenantIsolation: true, approvedExecution: true, concurrentIdempotency: true, qrFeatured: true, expiry: true, observedEvaluation: true }));
  } finally { await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await pool.end(); await client.end(); }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
