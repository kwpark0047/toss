const test=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');
const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const url=new URL(process.env.P0_TEST_DATABASE_URL||'http://missing');
if(url.hostname!=='127.0.0.1'||url.port!=='55438'||url.pathname!=='/wemarket_p0_schema_test')throw new Error('ISOLATED_TEST_DB_REQUIRED');
process.env.DATABASE_URL=url.href;process.env.DIRECT_URL=url.href;process.env.REPLICA_URL=url.href;process.env.NODE_ENV='test';process.env.JWT_SECRET='billing-db-fixture';
const db=require('../../config/prisma');
const serviceRequire=require('node:module').createRequire(path.resolve('services/SaaSBillingService.js'));
function load(gateway){const module={exports:{}};vm.runInNewContext(fs.readFileSync('services/SaaSBillingService.js','utf8'),{module,Buffer,Date,process,require(name){
 if(name==='../utils/toss')return gateway;
 if(name==='../utils/tokenEncryption')return {encryptToken:x=>'fixture:'+x,decryptToken:x=>x};
 return serviceRequire(name);
}});return module.exports;}
test.after(async()=>db.disconnectAll());
async function fixture(){
 const user=await db.users.create({data:{password:'fixture-only',email:crypto.randomUUID()+'@test.invalid'}});
 const store=await db.stores.create({data:{user_id:user.id,name:'billing CAS fixture'}});
 const plan=await db.plan.create({data:{name:crypto.randomUUID(),display_name:'Test',features:{}}});
 const sub=await db.subscription.create({data:{store_id:store.id,plan_id:plan.id,status:'incomplete',auto_renew:true,current_period_end:new Date('2026-01-01'),payment_method_id:'fixture-key'}});
 const invoice=await db.billingInvoice.create({data:{subscription_id:sub.id,store_id:store.id,plan_id:plan.id,billing_cycle:'MONTHLY',order_id:crypto.randomUUID(),amount:100,period_start:new Date('2026-01-01'),period_end:new Date('2030-01-01')}});
 return {user,store,plan,sub,invoice};
}
async function cleanup(f){await db.billingInvoice.delete({where:{id:f.invoice.id}});await db.subscription.delete({where:{id:f.sub.id}});await db.stores.delete({where:{id:f.store.id}});await db.users.delete({where:{id:f.user.id}});await db.plan.delete({where:{id:f.plan.id}});}
test('actual PostgreSQL commits successful billing and split-store entitlement atomically',async()=>{
 const f=await fixture();
 try {
  const service=load({payWithBillingKey:async()=>({status:'DONE',totalAmount:100,orderId:f.invoice.order_id,paymentKey:'fixture-success',approvedAt:new Date().toISOString()})});
  await service.chargeInvoice(f.invoice.id);
  assert.equal((await db.billingInvoice.findUnique({where:{id:f.invoice.id}})).status,'paid');
  assert.equal((await db.subscription.findUnique({where:{id:f.sub.id}})).status,'active');
  assert.equal((await db.store_subscriptions.findUnique({where:{store_id:f.store.id}})).plan,f.plan.name);
 } finally {await cleanup(f);}
});
for(const lateFailure of [true,false])test(`actual PostgreSQL rejects stale billing ${lateFailure?'failure':'success'} writes`,async()=>{
 const f=await fixture();
 const service=load({payWithBillingKey:async()=>{
  await db.$transaction(async tx=>{
   await tx.billingInvoice.update({where:{id:f.invoice.id},data:{status:'paid',attempts:2,claimed_at:new Date(Date.now()+1),payment_key:'new-owner-evidence'}});
   await tx.subscription.update({where:{id:f.sub.id},data:{status:'active'}});
  });
  if(lateFailure)throw new Error('delayed owner timeout');
  return {status:'DONE',totalAmount:100,orderId:f.invoice.order_id,paymentKey:'old-owner-evidence',approvedAt:new Date().toISOString()};
 }});
 await assert.rejects(service.chargeInvoice(f.invoice.id));
 assert.equal((await db.billingInvoice.findUnique({where:{id:f.invoice.id}})).payment_key,'new-owner-evidence');
 assert.equal((await db.subscription.findUnique({where:{id:f.sub.id}})).status,'active');
 await cleanup(f);
});
