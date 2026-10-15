const test=require('node:test'),assert=require('node:assert/strict');
const {verifySmtp}=require('../../scripts/verify-smtp-connection.cjs');
const env={SMTP_FROM:'sender@example.com',SMTP_HOST:'smtp.invalid',SMTP_USER:'fixture',SMTP_PASSWORD:'fixture'};
test('SMTP check requires explicit send, uses TLS and never claims delivery',async()=>{
 let mails=0;const create=options=>{assert.equal(options.tls.rejectUnauthorized,true);assert.equal(options.requireTLS,true);return {verify:async()=>true,sendMail:async data=>{mails++;assert.equal(data.to,'target@example.com');return {accepted:['target@example.com']};},close(){}};};
 assert.equal((await verifySmtp(env,{recipient:'target@example.com'},create)).sent,false);assert.equal(mails,0);
 const result=await verifySmtp(env,{recipient:'target@example.com',send:true},create);assert.equal(mails,1);assert.equal(result.providerAccepted,true);assert.equal(result.delivered,false);assert.equal(result.authenticationFlowVerified,false);
});
test('SMTP authentication failure stops before mail, without automatic retry',async()=>{
 let attempts=0,mails=0;await assert.rejects(verifySmtp(env,{recipient:'target@example.com',send:true},()=>({verify:async()=>{attempts++;throw Error('controlled-failure');},sendMail:async()=>{mails++;},close(){}})));assert.equal(attempts,1);assert.equal(mails,0);
});
