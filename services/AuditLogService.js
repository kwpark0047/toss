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
};

module.exports = AuditLogService;
