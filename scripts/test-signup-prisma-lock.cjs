// Real Prisma + isolated PostgreSQL; no tables, SMS or production data touched.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const env=require('dotenv').parse(fs.readFileSync('.env.staging.local'));
const url=new URL(env.DATABASE_URL);
if(url.hostname!=='127.0.0.1'||url.port!=='55438'||url.pathname!=='/wemarket_test_staging_20261010')throw Error('ISOLATED_DB_REQUIRED');
const {PrismaClient}=require('../prisma/app/generated/prisma');
const a=new PrismaClient({datasources:{db:{url:url.href}}}),b=new PrismaClient({datasources:{db:{url:url.href}}});
const native=require('node:module').createRequire(path.resolve('services/RegistrationOtpService.js'));
const ctx={module:{exports:{}},require:n=>n==='../config/prisma'?{}:native(n)};
vm.runInNewContext(fs.readFileSync('services/RegistrationOtpService.js','utf8'),ctx);
const service=new ctx.module.exports(a,()=>{throw Error('SMS_MUST_NOT_RUN');},{});
const identity='prisma-lock-regression-'+process.pid;
(async()=>{
 const probe=()=>b.$transaction(async tx=>(await tx.$queryRawUnsafe('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired',`signup:${identity}`))[0].acquired);
 await a.$transaction(async tx=>{await service.lock(tx,identity);assert.equal(await probe(),false,'concurrent session must not acquire held lock');});
 assert.equal(await probe(),true,'commit must release lock');
 await assert.rejects(a.$transaction(async tx=>{await service.lock(tx,identity);throw Error('rollback-probe');}),/rollback-probe/);
 assert.equal(await probe(),true,'rollback must release lock');
 console.log(JSON.stringify({passed:true,realPrisma:true,realPostgres:true,production:false,checks:['void deserialization avoided','cross-session mutual exclusion','commit releases lock','rollback releases lock'],externalSMSCalls:0}));
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{await a.$disconnect();await b.$disconnect();});
