const prisma = require('../config/prisma');
const { decryptPhone } = require('../utils/phoneEncryption');
const { AppError } = require('../utils/errorHandler');

const STATUSES = new Set(['trialing', 'expired', 'approved', 'all']);

class BusinessTrialService {
  constructor(db = prisma) {
    this.db = db;
  }

  async list(status = 'trialing', limit = 50) {
    if (!STATUSES.has(status)) throw new AppError('유효하지 않은 이용 상태입니다.', 400);
    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 100);
    const predicate = status === 'all'
      ? "business_access_status IN ('trialing','approved')"
      : status === 'expired'
        ? "business_access_status='trialing' AND trial_ends_at <= now()"
        : status === 'trialing'
          ? "business_access_status='trialing' AND trial_ends_at > now()"
          : "business_access_status='approved'";
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
}

module.exports = { BusinessTrialService };

