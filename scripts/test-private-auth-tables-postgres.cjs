const fs=require('fs'),crypto=require('crypto'),assert=require('node:assert/strict'),{Client}=require('pg');
const env=require('dotenv').parse(fs.readFileSync('.env.staging.local')),url=new URL(env.DATABASE_URL);
if(url.hostname!=='127.0.0.1'||url.port!=='55438'||url.pathname!=='/wemarket_test_staging_20261010')throw Error('ISOLATED_DB_REQUIRED');
const tag=crypto.randomBytes(6).toString('hex'),schema='privacy_test_'+tag,role='privacy_probe_'+tag,db=new Client({connectionString:url.href});
(async()=>{await db.connect();await db.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"; CREATE ROLE "${role}" NOLOGIN;`);
 try{
  await db.query(`CREATE TABLE phone_otps(id int PRIMARY KEY);CREATE TABLE provider_credentials(id int PRIMARY KEY);INSERT INTO phone_otps VALUES(1);INSERT INTO provider_credentials VALUES(1);GRANT USAGE ON SCHEMA "${schema}" TO "${role}";GRANT SELECT,UPDATE ON phone_otps,provider_credentials TO "${role}";`);
  await db.query(fs.readFileSync('prisma/migrations/20261014020000_private_registration_and_provider_tables/migration.sql','utf8').replaceAll('public.',`"${schema}".`));
  const rls=(await db.query('SELECT COUNT(*)::int AS n FROM pg_class WHERE relnamespace=$1::regnamespace AND relrowsecurity',[schema])).rows[0].n;assert.equal(rls,2);
  await db.query(`BEGIN; SET LOCAL ROLE "${role}"`);
  for(const table of ['phone_otps','provider_credentials']){
   assert.equal((await db.query(`SELECT * FROM "${schema}".${table}`)).rows.length,0);
   assert.equal((await db.query(`UPDATE "${schema}".${table} SET id=2 RETURNING id`)).rows.length,0);
  }
  await db.query('ROLLBACK');
  assert.equal((await db.query('SELECT * FROM phone_otps')).rows.length,1);
  console.log(JSON.stringify({passed:true,realPostgres:true,operatingDB:false,checks:['OTP RLS','credential RLS','unprivileged read denied','unprivileged update denied','server owner access retained']}));
 }finally{await db.query('ROLLBACK');await db.query(`DROP SCHEMA "${schema}" CASCADE; DROP ROLE "${role}";`);}
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.end());

