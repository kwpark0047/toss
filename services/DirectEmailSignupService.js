const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const sessions = require('./AuthSessionService');
const { AppError } = require('../utils/errorHandler');
const { normalizeEmail, SIGNUP_CONSENT_VERSION } = require('../utils/freeAuthPolicy');
const safeUser = require('../utils/publicUser');

function digest(value, env) {
  // The signing key is already mandatory for login/session issuance. Never persist raw email/IP in abuse buckets.
  const key = env.JWT_SECRET || 'wemarket-signup-rate-limit';
  return crypto.createHmac('sha256', key).update(value).digest('hex');
}

class DirectEmailSignupService {
  constructor(db = prisma, sessionService = sessions, env = process.env) {
    this.db = db;
    this.sessions = sessionService;
    this.env = env;
  }

  async register(input, ip = 'unknown') {
    const email = normalizeEmail(input.email);
    if (input.consentVersion !== SIGNUP_CONSENT_VERSION)
      throw new AppError('가입 동의 내용을 새로 확인해 주세요.', 400);

    try {
      const result = await this.db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout='3000ms'");
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout='8000ms'");
        const keys = [`direct-signup:email:${digest(email, this.env)}`, `direct-signup:ip:${digest(ip, this.env)}`].sort();
        for (const key of keys)
          await tx.$queryRawUnsafe(
            'SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended($1,0))) AS lock_result',
            key
          );

        const limits = await Promise.all([
          this.consumeBucket(tx, digest(`email:${email}`, this.env), 3, 3600),
          this.consumeBucket(tx, digest(`ip:${ip}`, this.env), 20, 3600),
        ]);
        if (limits.some((allowed) => !allowed))
          throw new AppError('가입 요청이 많습니다. 잠시 후 다시 시도해 주세요.', 429);

        const existing = await tx.$queryRawUnsafe(
          'SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1',
          email
        );
        if (existing.length)
          throw new AppError('이미 사용 중인 이메일입니다. 로그인해 주세요.', 409);

        const passwordHash = await bcrypt.hash(input.password, 12);
        const rows = await tx.$queryRawUnsafe(
          `INSERT INTO users(name,email,password,role,profile_step,password_login_enabled,email_verified_at)
           VALUES($1,$2,$3,'user',1,true,NULL) RETURNING *`,
          typeof input.name === 'string' && input.name.trim() ? input.name.trim().slice(0, 100) : '위마켓 회원',
          email,
          passwordHash
        );
        const user = rows[0];
        await tx.$executeRawUnsafe(
          'INSERT INTO auth_account_events(id,user_id,event,operation_id) VALUES($1::uuid,$2,$3,$4::uuid)',
          crypto.randomUUID(),
          user.id,
          `signup:direct-email-unverified:${SIGNUP_CONSENT_VERSION}:terms+privacy:age14`,
          crypto.randomUUID()
        );
        const pair = await this.sessions.issue(user, tx);
        return { ...pair, user: safeUser(user) };
      });
      return result;
    } catch (error) {
      if (error?.code === 'P2002' || error?.code === '23505')
        throw new AppError('이미 사용 중인 이메일입니다. 로그인해 주세요.', 409);
      throw error;
    }
  }

  async consumeBucket(tx, key, limit, seconds) {
    const rows = await tx.$queryRawUnsafe(
      `INSERT INTO auth_abuse_buckets(bucket_key,window_start,hits)
       VALUES($1,to_timestamp(floor(extract(epoch FROM now())/$2::int)*$2::int),1)
       ON CONFLICT(bucket_key,window_start) DO UPDATE SET hits=auth_abuse_buckets.hits+1
       RETURNING hits`,
      key,
      seconds
    );
    return Number(rows[0]?.hits) <= limit;
  }
}

module.exports = { DirectEmailSignupService };

