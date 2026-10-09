const test=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');
const url=new URL(process.env.P0_TEST_DATABASE_URL||'http://missing');
if(url.hostname!=='127.0.0.1'||url.port!=='55438'||url.pathname!=='/wemarket_p0_schema_test')throw new Error('ISOLATED_TEST_DB_REQUIRED');
process.env.DATABASE_URL=url.href;process.env.DIRECT_URL=url.href;process.env.REPLICA_URL=url.href;process.env.NODE_ENV='test';process.env.JWT_SECRET='webhook-fixture';process.env.TOKEN_ENC_KEY='webhook-fixture-encryption';
const db=require('../../config/prisma'),inbox=require('../../services/PaymentWebhookInbox');
test.after(async()=>db.disconnectAll());
function event(){return {eventType:'PAYMENT_STATUS_CHANGED',eventId:crypto.randomUUID(),data:{status:'DONE',orderId:'fixture',paymentKey:'fixture-key',totalAmount:100}};}
test('actual DB same event executes once and failed processing is durably retryable',async()=>{
 const e=event();let calls=0;
 await assert.rejects(inbox.run(e,async()=>{throw new Error('DB unavailable');}));
 const {id}=inbox.normalize(e);assert.equal((await db.paymentWebhookInbox.findUnique({where:{id}})).status,'failed');
 await db.paymentWebhookInbox.update({where:{id},data:{next_retry_at:new Date(0)}});
 await inbox.run(e,async()=>{calls++;return {handled:true};});
 await inbox.run(e,async()=>{calls++;return {handled:true};});assert.equal(calls,1);
 await db.paymentWebhookInbox.delete({where:{id}});
});
test('actual DB stale owner is fenced and expired lease resumes with preserved provider ID',async()=>{
 const e=event(),{id}=inbox.normalize(e);
 await assert.rejects(inbox.run(e,async()=>{
  await db.paymentWebhookInbox.update({where:{id},data:{owner:crypto.randomUUID(),lease_until:new Date(0)}});
  return {handled:true};
 }));
 const row=await db.paymentWebhookInbox.findUnique({where:{id}});
 const restored=JSON.parse(require('../../utils/tokenEncryption').decryptToken(row.payload_encrypted));
 assert.equal(inbox.normalize(restored).id,id);
 await inbox.run(restored,async()=>({handled:true}));assert.equal((await db.paymentWebhookInbox.findUnique({where:{id}})).status,'processed');
 await db.paymentWebhookInbox.delete({where:{id}});
});
test('unverified legacy or delayed canceled state is quarantined without granting entitlement',async()=>{
 const e=event();e.eventType='Subscription.PAYMENT_SUCCEEDED';
 const result=await inbox.run(e,inbox.processEvent);assert.equal(result.reviewRequired,true);
 assert.equal((await db.paymentWebhookInbox.findUnique({where:{id:inbox.normalize(e).id}})).status,'manual_review');
 await db.paymentWebhookInbox.delete({where:{id:inbox.normalize(e).id}});
});
test('automatic compensation journals before PG and repeated retry has one cancellation effect',async()=>{
 const gateway=require('../../utils/toss');const originalGet=gateway.getPayment,originalCancel=gateway.cancelPayment;
 const key='fixture-auto-'+crypto.randomUUID();let canceled=false,calls=0;
 gateway.getPayment=async()=>({paymentKey:key,totalAmount:100,balanceAmount:canceled?0:100,status:canceled?'CANCELED':'DONE'});
 gateway.cancelPayment=async(_key,_reason,amount,operationKey)=>{
  assert.equal(amount,100);assert.ok(operationKey.startsWith('auto-cancel:'));
  const id=crypto.createHash('sha256').update('toss:'+operationKey).digest('hex');
  const row=await db.paymentWebhookInbox.findUnique({where:{id}});assert.equal(row.status,'processing');assert.equal(row.kind,'auto_cancel');
  calls++;canceled=true;return {paymentKey:key,status:'CANCELED',balanceAmount:0};
 };
 try{
  const service=require('../../services/PaymentCompensationService');
  await service.autoCancel(key,'fixture');await service.autoCancel(key,'fixture');assert.equal(calls,1);
  const e={eventType:'AUTO_PAYMENT_CANCEL',eventId:'auto-cancel:'+crypto.createHash('sha256').update(key).digest('hex'),data:{paymentKey:key,cancelReason:'fixture'}};
  const row=await db.paymentWebhookInbox.findUnique({where:{id:inbox.normalize(e).id}});assert.equal(row.kind,'auto_cancel');assert.equal(row.status,'processed');
  await db.paymentWebhookInbox.delete({where:{id:row.id}});
 }finally{gateway.getPayment=originalGet;gateway.cancelPayment=originalCancel;}
});
