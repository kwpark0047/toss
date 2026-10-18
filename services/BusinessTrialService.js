const prisma = require('../config/prisma');
const { decryptPhone } = require('../utils/phoneEncryption');
const { AppError } = require('../utils/errorHandler');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

const STATUSES = new Set(['trialing', 'expired', 'approved', 'all']);

class BusinessTrialService {
  constructor(db = prisma) {
    this.db = db;
  }

  async list(status = 'trialing', limit = 50) {
    if (!STATUSES.has(status)) throw new AppError('유효하지 않은 이용 상태입니다.', 400);
    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 100);
    const predicate = status === 'all'
      ? "business_access_status IN ('trialing','approved') AND auth_status='active'"
      : status === 'expired'
        ? "business_access_status='trialing' AND trial_ends_at <= now() AND auth_status='active'"
        : status === 'trialing'
          ? "business_access_status='trialing' AND trial_ends_at > now() AND auth_status='active'"
          : "business_access_status='approved' AND auth_status='active'";
    const rows = await this.db.$queryRawUnsafe(
      `SELECT id, name, email, phone, business_access_status,
              trial_started_at, trial_ends_at, business_approved_at,
              created_at,
              CASE WHEN business_access_status='trialing' AND trial_ends_at <= now()
                   THEN 'expired' ELSE business_access_status END AS effective_status
       FROM public.users WHERE ${predicate}
       ORDER BY CASE WHEN business_access_status='trialing' THEN 0 ELSE 1 END,
                created_at DESC, id DESC LIMIT $1`,
      safeLimit
    );
    return rows.map((row) => ({ ...row, phone: decryptPhone(row.phone) }));
  }

  async approve(userId, adminId) {
    const id = Number(userId);
    if (!Number.isSafeInteger(id) || id < 1) throw new AppError('유효하지 않은 계정입니다.', 400);
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe(
        `UPDATE public.users SET business_access_status='approved',
              business_approved_at=now(), business_approved_by=$2
         WHERE id=$1 AND business_access_status='trialing'
         RETURNING id, name, email, phone, business_access_status,
                   trial_started_at, trial_ends_at, business_approved_at, created_at`,
        id,
        adminId
      );
      if (!rows.length) {
        const current = await tx.$queryRawUnsafe(
          'SELECT id, business_access_status FROM public.users WHERE id=$1 LIMIT 1',
          id
        );
        if (!current.length) throw new AppError('가입 계정을 찾을 수 없습니다.', 404);
        if (current[0].business_access_status === 'approved')
          throw new AppError('이미 정식 이용 승인된 계정입니다.', 409);
        throw new AppError('승인할 수 없는 가입 상태입니다.', 409);
      }
      const user = rows[0];
      await tx.$executeRawUnsafe(
        `INSERT INTO public.auth_account_events(id,user_id,event,operation_id)
         VALUES($1::uuid,$2,'business-trial:approved',$3::uuid)`,
        require('node:crypto').randomUUID(),
        id,
        require('node:crypto').randomUUID()
      );
      return { ...user, phone: decryptPhone(user.phone) };
    });

  }

  async revokeApproval(userId, adminId) {
    const id = Number(userId);
    if (!Number.isSafeInteger(id) || id < 1) throw new AppError('유효하지 않은 계정입니다.', 400);
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe(
        `UPDATE public.users SET business_access_status='trialing',
              business_approved_at=NULL, business_approved_by=NULL
         WHERE id=$1 AND business_access_status='approved' AND auth_status='active'
         RETURNING id, business_access_status, trial_started_at, trial_ends_at`, id
      );
      if (!rows.length) throw new AppError('승인 취소 대상 계정을 찾을 수 없거나 승인 상태가 아닙니다.', 409);
      await tx.$executeRawUnsafe(
        `INSERT INTO public.auth_account_events(id,user_id,event,operation_id)
         VALUES($1::uuid,$2,$3,$4::uuid)`,
        crypto.randomUUID(), id, `business-trial:approval-revoked:admin:${adminId}`, crypto.randomUUID()
      );
      return rows[0];
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

