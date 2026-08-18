const CrmAutomationService = require('../services/CrmAutomationService');

const crmAutomationController = {
  async generate(req, res) {
    const result = await CrmAutomationService.generate(req.params.storeId, {
      ...req.body,
      createdBy: req.user.id,
    });
    res.success(result, 'CRM 캠페인 후보가 생성되었습니다.');
  },

  async list(req, res) {
    const result = await CrmAutomationService.list(req.params.storeId, req.query.status);
    res.success(result);
  },

  async decide(req, res) {
    const result = await CrmAutomationService.decide(
      req.params.id,
      req.params.storeId,
      req.body.status,
      req.user.id
    );
    res.success(result, 'CRM 캠페인 결정이 저장되었습니다.');
  },

  async send(req, res) {
    const result = await CrmAutomationService.send(req.params.id, req.params.storeId);
    res.success(result, 'CRM 캠페인 발송이 완료되었습니다.');
  },
};

module.exports = crmAutomationController;
