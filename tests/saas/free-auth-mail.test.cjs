const test=require('node:test'),assert=require('node:assert/strict');
const {AuthMailService}=require('../../services/AuthMailService');
const env={SMTP_HOST:'smtp.example.com',SMTP_PORT:'587',SMTP_USER:'smtp',SMTP_PASSWORD:'secret',MAIL_FROM:'auth@example.com',FRONTEND_URL:'https://wemarket-saas.vercel.app'};
test('SMTP accepts only explicit provider acceptance, with no automatic retry',async()=>{
 let calls=0;const mail=new AuthMailService(env,()=>({sendMail:async()=>{calls++;return {accepted:['target@example.com'],rejected:[]};},close(){}}));
 await mail.send({email:'target@example.com',code:'123456',id:'id',token:'link-token'});assert.equal(calls,1);
 const rejected=new AuthMailService(env,()=>({sendMail:async()=>({accepted:[],rejected:['target@example.com']}),close(){}}));
 await assert.rejects(rejected.send({email:'target@example.com',code:'123456',id:'id',token:'token'}));
});
test('SMTP configuration fails before sending and never logs credentials',async()=>{
 let calls=0;const mail=new AuthMailService({},()=>{calls++;});
 await assert.rejects(mail.send({email:'target@example.com'}),e=>e.statusCode===503);assert.equal(calls,0);
});
test('existing SMTP_FROM works and MAIL_FROM takes precedence',async()=>{
 const {publicConfig}=require('../../utils/freeAuthPolicy');
 const legacy={...env,MAIL_FROM:undefined,SMTP_FROM:'legacy@example.com',FREE_AUTH_ENABLED:'true',TURNSTILE_SITE_KEY:'site',TURNSTILE_SECRET_KEY:'secret',EMAIL_AUTH_PEPPER:'p'.repeat(64)};
 let used;const create=()=>({sendMail:async m=>{used=m.from;return {accepted:['target@example.com']};},close(){}});
 assert.equal(publicConfig(legacy).email,true);
 await new AuthMailService(legacy,create).send({email:'target@example.com',code:'123456',id:'id',token:'token'});assert.equal(used,'legacy@example.com');
 await new AuthMailService({...legacy,MAIL_FROM:'preferred@example.com'},create).send({email:'target@example.com',code:'123456',id:'id',token:'token'});assert.equal(used,'preferred@example.com');
});
