const PlanRequest = require('../repositories/PlanRequest');
const Store = require('../repositories/Store');
const { AppError } = require('../utils/errorHandler');

class PlanRequestsService {
    /**
     * 플랜 업그레이드 신청
     */
    async createRequest(userId, data) {
        const { store_id, requested_plan, reason } = data;

        if (!store_id || !requested_plan) {
            throw new AppError('매장 ID와 신청 플랜은 필수입니다', 400);
        }
        if (!['pro', 'enterprise'].includes(requested_plan)) {
            throw new AppError('유효하지 않은 플랜입니다', 400);
        }

        const store = await Store.findById(store_id);
        if (!store) {
            throw new AppError('매장을 찾을 수 없습니다', 404);
        }
        if (store.user_id !== userId) {
            throw new AppError('권한이 없습니다', 403);
        }

        const planOrder = { free: 0, pro: 1, enterprise: 2 };
        if (planOrder[store.plan || 'free'] >= planOrder[requested_plan]) {
            throw new AppError('현재 플랜과 같거나 하위 플랜으로는 신청할 수 없습니다', 400);
        }

        return await PlanRequest.create({
            store_id,
            user_id: userId,
            current_plan: store.plan || 'free',
            requested_plan,
            reason
        });
    }

    /**
     * 내 매장의 신청 내역 조회
     */
    async getStoreRequests(storeId, userId, userRole) {
        const store = await Store.findById(storeId);
        if (!store) {
            throw new AppError('매장을 찾을 수 없습니다', 404);
        }
        if (store.user_id !== userId && userRole !== 'super_admin') {
            throw new AppError('권한이 없습니다', 403);
        }
        return await PlanRequest.findByStore(storeId);
    }

    /**
     * 전체 신청 목록 조회 (super_admin 전용)
     */
    async getAllRequests(status) {
        return await PlanRequest.findAll(status);
    }

    /**
     * 대기 중인 신청 수 조회 (super_admin 전용)
     */
    async getPendingCount() {
        return await PlanRequest.countPending();
    }

    /**
     * 신청 승인 (super_admin 전용)
     */
    async approveRequest(requestId, adminUserId, adminNote) {
        return await PlanRequest.approve(requestId, adminUserId, adminNote);
    }

    /**
     * 신청 거절 (super_admin 전용)
     */
    async rejectRequest(requestId, adminUserId, adminNote) {
        return await PlanRequest.reject(requestId, adminUserId, adminNote);
    }
}

module.exports = PlanRequestsService;
