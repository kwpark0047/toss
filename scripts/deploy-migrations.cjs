// Preserve migration identities. Corrections to two historically broken SQL
// files require a separate approved checksum/history review for existing DBs.
// The legacy 008/009 migrations
// sort before the baseline: a genuinely empty DB must execute baseline first.
const {Client} = require('pg');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const baseline = '20260101000000_baseline';
function planBootstrap(tableCount, appliedNames) {
  return tableCount === 0 && appliedNames.length === 0;
}
// Migration directories that the database journal has not recorded yet.
function pendingMigrations(localNames, appliedNames) {
  const applied=new Set(appliedNames);
  return localNames.filter(name=>!applied.has(name)).sort();
}
function localMigrationNames(dir=path.resolve('prisma/migrations')) {
  return fs.readdirSync(dir,{withFileTypes:true})
    .filter(entry=>entry.isDirectory() && fs.existsSync(path.join(dir,entry.name,'migration.sql')))
    .map(entry=>entry.name);
}
async function main() {
  const url=process.env.MIGRATION_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
  if(!url || !['postgres:','postgresql:'].includes(new URL(url).protocol)) throw new Error('EXPLICIT_MIGRATION_DATABASE_REQUIRED');
  const client=new Client({connectionString:url}); await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock(742190621)');
    const tables=await client.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name <> '_prisma_migrations' AND table_type='BASE TABLE'");
    const journal=await client.query("SELECT to_regclass('public._prisma_migrations') AS journal");
    const applied=journal.rows[0].journal ? (await client.query('SELECT migration_name FROM public._prisma_migrations')).rows.map(r=>r.migration_name) : [];
    const bootstrap=planBootstrap(tables.rows[0].n,applied);
    const pending=pendingMigrations(localMigrationNames(),applied);
    if(!process.argv.includes('--apply')) {
      console.log(JSON.stringify({dryRun:true,bootstrap,existingTables:tables.rows[0].n,pending}));
      // --check is the read-only deploy gate: refuse to ship code ahead of the schema.
      if(process.argv.includes('--check') && pending.length) { console.error('PENDING_MIGRATIONS_REQUIRE_APPROVED_APPLY'); process.exitCode=1; }
      return;
    }
    const run=args=>{
      const result=spawnSync(process.execPath,[path.resolve('node_modules/prisma/build/index.js'),...args],{stdio:'inherit',env:{...process.env,DATABASE_URL:url,DIRECT_URL:url,REPLICA_URL:url}});
      if(result.error) throw result.error;
      if(result.status!==0) throw new Error('PRISMA_MIGRATION_FAILED');
    };
    if(bootstrap) {
      await client.query('BEGIN');
      try {await client.query(fs.readFileSync(path.resolve('prisma/migrations',baseline,'migration.sql'),'utf8')); await client.query('COMMIT');}
      catch(error){await client.query('ROLLBACK');throw error;}
      // Resolve only the baseline whose SQL has just actually committed.
      // Never mark an unexecuted or failed migration as applied.
      run(['migrate','resolve','--applied',baseline]);
    }
    run(['migrate','deploy']);
  } finally {await client.query('SELECT pg_advisory_unlock(742190621)').catch(()=>{});await client.end();}
}
module.exports={planBootstrap,pendingMigrations};
if(require.main===module) main().catch(error=>{console.error(error.code || error.message);process.exitCode=1;});
