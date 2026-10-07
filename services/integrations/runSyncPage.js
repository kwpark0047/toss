const {assertAdapter,normalizeRecord,fetchPageWithRetry}=require('./providerPipeline');
/** Store must implement lease fencing and atomic page+cursor publication in durable storage. */
async function runSyncPage({adapter,store,job,credentials,signal,retryOptions}) {
 assertAdapter(adapter);
 if(!job || !Number.isSafeInteger(job.storeId) || job.storeId<1 || !job.accountId || !job.owner || adapter.provider!==job.provider)throw new Error('SYNC_AUTHORITY');
 await store.assertLease(job);
 let page;
 try {
  page=await fetchPageWithRetry(adapter,{cursor:job.cursor,window:job.window,credentials,signal},retryOptions);
  const records=page.records.map(raw=>normalizeRecord(adapter.normalize(raw)));
  // Publication implementation must reject a lost lease and roll back all records on conflict.
  return await store.publishPage(job,{records,nextCursor:page.done?null:page.nextCursor,done:page.done});
 } catch(error) {
  // Never persist provider exception messages: they can contain request URLs/tokens/raw PII.
  const status=error.status || error.response?.status;
  await store.recordError(job,{code:/^(CANONICAL_|PROVIDER_|SYNC_)/.test(error.code||'')?error.code:'PROVIDER_FAILURE',requiresReauth:status===401,retryable:status===429 || [500,502,503,504].includes(status)});
  throw error;
 }
}
module.exports={runSyncPage};
