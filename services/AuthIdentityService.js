const crypto = require('node:crypto'),
  bcrypt = require('bcryptjs'),
  jwt = require('jsonwebtoken');
const prisma = require('../config/prisma'),
  sessions = require('./AuthSessionService');
const { AppError } = require('../utils/errorHandler');
const { lock, activeUser, browserHash, recentProof, bucket } = require('./FreeAuthStore');
const { digest } = require('../utils/freeAuthSecrets');
const safeUser = require('../utils/publicUser');
class AuthIdentityService {
  constructor(db = prisma, env = process.env) {
    this.db = db;
    this.env = env;
  }
  async resolve(
    tx,
    { provider, subject, email = null, name = '위마켓 회원' },
    intent,
    userId = null
  ) {
    await lock(
      tx,
      ...[email ? `email:${email}` : null, `identity:${provider}:${subject}`].filter(Boolean)
    );
    const identities = await tx.$queryRawUnsafe(
      'SELECT user_id FROM social_accounts WHERE provider=$1 AND provider_id=$2',
      provider,
      subject
    );
    if (identities[0]) {
      if (userId && identities[0].user_id !== userId)
        throw new AppError('다른 계정에 연결된 인증 수단입니다.', 409);
      const user = await activeUser(tx, identities[0].user_id);
      // Unlink holds this user lock: recheck after waiting so a removed identity
      // cannot authorize a new session from an earlier MVCC snapshot.
      const current = await tx.$queryRawUnsafe(
        'SELECT user_id FROM social_accounts WHERE provider=$1 AND provider_id=$2',
        provider,
        subject
      );
      if (current[0]?.user_id !== user.id)
        throw new AppError('인증 수단 연결이 변경되었습니다. 다시 로그인해 주세요.', 409);
      return user;
    }
    const conflicts = email
      ? await tx.$queryRawUnsafe('SELECT id FROM users WHERE lower(email)=lower($1)', email)
      : [];
    if (conflicts.some((row) => row.id !== userId))
      throw new AppError('기존 계정으로 로그인한 뒤 인증 수단을 연결해 주세요.', 409);
    if (intent === 'login' || intent === 'reauth')
      throw new AppError(
        '연결된 계정이 없습니다. 기존 방식으로 로그인하거나 회원가입을 진행해 주세요.',
        409
      );
    let user;
    if (intent === 'link') {
      if (!userId) throw new AppError('로그인이 필요합니다.', 401);
      user = await activeUser(tx, userId);
    } else {
      const password = await bcrypt.hash(crypto.randomBytes(48).toString('base64url'), 10);
      const rows = await tx.$queryRawUnsafe(
        `INSERT INTO users(name,email,password,role,profile_step,password_login_enabled,email_verified_at)
    VALUES($1,$2,$3,'user',1,false,CASE WHEN $2::text IS NULL THEN NULL ELSE now() END) RETURNING *`,
        name,
        email,
        password
      );
      user = rows[0];
      await tx.$executeRawUnsafe(
        'INSERT INTO auth_account_events(id,user_id,event,operation_id) VALUES($1::uuid,$2,$3,$4::uuid)',
        crypto.randomUUID(),
        user.id,
        'signup:terms-privacy-v1',
        crypto.randomUUID()
      );
    }
    await tx.$executeRawUnsafe(
      `INSERT INTO social_accounts(user_id,provider,provider_id,email,name,updated_at) VALUES($1,$2,$3,$4,$5,now())`,
      user.id,
      provider,
      subject,
      email,
      name
    );
    if (intent === 'link' && email && (!user.email || user.email.toLowerCase() === email)) {
      await tx.$executeRawUnsafe(
        'UPDATE users SET email=$1,email_verified_at=now() WHERE id=$2',
        email,
        user.id
      );
      user = { ...user, email, email_verified_at: new Date() };
    }
    return user;
  }
  async loginResult(tx, user, browserProof, reauthSession = null) {
    if (user.two_factor_enabled) {
      const id = crypto.randomUUID();
      await tx.$executeRawUnsafe(
        "INSERT INTO auth_mfa_challenges(id,user_id,browser_hash,expires_at,purpose,session_id) VALUES($1::uuid,$2,$3,now()+interval '5 minutes',$4,$5::uuid)",
        id,
        user.id,
        browserHash(browserProof, this.env),
        reauthSession ? 'reauth' : 'login',
        reauthSession
      );
      return {
        twoFactorRequired: true,
        tempToken: jwt.sign({ type: 'free_mfa', id: user.id, jti: id }, this.env.JWT_SECRET, {
          algorithm: 'HS256',
          audience: 'wemarket-free-auth',
          expiresIn: '5m',
        }),
      };
    }
    if (reauthSession) return recentProof(tx, user, reauthSession, this.env);
    return { ...(await sessions.issue(user, tx)), user: safeUser(user) };
  }
  async emailResult(tx, row, browserProof, sessionId = null) {
    const user = await this.resolve(
      tx,
      { provider: 'email', subject: row.email, email: row.email },
      row.purpose,
      row.user_id
    );
    if (row.purpose === 'link') return { linked: true };
    if (row.purpose === 'reauth') {
      if (!sessionId) throw new AppError('로그인이 필요합니다.', 401);
      return this.loginResult(tx, user, browserProof, sessionId);
    }
    return this.loginResult(tx, user, browserProof);
  }
  async completeMfa(tempToken, code, browserProof) {
    let claims;
    try {
      claims = jwt.verify(tempToken, this.env.JWT_SECRET, {
        algorithms: ['HS256'],
        audience: 'wemarket-free-auth',
      });
    } catch {
      throw new AppError('2단계 인증을 다시 시작해 주세요.', 401);
    }
    if (claims.type !== 'free_mfa' || !Number.isInteger(claims.id))
      throw new AppError('2단계 인증을 다시 시작해 주세요.', 401);
    const outcome = await this.db.$transaction(async (tx) => {
      const user = await activeUser(tx, claims.id);
      const rows = await tx.$queryRawUnsafe(
          'SELECT * FROM auth_mfa_challenges WHERE id=$1::uuid FOR UPDATE',
          claims.jti
        ),
        row = rows[0];
      if (
        !row ||
        row.user_id !== user.id ||
        row.used_at ||
        row.attempts >= 5 ||
        new Date(row.expires_at) <= new Date() ||
        row.browser_hash !== browserHash(browserProof, this.env)
      )
        return null;
      let valid = false;
      if (user.two_factor_secret)
        valid = require('../utils/totp').verifyTotp(code, user.two_factor_secret);
      if (!valid && typeof code === 'string' && code.length <= 100) {
        const backups = JSON.parse(user.two_factor_backup_codes || '[]'),
          hash = crypto.createHash('sha256').update(code).digest('hex');
        if (backups.includes(hash)) {
          valid = true;
          await tx.$executeRawUnsafe(
            'UPDATE users SET two_factor_backup_codes=$1 WHERE id=$2',
            JSON.stringify(backups.filter((x) => x !== hash)),
            user.id
          );
        }
      }
      if (!valid) {
        await tx.$executeRawUnsafe(
          'UPDATE auth_mfa_challenges SET attempts=attempts+1 WHERE id=$1::uuid',
          row.id
        );
        return null;
      }
      await tx.$executeRawUnsafe(
        'UPDATE auth_mfa_challenges SET used_at=now() WHERE id=$1::uuid',
        row.id
      );
      if (row.purpose === 'reauth') return recentProof(tx, user, row.session_id, this.env);
      return { ...(await sessions.issue(user, tx)), user: safeUser(user) };
    });
    if (!outcome) throw new AppError('2단계 인증 코드가 만료됐거나 일치하지 않습니다.', 401);
    return outcome;
  }
  async reauthPassword(userId, sessionId, password) {
    const outcome = await this.db.$transaction(async (tx) => {
      const user = await activeUser(tx, userId);
      if (!(await bucket(tx, digest('reauth', String(userId), this.env), 5, 900))) return null;
      if (
        !user.password_login_enabled ||
        typeof password !== 'string' ||
        password.length > 128 ||
        !(await bcrypt.compare(password, user.password))
      )
        return null;
      // Existing MFA accounts must also prove their TOTP/backup through the MFA flow.
      if (user.two_factor_enabled)
        throw new AppError('설정된 2단계 인증 수단으로 다시 인증해 주세요.', 403);
      return recentProof(tx, user, sessionId, this.env);
    });
    if (!outcome) throw new AppError('인증 정보를 확인해 주세요.', 401);
    return outcome;
  }
}
module.exports = { AuthIdentityService };
