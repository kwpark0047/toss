// Real local PostgreSQL transactions; controlled SMS acknowledgement, zero external SMS calls.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {Client,Pool}=require('pg');
const env=require('dotenv').parse(fs.readFileSync('.env.staging.local'));
const url=new URL(env.DATABASE_URL);
if(url.hostname!=='127.0.0.1'||url.port!=='55438'||url.pathname!=='/wemarket_test_staging_20261010')throw Error('ISOLATED_DB_REQUIRED');
const schema='signup_test_'+crypto.randomBytes(6).toString('hex'),client=new Client({connectionString:url.href});let pool;
function adapter(connection){return {
 $queryRawUnsafe:async(sql,...args)=>(await connection.query(sql,args)).rows,
 phone_otps:{
  findFirst:async({where})=>(await connection.query(`SELECT * FROM phone_otps WHERE phone=$1 AND ($2::boolean IS NULL OR used=$2) AND ($3::boolean IS NULL OR verified=$3) AND ($4::timestamp IS NULL OR expires_at>$4) ORDER BY created_at DESC,id DESC LIMIT 1`,[where.phone,where.used??null,where.verified??null,where.expires_at?.gt??null])).rows[0],
  updateMany:async({where})=>connection.query('UPDATE phone_otps SET used=true WHERE phone=$1 AND NOT used',[where.phone]),
  create:async({data})=>connection.query('INSERT INTO phone_otps(phone,otp,expires_at) VALUES($1,$2,$3)',[data.phone,data.otp,data.expires_at]),
  update:async({where,data})=>{const keys=Object.keys(data);assert.ok(keys.every(k=>['used','verified','otp'].includes(k)));return connection.query(`UPDATE phone_otps SET ${keys.map((k,i)=>`${k}=$${i+2}`).join(',')} WHERE id=$1`,[where.id,...keys.map(k=>data[k])]);},
 },users:{findFirst:async({where})=>(await connection.query('SELECT * FROM users WHERE phone=ANY($1::text[])',[where.phone.in])).rows[0],create:async({data})=>(await connection.query('INSERT INTO users(phone) VALUES($1) RETURNING *',[data.phone])).rows[0]},
};}
(async()=>{
 await client.connect();await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"`);
 pool=new Pool({connectionString:url.href,options:`-c search_path=${schema}`,max:4});
 try{
  await client.query(`CREATE TABLE users(id serial PRIMARY KEY,phone text UNIQUE NOT NULL CHECK(phone!='fault'));
    CREATE TABLE phone_otps(id serial PRIMARY KEY,phone text NOT NULL,otp text NOT NULL,expires_at timestamp NOT NULL,verified boolean NOT NULL DEFAULT false,used boolean NOT NULL DEFAULT false,created_at timestamp NOT NULL DEFAULT now());`);
  const db=adapter(pool);db.$transaction=async work=>{const tx=await pool.connect();try{await tx.query('BEGIN');const result=await work(adapter(tx));await tx.query('COMMIT');return result;}catch(e){await tx.query('ROLLBACK');throw e;}finally{tx.release();}};
  const native=require('node:module').createRequire(path.resolve('services/RegistrationOtpService.js'));
  const ctx={module:{exports:{}},require:name=>name==='../config/prisma'?db:native(name)};vm.runInNewContext(fs.readFileSync('services/RegistrationOtpService.js','utf8'),ctx);
  let code;const Service=ctx.module.exports,service=new Service(db,async(_p,text)=>{code=text.match(/\d{6}/)[0];return {sent:true};},{NODE_ENV:'production',JWT_SECRET:'local-test-only-key'});
  const sent=await service.send('01012345678');assert.equal(sent.dev_otp,undefined);
  const record=(await client.query('SELECT * FROM phone_otps')).rows[0];assert.ok(record.otp.startsWith('v1:'));assert.ok(!record.otp.includes(code));
  const proof=await service.verify('01012345678',code);
  await assert.rejects(service.createUser('01012345678',['fault'],{phone:'fault'},proof.verificationToken),e=>e.code==='23514');
  assert.equal((await client.query('SELECT used FROM phone_otps')).rows[0].used,false);
  await assert.rejects(service.createUser('01087654321',['cipher'],{phone:'cipher'},proof.verificationToken),e=>e.statusCode===400);
  await assert.rejects(service.createUser('01012345678',['cipher'],{phone:'cipher'},proof.verificationToken+'tampered'),e=>e.statusCode===400);
  const results=await Promise.allSettled([service.createUser('01012345678',['cipher'],{phone:'cipher'},proof.verificationToken),service.createUser('01012345678',['cipher'],{phone:'cipher'},proof.verificationToken)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n,1);
  assert.equal((await client.query('SELECT used FROM phone_otps')).rows[0].used,true);
  console.log(JSON.stringify({passed:true,realPostgres:true,externalSMSCalls:0,operatingDB:false,checks:['hashed OTP','signup proof binding','tampered proof rejection','transaction rollback preserves OTP','concurrent signup exactly once','single use OTP']}));
 }finally{await pool.end();await client.query(`DROP SCHEMA "${schema}" CASCADE`);}
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>client.end());
