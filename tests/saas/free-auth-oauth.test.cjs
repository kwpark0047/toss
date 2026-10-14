const test=require('node:test'),assert=require('node:assert/strict');
const {verifyOidcToken}=require('../../services/OAuthProvider');
test('OIDC verifies signature, issuer, audience, nonce and verified email',async()=>{
 const {generateKeyPair,exportJWK,SignJWT,createLocalJWKSet}=await import('jose');
 const {privateKey,publicKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);jwk.kid='fixture';
 const keys=createLocalJWKSet({keys:[jwk]});
 const token=await new SignJWT({nonce:'expected',email:'a@example.com',email_verified:true}).setProtectedHeader({alg:'RS256',kid:'fixture'}).setIssuedAt().setSubject('provider-user').setIssuer('https://accounts.google.com').setAudience('client').setExpirationTime('5m').sign(privateKey);
 const options={keys,issuer:'https://accounts.google.com',audience:'client',nonce:'expected'};
 assert.equal((await verifyOidcToken(token,options)).subject,'provider-user');
 for(const patch of [{audience:'foreign-app'},{nonce:'other'},{issuer:'https://evil.example'}])await assert.rejects(verifyOidcToken(token,{...options,...patch}));
 await assert.rejects(verifyOidcToken(token.slice(0,-8)+'tampered',options));
});
