const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
test('worker SIGTERM waits for financial work before DB disconnect and stops further ticks',async()=>{
 const callbacks=[],signals={};let release,disconnects=0,resumes=0,deadlineCleared=false,resourcesClosed=false;
 const pending=new Promise(resolve=>{release=resolve;});
 const sandbox={module:{exports:{}},console:{error(){}},process:{env:{PAYMENT_INBOX_RETRY_ENABLED:'true'},once:(name,fn)=>{signals[name]=fn;},exit(){throw new Error('unexpected exit');}},
 setInterval:fn=>{callbacks.push(fn);return callbacks.length;},clearInterval(){},setTimeout:()=>99,clearTimeout:()=>{deadlineCleared=true;},
 require:name=>{
  if(name==='dotenv')return {config(){}};
  if(name.includes('billingScheduler'))return {startBillingScheduler(){throw new Error('billing must stay disabled');}};
  if(name.includes('webhookDispatcher'))return {startRetryScheduler(){throw new Error('outbound must stay disabled');}};
  if(name.includes('prisma'))return {disconnectAll:async()=>{disconnects++;}};
  if(name.includes('PaymentWebhookInbox'))return {resume:async()=>{resumes++;await pending;}};
  if(name.includes('runtimeResources'))return {closeRuntimeResources:async()=>{resourcesClosed=true;}};
  throw new Error(name);
 }};
 vm.runInNewContext(fs.readFileSync('scripts/operations-worker.cjs','utf8'),sandbox);
 callbacks[0]();await Promise.resolve();signals.SIGTERM();await Promise.resolve();
 assert.equal(disconnects,0);callbacks[0]();assert.equal(resumes,1);
 release();await new Promise(setImmediate);
 assert.equal(disconnects,1);assert.equal(deadlineCleared,true);assert.equal(resourcesClosed,true);
});
