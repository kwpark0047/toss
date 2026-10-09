const test=require('node:test');const assert=require('node:assert/strict');
const {normalize}=require('../../services/PaymentWebhookInbox');
test('durable payload retains provider event identity during retry and excludes customer fields',()=>{
 const first=normalize({eventType:'PAYMENT_STATUS_CHANGED',data:{webhookId:'provider-event-1',paymentKey:'fixture-key',orderId:'o',totalAmount:100,status:'DONE',customerKey:'private',customerPhone:'private'}});
 const resumed=normalize(first.payload);
 assert.equal(resumed.id,first.id);assert.equal(resumed.digest,first.digest);
 assert.equal(first.payload.data.customerKey,undefined);assert.equal(first.payload.data.customerPhone,undefined);
});
