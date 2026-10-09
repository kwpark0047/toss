const test=require('node:test');const assert=require('node:assert/strict');
const {collectCanonicalEvidence}=require('../../services/integrations/canonicalAnalysis');
test('missing canonical database never fails native AI analysis',async()=>{
 const result=await collectCanonicalEvidence({$queryRawUnsafe:async()=>{throw new Error('secret-url');}},3,new Date('2026-10-01'),new Date('2026-10-08'));
 assert.equal(result.status,'unavailable');assert.equal(JSON.stringify(result).includes('secret-url'),false);assert.equal(result.sources.length,0);
});
test('provider evidence retains account, period and sample without claiming combined sales',async()=>{
 let args;
 const db={$queryRawUnsafe:async(...input)=>{args=input;return [{provider:'vendor',account_id:'account',records:2,first_at:'2026-10-02',last_at:'2026-10-07',last_job_id:'job'}];}};
 const result=await collectCanonicalEvidence(db,3,new Date('2026-10-01'),new Date('2026-10-08'));
 assert.equal(args[1],3);assert.equal(result.sources[0].provider,'vendor');assert.equal(result.used_for_revenue,false);assert.equal(result.sources[0].sample_size,2);
});
