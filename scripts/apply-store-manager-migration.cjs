// Apply only the specifically approved additive migration; never deploy older pending migrations.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { Client } = require('pg');
const env = require('dotenv').parse(fs.readFileSync('.env.production'));
const name = '20261007030000_ai_store_manager';
const sql = fs.readFileSync(`prisma/migrations/${name}/migration.sql`, 'utf8');
const checksum = crypto.createHash('sha256').update(sql).digest('hex');
async function main() {
  const client = new Client({ connectionString: env.DIRECT_URL || env.DATABASE_URL });
  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query('SET LOCAL lock_timeout = \'10s\'');
    await client.query('SET LOCAL statement_timeout = \'60s\'');
    await client.query('SELECT pg_advisory_xact_lock(146468,0)');
    const migrations = await client.query('SELECT checksum,finished_at,rolled_back_at FROM public._prisma_migrations WHERE migration_name=$1', [name]);
    const tables = await client.query('SELECT tablename FROM pg_tables WHERE schemaname=$1 AND tablename=ANY($2::text[])', ['public', ['manager_snapshots', 'manager_actions', 'manager_action_events', 'manager_evaluations', 'manager_ai_requests']]);
    if (migrations.rows.length) {
      if (migrations.rows.length !== 1 || migrations.rows[0].checksum !== checksum || !migrations.rows[0].finished_at || migrations.rows[0].rolled_back_at || tables.rows.length !== 5) throw new Error('Existing migration state does not match; no changes applied.');
      console.log(JSON.stringify({ migration: name, alreadyApplied: true, tables: tables.rows }));
    } else {
      if (tables.rows.length) throw new Error('Untracked integration tables exist; no changes applied.');
      if (!process.argv.includes('--apply-approved')) {
        console.log(JSON.stringify({ migration: name, ready: true, tablesToAdd: ['manager_snapshots', 'manager_actions', 'manager_action_events', 'manager_evaluations', 'manager_ai_requests'], checksum }));
      } else {
        await client.query(sql);
        await client.query('INSERT INTO public._prisma_migrations(id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES($1,$2,NOW(),$3,NOW(),1)', [crypto.randomUUID(), checksum, name]);
        console.log(JSON.stringify({ migration: name, applied: true, tablesAdded: 5 }));
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(JSON.stringify({ code: error.code, message: error.message })); process.exitCode = 1;
  } finally { await client.end(); }
}
main();
