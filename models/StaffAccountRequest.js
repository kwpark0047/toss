const prisma = require('../config/prisma');

/**
 * [StaffAccountRequest (직원 계정 신청) 모델 - Prisma 기반]
 */
const StaffAccountRequest = {
  create: async (data) => {
    const { store_id, user_id, role, count = 1, reason } = data;

    const existing = await prisma.staff_account_requests.findFirst({
      where: {
        store_id: parseInt(store_id),
        role,
        status: 'pending'
      }
    });

    if (existing) {
      throw new Error(`이미 대기 중인 ${role} 계정 신청이 있습니다`);
    }

    return await prisma.staff_account_requests.create({
      data: {
        store_id: parseInt(store_id),
        user_id: parseInt(user_id),
        role,
        count: parseInt(count),
        reason: reason || null,
        status: 'pending'
      }
    });
  },

  findById: async (id) => {
    const request = await prisma.staff_account_requests.findUnique({
      where: { id: parseInt(id) },
      include: {
        stores: { select: { name: true } },
        users_staff_account_requests_user_idTousers: { select: { name: true, email: true } }
      }
    });

    if (!request) return null;

    return {
      ...request,
      store_name: request.stores?.name,
      user_name: request.users_staff_account_requests_user_idTousers?.name,
      user_email: request.users_staff_account_requests_user_idTousers?.email
    };
  },

  findAll: async (status = null) => {
    const where = status ? { status } : {};
    const requests = await prisma.staff_account_requests.findMany({
      where,
      include: {
        stores: { select: { name: true } },
        users_staff_account_requests_user_idTousers: { select: { name: true, email: true } }
      },
      orderBy: { created_at: 'desc' }
    });

    return requests.map(sar => ({
      ...sar,
      store_name: sar.stores?.name,
      user_name: sar.users_staff_account_requests_user_idTousers?.name,
      user_email: sar.users_staff_account_requests_user_idTousers?.email
    }));
  },

  findByStore: async (storeId) => {
    return await prisma.staff_account_requests.findMany({
      where: { store_id: parseInt(storeId) },
      orderBy: { created_at: 'desc' }
    });
  },

  approve: async (id, reviewedBy, adminNote = null) => {
    return await prisma.staff_account_requests.update({
      where: { id: parseInt(id) },
      data: {
        status: 'approved',
        reviewed_by: parseInt(reviewedBy),
        admin_note: adminNote,
        reviewed_at: new Date()
      }
    });
  },

  reject: async (id, reviewedBy, adminNote = null) => {
    return await prisma.staff_account_requests.update({
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
    return await prisma.staff_account_requests.count({
      where: { status: 'pending' }
    });
  }
};

module.exports = StaffAccountRequest;
