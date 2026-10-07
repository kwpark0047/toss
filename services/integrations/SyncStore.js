const crypto=require('crypto');
function tenant(id){if(!Number.isSafeInteger(id)||id<1||id>2147483647)throw new Error('SYNC_TENANT');return id;}
class SyncStore {
 constructor(db){this.db=db;}
 async history(storeId){return this.db.$queryRawUnsafe(`SELECT j.id,j.account_id,a.provider,j.status,j.attempts,j.pages,j.window_start,j.window_end,j.created_at,j.completed_at,a.verified_at FROM external_sync_jobs j JOIN external_sync_accounts a ON a.id=j.account_id AND a.store_id=j.store_id WHERE j.store_id=$1 ORDER BY j.created_at DESC LIMIT 100`,tenant(storeId));}
 async assertLease(job,db=this.db,lock=false){
  const rows=await db.$queryRawUnsafe(`SELECT id FROM external_sync_jobs WHERE id=$1::uuid AND store_id=$2 AND account_id=$3::uuid AND owner=$4::uuid AND status='running' AND lease_until>now() ${lock?'FOR UPDATE':''}`,job.id,tenant(job.storeId),job.accountId,job.owner);
  if(!rows.length)throw new Error('SYNC_LEASE_LOST');
 }
 async publishPage(job,page){return this.db.$transaction(async tx=>{
  await this.assertLease(job,tx,true);
  for(const record of page.records){
   const existing=await tx.$queryRawUnsafe(`SELECT payload_hash FROM external_canonical_records WHERE account_id=$1::uuid AND store_id=$2 AND entity=$3 AND external_id=$4 AND version=$5`,job.accountId,job.storeId,record.entity,record.external_id,record.version);
   if(existing.length){if(existing[0].payload_hash!==record.hash)throw new Error('CANONICAL_VERSION_CONFLICT');continue;}
   await tx.$executeRawUnsafe(`INSERT INTO external_canonical_records(account_id,store_id,entity,external_id,version,occurred_at,data,payload_hash,job_id) VALUES($1::uuid,$2,$3,$4,$5,$6::timestamptz,$7::jsonb,$8,$9::uuid)`,job.accountId,job.storeId,record.entity,record.external_id,record.version,record.occurred_at,JSON.stringify(record.data),record.hash,job.id);
  }
  await tx.$executeRawUnsafe(`UPDATE external_sync_jobs SET cursor=$1,pages=pages+1,status=$2,owner=NULL,lease_until=NULL,completed_at=CASE WHEN $3 THEN now() ELSE NULL END WHERE id=$4::uuid AND store_id=$5`,page.nextCursor,page.done?'completed':'queued',page.done,job.id,job.storeId);
  if(page.done)await tx.$executeRawUnsafe(`INSERT INTO external_sync_cursors(account_id,store_id,cursor,synced_until) VALUES($1::uuid,$2,NULL,$3::timestamptz) ON CONFLICT(account_id) DO UPDATE SET synced_until=GREATEST(external_sync_cursors.synced_until,EXCLUDED.synced_until),updated_at=now()`,job.accountId,job.storeId,job.window.end);
  return {published:page.records.length,done:page.done};
 });}
 async recordError(job,error){return this.db.$transaction(async tx=>{
  await this.assertLease(job,tx,true);
  await tx.$executeRawUnsafe(`INSERT INTO external_sync_errors(id,job_id,store_id,code,retryable) VALUES($1::uuid,$2::uuid,$3,$4,$5)`,crypto.randomUUID(),job.id,job.storeId,error.code,error.retryable);
  await tx.$executeRawUnsafe(`UPDATE external_sync_jobs SET status=CASE WHEN $1 AND attempts<8 THEN 'retry' ELSE 'failed' END,owner=NULL,lease_until=NULL,next_attempt_at=now()+LEAST(3600,power(2,LEAST(attempts,10))*15)*interval '1 second' WHERE id=$2::uuid AND store_id=$3`,error.retryable,job.id,job.storeId);
  if(error.requiresReauth)await tx.$executeRawUnsafe(`UPDATE external_sync_accounts SET state='reauth_required',verified_at=NULL WHERE id=$1::uuid AND store_id=$2`,job.accountId,job.storeId);
 });}
}
module.exports=SyncStore;
