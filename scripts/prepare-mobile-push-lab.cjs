// Seed an already provisioned, empty, loopback-only QA database. No dotenv files.
const { DATABASE_URL, assertLabLaunch } = require('./mobile-push-lab-guard.cjs');
assertLabLaunch(process.argv.slice(2), process.env);
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('pg');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, '.tmp/order-completion-sandbox');
(async () => {
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(path.join(dir, 'fixture.json'))) throw Error('PRIVATE_FIXTURE_ALREADY_EXISTS');
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    await db.query('BEGIN');
    const count = (
      await db.query(
        'SELECT (SELECT count(*)::int FROM users) AS users, (SELECT count(*)::int FROM stores) AS stores, (SELECT count(*)::int FROM orders) AS orders'
      )
    ).rows[0];
    if (count.users || count.stores || count.orders)
      throw Error('EMPTY_DISPOSABLE_DATABASE_REQUIRED');
    const email = 'mobile-push-lab@example.invalid';
    const password = crypto.randomBytes(24).toString('base64url');
    const user = (
      await db.query(
        "INSERT INTO users(name,email,password,role,profile_step,password_login_enabled,auth_status) VALUES($1,$2,$3,'owner',3,true,'active') RETURNING id",
        ['푸시 QA 전용', email, await require('bcryptjs').hash(password, 10)]
      )
    ).rows[0];
    const store = (
      await db.query('INSERT INTO stores(user_id,name,is_active) VALUES($1,$2,true) RETURNING id', [
        user.id,
        '푸시 테스트 전용 매장',
      ])
    ).rows[0];
    const product = (
      await db.query(
        'INSERT INTO products(store_id,name,price,stock_quantity,is_active,is_sold_out) VALUES($1,$2,10000,100,true,false) RETURNING id',
        [store.id, 'QA 테스트 메뉴']
      )
    ).rows[0];
    // The bundled browser verifier deliberately targets the sole fresh store.
    if (store.id !== 1 || product.id !== 1) throw Error('FRESH_TEST_SEQUENCES_REQUIRED');
    await db.query(
      'INSERT INTO store_order_channels(store_id,dine_in_enabled,takeout_enabled) VALUES($1,true,true)',
      [store.id]
    );
    const fixture = {
      dbUrl: DATABASE_URL,
      email,
      password,
      userId: user.id,
      storeId: store.id,
      productId: product.id,
    };
    await db.query('COMMIT');
    fs.writeFileSync(path.join(dir, 'fixture.json'), JSON.stringify(fixture), {
      flag: 'wx',
      mode: 0o600,
    });
    const keys = path.join(dir, 'web-push-qa.json');
    if (!fs.existsSync(keys))
      fs.writeFileSync(keys, JSON.stringify(require('web-push').generateVAPIDKeys()), {
        flag: 'wx',
        mode: 0o600,
      });
    console.log(
      JSON.stringify({
        synthetic: true,
        storeId: store.id,
        amount: 10000,
        privateFixtureWritten: true,
      })
    );
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
})().catch((error) => {
  console.error(error.code || error.message);
  process.exitCode = 1;
});
