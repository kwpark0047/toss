const test=require('node:test'),assert=require('node:assert/strict');
const {LegacySocialVerifier}=require('../../services/LegacySocialVerifier');
test('legacy Google access tokens must belong to configured app and return a real subject',async()=>{
 const replies=[{aud:'foreign-app'},{sub:'abc',email:'a@example.com',email_verified:true}];
 const v=new LegacySocialVerifier({GOOGLE_CLIENT_ID:'our-app'},async()=>new Response(JSON.stringify(replies.shift()),{status:200}));
 await assert.rejects(v.verify('google','access-token'),e=>e.statusCode===401);
 const missing=new LegacySocialVerifier({KAKAO_APP_ID:'1'},async()=>new Response(JSON.stringify({app_id:1}),{status:200}));
 await assert.rejects(missing.verify('kakao','access-token'));
});
