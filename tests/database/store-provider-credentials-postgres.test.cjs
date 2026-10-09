const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const url = process.env.P0_TEST_DATABASE_URL;
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
    !/^\/wemarket_test_[a-z0-9_]+$/.test(new URL(url).pathname))
  throw new Error('Explicit isolated local wemarket_test database required');
process.env.PROVIDER_SECRET_KEY = 'fixture-provider-encryption-key-32-chars';
const { ProviderCredentialService } = require('../../services/ProviderCredentialService');

test('real PostgreSQL enforces named provider scope, encryption and rotation', async () => {
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query('BEGIN');
  try {
    const stores = (await client.query('SELECT id FROM stores ORDER BY id LIMIT 2')).rows;
    assert.equal(stores.length, 2, 'requires two test stores');
    const [a,b] = stores.map(row => row.id);
    const db = {
      $queryRawUnsafe: async (sql,...args) => (await client.query(sql,args)).rows,
      $executeRawUnsafe: async (sql,...args) => (await client.query(sql,args)).rowCount,
    };
    const service = new ProviderCredentialService(db);
    for (const provider of ['tossplace','payhere','okpos','easypos','yogiyo','coupangeats','tosspayments']) {
      const values = provider === 'tosspayments' ? {client_key:'test_ck_fixture123',secret_key:'test_sk_fixture123'} : {api_key:'fixture-vendor-key123'};
      await service.save(provider,a,values,1);
      assert.deepEqual((await service.resolve(provider,a)).values,values);
      assert.equal(await service.resolve(provider,b),null);
      const rows = await service.list(a);
      for (const value of Object.values(values)) assert.ok(!JSON.stringify(rows).includes(value));
      assert.equal((await service.test(provider,a)).status,'adapter_required');
      await service.save(provider,a,{enabled:false},1);
      assert.equal(await service.resolve(provider,a),null);
      await service.save(provider,a,{...values,enabled:true},1);
      assert.deepEqual((await service.resolve(provider,a)).values,values);
      await assert.rejects(service.save(provider,null,values,1));
    }
    await client.query('SAVEPOINT scope_test');
    await assert.rejects(client.query("UPDATE provider_credentials SET scope_key='global',store_id=NULL WHERE provider='tossplace' AND store_id=$1",[a]),error=>error.code==='23514');
    await client.query('ROLLBACK TO SAVEPOINT scope_test');
  } finally {
    await client.query('ROLLBACK');
    await client.end();
    await require('../../config/prisma').disconnectAll();
  }
});
