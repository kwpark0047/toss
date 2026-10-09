// Targeted additive migration: do not deploy unrelated pending migrations.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { Client } = require('pg');
const env = require('dotenv').parse(fs.readFileSync('.env.production'));
const name = '20261008020000_canonical_sync';
const sql = fs.readFileSync(`prisma/migrations/${name}/migration.sql`, 'utf8');
const checksum = crypto.createHash('sha256').update(sql).digest('hex');
const tables = ['external_sync_accounts','external_sync_jobs','external_sync_cursors','external_canonical_records','external_sync_errors','external_menu_mappings'];
async function main() {
  const client = new Client({ connectionString: env.DIRECT_URL || env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '60s'");
    await client.query('SELECT pg_advisory_xact_lock(146468,0)');
    const role = (await client.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    if (!role?.rolsuper && !role?.rolbypassrls) throw new Error('SERVICE_ROLE_RLS_PREFLIGHT_REQUIRED');
    const migration = await client.query('SELECT checksum,finished_at,rolled_back_at FROM public._prisma_migrations WHERE migration_name=$1',[name]);
    const existing = await client.query('SELECT tablename FROM pg_tables WHERE schemaname=$1 AND tablename=ANY($2::text[])',['public',tables]);
    if (migration.rows.length) {
      const row=migration.rows[0];
      if(migration.rows.length!==1 || row.checksum!==checksum || !row.finished_at || row.rolled_back_at || existing.rows.length!==tables.length)throw new Error('MIGRATION_STATE_CONFLICT');
      console.log(JSON.stringify({migration:name,alreadyApplied:true,checksum}));
    } else {
      if(existing.rows.length)throw new Error('UNTRACKED_TABLES_REQUIRE_RECONCILIATION');
      if(!process.argv.includes('--apply-approved'))console.log(JSON.stringify({migration:name,ready:true,checksum,tablesToAdd:tables}));
      else {
        await client.query(sql);
        await client.query('INSERT INTO public._prisma_migrations(id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES($1,$2,now(),$3,now(),1)',[crypto.randomUUID(),checksum,name]);
        const protectedTables=await client.query('SELECT count(*)::int AS count FROM pg_class WHERE relnamespace=\'public\'::regnamespace AND relname=ANY($1::text[]) AND relrowsecurity',[tables]);
        if(protectedTables.rows[0].count!==tables.length)throw new Error('RLS_VERIFICATION_FAILED');
        console.log(JSON.stringify({migration:name,applied:true,checksum,tablesAdded:tables.length,rlsVerified:true}));
      }
    }
    await client.query('COMMIT');
  } catch(error) {
    await client.query('ROLLBACK').catch(()=>{});
    console.error(JSON.stringify({migration:name,failed:true,code:error.code || error.message}));
    process.exitCode=1;
  } finally { await client.end(); }
}
main();
