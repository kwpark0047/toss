const crypto = require('node:crypto');
const { AppError } = require('../utils/errorHandler');
const { digest } = require('../utils/freeAuthSecrets');
async function lock(tx, ...keys) {
  await tx.$executeRawUnsafe("SET LOCAL lock_timeout='3000ms'");
  await tx.$executeRawUnsafe("SET LOCAL statement_timeout='8000ms'");
  for (const value of [...new Set(keys)].sort())
    await tx.$queryRawUnsafe(
      'SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended($1,0))) AS l',
      value
    );
}
async function bucket(tx, key, limit, seconds = 3600) {
  const rows = await tx.$queryRawUnsafe(
    `INSERT INTO auth_abuse_buckets(bucket_key,window_start,hits)
 VALUES($1,to_timestamp(floor(extract(epoch FROM now())/$2::int)*$2::int),1)
 ON CONFLICT(bucket_key,window_start) DO UPDATE SET hits=auth_abuse_buckets.hits+1 RETURNING hits`,
    key,
    seconds
  );
  return rows[0].hits <= limit;
}
async function activeUser(tx, id) {
  const rows = await tx.$queryRawUnsafe('SELECT * FROM users WHERE id=$1 FOR UPDATE', id);
  const user = rows[0];
  if (!user || user.auth_status !== 'active') throw new AppError('로그인이 필요합니다.', 401);
  return user;
}
function browserHash(proof, env) {
  if (typeof proof !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(proof))
    throw new AppError('인증을 시작한 브라우저에서 다시 진행해 주세요.', 400);
  return digest('browser', proof, env);
}
async function recentProof(tx, user, sessionId, env) {
  const token = crypto.randomBytes(32).toString('base64url');
  await tx.$executeRawUnsafe(
    "INSERT INTO auth_recent_proofs(proof_hash,user_id,session_id,expires_at) VALUES($1,$2,$3::uuid,now()+interval '5 minutes')",
    digest('recent', token, env),
    user.id,
    sessionId
  );
  return { reauthProof: token, expiresIn: 300 };
}
async function consumeProof(tx, userId, sessionId, proof, env) {
  if (typeof proof !== 'string' || proof.length > 128)
    throw new AppError('최근 본인 인증이 필요합니다.', 403);
  const rows = await tx.$queryRawUnsafe(
    'UPDATE auth_recent_proofs SET used_at=now() WHERE proof_hash=$1 AND user_id=$2 AND session_id=$3::uuid AND used_at IS NULL AND expires_at>now() AND EXISTS(SELECT 1 FROM auth_sessions s WHERE s.id=$3::uuid AND s.user_id=$2 AND s.revoked_at IS NULL AND s.expires_at>now()) RETURNING user_id',
    digest('recent', proof, env),
    userId,
    sessionId
  );
  if (rows.length !== 1) throw new AppError('최근 본인 인증이 필요합니다.', 403);
}
module.exports = { lock, bucket, activeUser, browserHash, recentProof, consumeProof };
