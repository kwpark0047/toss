const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const native=require('node:module').createRequire(path.resolve('services/RegistrationOtpService.js'));
const ctx={module:{exports:{}},require:name=>name==='../config/prisma'?{}:native(name)};
vm.runInNewContext(fs.readFileSync('services/RegistrationOtpService.js','utf8'),ctx);
const Service=ctx.module.exports;
function fixture(){
 let rows=[],users=[],failCreate=false;
 const db={$queryRawUnsafe:async()=>[],phone_otps:{
  findFirst:async({where})=>rows.filter(r=>r.phone===where.phone&&(where.used===undefined||r.used===where.used)&&(where.verified===undefined||r.verified===where.verified)&&(!where.expires_at||r.expires_at>where.expires_at.gt)).at(-1),
  updateMany:async()=>{rows.forEach(r=>r.used=true);},
  create:async({data})=>{rows.push({id:rows.length+1,used:false,verified:false,created_at:new Date(),...data});},
  update:async({where,data})=>Object.assign(rows.find(r=>r.id===where.id),data),
 },users:{findFirst:async()=>users[0],create:async({data})=>{if(failCreate)throw Error('injected DB failure');users.push({id:1,...data});return users[0];}}};
 db.$transaction=async work=>{const before=structuredClone({rows,users});try{return await work(db);}catch(e){rows=before.rows;users=before.users;throw e;}};
 return {db,rows:()=>rows,fail:()=>failCreate=true};
}
const env={NODE_ENV:'production',JWT_SECRET:'test-fixture-signing-key'};
test('production SMS failure is 503, never a successful dev OTP response or persisted challenge',async()=>{
 const f=fixture(),s=new Service(f.db,async()=>({sent:false}),env);
 await assert.rejects(s.send('01012345678'),e=>e.statusCode===503);assert.equal(f.rows().length,0);
});
test('production accepts provider acknowledgement without exposing OTP, hashes at rest and throttles resends',async()=>{
 const f=fixture();let code;const s=new Service(f.db,async(_phone,text)=>{code=text.match(/\d{6}/)[0];return {sent:true};},env);
 const result=await s.send('01012345678');assert.equal(result.dev_otp,undefined);assert.ok(!f.rows()[0].otp.includes(code));
 await assert.rejects(s.send('01012345678'),e=>e.statusCode===429);
 const verified=await s.verify('01012345678',code);assert.equal(verified.verified,true);
 await assert.rejects(s.createUser('01012345678',['cipher'],{phone:'cipher'}),e=>e.statusCode===400);
 await assert.rejects(s.createUser('01087654321',['other'],{phone:'other'},verified.verificationToken),e=>e.statusCode===400);
 f.fail();await assert.rejects(s.createUser('01012345678',['cipher'],{phone:'cipher'},verified.verificationToken),/injected DB failure/);assert.equal(f.rows()[0].used,false);
});
test('five incorrect attempts durably exhaust challenge; expired verified OTP cannot register',async()=>{
 const f=fixture(),s=new Service(f.db,async()=>({sent:true}),env);await s.send('01012345678');
 for(let i=0;i<5;i++)await assert.rejects(s.verify('01012345678','000000'),e=>e.statusCode===400);
 assert.equal(f.rows()[0].used,true);
 f.rows()[0].used=false;f.rows()[0].verified=true;f.rows()[0].expires_at=new Date(0);
 await assert.rejects(s.createUser('01012345678',['cipher'],{phone:'cipher'}),e=>e.statusCode===400);
});
