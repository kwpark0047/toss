// Creates disposable browser fixtures in the named isolated staging DB only.
const fs=require('node:fs'),crypto=require('node:crypto'),bcrypt=require('bcryptjs'),{Client}=require('pg');
const env=require('dotenv').parse(fs.readFileSync('.env.staging.local')),url=new URL(env.DATABASE_URL);
if(url.hostname!=='127.0.0.1'||url.port!=='55438'||url.pathname!=='/wemarket_test_staging_20261010')throw Error('ISOLATED_DB_REQUIRED');
Object.assign(process.env,env,{NODE_ENV:'test',DIRECT_URL:url.href,REPLICA_URL:url.href,GEMINI_API_KEY:'',SMS_API_KEY:'',SMS_API_SECRET:''});
const db=require('../config/prisma'),Support=require('../services/BusinessSupportService'),Worker=require('../services/BusinessSupportWorker');
(async()=>{
 const pg=new Client({connectionString:url.href});await pg.connect();
 try{
  const state=(await pg.query("SELECT to_regclass('public.business_support_cases') AS name")).rows[0];
  if(!state.name)await pg.query(fs.readFileSync('prisma/migrations/20261014010000_business_support/migration.sql','utf8'));
 }finally{await pg.end();}
 const password=crypto.randomBytes(18).toString('base64url'),hashed=await bcrypt.hash(password,10),tag=crypto.randomUUID();
 const platform=await db.users.create({data:{email:`support-platform-${tag}@test.invalid`,password:hashed,name:'지원센터 검증 관리자',role:'super_admin'}});
 const owner=await db.users.create({data:{email:`support-owner-${tag}@test.invalid`,password:hashed,name:'지원센터 검증 사업자',role:'store_admin'}});
 if(platform.id>9999||owner.id>9999)throw Error('FIXTURE_PHONE_ID_RANGE');
 const platformPhone=`0109998${String(platform.id).padStart(4,'0')}`,ownerPhone=`0109999${String(owner.id).padStart(4,'0')}`;
 await db.users.update({where:{id:platform.id},data:{phone:platformPhone}});
 await db.users.update({where:{id:owner.id},data:{phone:ownerPhone}});
 const store=await db.stores.create({data:{user_id:owner.id,name:'격리 지원센터 검증 매장',is_active:true}});
 const product=await db.products.create({data:{store_id:store.id,name:'검증 대표 메뉴',price:5000,is_active:true,is_sold_out:false,stock_quantity:100}});
 await db.products.create({data:{store_id:store.id,name:'검증 품절 메뉴',price:3000,is_active:true,is_sold_out:true,stock_quantity:0}});
 const now=new Date();
 for(const days of [0,7,14,21,28]){
  const at=new Date(now.getTime()-days*86400000);at.setUTCHours(1,0,0,0);
  for(let i=0;i<(days?24:3);i++)await db.orders.create({data:{store_id:store.id,order_number:`SUPPORT-${tag}-${days}-${i}`,status:'completed',payment_status:'paid',total_amount:5000,created_at:at,order_items:{create:{product_id:product.id,product_name:product.name,quantity:1,price:5000,subtotal:5000}}}});
 }
 await db.orders.create({data:{store_id:store.id,order_number:`SUPPORT-${tag}-pending`,status:'pending',payment_status:'pending',total_amount:5000,created_at:new Date(now.getTime()-30*60000)}});
 const service=new Support(db);await service.enroll(store.id,{id:owner.id,role:owner.role},true);
 const worker=new Worker(db);await worker.runBatch({limit:10,concurrency:1});
 const cases=await service.list({id:platform.id,role:platform.role},store.id);
 if(!cases.items.some(c=>c.action_id))throw Error('QR_ACTION_REQUIRED_FOR_E2E');
 fs.writeFileSync('.env.support-browser.local',`SUPPORT_PLATFORM_EMAIL=${platform.email}\nSUPPORT_OWNER_EMAIL=${owner.email}\nSUPPORT_PLATFORM_PHONE=${platformPhone}\nSUPPORT_OWNER_PHONE=${ownerPhone}\nSUPPORT_TEST_PASSWORD=${password}\nSUPPORT_STORE_ID=${store.id}\nSUPPORT_CASE_ID=${cases.items[0].id}\n`);
 console.log(JSON.stringify({prepared:true,isolated:true,storeId:store.id,caseId:cases.items[0].id,realProviderCalls:0,fixturePaidOrdersOnly:true}));
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{await db.disconnectAll();await require('../utils/runtimeResources').closeRuntimeResources();});

