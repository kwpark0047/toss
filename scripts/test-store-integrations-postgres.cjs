// Real PostgreSQL regression in an isolated schema, restricted to the local test DB.
const { Client, Pool } = require('pg');
const fs = require('node:fs');
const crypto = require('node:crypto');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const url = new URL(process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/wemarket_test');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/wemarket_test') throw new Error('Only local wemarket_test is allowed.');
const schema = 'integration_test_' + crypto.randomBytes(6).toString('hex');
const connectionString = url.toString();
const client = new Client({ connectionString }), pool = new Pool({ connectionString, max: 3 });
function adapter(pg) { return { $queryRawUnsafe: async (sql, ...values) => (await pg.query(sql, values)).rows, $executeRawUnsafe: async (sql, ...values) => (await pg.query(sql, values)).rowCount }; }
async function main() {
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query('CREATE TABLE stores(id int PRIMARY KEY); CREATE TABLE orders(id int PRIMARY KEY,store_id int,total_amount int,payment_status text,status text,created_at timestamptz DEFAULT NOW()); CREATE TABLE ledger(id serial,store_id int,order_id int,type text,amount int); CREATE TABLE store_customers(id int,store_id int); INSERT INTO stores VALUES(3),(4); INSERT INTO orders(id,store_id,total_amount,payment_status,status) VALUES(30,3,5000,\'paid\',\'completed\'),(40,4,7000,\'paid\',\'completed\'); INSERT INTO ledger(store_id,order_id,type,amount) VALUES(3,30,\'REFUND\',-1000); INSERT INTO store_customers VALUES(1,3);');
    const migration = fs.readFileSync('prisma/migrations/20261007010000_store_data_integrations/migration.sql', 'utf8').replaceAll('"public".', `"${schema}".`);
    await client.query(migration);
    const db = adapter(client);
    db.$transaction = async work => {
      const tx = await pool.connect();
      try { await tx.query('BEGIN'); await tx.query(`SET LOCAL search_path TO "${schema}"`); const result = await work(adapter(tx)); await tx.query('COMMIT'); return result; }
      catch (error) { await tx.query('ROLLBACK'); throw error; }
      finally { tx.release(); }
    };
    const context = { module: { exports: {} }, require: name => name === '../config/prisma' ? {} : name === './integrationContract' ? require('../services/integrationContract') : name === '../utils/errorHandler' ? require('../utils/errorHandler') : require(name) };
    vm.runInNewContext(fs.readFileSync('services/StoreIntegrationService.js', 'utf8'), context);
    const service = new context.module.exports(db);
    const source = await service.createConnection(3, { channel: 'pos', name: 'test-pos', provider: 'fixture', method: 'csv' });
    const event = { event_id: 'e-1', record_id: 'r-1', kind: 'order', version: 1, occurred_at: new Date().toISOString(), amount: 3000, refund_amount: 500, status: 'paid', order_key: 'merchant-order-1' };
    const mirror = { ...event, event_id: 'e-native', record_id: 'r-native', amount: 5000, refund_amount: 0, native_order_id: 30 };
    const input = { events: [event, mirror, { ...event, event_id: 'e-pay', record_id: 'p-1', kind: 'payment', refund_amount: 0 }] };
    assert.equal((await service.preview(3, source.id, input)).count, 3);
    const results = await Promise.all([service.ingest(3, source.id, input, 'csv'), service.ingest(3, source.id, input, 'csv')]);
    assert.equal(results.reduce((sum, result) => sum + result.accepted, 0), 3);
    assert.equal(results.reduce((sum, result) => sum + result.duplicates, 0), 3);
    let summary = await service.overview(3, 30);
    assert.equal(summary.total_revenue, 6500); assert.equal(summary.total_orders, 2); assert.equal(summary.crm_customers, 1);
    await assert.rejects(service.ingest(4, source.id, input), error => error.statusCode === 404);
    await assert.rejects(service.ingest(3, source.id, { events: [{ ...event, event_id: 'cross-store', native_order_id: 40 }] }), error => error.statusCode === 400);
    // The first insert must roll back if a later row conflicts.
    await assert.rejects(service.ingest(3, source.id, { events: [{ ...event, event_id: 'should-rollback', record_id: 'new' }, { ...event, amount: 999 }] }), error => error.statusCode === 409);
    assert.equal(Number((await client.query('SELECT COUNT(*) FROM integration_events')).rows[0].count), 3);
    // Cross-channel canonical references count once.
    const online = await service.createConnection(3, { channel: 'online_order', name: 'test-online', provider: 'fixture', method: 'api' });
    await service.ingest(3, online.id, { events: [{ ...event, event_id: 'online-1', record_id: 'online-record' }] }, 'api');
    assert.equal((await service.overview(3, 30)).total_revenue, 6500);
    // A higher version from the old date cancels the entire canonical order.
    const cancelled = { ...event, event_id: 'e-2', version: 2, status: 'cancelled', occurred_at: new Date(Date.now() - 100 * 86400000).toISOString() };
    await service.ingest(3, source.id, { events: [cancelled] }, 'csv');
    await service.ingest(3, online.id, { events: [{ ...cancelled, event_id: 'online-2', record_id: 'online-record' }] }, 'api');
    summary = await service.overview(3, 30); assert.equal(summary.total_revenue, 4000);
    const card = await service.createConnection(3, { channel: 'card_terminal', name: 'test-card', provider: 'fixture', method: 'api' });
    await assert.rejects(service.ingest(3, card.id, { events: [event] }, 'api'), error => error.statusCode === 400);
    await service.setEnabled(3, source.id, false);
    await assert.rejects(service.ingest(3, source.id, input), error => error.statusCode === 409);
    console.log(JSON.stringify({ passed: true, realPostgres: true, tenantIsolation: true, concurrentIdempotency: true, atomicRollback: true, canonicalDedup: true, nativeRefunds: true, latestVersionBeforeDate: true }));
  } finally { await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await pool.end(); await client.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
