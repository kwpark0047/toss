const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),express=require('express'),request=require('supertest');
test('signup OTP endpoints exist, normalize formatted phone, validate code, and preserve phone registration contract',async()=>{
 const calls=[];const controllers=new Proxy({}, {get:(_target,name)=>(req,res)=>{calls.push({name,body:req.body});res.json({ok:true});}});
 const native=require('node:module').createRequire(require('node:path').resolve('routes/auth.js'));
 const context={module:{exports:{}},require:name=>name==='../controllers/authController'?controllers:name==='../middleware/auth'?{authMiddleware:(_req,_res,next)=>next()}:name==='../controllers/adminTwoFactorController'?controllers:native(name)};
 vm.runInNewContext(fs.readFileSync('routes/auth.js','utf8'),context);
 const app=express();app.use(express.json());app.use('/api/auth',context.module.exports);
 await request(app).post('/api/auth/send-otp').send({phone:'010-1234-5678'}).expect(200);
 assert.equal(calls.at(-1).body.phone,'01012345678');assert.equal(calls.at(-1).name,'sendOtp');
 await request(app).post('/api/auth/send-otp').send({phone:'bad'}).expect(400);
 await request(app).post('/api/auth/verify-otp').send({phone:'010-1234-5678',otp:'123456'}).expect(200);
 assert.equal(calls.at(-1).name,'verifyOtp');
 await request(app).post('/api/auth/verify-otp').send({phone:'01012345678',otp:'123'}).expect(400);
 await request(app).post('/api/auth/register').send({phone:'010-1234-5678',password:'Secure1234'}).expect(400);
 await request(app).post('/api/auth/register').send({phone:'010-1234-5678',password:'Secure1234',verificationToken:'fixture-only-proof'}).expect(200);
 assert.equal(calls.at(-1).name,'register');assert.equal(calls.at(-1).body.phone,'01012345678');
});
