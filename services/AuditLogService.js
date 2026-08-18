const prisma = require('../config/prisma');
const logger = require('../utils/logger');

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'access_token',
  'refresh_token',
  'fcm_token',
  'phone',
  'customer_phone',
  'card_number',
  'toss_pay_token',
]);

const redact = (value) => {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redact(child),
    ])
  );
};

const AuditLogService = {
  async record({
    actorUserId = null,
    actorRole = null,
    action,
    resourceType,
    resourceId = null,
    storeId = null,
    before = null,
    after = null,
    metadata = null,
  }) {
    if (!prisma.audit_logs || !action || !resourceType) return null;

    try {
      return await prisma.audit_logs.create({
        data: {
          actor_user_id: actorUserId,
          actor_role: actorRole,
          action,
          resource_type: resourceType,
          resource_id: resourceId,
          store_id: storeId,
          before_data: redact(before),
          after_data: redact(after),
          metadata: redact(metadata),
        },
      });
    } catch (error) {
      // Auditing must never break the business transaction.
      logger.warn(`[AuditLog] 기록 실패: ${error.message}`);
      return null;
    }
  },

  async list({ page = 1, limit = 50, action, resourceType, storeId } = {}) {
    if (!prisma.audit_logs) return { items: [], total: 0, page: 1, limit: 0, totalPages: 0 };
    const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNumber = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
    const where = {
      ...(action ? { action } : {}),
      ...(resourceType ? { resource_type: resourceType } : {}),
      ...(storeId ? { store_id: Number.parseInt(storeId, 10) } : {}),
    };
    const [total, items] = await Promise.all([
      prisma.audit_logs.count({ where }),
      prisma.audit_logs.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (pageNumber - 1) * limitNumber,
        take: limitNumber,
      }),
    ]);
    return {
      items,
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber),
    };
  },

  async prune(retentionDays = process.env.AUDIT_LOG_RETENTION_DAYS || 180) {
    if (!prisma.audit_logs) return { deleted: 0, retentionDays: 0 };
    const days = Math.min(3650, Math.max(1, Number.parseInt(retentionDays, 10) || 180));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const result = await prisma.audit_logs.deleteMany({
      where: { created_at: { lt: cutoff } },
    });
    return { deleted: result.count, retentionDays: days, cutoff };
  },
};

module.exports = AuditLogService;
