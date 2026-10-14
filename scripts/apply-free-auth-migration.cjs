// Target-bound, metadata-only preflight; --apply is explicitly required for DDL.
const fs=require('node:fs'),crypto=require('node:crypto'),{Client}=require('pg');
const environment=process.argv[2],apply=process.argv.includes('--apply');
if(!['production','staging'].includes(environment))throw Error('EXPLICIT_ENVIRONMENT_REQUIRED');
const env=require('dotenv').parse(fs.readFileSync(environment==='production'?'.env.production':'.env.staging.local'));
const url=new URL(env.DIRECT_URL||env.DATABASE_URL);
if(environment==='production'&&(!url.username.includes('yreoeqmcebnosmtlyump')||!url.hostname.endsWith('.supabase.com')))throw Error('EXPECTED_PRODUCTION_PROJECT_REQUIRED');
if(environment==='staging'&&(url.hostname!=='127.0.0.1'||url.port!=='55438'||url.pathname!=='/wemarket_test_staging_20261010'))throw Error('ISOLATED_STAGING_REQUIRED');
const db=new Client({connectionString:url.href,connectionTimeoutMillis:15000,...(environment==='production'?{ssl:{rejectUnauthorized:true,ca:fs.readFileSync('reports/supabase-prod-ca-2021.crt','utf8')}}:{})});
const name='20261014030000_free_authentication',sql=fs.readFileSync(`prisma/migrations/${name}/migration.sql`,'utf8'),checksum=crypto.createHash('sha256').update(sql).digest('hex');
const tables=['auth_email_challenges','auth_oauth_flows','auth_abuse_buckets','auth_recent_proofs','auth_account_events','auth_mfa_challenges'];
async function metadata(){
 const columns=(await db.query("SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name=ANY($1::text[]) ORDER BY column_name",[['auth_status','password_login_enabled','email_verified_at']])).rows;
 const privateTables=(await db.query('SELECT c.relname,c.relrowsecurity AS rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=\'public\' AND c.relname=ANY($1::text[]) ORDER BY c.relname',[tables])).rows;
 const grants=(await db.query("SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name=ANY($1::text[]) AND grantee IN ('PUBLIC','anon','authenticated')",[tables])).rows;
 const index=(await db.query("SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='users_email_casefold_key'")).rows;
 return {columns,privateTables,publicGrants:grants,index};
}
(async()=>{
 await db.connect();await db.query('BEGIN');
 if(!apply)await db.query('SET TRANSACTION READ ONLY');
 await db.query("SET LOCAL lock_timeout='5s'");await db.query("SET LOCAL statement_timeout='30s'");
 // Serialize this exact release; do not deploy unrelated pending migrations.
 if(apply)await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[name]);
 const collision=(await db.query('SELECT count(*)::int AS groups FROM (SELECT lower(email) FROM public.users WHERE email IS NOT NULL GROUP BY lower(email) HAVING count(*)>1) duplicate_groups')).rows[0].groups;
 const history=(await db.query('SELECT checksum,finished_at,rolled_back_at FROM public._prisma_migrations WHERE migration_name=$1',[name])).rows;
 const before=await metadata(),usersBefore=(await db.query('SELECT count(*)::int AS count FROM public.users')).rows[0].count;
 if(collision)throw Object.assign(Error('EMAIL_CASEFOLD_COLLISIONS'),{safeCode:'EMAIL_CASEFOLD_COLLISIONS'});
 if(history.length&&(history.length!==1||history[0].checksum!==checksum||!history[0].finished_at||history[0].rolled_back_at))throw Object.assign(Error('MIGRATION_HISTORY_CONFLICT'),{safeCode:'MIGRATION_HISTORY_CONFLICT'});
 if(apply&&!history.length){
  if(before.columns.length||before.privateTables.length||before.index.length)throw Object.assign(Error('PARTIAL_SCHEMA_REQUIRES_REVIEW'),{safeCode:'PARTIAL_SCHEMA_REQUIRES_REVIEW'});
  if(!(await db.query("SELECT to_regclass('public.auth_sessions') IS NOT NULL AS ready")).rows[0].ready)throw Error('AUTH_SESSIONS_REQUIRED');
  await db.query(sql.replace(/^BEGIN;\s*/,'').replace(/COMMIT;\s*$/,''));
  await db.query('INSERT INTO public._prisma_migrations(id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES($1,$2,now(),$3,now(),1)',[crypto.randomUUID(),checksum,name]);
 }
 const after=await metadata(),usersAfter=(await db.query('SELECT count(*)::int AS count FROM public.users')).rows[0].count;
 if(apply&&(after.columns.length!==3||after.privateTables.length!==6||after.privateTables.some(t=>!t.rls)||after.publicGrants.length||after.index.length!==1||usersBefore!==usersAfter))throw Error('POSTCONDITION_FAILED');
 const denied=[];
 if(after.privateTables.length===6){
  for(const role of ['anon','authenticated']){
   if(!(await db.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)continue;
   for(const table of tables){
    await db.query('SAVEPOINT role_probe');let code;
    try{await db.query(`SET LOCAL ROLE "${role}"`);await db.query(`SELECT 1 FROM public."${table}" LIMIT 1`);}catch(error){code=error.code;}
    await db.query('ROLLBACK TO SAVEPOINT role_probe');await db.query('RELEASE SAVEPOINT role_probe');
    if(code!=='42501')throw Error('PUBLIC_ROLE_ACCESS_NOT_DENIED');denied.push({role,table,code});
   }
  }
 }
 if(apply)await db.query('COMMIT');else await db.query('ROLLBACK');
 console.log(JSON.stringify({environment,mode:apply?'apply':'preflight',migration:name,checksum,applied:apply,alreadyApplied:history.length===1,emailCollisionGroups:collision,usersBefore,usersAfter,metadata:after,deniedRoleProbes:denied,existingFinancialRecordsModified:false}));
})().catch(async error=>{await db.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({failed:true,environment,code:error.safeCode||error.code||'MIGRATION_FAILED'}));process.exitCode=1;}).finally(()=>db.end());
