const test=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');
const url=new URL(process.env.P0_TEST_DATABASE_URL||'http://missing');
if(url.hostname!=='127.0.0.1'||url.port!=='55438'||url.pathname!=='/wemarket_p0_schema_test') throw new Error('ISOLATED_TEST_DB_REQUIRED');
process.env.DATABASE_URL=url.href;process.env.DIRECT_URL=url.href;process.env.REPLICA_URL=url.href;
process.env.JWT_SECRET='session-local-fixture';process.env.JWT_REFRESH_SECRET='session-refresh-local-fixture';process.env.NODE_ENV='test';
const db=require('../../config/prisma');const sessions=require('../../services/AuthSessionService');const jwt=require('jsonwebtoken');
test.after(async()=>db.disconnectAll());
async function account(){return db.users.create({data:{password:'fixture-only',email:`${crypto.randomUUID()}@test.invalid`,role:'super_admin'}});}
test('real DB logout revokes access and refresh of the same session',async()=>{
 const user=await account(),pair=await sessions.issue(user);
 const decoded=jwt.verify(pair.token,process.env.JWT_SECRET);await sessions.verifyAccess(decoded);
 await sessions.revoke(pair.token);
 await assert.rejects(sessions.verifyAccess(decoded));await assert.rejects(sessions.rotate(pair.refreshToken));
 await db.users.delete({where:{id:user.id}});
});
test('real DB current role overrides stale administrator JWT and refresh reuse revokes',async()=>{
 const user=await account(),pair=await sessions.issue(user),decoded=jwt.verify(pair.token,process.env.JWT_SECRET);
 await db.users.update({where:{id:user.id},data:{role:'user'}});
 assert.equal((await sessions.verifyAccess(decoded)).role,'user');
 const rotated=await sessions.rotate(pair.refreshToken);assert.notEqual(rotated.refreshToken,pair.refreshToken);
 await assert.rejects(sessions.rotate(pair.refreshToken));await assert.rejects(sessions.verifyAccess(jwt.decode(rotated.token)));
 await db.users.delete({where:{id:user.id}});
});
test('real DB simultaneous refresh has one winner without duplicate credentials',async()=>{
 const user=await account(),pair=await sessions.issue(user);
 const results=await Promise.allSettled([sessions.rotate(pair.refreshToken),sessions.rotate(pair.refreshToken)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 await db.users.delete({where:{id:user.id}});
});
