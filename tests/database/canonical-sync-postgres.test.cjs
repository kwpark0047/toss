const test=require('node:test');const assert=require('node:assert/strict');const crypto=require('crypto');
const {Pool}=require('pg');const SyncStore=require('../../services/integrations/SyncStore');const {normalizeRecord}=require('../../services/integrations/providerPipeline');
const url=process.env.P0_TEST_DATABASE_URL;
if(!url || new URL(url).hostname!=='127.0.0.1' || new URL(url).port!=='55438' || new URL(url).pathname!=='/wemarket_p0_schema_test')throw new Error('ISOLATED_TEST_DB_REQUIRED');
test('real PG fences leases, detects conflicts and rolls checkpoint back',async()=>{
 const pool=new Pool({connectionString:url});const client=await pool.connect();
 const db={$queryRawUnsafe:async(sql,...args)=>(await client.query(sql,args)).rows,$executeRawUnsafe:async(sql,...args)=>(await client.query(sql,args)).rowCount,$transaction:async fn=>{await client.query('SAVEPOINT publish');try {const result=await fn(db);await client.query('RELEASE SAVEPOINT publish');return result;}catch(e){await client.query('ROLLBACK TO SAVEPOINT publish');throw e;}}};
 try {
 await client.query('BEGIN');const stores=(await client.query('SELECT id FROM stores ORDER BY id LIMIT 2')).rows;assert.equal(stores.length,2);
 const storeId=stores[0].id,foreignStore=stores[1].id,connection=crypto.randomUUID(),account=crypto.randomUUID(),id=crypto.randomUUID(),owner=crypto.randomUUID();
 await client.query("INSERT INTO integration_connections(id,store_id,channel,provider,name,method) VALUES($1,$2,'pos','test-only','test','api')",[connection,storeId]);
 await assert.rejects(db.$transaction(tx=>tx.$executeRawUnsafe("INSERT INTO external_sync_accounts(id,store_id,connection_id,provider) VALUES($1,$2,$3,'test-only')",crypto.randomUUID(),foreignStore,connection)),e=>e.code==='23503');
 await client.query("INSERT INTO external_sync_accounts(id,store_id,connection_id,provider) VALUES($1,$2,$3,'test-only')",[account,storeId,connection]);
 await client.query("INSERT INTO external_sync_jobs(id,account_id,store_id,status,owner,lease_until,window_start,window_end) VALUES($1,$2,$3,'running',$4,now()+interval '2 minutes',now()-interval '1 day',now())",[id,account,storeId,owner]);
 const job={id,accountId:account,storeId,owner,window:{end:new Date().toISOString()}};const service=new SyncStore(db);
 const record=normalizeRecord({entity:'Order',external_id:'order',version:1,occurred_at:new Date().toISOString(),data:{amount:1000,refund_amount:0,status:'paid'}});
 await assert.rejects(service.publishPage({...job,owner:crypto.randomUUID()},{records:[record],done:true,nextCursor:null}),/LEASE_LOST/);
 await service.publishPage(job,{records:[record],done:false,nextCursor:'page-2'});
 await client.query("UPDATE external_sync_jobs SET status='running',owner=$1,lease_until=now()+interval '2 minutes' WHERE id=$2",[owner,id]);
 await assert.rejects(service.publishPage(job,{records:[{...record,hash:'different'}],done:true,nextCursor:null}),/VERSION_CONFLICT/);
 const row=(await client.query('SELECT cursor,pages,status FROM external_sync_jobs WHERE id=$1',[id])).rows[0];assert.equal(row.cursor,'page-2');assert.equal(row.pages,1);assert.equal(row.status,'running');
 await service.publishPage(job,{records:[record],done:true,nextCursor:null});
 assert.equal((await client.query('SELECT count(*)::int AS n FROM external_canonical_records WHERE account_id=$1',[account])).rows[0].n,1);
 assert.equal((await client.query('SELECT count(*)::int AS n FROM external_sync_cursors WHERE account_id=$1',[account])).rows[0].n,1);
 }finally {await client.query('ROLLBACK');client.release();await pool.end();}
});
