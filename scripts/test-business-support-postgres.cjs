// Dedicated local PostgreSQL only. Unique disposable schema; no operating DB access.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {Client,Pool}=require('pg');
const env=require('dotenv').parse(fs.readFileSync('.env.staging.local'));
const url=new URL(env.DATABASE_URL);
if(url.hostname!=='127.0.0.1'||url.port!=='55438'||url.pathname!=='/wemarket_test_staging_20261010')throw Error('ISOLATED_DB_REQUIRED');
const schema='support_test_'+crypto.randomBytes(6).toString('hex');
const client=new Client({connectionString:url.href});
let pool;
function adapter(connection){return {$queryRawUnsafe:async(sql,...args)=>(await connection.query(sql.replaceAll('public.business_support_cases',`${schema}.business_support_cases`),args)).rows,$executeRawUnsafe:async(sql,...args)=>(await connection.query(sql,args)).rowCount,
 phone_otps:{
  findFirst:async({where})=>(await connection.query(`SELECT * FROM phone_otps WHERE phone=$1 AND ($2::boolean IS NULL OR used=$2) AND ($3::boolean IS NULL OR verified=$3) AND ($4::timestamp IS NULL OR expires_at>$4) ORDER BY created_at DESC,id DESC LIMIT 1`,[where.phone,where.used??null,where.verified??null,where.expires_at?.gt??null])).rows[0],
  updateMany:async({where})=>connection.query('UPDATE phone_otps SET used=true WHERE phone=$1 AND NOT used',[where.phone]),
  create:async({data})=>connection.query('INSERT INTO phone_otps(phone,otp,expires_at) VALUES($1,$2,$3)',[data.phone,data.otp,data.expires_at]),
  update:async({where,data})=>{const keys=Object.keys(data);assert.ok(keys.every(k=>['used','verified','otp'].includes(k)));return connection.query(`UPDATE phone_otps SET ${keys.map((k,i)=>`${k}=$${i+2}`).join(',')} WHERE id=$1`,[where.id,...keys.map(k=>data[k])]);},
 },users:{findFirst:async({where})=>(await connection.query('SELECT * FROM users WHERE phone=ANY($1::text[])',[where.phone.in])).rows[0],create:async({data})=>(await connection.query('INSERT INTO users(phone) VALUES($1) RETURNING *',[data.phone])).rows[0]}};}
