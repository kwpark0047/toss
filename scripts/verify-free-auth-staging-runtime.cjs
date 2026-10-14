const fs=require('node:fs'),assert=require('node:assert/strict'),dotenv=require('dotenv');
const staging=dotenv.parse(fs.readFileSync('.env.staging.local')),url=new URL(staging.DATABASE_URL);
if(url.hostname!=='127.0.0.1'||url.port!=='55438'||url.pathname!=='/wemarket_test_staging_20261010')throw Error('ISOLATED_STAGING_REQUIRED');
const fixtures=dotenv.parse(fs.readFileSync('.env.role-browser.local')),origin='http://127.0.0.1:5300/api';
async function request(path,method='GET',body,token){
 const response=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
 const json=await response.json().catch(()=>({}));return {status:response.status,data:json.data||json};
}
(async()=>{
 const health=await request('/health');assert.equal(health.status,200);
 const config=await request('/auth/free/config');assert.equal(config.status,200);assert.equal(config.data.enabled,false);
 const results=[];
 for(const kind of ['OWNER','MANAGER','KITCHEN']){
  assert.ok(fixtures[kind+'_PHONE']&&fixtures.PASSWORD);
  const login=await request('/auth/login','POST',{identifier:fixtures[kind+'_PHONE'],password:fixtures.PASSWORD});assert.equal(login.status,200,kind+' login');assert.ok(login.data.token);
  const me=await request('/auth/me','GET',null,login.data.token);assert.equal(me.status,200,kind+' session');
  const logout=await request('/auth/logout','POST',{refreshToken:login.data.refreshToken},login.data.token);assert.equal(logout.status,200,kind+' logout');
  const revoked=await request('/auth/me','GET',null,login.data.token);assert.equal(revoked.status,401,kind+' revoked');
  results.push({fixture:kind,login:login.status,me:me.status,logout:logout.status,revoked:revoked.status});
 }
 console.log(JSON.stringify({staging:true,operating:false,health:health.status,newEnrollmentEnabled:false,externalEmails:0,results}));
})().catch(()=>{console.error('STAGING_RUNTIME_AUTH_VERIFICATION_FAILED');process.exitCode=1;});
