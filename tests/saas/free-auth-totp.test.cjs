const test=require('node:test'),assert=require('node:assert/strict');
const {verifyTotp}=require('../../utils/totp');
test('installed otplib returns valid=false for incorrect tokens; no truthy-result bypass',()=>{
 const otp=require('otplib'),secret=otp.generateSecret(),token=otp.generateSync({secret});
 assert.equal(verifyTotp(token,secret),true);
 assert.equal(verifyTotp('not-a-token',secret),false);
 assert.equal(verifyTotp('000000',secret),token==='000000');
 assert.equal(verifyTotp(token,'invalid secret'),false);
});
