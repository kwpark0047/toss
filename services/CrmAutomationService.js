const prisma = require('../config/prisma');
const { decryptPhone } = require('../utils/phoneEncryption');
const { sendSms } = require('../utils/smsService');
const { AppError } = require('../utils/errorHandler');

const SEGMENTS = ['Champions', 'Loyal', 'At_Risk', 'Lost', 'New', 'General'];

const classifySegment = (customer) => {
  const lastVisitAt = customer.last_visit_at || customer.last_visited_at;
  const daysSinceLast = lastVisitAt
    ? Math.floor((Date.now() - new Date(lastVisitAt)) / 86400000)
    : 9999;
  const visits = customer.visit_count || 0;
  const spent = customer.total_spent || 0;
  if (daysSinceLast <= 7 && visits >= 5 && spent >= 50000) return 'Champions';
  if (daysSinceLast <= 30 && visits >= 3 && spent >= 20000) return 'Loyal';
  if (daysSinceLast > 90) return 'Lost';
  if (daysSinceLast > 60 && visits >= 2) return 'At_Risk';
  if (visits === 1) return 'New';
  return 'General';
};

const parseId = (value, label) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new AppError(`유효하지 않은 ${label}입니다.`, 400);
  return parsed;
};

const CrmAutomationService = {
  async generate(storeId, { segmentName, message, triggerType = 'MANUAL', createdBy }) {
    const storeNumber = parseId(storeId, '매장 ID');
    if (!SEGMENTS.includes(segmentName))
      throw new AppError('유효하지 않은 고객 세그먼트입니다.', 400);
    if (typeof message !== 'string' || !message.trim() || message.length > 80) {
      throw new AppError('메시지는 1자 이상 80자 이하로 입력해야 합니다.', 400);
    }
    const customers = await prisma.store_customers.findMany({
      where: { store_id: storeNumber },
      select: { customer_phone: true, last_visit_at: true, visit_count: true, total_spent: true },
    });
    const targetCount = customers.filter(
      (customer) => classifySegment(customer) === segmentName && customer.customer_phone
    ).length;
    if (!targetCount) throw new AppError('발송 대상 고객이 없습니다.', 404);
    return prisma.crm_campaign_runs.create({
      data: {
        store_id: storeNumber,
        segment_name: segmentName,
        trigger_type: triggerType,
        message: message.trim(),
        target_count: targetCount,
        created_by: createdBy || null,
      },
    });
  },

  async list(storeId, status = 'pending') {
    const storeNumber = parseId(storeId, '매장 ID');
    if (!['pending', 'approved', 'sent', 'rejected'].includes(status))
      throw new AppError('유효하지 않은 캠페인 상태입니다.', 400);
    return prisma.crm_campaign_runs.findMany({
      where: { store_id: storeNumber, status },
      orderBy: { created_at: 'desc' },
    });
  },

  async decide(runId, storeId, status, userId) {
    const id = parseId(runId, '캠페인 ID');
    const storeNumber = parseId(storeId, '매장 ID');
    if (!['approved', 'rejected'].includes(status))
      throw new AppError('유효하지 않은 캠페인 결정입니다.', 400);
    const run = await prisma.crm_campaign_runs.findFirst({ where: { id, store_id: storeNumber } });
    if (!run) throw new AppError('캠페인을 찾을 수 없습니다.', 404);
    if (run.status !== 'pending') throw new AppError('이미 처리된 캠페인입니다.', 409);
    return prisma.crm_campaign_runs.update({
      where: { id },
      data: { status, approved_by: userId, approved_at: new Date() },
    });
  },

  async send(runId, storeId) {
    const id = parseId(runId, '캠페인 ID');
    const storeNumber = parseId(storeId, '매장 ID');
    const run = await prisma.crm_campaign_runs.findFirst({ where: { id, store_id: storeNumber } });
    if (!run) throw new AppError('캠페인을 찾을 수 없습니다.', 404);
    if (run.status !== 'approved') throw new AppError('승인된 캠페인만 발송할 수 있습니다.', 409);
    const customers = await prisma.store_customers.findMany({
      where: { store_id: storeNumber },
      select: { customer_phone: true, last_visit_at: true, visit_count: true, total_spent: true },
    });
    const targets = customers.filter(
      (customer) => classifySegment(customer) === run.segment_name && customer.customer_phone
    );
    let sentCount = 0;
    let failedCount = 0;
    for (const target of targets) {
      try {
        const phone = decryptPhone(target.customer_phone);
        const result = await sendSms(phone, run.message);
        if (result?.sent || result?.dev || result?.fallback) sentCount += 1;
        else failedCount += 1;
      } catch {
        failedCount += 1;
      }
    }
    return prisma.crm_campaign_runs.update({
      where: { id },
      data: {
        status: 'sent',
        sent_count: sentCount,
        failed_count: failedCount,
        sent_at: new Date(),
      },
    });
  },
};

module.exports = CrmAutomationService;
