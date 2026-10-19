const test=require('node:test'),assert=require('node:assert/strict');
const {normalizeEmail,publicConfig,assertProviderProfile,assertSignupConsent}=require('../../utils/freeAuthPolicy');
const {TurnstileVerifier}=require('../../services/TurnstileVerifier');
test('email canonicalization does not merge Gmail dots or plus tags',()=>{
 assert.equal(normalizeEmail(' Test.Name+tag@EXAMPLE.com '),'test.name+tag@example.com');
 for(const x of ['', 'a@', 'a\r\nb@example.com', 'a'.repeat(400)+'@example.com']) assert.throws(()=>normalizeEmail(x));
});
test('public config defaults disabled and never exposes credentials',()=>{
 assert.equal(publicConfig({}).enabled,false);
 const env={FREE_AUTH_ENABLED:'true',GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'secret',TURNSTILE_SITE_KEY:'site',TURNSTILE_SECRET_KEY:'turn-secret',EMAIL_AUTH_PEPPER:'fixture-pepper-'.repeat(3),NODE_ENV:'production'};
 const config=publicConfig(env);assert.equal(config.google,true);assert.equal(config.kakao,false);
 assert.ok(!JSON.stringify(config).includes('turn-secret'));assert.ok(!JSON.stringify(config).includes('"secret"'));
});
test('simple signup is independently enabled without turning on OAuth or email OTP',()=>{
 const env={FREE_AUTH_SIMPLE_SIGNUP_ENABLED:'true',TURNSTILE_SITE_KEY:'site',TURNSTILE_SECRET_KEY:'turn-secret',FRONTEND_URL:'https://wemarket-saas.vercel.app',NODE_ENV:'production',FREE_AUTH_TERMS_URL:'https://wemarket-saas.vercel.app/platform/terms',FREE_AUTH_PRIVACY_URL:'https://wemarket-saas.vercel.app/platform/privacy'};
 assert.equal(publicConfig(env).simpleSignup,true);
 assert.equal(publicConfig(env).enabled,false);
 assert.equal(publicConfig(env).google,false);
 assert.equal(publicConfig(env).email,false);
 assert.equal(publicConfig({...env,TURNSTILE_SECRET_KEY:''}).simpleSignup,false);
 assert.equal(publicConfig({...env,FREE_AUTH_SIMPLE_SIGNUP_ENABLED:'false'}).simpleSignup,false);
 assert.equal(publicConfig({...env,FREE_AUTH_PRIVACY_URL:'https://other.example/privacy'}).simpleSignup,false);
});
test('signup consent requires both policies and an explicit age-14+ confirmation',()=>{
 const config={termsUrl:'https://wemarket-saas.vercel.app/platform/terms',privacyUrl:'https://wemarket-saas.vercel.app/platform/privacy'};
 const base={purpose:'signup',agreeTerms:true,agreePrivacy:true,confirmAge14:true};
 assert.throws(()=>assertSignupConsent({...base,confirmAge14:false},config));
 assert.throws(()=>assertSignupConsent({...base,agreeTerms:false},config));
 assert.throws(()=>assertSignupConsent({...base,agreePrivacy:false},config));
 assert.doesNotThrow(()=>assertSignupConsent(base,config));
 assert.throws(()=>assertSignupConsent(base,{...config,privacyUrl:null}));
});
test('invalid provider subjects and unverified email are not identity evidence',()=>{
 assert.throws(()=>assertProviderProfile({sub:undefined}));assert.throws(()=>assertProviderProfile({sub:'undefined'}));
 assert.equal(assertProviderProfile({sub:'123',email:'a@example.com',email_verified:false}).email,null);
});
test('Turnstile fails closed on missing token, wrong host/action and provider timeout',async()=>{
 const env={NODE_ENV:'production',TURNSTILE_SECRET_KEY:'secret',FRONTEND_URL:'https://wemarket-saas.vercel.app'};
 const v=new TurnstileVerifier(env,async()=>({ok:true,json:async()=>({success:true,hostname:'evil.example',action:'signup'})}));
 await assert.rejects(v.verify('', 'signup'));
 await assert.rejects(v.verify('token','signup'));
 const ok=new TurnstileVerifier(env,async()=>({ok:true,json:async()=>({success:true,hostname:'wemarket-saas.vercel.app',action:'signup'})}));
 await ok.verify('token','signup');await assert.rejects(ok.verify('token','login'));
 const offline=new TurnstileVerifier(env,async()=>{throw Error('network secret detail');});
 await assert.rejects(offline.verify('token','signup'),e=>e.statusCode===503&&!e.message.includes('secret'));
});

