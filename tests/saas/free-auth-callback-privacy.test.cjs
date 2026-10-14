const test=require('node:test'),assert=require('node:assert/strict');
const redact=require('../../middleware/redactAuthCallback');
test('OAuth code/state do not reach URL loggers, while callback can read them',()=>{
 const req={url:'/api/auth/free/oauth/google/callback?code=secret-code&state=secret-state',originalUrl:'/api/auth/free/oauth/google/callback?code=secret-code&state=secret-state'};let next=0;
 redact(req,{},()=>next++);assert.equal(next,1);assert.equal(req.url,'/api/auth/free/oauth/google/callback');assert.equal(req.originalUrl,req.url);assert.equal(req.freeAuthCallback.code,'secret-code');assert.ok(!JSON.stringify(req).includes('secret-code'));
});
