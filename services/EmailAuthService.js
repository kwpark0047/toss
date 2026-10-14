const crypto = require('node:crypto');
const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const { normalizeEmail } = require('../utils/freeAuthPolicy');
const { digest, seal, open } = require('../utils/freeAuthSecrets');
const { lock, bucket, browserHash } = require('./FreeAuthStore');
const { AuthMailService } = require('./AuthMailService');
class EmailAuthService {
  constructor(db = prisma, mail = new AuthMailService(), env = process.env) {
    this.db = db;
    this.mail = mail;
    this.env = env;
  }
  async request({
    email: input,
    purpose,
    browserProof,
    userId = null,
    sessionId = null,
    ip = 'unknown',
  }) {
    const email = normalizeEmail(input),
      browser = browserHash(browserProof, this.env);
    if (
      !['signup', 'login', 'link', 'reauth'].includes(purpose) ||
      (['link', 'reauth'].includes(purpose) && !userId)
    )
      throw new AppError('인증 요청을 확인해 주세요.', 400);
    if (!this.mail.configured()) throw new AppError('이메일 발송 설정이 필요합니다.', 503);
    const id = crypto.randomUUID(),
      code = String(crypto.randomInt(100000, 1000000)),
      token = crypto.randomBytes(32).toString('base64url');
    const outcome = await this.db.$transaction(async (tx) => {
      await lock(tx, `email:${email}`, 'email-budget');
      const latest = await tx.$queryRawUnsafe(
        'SELECT created_at FROM auth_email_challenges WHERE email=$1 ORDER BY created_at DESC LIMIT 1',
        email
      );
      if (latest[0] && Date.now() - new Date(latest[0].created_at).getTime() < 60000)
        return { error: 429 };
      const limits = [
        await bucket(tx, digest('email-rate', email, this.env), 5),
        await bucket(tx, digest('ip-rate', ip, this.env), 20),
        await bucket(
          tx,
          'email-global',
          Math.min(1000, Math.max(1, Number(this.env.AUTH_EMAIL_DAILY_BUDGET) || 80)),
          86400
        ),
      ];
      if (limits.some((ok) => !ok)) return { error: 429 };
      await tx.$executeRawUnsafe(
        'UPDATE auth_email_challenges SET used_at=now(),dispatch_payload=NULL WHERE email=$1 AND used_at IS NULL',
        email
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO auth_email_challenges(id,email,purpose,user_id,browser_hash,otp_hash,link_hash,expires_at,dispatch_payload,session_id)
    VALUES($1::uuid,$2,$3,$4,$5,$6,$7,now()+interval '10 minutes',$8,$9::uuid)`,
        id,
        email,
        purpose,
        userId,
        browser,
        digest('email-otp', `${id}:${code}`, this.env),
        digest('email-link', `${id}:${token}`, this.env),
        seal({ email, code, id, token }, id, this.env),
        sessionId
      );
      return { id };
    });
    if (outcome.error) throw new AppError('요청이 많습니다. 잠시 후 다시 시도해 주세요.', 429);
    await this.dispatch(id);
    return {
      challengeId: id,
      expiresIn: 300,
      message: '인증 가능한 주소라면 이메일이 접수됩니다. 메일함을 확인해 주세요.',
      accepted: true,
      delivered: false,
    };
  }
  async dispatch(id) {
    const rows = await this.db.$queryRawUnsafe(
      `UPDATE auth_email_challenges SET dispatch_state='sending',dispatch_started_at=now()
   WHERE id=$1::uuid AND dispatch_state='pending' AND used_at IS NULL AND expires_at>now() RETURNING dispatch_payload`,
      id
    );
    if (rows.length !== 1) return { claimed: false };
    try {
      await this.mail.send(open(rows[0].dispatch_payload, id, this.env));
      await this.db.$executeRawUnsafe(
        "UPDATE auth_email_challenges SET dispatch_state='accepted',dispatch_payload=NULL WHERE id=$1::uuid AND dispatch_state='sending'",
        id
      );
      return { accepted: true };
    } catch {
      await this.db
        .$executeRawUnsafe(
          "UPDATE auth_email_challenges SET dispatch_state='uncertain',dispatch_payload=NULL WHERE id=$1::uuid AND dispatch_state='sending'",
          id
        )
        .catch(() => {});
      throw new AppError(
        '이메일 처리 결과를 확인하지 못했습니다. 도착 여부를 확인하고 1분 뒤 다시 요청해 주세요.',
        503
      );
    }
  }
  async verify({ id, code, token, browserProof }, complete) {
    if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw new AppError('인증 요청을 확인해 주세요.', 400);
    const browser = browserHash(browserProof, this.env);
    const outcome = await this.db.$transaction(async (tx) => {
      const hint = await tx.$queryRawUnsafe(
        'SELECT email FROM auth_email_challenges WHERE id=$1::uuid',
        id
      );
      if (!hint[0]) return { error: true };
      await lock(tx, `email:${hint[0].email}`);
      const rows = await tx.$queryRawUnsafe(
          'SELECT * FROM auth_email_challenges WHERE id=$1::uuid FOR UPDATE',
          id
        ),
        row = rows[0];
      if (
        !row ||
        row.browser_hash !== browser ||
        row.used_at ||
        new Date(row.expires_at) <= new Date() ||
        row.attempts >= 5
      )
        return { error: true };
      const viaLink = typeof token === 'string';
      const validFormat = viaLink ? /^[A-Za-z0-9_-]{43}$/.test(token) : /^\d{6}$/.test(code || '');
      const actual = digest(
          viaLink ? 'email-link' : 'email-otp',
          `${id}:${viaLink ? token : code}`,
          this.env
        ),
        expected = viaLink ? row.link_hash : row.otp_hash;
      const expiredOtp = !viaLink && Date.now() - new Date(row.created_at).getTime() >= 300000;
      if (
        !validFormat ||
        expiredOtp ||
        !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
      ) {
        await tx.$executeRawUnsafe(
          'UPDATE auth_email_challenges SET attempts=attempts+1 WHERE id=$1::uuid',
          id
        );
        return { error: true };
      }
      const result = await complete(tx, row);
      await tx.$executeRawUnsafe(
        'UPDATE auth_email_challenges SET used_at=now(),dispatch_payload=NULL WHERE id=$1::uuid',
        id
      );
      return { result };
    });
    if (outcome.error) throw new AppError('인증번호·링크가 만료됐거나 일치하지 않습니다.', 400);
    return outcome.result;
  }
  async recover() {
    // Crashed sends are uncertain, never automatically replayed through SMTP.
    return this.db.$executeRawUnsafe(
      "UPDATE auth_email_challenges SET dispatch_state='uncertain',dispatch_payload=NULL WHERE dispatch_state='sending' AND dispatch_started_at<now()-interval '1 minute'"
    );
  }
}
module.exports = { EmailAuthService };