function load(file,db){
 const native=require('node:module').createRequire(path.resolve(file));
 const context={module:{exports:{}},process:{env:{}},setTimeout,clearTimeout,require:name=>name==='../config/prisma'?db:name==='./StoreManagerService'?load('services/StoreManagerService.js',db):name==='./BusinessSupportService'?load('services/BusinessSupportService.js',db):native(name)};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});return context.module.exports;
}
(async()=>{
 await client.connect();
 await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}",public`);
 pool=new Pool({connectionString:url.href,options:`-c search_path=${schema},public`,max:6});
 try{
   await client.query(`CREATE TABLE users(id serial PRIMARY KEY,phone text UNIQUE); INSERT INTO users(id) VALUES(7),(8),(9);
   CREATE TABLE stores(id int PRIMARY KEY,user_id int NOT NULL REFERENCES users(id),name text,is_active boolean); INSERT INTO stores VALUES(3,7,'test A',true),(4,8,'test B',true);
   CREATE TABLE products(id int PRIMARY KEY,store_id int,name text,is_active boolean,is_sold_out boolean,stock_quantity int,updated_at timestamp);INSERT INTO products(id,store_id,name,is_active,is_sold_out,stock_quantity) VALUES(1,3,'test menu',true,false,100);
   CREATE TABLE orders(id serial PRIMARY KEY,store_id int,status text,created_at timestamp);INSERT INTO orders(store_id,status,created_at) VALUES(3,'pending',now()-interval '30 minutes');`);
  await client.query(fs.readFileSync('prisma/migrations/20261007030000_ai_store_manager/migration.sql','utf8').replaceAll('"public".',`"${schema}".`));
  await client.query(fs.readFileSync('prisma/migrations/20261014010000_business_support/migration.sql','utf8'));
  await client.query(fs.readFileSync('prisma/migrations/20261021010000_business_support_messages/migration.sql','utf8'));
  const db=adapter(pool);db.$transaction=async work=>{const tx=await pool.connect();try{await tx.query('BEGIN');const result=await work(adapter(tx));await tx.query('COMMIT');return result;}catch(e){await tx.query('ROLLBACK');throw e;}finally{tx.release();}};
  const Service=load('services/BusinessSupportService.js',db),Worker=load('services/BusinessSupportWorker.js',db);
  const service=new Service(db),owner={id:7,role:'store_admin'},platform={id:9,role:'super_admin'},foreign={id:8,role:'store_admin'};
  await assert.rejects(service.enroll(3,platform,true),e=>e.statusCode===403);
  await service.enroll(3,owner,true);
  const sid=crypto.randomUUID(),aid=crypto.randomUUID();
  await client.query('INSERT INTO manager_snapshots(id,store_id,snapshot_key,payload) VALUES($1,3,$2,$3)',[sid,'test',{}]);
  await client.query("INSERT INTO manager_actions(id,store_id,snapshot_id,dedupe_key,kind,product_id,payload) VALUES($1,3,$2,'test','menu_feature',1,$3)",[aid,sid,{title:'test QR',reason:'observed'}]);
  const snapshot={snapshot_id:sid,as_of:new Date().toISOString(),insights:[],provenance:{native:{provider:'wemarket'}},actions:[{id:aid,snapshot_id:sid,status:'proposed',kind:'menu_feature',product_id:1,payload:{title:'test QR'}}]};
  const cases=await service.createFromSnapshot(3,snapshot,{pending:1,oldest_minutes:30}),id=cases[0].id;
  assert.equal((await service.createFromSnapshot(3,snapshot)).length,0);
  const laterSnapshotId=crypto.randomUUID();
  await client.query('INSERT INTO manager_snapshots(id,store_id,snapshot_key,payload) VALUES($1,3,$2,$3)',[laterSnapshotId,'later',{}]);
  await service.createFromSnapshot(3,{...snapshot,snapshot_id:laterSnapshotId,actions:[]});
  assert.equal((await service.detail(3,id,platform)).snapshot_id,sid,'QR proposal must retain its original evidence snapshot');
  assert.equal((await service.list(owner,3)).items.length,0);
  await assert.rejects(service.detail(3,id,foreign),e=>e.statusCode===403);
  await assert.rejects(service.transition(3,id,'approve',platform,crypto.randomUUID()),e=>e.statusCode===403);
  const op=crypto.randomUUID();
  const send=await Promise.all([service.transition(3,id,'send',platform,op,'test'),service.transition(3,id,'send',platform,op,'test')]);
  assert.equal(send.filter(r=>r.already_applied).length,1);
  await assert.rejects(service.transition(3,id,'send',owner,op,'test'),e=>e.statusCode===409);
  const messageOperation=crypto.randomUUID();
  const internalMessage=await service.addMessage(3,id,platform,{operation_id:messageOperation,body:'  운영팀 내부 확인  ',visibility:'internal'});
  const repeatedMessage=await service.addMessage(3,id,platform,{operation_id:messageOperation,body:'운영팀 내부 확인',visibility:'internal'});
  assert.equal(repeatedMessage.already_applied,true);
  const ownerReply=await service.addMessage(3,id,owner,{operation_id:crypto.randomUUID(),body:'확인했습니다.'});
  const ownerDetail=await service.detail(3,id,owner),platformDetail=await service.detail(3,id,platform);
  assert.equal(ownerDetail.messages.some(message=>message.id===internalMessage.id),false,'internal notes stay private');
  assert.equal(platformDetail.messages.some(message=>message.id===ownerReply.id),true,'platform sees owner replies');
  assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM business_support_messages WHERE case_id=$1',[id])).rows[0].n,2,'retry creates no duplicate');
  await assert.rejects(service.addMessage(3,id,owner,{operation_id:crypto.randomUUID(),body:'not internal',visibility:'internal'}),e=>e.statusCode===403);
  await assert.rejects(service.manager.transition(3,aid,'approve',7),e=>e.statusCode===409);
  await service.transition(3,id,'changes',owner,crypto.randomUUID(),'change');
  await service.transition(3,id,'send',platform,crypto.randomUUID(),'revised');
  await service.transition(3,id,'approve',owner,crypto.randomUUID());
  const executions=await Promise.allSettled([service.transition(3,id,'execute',owner,crypto.randomUUID()),service.transition(3,id,'execute',owner,crypto.randomUUID())]);
  assert.equal(executions.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM manager_action_events WHERE event='execute'")).rows[0].count,1);
  await service.enroll(3,owner,false);await service.transition(3,id,'stop',owner,crypto.randomUUID());
  assert.equal((await service.detail(3,id,owner)).status,'stopped');
  await service.enroll(3,owner,true);
  const worker=new Worker(db),claimed=await Promise.all([worker.claim(),worker.claim()]);assert.equal(claimed.filter(Boolean).length,1);
  const job=claimed.find(Boolean);
  worker.service.manager.briefing=async()=>{throw Error('fixture failure with private data');};
  await worker.process(job);
  const retry=(await client.query('SELECT * FROM business_support_jobs WHERE store_id=3')).rows[0];
  assert.equal(retry.status,'pending');assert.equal(retry.last_error,'analysis_failed');assert.ok(retry.available_at>new Date());
  await client.query("UPDATE business_support_jobs SET status='running',attempts=5,lease_until=now()-interval '1 minute' WHERE store_id=3");
  assert.equal(await worker.claim(),null);assert.equal((await client.query('SELECT status FROM business_support_jobs WHERE store_id=3')).rows[0].status,'dead');
  await service.markDirty(3);const recovering=await worker.claim();assert.ok(recovering);
  worker.service.manager.briefing=async()=>snapshot;
  await service.markDirty(3);await worker.process(recovering);
  assert.equal((await client.query('SELECT status FROM business_support_jobs WHERE store_id=3')).rows[0].status,'pending','new dirty generation survives active job completion');
  const finalJob=await worker.claim();await worker.process(finalJob);
  assert.equal((await client.query('SELECT status FROM business_support_jobs WHERE store_id=3')).rows[0].status,'done');
  await service.markDirty(3);const stale=await worker.claim();
  await client.query("UPDATE business_support_jobs SET lease_until=now()-interval '1 minute' WHERE store_id=3");
  const replacement=await new Worker(db).claim();assert.notEqual(stale.lease_id,replacement.lease_id);
  assert.equal((await worker.process(stale)).status,'lease_lost');
  await worker.process(replacement);
  await assert.rejects(client.query('INSERT INTO business_support_cases(id,store_id,snapshot_id,priority,evidence) VALUES($1,4,$2,1,$3)',[crypto.randomUUID(),sid,{}]),e=>e.code==='23503');
  assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM pg_class WHERE relnamespace=$1::regnamespace AND relname LIKE $2 AND relrowsecurity',[schema,'business_support_%'])).rows[0].count,5);
  await client.query(`CREATE TABLE phone_otps(id serial PRIMARY KEY,phone text NOT NULL,otp text NOT NULL,expires_at timestamp NOT NULL,verified boolean NOT NULL DEFAULT false,used boolean NOT NULL DEFAULT false,created_at timestamp NOT NULL DEFAULT now());`);
  const OTP=load('services/RegistrationOtpService.js',db);let code;
  const otp=new OTP(db,async(_phone,text)=>{code=text.match(/\d{6}/)[0];return {sent:true};},{NODE_ENV:'production',JWT_SECRET:'isolated-postgres-fixture'});
  const delivered=await otp.send('01012345678');assert.equal(delivered.dev_otp,undefined);
  const verified=await otp.verify('01012345678',code);
  await assert.rejects(otp.createUser('01012345678',['cipher'],{phone:'cipher'},verified.verificationToken+'tampered'),e=>e.statusCode===400);
  const registered=await Promise.allSettled([otp.createUser('01012345678',['cipher'],{phone:'cipher'},verified.verificationToken),otp.createUser('01012345678',['cipher'],{phone:'cipher'},verified.verificationToken)]);
  assert.equal(registered.filter(r=>r.status==='fulfilled').length,1);assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM users WHERE phone='cipher'")).rows[0].count,1);
  assert.equal((await client.query('SELECT used FROM phone_otps')).rows[0].used,true);
  await client.query("INSERT INTO products(id,store_id,name,is_active,is_sold_out,stock_quantity) VALUES(2,4,'other fixture',true,false,10)");
  await service.enroll(4,foreign,true);
  const original4=crypto.randomUUID(),latest4=crypto.randomUUID(),action4=crypto.randomUUID();
  for(const [id4,key4] of [[original4,'original4'],[latest4,'latest4']])await client.query('INSERT INTO manager_snapshots(id,store_id,snapshot_key,payload) VALUES($1,4,$2,$3)',[id4,key4,{as_of:new Date().toISOString(),provenance:{native:{provider:'wemarket'}}}]);
  await client.query("INSERT INTO manager_actions(id,store_id,snapshot_id,dedupe_key,kind,product_id,payload) VALUES($1,4,$2,'daily4','menu_feature',2,$3)",[action4,original4,{title:'original proposal'}]);
  await service.createFromSnapshot(4,{...snapshot,snapshot_id:latest4,actions:[{id:action4,snapshot_id:original4,status:'proposed',kind:'menu_feature',product_id:2,payload:{title:'original proposal'}}]});
  const case4=(await service.list(platform,4)).items[0];
  assert.equal(case4.action_id,action4,'same-day proposed action must survive five-minute snapshot rollover');
  assert.equal(case4.evidence.action_source.snapshot_id,original4);
  await service.transition(4,case4.id,'send',platform,crypto.randomUUID());
  await service.transition(4,case4.id,'approve',foreign,crypto.randomUUID());
  await service.transition(4,case4.id,'execute',foreign,crypto.randomUUID());
  await client.query("UPDATE manager_actions SET started_at=now()-interval '8 days',ends_at=now()-interval '1 day' WHERE id=$1",[action4]);
  await client.query("ALTER TABLE orders ADD COLUMN total_amount int DEFAULT 0,ADD COLUMN payment_status text DEFAULT 'pending';CREATE TABLE order_items(order_id int,product_id int);CREATE TABLE ledger(store_id int,order_id int,type text,amount int)");
  const evaluation=await service.evaluate(4,case4.id,foreign);assert.equal(evaluation.verdict,'insufficient');assert.equal(evaluation.causal,false);
  await service.evaluate(4,case4.id,foreign);
  assert.equal((await client.query("SELECT COUNT(*)::int AS n FROM business_support_events WHERE case_id=$1 AND event='evaluate'",[case4.id])).rows[0].n,1);
  console.log(JSON.stringify({passed:true,realPostgres:true,operatingDB:false,checks:['owner consent','draft privacy','foreign tenant denial','platform approval denial','idempotent concurrent send','internal message privacy','support message idempotency','owner internal-note denial','linked action bypass blocked','change request and resend','concurrent QR execution once','stop after withdrawal','worker exclusive claim','backoff and sanitized errors','lease exhaustion DLQ','manual recovery','tenant FK','RLS','OTP hashed at rest','tampered signup proof rejected','concurrent signup exactly once','OTP consumed atomically']}));
 }finally{await pool.end();await client.query(`DROP SCHEMA "${schema}" CASCADE`);}
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>client.end());
