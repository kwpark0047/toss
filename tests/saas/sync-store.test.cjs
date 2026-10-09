const test=require('node:test');const assert=require('node:assert/strict');
const SyncStore=require('../../services/integrations/SyncStore');
test('publication locks and checks lease before canonical writes',async()=>{
 let writes=0;
 const tx={$queryRawUnsafe:async()=>[], $executeRawUnsafe:async()=>{writes++;}};
 const store=new SyncStore({$transaction:async fn=>fn(tx)});
 await assert.rejects(store.publishPage({id:'id',storeId:3,accountId:'account',owner:'old'}, {records:[],done:true}));
 assert.equal(writes,0);
});
test('job scope requires valid tenant before DB access',async()=>{
 const store=new SyncStore({$queryRawUnsafe:async()=>{throw new Error('DB_ACCESS');}});
 await assert.rejects(store.history(-1),/SYNC_TENANT/);
});
