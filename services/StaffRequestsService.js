const StaffAccountRequest = require('../repositories/StaffAccountRequest');
const Store = require('../repositories/Store');
const { AppError } = require('../utils/errorHandler');

class StaffRequestsService {
    /**
     * 역할 계정 신청
     */
    async createRequest(userId, data) {
        const { store_id, role, count, reason } = data;

        if (!store_id || !role) {
            throw new AppError('매장 ID와 신청 역할(manager/kitchen)은 필수입니다', 400);
        }
        if (!['manager', 'kitchen'].includes(role)) {
            throw new AppError('매니저 또는 주방 역할만 신청 가능합니다', 400);
        }

        const store = await Store.findById(store_id);
        if (!store) {
            throw new AppError('매장을 찾을 수 없습니다', 404);
        }
        if (store.user_id !== userId) {
            throw new AppError('권한이 없습니다', 403);
        }

        return await StaffAccountRequest.create({
            store_id,
            user_id: userId,
            role,
            count: count || 1,
            reason
        });
    }

    /**
     * 매장별 신청 내역 조회
     */
    async getStoreRequests(storeId, userId, userRole) {
        const store = await Store.findById(storeId);
        if (!store) {
            throw new AppError('매장을 찾을 수 없습니다', 404);
        }
        if (store.user_id !== userId && userRole !== 'super_admin') {
            throw new AppError('권한이 없습니다', 403);
        }
        return await StaffAccountRequest.findByStore(storeId);
    }

    /**
     * 전체 신청 목록 조회 (super_admin 전용)
     */
    async getAllRequests(status) {
        return await StaffAccountRequest.findAll(status);
    }

    /**
     * 대기 중인 신청 수 조회 (super_admin 전용)
     */
    async getPendingCount() {
        return await StaffAccountRequest.countPending();
    }

    /**
     * 신청 승인 (super_admin 전용)
     */
    async approveRequest(requestId, adminUserId, adminNote) {
        return await StaffAccountRequest.approve(requestId, adminUserId, adminNote);
    }

    /**
     * 신청 거절 (super_admin 전용)
     */
    async rejectRequest(requestId, adminUserId, adminNote) {
        return await StaffAccountRequest.reject(requestId, adminUserId, adminNote);
    }
}

module.exports = StaffRequestsService;
