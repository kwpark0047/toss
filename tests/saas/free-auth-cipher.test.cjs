const test=require('node:test'),assert=require('node:assert/strict');
const {seal,open}=require('../../utils/freeAuthSecrets');
const env={EMAIL_AUTH_PEPPER:'cipher-fixture-'.repeat(4)};
test('authentication ciphertext rejects shortened GCM tags and altered context',()=>{
 const sealed=seal({fixture:true},'challenge-fixture',env);
 assert.deepEqual(open(sealed,'challenge-fixture',env),{fixture:true});
 const [iv,tag,data]=sealed.split('.');
 const short=Buffer.from(tag,'base64url').subarray(0,4).toString('base64url');
 assert.throws(()=>open([iv,short,data].join('.'),'challenge-fixture',env));
 assert.throws(()=>open(sealed,'other-context',env));
});
