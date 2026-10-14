// Explicit opt-in; never sends mail or replays uncertain SMTP deliveries.
if(process.env.FREE_AUTH_MAINTENANCE_ENABLED!=='true')throw Error('FREE_AUTH_MAINTENANCE_ENABLED_REQUIRED');
const db=require('../config/prisma');
async function maintain(){
 return db.$transaction(async tx=>{
  await tx.$executeRawUnsafe("SET LOCAL statement_timeout='10s'");
  const uncertain=await tx.$executeRawUnsafe("UPDATE auth_email_challenges SET dispatch_state='uncertain',dispatch_payload=NULL WHERE dispatch_state='sending' AND dispatch_started_at<now()-interval '1 minute'");
  const email=await tx.$executeRawUnsafe("DELETE FROM auth_email_challenges WHERE expires_at<now()-interval '7 days'");
  const oauth=await tx.$executeRawUnsafe("DELETE FROM auth_oauth_flows WHERE expires_at<now()-interval '1 day'");
  const mfa=await tx.$executeRawUnsafe("DELETE FROM auth_mfa_challenges WHERE expires_at<now()-interval '1 day'");
  const proofs=await tx.$executeRawUnsafe("DELETE FROM auth_recent_proofs WHERE expires_at<now()-interval '1 day'");
  const buckets=await tx.$executeRawUnsafe("DELETE FROM auth_abuse_buckets WHERE window_start<now()-interval '2 days'");
  return {uncertain,email,oauth,mfa,proofs,buckets};
 });
}
maintain().then(result=>console.log(JSON.stringify(result))).catch(()=>{console.error('FREE_AUTH_MAINTENANCE_FAILED');process.exitCode=1;}).finally(()=>db.disconnectAll());
