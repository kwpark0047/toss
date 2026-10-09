const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
test('service worker never registers broad private API response caches',()=>{
 const source=fs.readFileSync('frontend/vite.config.js','utf8');
 assert.equal(source.includes("cacheName: 'wemarket-api'"),false);
 assert.equal(source.includes("cacheName: 'wemarket-api-stale'"),false);
});
