// Dedicated local DB, never reuse the financial fixture or an application database.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { Client } = require('pg');
async function main() {
  const root = path.resolve(__dirname, '..');
  const url = new URL(
    process.env.DISPATCH_TEST_DATABASE_URL ||
      process.env.P0_TEST_DATABASE_URL ||
      'postgresql://postgres@127.0.0.1:55434/postgres'
  );
  if (!['127.0.0.1', 'localhost'].includes(url.hostname))
    throw new Error('Local test PostgreSQL required');
  url.pathname = '/postgres';
  const admin = new Client({ connectionString: url.href });
  await admin.connect();
  try {
    const existing = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname='wemarket_dispatch_test'"
    );
    if (existing.rowCount) await admin.query('DROP DATABASE wemarket_dispatch_test WITH (FORCE)');
    await admin.query('CREATE DATABASE wemarket_dispatch_test');
  } finally {
    await admin.end();
  }
  url.pathname = '/wemarket_dispatch_test';
  fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.tmp/dispatch-schema.prisma'),
    fs
      .readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8')
      .replace('output   = "app/generated/prisma"', 'output   = "dispatch-client"')
  );
  const env = {
    ...process.env,
    DATABASE_URL: url.href,
    DIRECT_URL: url.href,
    DISPATCH_TEST_DATABASE_URL: url.href,
  };
  for (const args of [
    ['node_modules/prisma/build/index.js', 'generate', '--schema', '.tmp/dispatch-schema.prisma'],
    [
      'scripts/run-jest.cjs',
      '--config',
      'jest.config.js',
      'tests/integration/deliveryDispatch.postgres.test.js',
      '--runInBand',
      '--coverage=false',
    ],
  ]) {
    const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
    if (result.status !== 0) {
      process.exitCode = result.status || 1;
      return;
    }
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
