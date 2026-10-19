const {test}=require('node:test');
const assert=require('node:assert/strict');
const retry=require('../../services/PaymentRetry');
function fixture(patch={}){
 const order={id:7,store_id:2,order_number:'stable-order',status:'pending',payment_status:'pending',total_amount:10000,...patch};
 let prepared=0,lookups=0;
 const tx={$queryRawUnsafe:async()=>[],orders:{findUnique:async()=>order},payments:{findMany:async()=>[],update:async()=>({})}};
 const db={$transaction:async fn=>fn(tx)};
 const provider={getPaymentByOrderId:async()=>{lookups++;return null}};
 const prepare=async(data,client)=>{assert.equal(client,tx);assert.deepEqual(data,{order_id:7,method:'CARD'});prepared++;return {payment_id:9,order_number:'stable-order',amount:10000}};
 return {db,provider,prepare,count:()=>({prepared,lookups})};
}
test('history proof must include both store and order before provider access',async()=>{
 for(const proof of [{storeId:3,orderIds:[7]},{storeId:2,orderIds:[8]},null]){
  const f=fixture();await assert.rejects(retry({...f,orderId:7,proof}),/권한/);assert.equal(f.count().prepared,0);assert.equal(f.count().lookups,0);
 }
});
test('retry prepares existing order without accepting client amount/store',async()=>{
 const f=fixture();assert.equal((await retry({...f,orderId:7,proof:{storeId:2,orderIds:[7]}})).payment_id,9);assert.equal(f.count().prepared,1);
});
test('paid/canceled/completed orders cannot retry',async()=>{
 for(const patch of [{payment_status:'paid'},{status:'cancelled'},{status:'completed'}]){
  const f=fixture(patch);await assert.rejects(retry({...f,orderId:7,proof:{storeId:2,orderIds:[7]}}));assert.equal(f.count().prepared,0);
 }
});
test('provider timeout, approved or in-progress authentication fails closed',async()=>{
 for(const status of ['DONE','IN_PROGRESS','CANCELED']){
  const f=fixture();f.provider.getPaymentByOrderId=async()=>({status});await assert.rejects(retry({...f,orderId:7,proof:{storeId:2,orderIds:[7]}}));assert.equal(f.count().prepared,0);
 }
 const f=fixture();f.provider.getPaymentByOrderId=async()=>{throw Error('timeout')};await assert.rejects(retry({...f,orderId:7,proof:{storeId:2,orderIds:[7]}}));assert.equal(f.count().prepared,0);
});
test('expired unpaid provider intent may reopen, but approved/refunded history cannot',async()=>{
 const f=fixture();f.provider.getPaymentByOrderId=async()=>({orderId:'stable-order',status:'EXPIRED',totalAmount:10000,balanceAmount:10000});
 assert.equal((await retry({...f,orderId:7,proof:{storeId:2,orderIds:[7]}})).payment_id,9);
 for(const patch of [{approvedAt:'2026-10-16'}, {cancels:[{}]}, {balanceAmount:9000}]){
  f.provider.getPaymentByOrderId=async()=>({orderId:'stable-order',status:'EXPIRED',totalAmount:10000,balanceAmount:10000,...patch});
  await assert.rejects(retry({...f,orderId:7,proof:{storeId:2,orderIds:[7]}}));
 }
});

