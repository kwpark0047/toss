const auditLogService = require('../services/AuditLogService');

const auditLogController = {
  async list(req, res) {
    const result = await auditLogService.list(req.query);
    res.success(result);
  },

  async prune(req, res) {
    const result = await auditLogService.prune(req.body?.retention_days);
    res.success(result, '감사 로그 보존 기간 정리가 완료되었습니다.');
  },
};

module.exports = auditLogController;
