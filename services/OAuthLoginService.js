const crypto = require('node:crypto');
const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const { OAuthProvider } = require('./OAuthProvider');
const { AuthIdentityService } = require('./AuthIdentityService');
const { digest, seal, open } = require('../utils/freeAuthSecrets');
const { browserHash, bucket, activeUser } = require('./FreeAuthStore');
class OAuthLoginService {
  constructor(db = prisma, env = process.env, provider = new OAuthProvider(env)) {
    this.db = db;
    this.env = env;
    this.provider = provider;
    this.identity = new AuthIdentityService(db, env);
  }
  async start({ provider, intent, browserProof, userId = null, sessionId = null, ip = 'unknown' }) {
    if (
      !['login', 'signup', 'link', 'reauth'].includes(intent) ||
      !['google', 'kakao'].includes(provider) ||
      (['link', 'reauth'].includes(intent) && !userId)
    )
      throw new AppError('소셜 인증 요청을 확인해 주세요.', 400);
    const browser = browserHash(browserProof, this.env),
      id = crypto.randomUUID(),
      state = crypto.randomBytes(32).toString('base64url'),
      nonce = crypto.randomBytes(32).toString('base64url'),
      verifier = crypto.randomBytes(48).toString('base64url');
    const url = this.provider.authorization(provider, {
      state,
      nonce,
      verifier,
      reauth: intent === 'reauth',
    });
    const allowed = await this.db.$transaction(async (tx) => {
      if (!(await bucket(tx, digest('oauth-ip', ip, this.env), 30, 900))) return false;
      await tx.$executeRawUnsafe(
        `INSERT INTO auth_oauth_flows(id,provider,state_hash,browser_hash,nonce,verifier_ciphertext,intent,user_id,session_id,expires_at)
    VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9::uuid,now()+interval '10 minutes')`,
        id,
        provider,
        digest('oauth-state', state, this.env),
        browser,
        nonce,
        seal(verifier, id, this.env),
        intent,
        userId,
        sessionId
      );
      return true;
    });
    if (!allowed)
      throw new AppError('소셜 로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.', 429);
    return { url };
  }
  async callback(provider, state, code) {
    if (
      !/^[A-Za-z0-9_-]{43}$/.test(state || '') ||
      typeof code !== 'string' ||
      !code ||
      code.length > 4096
    )
      throw new AppError('소셜 인증 요청을 확인해 주세요.', 400);
    const rows = await this.db.$queryRawUnsafe(
        `UPDATE auth_oauth_flows SET used_at=now() WHERE state_hash=$1 AND provider=$2 AND used_at IS NULL AND expires_at>now() RETURNING *`,
        digest('oauth-state', state, this.env),
        provider
      ),
      row = rows[0];
    if (!row) throw new AppError('소셜 인증 요청이 만료됐거나 이미 사용됐습니다.', 400);
    const profile = await this.provider.exchange(provider, {
      code,
      nonce: row.nonce,
      verifier: open(row.verifier_ciphertext, row.id, this.env),
      reauth: row.intent === 'reauth',
    });
    await this.db.$executeRawUnsafe(
      'UPDATE auth_oauth_flows SET result_ciphertext=$1,verifier_ciphertext=$2 WHERE id=$3::uuid',
      seal(profile, row.id, this.env),
      'consumed',
      row.id
    );
    return row.id;
  }
  async exchange(id, browserProof, actor = null) {
    if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw new AppError('인증 요청을 확인해 주세요.', 400);
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe(
          'SELECT * FROM auth_oauth_flows WHERE id=$1::uuid FOR UPDATE',
          id
        ),
        row = rows[0];
      if (
        !row ||
        row.result_used_at ||
        !row.result_ciphertext ||
        new Date(row.expires_at) <= new Date() ||
        row.browser_hash !== browserHash(browserProof, this.env)
      )
        throw new AppError('인증을 시작한 브라우저에서 다시 로그인해 주세요.', 401);
      if (row.user_id && (!actor || actor.id !== row.user_id || actor.sid !== row.session_id))
        throw new AppError('연결을 시작한 계정으로 다시 로그인해 주세요.', 401);
      const profile = open(row.result_ciphertext, row.id, this.env);
      const user = await this.identity.resolve(
        tx,
        { ...profile, provider: row.provider },
        row.intent,
        row.user_id
      );
      let result;
      if (row.intent === 'link') result = { linked: true };
      else if (row.intent === 'reauth')
        result = await this.identity.loginResult(
          tx,
          await activeUser(tx, user.id),
          browserProof,
          row.session_id
        );
      else result = await this.identity.loginResult(tx, user, browserProof);
      await tx.$executeRawUnsafe(
        'UPDATE auth_oauth_flows SET result_used_at=now(),result_ciphertext=NULL WHERE id=$1::uuid',
        row.id
      );
      return result;
    });
  }
}
module.exports = { OAuthLoginService };
