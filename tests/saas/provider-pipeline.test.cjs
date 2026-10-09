const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRecord, fetchPageWithRetry, assertAdapter } = require('../../services/integrations/providerPipeline');
const record = {entity:'Order',external_id:'one',version:1,occurred_at:'2026-10-08T01:00:00Z',data:{amount:5000,refund_amount:0,status:'paid'}};
test('tenant authority and personal fields cannot be supplied by provider',()=>{
  assert.throws(()=>normalizeRecord({...record,store_id:4}));
  assert.throws(()=>normalizeRecord({...record,data:{...record.data,phone:'01012345678'}}));
  assert.throws(()=>normalizeRecord({...record,data:{...record.data,amount:0.5}}));
});
test('canonical hash ignores property order but binds version and facts',()=>{
 const a=normalizeRecord(record),b=normalizeRecord({...record,data:{status:'paid',refund_amount:0,amount:5000}});
 assert.equal(a.hash,b.hash); assert.notEqual(a.hash,normalizeRecord({...record,version:2}).hash);
});
test('rate limit retries are bounded; no credential error retries',async()=>{
 let calls=0,delays=[];
 const adapter={fetchPage:async()=>{if(++calls<3)throw {status:429,retryAfterMs:100};return {records:[record],nextCursor:null,done:true};}};
 const result=await fetchPageWithRetry(adapter,{}, {sleep:async ms=>delays.push(ms),random:()=>0});
 assert.equal(calls,3);assert.equal(delays.length,2);assert.equal(result.records.length,1);
 calls=0;await assert.rejects(fetchPageWithRetry({fetchPage:async()=>{calls++;throw {status:401};}},{}));assert.equal(calls,1);
});
test('pagination rejects repeated checkpoints and malformed response',async()=>{
 await assert.rejects(fetchPageWithRetry({fetchPage:async()=>({records:[],nextCursor:'x',done:false})},{cursor:'x'}));
 await assert.rejects(fetchPageWithRetry({fetchPage:async()=>({records:{},done:true})},{}));
});
test('unsupported adapters cannot advertise operational success',()=>{
 assert.throws(()=>assertAdapter({provider:'pos',fetchPage(){}}));
});
test('publication carries authenticated scope and never advances a failed page',async()=>{
 const {runSyncPage}=require('../../services/integrations/runSyncPage');
 const job={storeId:3,accountId:'account',provider:'reference',owner:'owner',cursor:null};
 const adapter={provider:'reference',documentationUrl:'https://example.test/docs',normalize:r=>r,fetchPage:async()=>({records:[record],done:true})};
 let published=0, errors=[];
 const store={assertLease:async()=>{},publishPage:async(j,p)=>{assert.equal(j.storeId,3);assert.equal(p.records[0].entity,'Order');published++;},recordError:async(j,e)=>errors.push(e)};
 await runSyncPage({adapter,store,job});assert.equal(published,1);
 adapter.fetchPage=async()=>({records:[{...record,data:{amount:'bad'}}],done:true});
 await assert.rejects(runSyncPage({adapter,store,job}));assert.equal(published,1);assert.equal(errors.length,1);
});
