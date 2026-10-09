const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(providerFails) {
  const sub = { id: 's', store_id: 3, status: 'incomplete', auto_renew: true, current_period_end: new Date(0), payment_method_id: 'key', plan: {name:'pro'} };
  const invoice = { id:'i', status:'pending', attempts:0, order_id:'order', amount:100, period_end:new Date('2030-01-01'), subscription:sub };
  const matches = where => where.status === invoice.status && where.attempts === invoice.attempts && +where.claimed_at === +invoice.claimed_at;
  const delegate = {
    findUnique: async () => ({...invoice}),
    update: async ({data}) => Object.assign(invoice,data),
    updateMany: async ({where,data}) => {
      if(data.status === 'processing') { Object.assign(invoice,data,{attempts:invoice.attempts+1}); return {count:1}; }
      if(!matches(where)) return {count:0};
      Object.assign(invoice,data); return {count:1};
    }
  };
  const tx = { $queryRaw: async()=>[], billingInvoice:delegate, subscription:{findUnique:async()=>sub, update:async({data})=>Object.assign(sub,data)}, stores:{update:async()=>{}}, store_subscriptions:{upsert:async()=>{}} };
  const module = {exports:{}};
  vm.runInNewContext(fs.readFileSync('services/SaaSBillingService.js','utf8'), {module,Date,Buffer,process:{env:{}},require(name){
    if(name==='crypto') return require('crypto');
    if(name==='jsonwebtoken') return {};
    if(name==='../config/prisma') return {...tx,$transaction:async fn=>fn(tx)};
    if(name==='../utils/toss') return {payWithBillingKey:async()=>{
      // A new owner has completed while the old provider call was delayed.
      invoice.status='paid'; invoice.attempts=2; invoice.claimed_at=new Date(Date.now()+1); sub.status='active';
      if(providerFails) throw new Error('late timeout');
      return {status:'DONE',totalAmount:100,orderId:'order',paymentKey:'pg-key',approvedAt:new Date().toISOString()};
    }};
    if(name==='../utils/tokenEncryption') return {encryptToken:x=>x,decryptToken:x=>x};
    if(name==='../utils/subscriptionPolicy') return {};
    if(name==='../utils/errorHandler') return {AppError:class extends Error{}};
    if(name==='../utils/logger') return {error(){}};
    throw new Error(name);
  }});
  return {billing:module.exports,invoice,sub};
}
test('stale failed billing owner cannot overwrite paid invoice or active entitlement', async()=>{
  const {billing,invoice,sub}=setup(true);
  await assert.rejects(billing.chargeInvoice('i'));
  assert.equal(invoice.status,'paid'); assert.equal(sub.status,'active');
});
test('stale successful owner cannot overwrite a newer payment evidence',async()=>{
  const {billing,invoice}=setup(false); invoice.payment_key='new-owner-key';
  await assert.rejects(billing.chargeInvoice('i'));
  assert.equal(invoice.payment_key,'new-owner-key');
});
