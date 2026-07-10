const KdsService = require('../services/KdsService');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');

/**
 * KDS(주방 디스플레이 시스템) 컨트롤러
 * 매장 주방 모니터 전용 액티브 주문 리스팅 및 실시간 상태 전환을 담당합니다.
 */
const kdsController = {
    /**
     * [GET] 특정 매장의 KDS 활성 주문 목록 조회 (pending, preparing, ready)
     */
    getActiveOrders: catchAsync(async (req, res) => {
        const { storeId } = req.params;
        const orders = await KdsService.getActiveKdsOrders(storeId);
        res.success(orders, '주방의 활성 조리 주문 목록이 정상적으로 조회되었습니다.');
    }),

    /**
     * [POST] KDS 주문 상태 전이 처리 (조리중, 조리완료, 수령완료)
     */
    updateOrderStatus: catchAsync(async (req, res) => {
        const { storeId, orderId } = req.params;
        const { status, staffId } = req.body;

        if (!status) {
            throw new AppError('업데이트할 조리 상태(status)는 필수입니다.', 400);
        }

        const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            throw new AppError('올바르지 않은 KDS 조리 상태 코드입니다.', 400);
        }

        // Socket.io 인스턴스를 서비스에 주입하여 실시간 주방 태블릿 전파 작동
        const io = req.app.get('io');

        const order = await KdsService.updateKdsOrderStatus(storeId, orderId, status, staffId, io);
        res.success(order, `주문 조리 상태가 성공적으로 [${status}] 상태로 전환되었습니다.`);
    })
};

module.exports = kdsController;
