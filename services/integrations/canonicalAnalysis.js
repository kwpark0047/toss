async function collectCanonicalEvidence(db,storeId,start,end) {
 const period={start:start.toISOString(),end:end.toISOString()};
 try {
  const rows=await db.$queryRawUnsafe(`WITH latest AS (
    SELECT DISTINCT ON(r.account_id,r.entity,r.external_id) r.* FROM external_canonical_records r
    WHERE r.store_id=$1 ORDER BY r.account_id,r.entity,r.external_id,r.version DESC
  ) SELECT a.provider,r.account_id,COUNT(*)::int AS records,MIN(r.occurred_at) AS first_at,MAX(r.occurred_at) AS last_at,
    (array_agg(r.job_id ORDER BY r.created_at DESC))[1] AS last_job_id
    FROM latest r JOIN external_sync_accounts a ON a.id=r.account_id AND a.store_id=r.store_id
    WHERE r.occurred_at>=$2::timestamptz AND r.occurred_at<$3::timestamptz
    GROUP BY a.provider,r.account_id`,storeId,start,end);
  return {status:rows.length?'available':'insufficient_data',period,used_for_revenue:false,
   reason:'External/native reconciliation and menu mapping must be verified before combined recommendations.',
   sources:rows.map(r=>({provider:r.provider,account_id:r.account_id,period,sample_size:Number(r.records),first_at:r.first_at,last_at:r.last_at,sync_job_id:r.last_job_id}))};
 } catch {
  return {status:'unavailable',period,used_for_revenue:false,sources:[],reason:'Canonical source unavailable; native order analysis remains available.'};
 }
}
module.exports={collectCanonicalEvidence};
