const prisma = require('../config/prisma');

/**
 * [PlanRequest (플랜 신청) 모델 - Prisma 기반]
 */
const PlanRequest = {
  create: async (data) => {
    const { store_id, user_id, current_plan, requested_plan, reason } = data;

    const existing = await prisma.plan_requests.findFirst({
      where: {
        store_id: parseInt(store_id),
        status: 'pending'
      }
    });

    if (existing) {
      throw new Error('이미 대기 중인 플랜 신청이 있습니다');
    }

    return await prisma.plan_requests.create({
      data: {
        store_id: parseInt(store_id),
        user_id: parseInt(user_id),
        current_plan: current_plan || 'free',
        requested_plan,
        reason: reason || null,
        status: 'pending'
      },
      include: {
        stores: { select: { name: true } },
        users_plan_requests_user_idTousers: { select: { name: true, email: true } }
      }
    });
  },

  findById: async (id) => {
    const request = await prisma.plan_requests.findUnique({
      where: { id: parseInt(id) },
      include: {
        stores: { select: { name: true } },
        users_plan_requests_user_idTousers: { select: { name: true, email: true } }
      }
    });

    if (!request) return null;

    return {
      ...request,
      store_name: request.stores?.name,
      user_name: request.users_plan_requests_user_idTousers?.name,
      user_email: request.users_plan_requests_user_idTousers?.email
    };
  },

  findAll: async (status = null) => {
    const where = status ? { status } : {};
    const requests = await prisma.plan_requests.findMany({
      where,
      include: {
        stores: { select: { name: true } },
        users_plan_requests_user_idTousers: { select: { name: true, email: true } }
      },
      orderBy: { created_at: 'desc' }
    });

    return requests.map(pr => ({
      ...pr,
      store_name: pr.stores?.name,
      user_name: pr.users_plan_requests_user_idTousers?.name,
      user_email: pr.users_plan_requests_user_idTousers?.email
    }));
  },

  findByStore: async (storeId) => {
    return await prisma.plan_requests.findMany({
      where: { store_id: parseInt(storeId) },
      orderBy: { created_at: 'desc' }
    });
  },

  approve: async (id, reviewedBy, adminNote = null) => {
    return await prisma.$transaction(async (tx) => {
      const request = await tx.plan_requests.findUnique({
        where: { id: parseInt(id) }
      });

      if (!request) throw new Error('신청을 찾을 수 없습니다');
      if (request.status !== 'pending') throw new Error('이미 처리된 신청입니다');

      const updatedRequest = await tx.plan_requests.update({
        where: { id: parseInt(id) },
        data: {
          status: 'approved',
          reviewed_by: parseInt(reviewedBy),
          admin_note: adminNote,
          reviewed_at: new Date()
        }
      });

      await tx.stores.update({
        where: { id: request.store_id },
        data: { plan: request.requested_plan }
      });

      return updatedRequest;
    });
  },

  reject: async (id, reviewedBy, adminNote = null) => {
    return await prisma.plan_requests.update({
      where: { id: parseInt(id) },
      data: {
        status: 'rejected',
        reviewed_by: parseInt(reviewedBy),
        admin_note: adminNote,
        reviewed_at: new Date()
      }
    });
  },

  countPending: async () => {
    return await prisma.plan_requests.count({
      where: { status: 'pending' }
    });
  }
};

module.exports = PlanRequest;
