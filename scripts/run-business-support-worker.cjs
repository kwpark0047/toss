// Separate process: never start analysis from the order/payment request path.
if(process.env.BUSINESS_SUPPORT_WORKER_ENABLED!=='true'){
  console.error('BUSINESS_SUPPORT_WORKER_ENABLED=true is required; no jobs executed.');process.exitCode=1;
}else{
  const Worker=require('../services/BusinessSupportWorker');
  const db=require('../config/prisma');
  (async()=>{const worker=new Worker();await worker.schedule();console.log(JSON.stringify(await worker.runBatch()));})()
    .catch(()=>{console.error('Business support worker failed');process.exitCode=1;})
    .finally(async()=>{await db.disconnectAll();await require('../utils/runtimeResources').closeRuntimeResources();});
}
