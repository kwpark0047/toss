const crypto = require('node:crypto'),
  bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const { activeUser, consumeProof, recentProof, bucket } = require('./FreeAuthStore');
const { digest } = require('../utils/freeAuthSecrets');
class AccountLifecycleService {
  constructor(db = prisma, env = process.env) {
    this.db = db;
    this.env = env;
  }
  async accounts(actor) {
    const identities = await this.db.$queryRawUnsafe(
      'SELECT provider,email,created_at FROM social_accounts WHERE user_id=$1 ORDER BY created_at',
      actor.id
    );
    const rows = await this.db.$queryRawUnsafe(
      'SELECT password_login_enabled,email_verified_at,auth_status FROM users WHERE id=$1',
      actor.id
    );
    return { identities, ...rows[0] };
  }
  async reauthTotp(actor, code) {
    const result = await this.db.$transaction(async (tx) => {
      const user = await activeUser(tx, actor.id);
      if (!(await bucket(tx, digest('reauth-totp', String(actor.id), this.env), 5, 900)))
        return null;
      if (
        !user.two_factor_enabled ||
        !require('../utils/totp').verifyTotp(code, user.two_factor_secret)
      )
        return null;
      return recentProof(tx, user, actor.sid, this.env);
    });
    if (!result) throw new AppError('2단계 인증 정보를 확인해 주세요.', 401);
    return result;
  }
  async unlink(actor, provider, proof) {
    if (!['google', 'kakao', 'naver', 'email'].includes(provider))
      throw new AppError('인증 수단을 확인해 주세요.', 400);
    return this.db.$transaction(async (tx) => {
      const user = await activeUser(tx, actor.id);
      await consumeProof(tx, actor.id, actor.sid, proof, this.env);
      const rows = await tx.$queryRawUnsafe(
        'SELECT id,provider FROM social_accounts WHERE user_id=$1 FOR UPDATE',
        actor.id
      );
      const target = rows.filter((x) => x.provider === provider);
      if (!target.length) return { unlinked: true };
      if (!user.password_login_enabled && rows.length <= target.length)
        throw new AppError(
          '마지막 로그인 수단은 해제할 수 없습니다. 다른 인증 수단을 먼저 연결해 주세요.',
          409
        );
      await tx.$executeRawUnsafe(
        'DELETE FROM social_accounts WHERE user_id=$1 AND provider=$2',
        actor.id,
        provider
      );
      await tx.$executeRawUnsafe(
        'INSERT INTO auth_account_events(id,user_id,event,operation_id) VALUES($1::uuid,$2,$3,$4::uuid)',
        crypto.randomUUID(),
        actor.id,
        `unlink:${provider}`,
        crypto.randomUUID()
      );
      return { unlinked: true, providerConsentRevoked: false };
    });
  }
  async withdraw(actor, proof, operationId) {
    if (!/^[0-9a-f-]{36}$/i.test(operationId || ''))
      throw new AppError('작업 ID를 확인해 주세요.', 400);
    return this.db.$transaction(async (tx) => {
      const user = await activeUser(tx, actor.id);
      const old = await tx.$queryRawUnsafe(
        'SELECT user_id,event FROM auth_account_events WHERE operation_id=$1::uuid',
        operationId
      );
      if (old.length) {
        if (old[0].user_id !== actor.id || old[0].event !== 'withdraw')
          throw new AppError('다른 작업에 사용된 ID입니다.', 409);
        return { withdrawn: true };
      }
      await consumeProof(tx, actor.id, actor.sid, proof, this.env);
      const stores = await tx.$queryRawUnsafe(
        'SELECT id FROM stores WHERE user_id=$1 LIMIT 1',
        actor.id
      );
      if (stores.length)
        throw new AppError(
          '소유 매장의 이전 및 구독 정리를 먼저 완료해 주세요. 주문·정산 기록은 삭제하지 않습니다.',
          409
        );
      if (user.role === 'super_admin') {
        const admins = await tx.$queryRawUnsafe(
          "SELECT id FROM users WHERE role='super_admin' AND auth_status='active' FOR UPDATE"
        );
        if (admins.length <= 1) throw new AppError('마지막 최고관리자는 탈퇴할 수 없습니다.', 409);
      }
      const sessionRows = await tx.$queryRawUnsafe(
        'SELECT id FROM auth_sessions WHERE user_id=$1 AND revoked_at IS NULL',
        actor.id
      );
      await tx.$executeRawUnsafe(
        `UPDATE users SET auth_status='deletion_pending',password_login_enabled=false,password=$1,
    name=NULL,email=NULL,phone=NULL,address=NULL,fcm_token=NULL,two_factor_secret=NULL,two_factor_backup_codes=NULL WHERE id=$2`,
        await bcrypt.hash(crypto.randomBytes(48).toString('base64url'), 10),
        actor.id
      );
      await tx.$executeRawUnsafe(
        'UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',
        actor.id
      );
      await tx.$executeRawUnsafe('DELETE FROM social_accounts WHERE user_id=$1', actor.id);
      await tx.$executeRawUnsafe(
        "UPDATE auth_email_challenges SET email='withdrawn@invalid.local',used_at=now(),dispatch_payload=NULL WHERE user_id=$1 OR lower(email)=lower($2)",
        actor.id,
        user.email || ''
      );
      await tx.$executeRawUnsafe(
        'UPDATE auth_oauth_flows SET result_used_at=now(),result_ciphertext=NULL WHERE user_id=$1',
        actor.id
      );
      await tx.$executeRawUnsafe(
        'INSERT INTO auth_account_events(id,user_id,event,operation_id) VALUES($1::uuid,$2,$3,$4::uuid)',
        crypto.randomUUID(),
        actor.id,
        'withdraw',
        operationId
      );
      return {
        withdrawn: true,
        financialRecordsRetained: true,
        providerConsentRevoked: false,
        sessionIds: sessionRows.map((row) => row.id),
      };
    });
  }
}
module.exports = { AccountLifecycleService };
