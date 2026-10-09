const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
test('scheduler shutdown drains a started charge and prevents subsequent claims',async()=>{
 let tick,release,calls=0,cleared=false;
 const pending=new Promise(resolve=>{release=resolve;});
 const sandbox={module:{exports:{}},process:{env:{NODE_ENV:'staging',BILLING_SCHEDULER_ENABLED:'true'}},
  setInterval:fn=>{tick=fn;return {unref(){}};},clearInterval:()=>{cleared=true;},
  require:name=>name.includes('logger')?{error(){}}:{runDueBilling:async()=>{calls++;await pending;}}};
 vm.runInNewContext(fs.readFileSync('services/billingScheduler.js','utf8'),sandbox);
 const stop=sandbox.module.exports.startBillingScheduler();
 const active=tick();await Promise.resolve();
 const drained=stop();assert.equal(cleared,true);assert.ok(drained&&typeof drained.then==='function','stop must return in-flight completion');
 let completed=false;drained.then(()=>{completed=true;});await Promise.resolve();assert.equal(completed,false);
 await tick();assert.equal(calls,1);release();await active;await drained;assert.equal(completed,true);
});
