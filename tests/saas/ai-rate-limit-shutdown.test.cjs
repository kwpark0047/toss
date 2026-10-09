const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
test('AI rate limit Redis client is drained and disconnected on shutdown',async()=>{
 let options,release,disconnects=0;
 const pending=new Promise(resolve=>{release=resolve;});
 const client={on(){},connect:()=>pending,disconnect:async()=>{disconnects++;}};
 const sandbox={module:{exports:{}},process:{env:{REDIS_URL:'redis://fixture.invalid'}},setTimeout,clearTimeout,Date,
 require:name=>name==='express-rate-limit'?(value)=>{options=value;return value;}:name==='redis'?{createClient:()=>client}:name.includes('runtimeResources')?{registerResource(){}}:{info(){},warn(){},error(){}}};
 vm.runInNewContext(fs.readFileSync('utils/aiRateLimiter.js','utf8'),sandbox);
 const exported=sandbox.module.exports;assert.equal(typeof exported.shutdownAIRateLimiter,'function');
 exported.createAIRateLimiter('recommend');const initialization=options.store.init({});
 const stopped=exported.shutdownAIRateLimiter();await Promise.resolve();assert.equal(disconnects,0);
 release();await initialization;await stopped;assert.equal(disconnects,1);
});
