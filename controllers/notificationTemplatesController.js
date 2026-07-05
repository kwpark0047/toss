const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');

const ALLOWED_TYPES = ['NEW_ORDER', 'ORDER_STATUS', 'LOW_STOCK', 'NEW_REVIEW', 'NEW_RESERVATION', 'MANAGER_CALL', 'SETTLEMENT', 'SYSTEM'];
const ALLOWED_CHANNELS = ['push', 'socket', 'alimtalk', 'all'];

/**
 * GET /api/notification-templates?store_id=&type=&is_active=
 * 템플릿 목록 조회 (store_id 필수 — 전역 템플릿은 0)
 */
const getTemplates = async (req, res, next) => {
  try {
    const { store_id, type, is_active } = req.query;
    if (!store_id) return next(new AppError('store_id가 필요합니다.', 400));

    const where = {
      OR: [
        { store_id: Number(store_id) },
        { store_id: null }
      ]
    };
    if (type && ALLOWED_TYPES.includes(type)) where.type = type;
    if (is_active === 'true') where.is_active = true;
    else if (is_active === 'false') where.is_active = false;

    const templates = await prisma.notification_templates.findMany({
      where,
      orderBy: [{ store_id: { sort: 'asc', nulls: 'first' } }, { type: 'asc' }]
    });

    const parsed = templates.map(t => ({
      ...t,
      variables: t.variables ? (() => { try { return JSON.parse(t.variables); } catch { return null; } })() : null
    }));

    res.success(parsed, '알림 템플릿 목록 조회 완료');
  } catch (err) { next(err); }
};

/**
 * GET /api/notification-templates/:id
 * 단일 템플릿 조회
 */
const getTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await prisma.notification_templates.findUnique({
      where: { id: Number(id) }
    });
    if (!template) return next(new AppError('템플릿을 찾을 수 없습니다.', 404));

    res.success({
      ...template,
      variables: template.variables ? (() => { try { return JSON.parse(template.variables); } catch { return null; } })() : null
    });
  } catch (err) { next(err); }
};

/**
 * POST /api/notification-templates
 * 템플릿 생성
 */
const createTemplate = async (req, res, next) => {
  try {
    const { store_id, type, channel, title, message, variables, is_active } = req.body;

    if (!type || !title || !message) {
      return next(new AppError('type, title, message는 필수 항목입니다.', 400));
    }
    if (!ALLOWED_TYPES.includes(type)) {
      return next(new AppError(`유효하지 않은 type입니다. 허용: ${ALLOWED_TYPES.join(', ')}`, 400));
    }
    if (channel && !ALLOWED_CHANNELS.includes(channel)) {
      return next(new AppError(`유효하지 않은 channel입니다. 허용: ${ALLOWED_CHANNELS.join(', ')}`, 400));
    }

    const template = await prisma.notification_templates.create({
      data: {
        store_id: store_id ? Number(store_id) : null,
        type,
        channel: channel || 'all',
        title,
        message,
        variables: variables ? JSON.stringify(variables) : null,
        is_active: is_active !== undefined ? is_active : true
      }
    });

    res.success(template, '알림 템플릿이 생성되었습니다.', 201);
  } catch (err) { next(err); }
};

/**
 * PUT /api/notification-templates/:id
 * 템플릿 수정
 */
const updateTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, channel, title, message, variables, is_active } = req.body;

    const existing = await prisma.notification_templates.findUnique({
      where: { id: Number(id) }
    });
    if (!existing) return next(new AppError('템플릿을 찾을 수 없습니다.', 404));

    if (type && !ALLOWED_TYPES.includes(type)) {
      return next(new AppError(`유효하지 않은 type입니다. 허용: ${ALLOWED_TYPES.join(', ')}`, 400));
    }
    if (channel && !ALLOWED_CHANNELS.includes(channel)) {
      return next(new AppError(`유효하지 않은 channel입니다. 허용: ${ALLOWED_CHANNELS.join(', ')}`, 400));
    }

    const template = await prisma.notification_templates.update({
      where: { id: Number(id) },
      data: {
        ...(type !== undefined && { type }),
        ...(channel !== undefined && { channel }),
        ...(title !== undefined && { title }),
        ...(message !== undefined && { message }),
        ...(variables !== undefined && { variables: JSON.stringify(variables) }),
        ...(is_active !== undefined && { is_active })
      }
    });

    res.success(template, '알림 템플릿이 수정되었습니다.');
  } catch (err) { next(err); }
};

/**
 * DELETE /api/notification-templates/:id
 * 템플릿 삭제
 */
const deleteTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.notification_templates.delete({
      where: { id: Number(id) }
    });
    res.success({ id: Number(id) }, '알림 템플릿이 삭제되었습니다.');
  } catch (err) {
    if (err.code === 'P2025') return next(new AppError('템플릿을 찾을 수 없습니다.', 404));
    next(err);
  }
};

module.exports = {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate
};
