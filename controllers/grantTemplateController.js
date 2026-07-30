const prisma = require('../config/prisma');

const GrantTemplateController = {
  list: async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const where = storeId ? { store_id: Number(storeId) } : {};
      const templates = await prisma.grant_templates.findMany({
        where,
        orderBy: { created_at: 'desc' },
      });
      res.success(templates);
    } catch (err) {
      next(err);
    }
  },

  create: async (req, res, next) => {
    try {
      const { store_id, title, reason, is_auto } = req.body;
      if (!title || !reason) {
        return res.status(400).json({ error: 'title과 reason은 필수입니다.' });
      }
      const template = await prisma.grant_templates.create({
        data: {
          store_id: store_id ? Number(store_id) : null,
          title,
          reason,
          is_auto: is_auto || false,
        },
      });
      res.success(template, '템플릿이 생성되었습니다.', 201);
    } catch (err) {
      next(err);
    }
  },

  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { title, reason, is_auto, is_active } = req.body;
      const template = await prisma.grant_templates.update({
        where: { id: Number(id) },
        data: {
          ...(title !== undefined && { title }),
          ...(reason !== undefined && { reason }),
          ...(is_auto !== undefined && { is_auto }),
          ...(is_active !== undefined && { is_active }),
        },
      });
      res.success(template, '템플릿이 수정되었습니다.');
    } catch (err) {
      next(err);
    }
  },

  delete: async (req, res, next) => {
    try {
      const { id } = req.params;
      await prisma.grant_templates.delete({
        where: { id: Number(id) },
      });
      res.success(null, '템플릿이 삭제되었습니다.');
    } catch (err) {
      next(err);
    }
  },
};

module.exports = GrantTemplateController;
