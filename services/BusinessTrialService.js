const prisma = require('../config/prisma');
const { decryptPhone } = require('../utils/phoneEncryption');
const { AppError } = require('../utils/errorHandler');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

const STATUSES = new Set(['trialing', 'expired', 'all']);
const MAX_EXTEND_DAYS = 90;

class BusinessTrialService {
  constructor(db = prisma) {
    this.db = db;
  }

  async list(status = 'trialing', limit = 50) {
    if (!STATUSES.has(status)) throw new AppError('유효하지 않은 이용 상태입니다.', 400);
    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 100);
    // 플랜 판정(ownerTrialEndsAt)과 같은 기준: 상태가 trialing이든 approved든 trial_ends_at으로 판단
    const base =
      "trial_started_at IS NOT NULL AND business_access_status IN ('trialing','approved') AND auth_status='active'";
    const predicate = status === 'all'
      ? base
      : status === 'expired'
        ? `${base} AND (trial_ends_at IS NULL OR trial_ends_at <= now())`
        : `${base} AND trial_ends_at > now()`;
    const rows = await this.db.$queryRawUnsafe(
      `SELECT id, name, email, phone, business_access_status,
              trial_started_at, trial_ends_at, business_approved_at,
              created_at,
              CASE WHEN trial_ends_at > now() THEN 'trialing' ELSE 'expired' END AS effective_status
       FROM public.users WHERE ${predicate}
       ORDER BY CASE WHEN trial_ends_at > now() THEN 0 ELSE 1 END,
                created_at DESC, id DESC LIMIT $1`,
      safeLimit
    );
    return rows.map((row) => ({ ...row, phone: decryptPhone(row.phone) }));
  }

  // 체험 기간 연장. 남은 기간이 있으면 그 끝에서, 이미 끝났으면 지금부터 days일을 더한다.
  // 연장 중에는 프로 플랜 기능을 계속 쓰고, 끝나면 무료 플랜으로 돌아간다.
  async extendTrial(userId, adminId, days = 30) {
    const id = Number(userId);
    if (!Number.isSafeInteger(id) || id < 1) throw new AppError('유효하지 않은 계정입니다.', 400);
    const extendDays =
      typeof days === 'number' || (typeof days === 'string' && /^\d+$/.test(days))
        ? Number(days)
        : NaN;
    if (!Number.isSafeInteger(extendDays) || extendDays < 1 || extendDays > MAX_EXTEND_DAYS)
      throw new AppError(`연장 기간은 1~${MAX_EXTEND_DAYS}일이어야 합니다.`, 400);
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe(
        `UPDATE public.users SET business_access_status='trialing',
              trial_ends_at = GREATEST(COALESCE(trial_ends_at, now()), now()) + ($2::int * interval '1 day')
         WHERE id=$1 AND trial_started_at IS NOT NULL AND auth_status='active'
           AND business_access_status IN ('trialing','approved')
         RETURNING id, name, email, phone, business_access_status,
                   trial_started_at, trial_ends_at, created_at`,
        id,
        extendDays
      );
      if (!rows.length) throw new AppError('체험을 연장할 수 있는 계정을 찾을 수 없습니다.', 404);
      await tx.$executeRawUnsafe(
        `INSERT INTO public.auth_account_events(id,user_id,event,operation_id)
         VALUES($1::uuid,$2,$3,$4::uuid)`,
        crypto.randomUUID(),
        id,
        `business-trial:extended:${extendDays}d:admin:${adminId}`,
        crypto.randomUUID()
      );
      return { ...rows[0], phone: decryptPhone(rows[0].phone) };
    });
  }

  // 개인정보를 익명화하고 인증을 폐기하되, 재무·감사 참조용 user row와 기록은 보존한다.
  async deleteAccount(userId, adminId) {
    const id = Number(userId);
    if (!Number.isSafeInteger(id) || id < 1) throw new AppError('유효하지 않은 계정입니다.', 400);
    return this.db.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe(
        `SELECT id, email, trial_started_at FROM public.users
         WHERE id=$1 AND auth_status='active' AND COALESCE(role,'user') <> 'super_admin' AND trial_started_at IS NOT NULL
           AND business_access_status IN ('trialing','approved') FOR UPDATE`, id
      );
      if (!locked.length) throw new AppError('삭제할 활성 체험 계정을 찾을 수 없습니다.', 404);
      const stores = await tx.$queryRawUnsafe('SELECT id FROM public.stores WHERE user_id=$1 LIMIT 1', id);
      if (stores.length) throw new AppError('소유 매장이 있는 계정은 삭제할 수 없습니다. 매장과 정산 기록을 먼저 안전하게 이전해 주세요.', 409);

      await tx.$executeRawUnsafe(
        `UPDATE public.users SET auth_status='deletion_pending', business_access_status='rejected',
          password_login_enabled=false, password=$1, name=NULL, email=NULL, phone=NULL, address=NULL,
          fcm_token=NULL, two_factor_enabled=false, two_factor_secret=NULL, two_factor_backup_codes=NULL,
          business_approved_at=NULL, business_approved_by=NULL
         WHERE id=$2`,
        await bcrypt.hash(crypto.randomBytes(48).toString('base64url'), 10), id
      );
      await tx.$executeRawUnsafe("UPDATE public.auth_sessions SET revoked_at=now(), refresh_hash='' WHERE user_id=$1 AND revoked_at IS NULL", id);
      await tx.$executeRawUnsafe('DELETE FROM public.social_accounts WHERE user_id=$1', id);
      await tx.$executeRawUnsafe(
        `UPDATE public.auth_email_challenges SET email='withdrawn+' || $1::text || '@invalid.local',
          otp_hash='', link_hash='', browser_hash='', used_at=now(), dispatch_payload=NULL
         WHERE user_id=$1 OR lower(email)=lower($2)`, id, locked[0].email || ''
      );
      await tx.$executeRawUnsafe("UPDATE public.auth_oauth_flows SET used_at=COALESCE(used_at,now()), verifier_ciphertext='', result_used_at=now(), result_ciphertext=NULL WHERE user_id=$1", id);
      await tx.$executeRawUnsafe('DELETE FROM public.auth_recent_proofs WHERE user_id=$1', id);
      await tx.$executeRawUnsafe('DELETE FROM public.auth_mfa_challenges WHERE user_id=$1', id);
      await tx.$executeRawUnsafe(
        `INSERT INTO public.auth_account_events(id,user_id,event,operation_id)
         VALUES($1::uuid,$2,$3,$4::uuid)`,
        crypto.randomUUID(), id, `business-trial:account-deleted:admin:${adminId}`, crypto.randomUUID()
      );
      return { id, deleted: true, anonymized: true, financialRecordsRetained: true, deletedBy: adminId };
    });
  }
}

module.exports = { BusinessTrialService };

