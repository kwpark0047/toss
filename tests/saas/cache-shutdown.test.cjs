const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
test('cache shutdown waits for initialization and closes Redis and expiration timer',async()=>{
 let release,disconnected=0,timersClosed=0;
 const pending=new Promise(resolve=>{release=resolve;});
 const redis={connect:()=>pending,disconnect:async()=>{disconnected++;}};
 const sandbox={module:{exports:{}},require:name=>name==='node-cache'?class{close(){timersClosed++;}}:name.includes('redisCache')?{getRedisCache:()=>redis}:name.includes('runtimeResources')?{registerResource(){}}: {info(){},warn(){}}};
 vm.runInNewContext(fs.readFileSync('utils/cache.js','utf8'),sandbox);
 const cache=sandbox.module.exports.hybridCache;
 assert.equal(typeof cache.close,'function');
 let closed=false;const stopping=cache.close().then(()=>{closed=true;});await Promise.resolve();assert.equal(closed,false);
 release();await stopping;assert.equal(disconnected,1);assert.equal(timersClosed,1);assert.equal(cache.redisReady,false);
});
