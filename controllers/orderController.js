const Order = require('../repositories/Order');
const OrderService = require('../services/OrderService');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const prisma = require('../config/prisma');

const orderController = {
    // 주문 생성
    createOrder: catchAsync(async (req, res) => {
        const orderService = new OrderService(req.app.get('io'));
        const order = await orderService.createOrder(req.body);
        res.created(order, '주문이 생성되었습니다.');
    }),

    // 고객별 주문 내역 조회
    getCustomerHistory: catchAsync(async (req, res) => {
        const { phone, toss_user_key } = req.query;
        if (!phone && !toss_user_key) {
            return res.status(400).json({ error: '조회에 필요한 정보가 부족합니다.' });
        }
        const orders = await Order.findByCustomer(phone, toss_user_key);
        res.success(orders);
    }),

    // 매장별 주문 목록 조회
    getStoreOrders: catchAsync(async (req, res) => {
        const { storeId } = req.params;
        const { status, date } = req.query;
        const orders = await Order.findByStoreId(storeId, status, date);
        res.success(orders);
    }),

    // 주문 단일 상세 조회
    getOrderDetails: catchAsync(async (req, res) => {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: '주문을 찾을 수 없습니다' });
        res.success(order);
    }),

    // 주문 상태 업데이트
    updateStatus: catchAsync(async (req, res) => {
        const orderService = new OrderService(req.app.get('io'));
        const { status, staff_id } = req.body;
        const updated = await orderService.updateStatus(req.params.id, status, staff_id);
        res.json({ success: true, order: updated, message: '주문 상태가 변경되었습니다' });
    }),

    // 주문 취소
    cancelOrder: catchAsync(async (req, res) => {
        const orderService = new OrderService(req.app.get('io'));
        const result = await orderService.cancelOrder(req.params.id, req.user?.id, req.user?.role);
        res.json(result);
    }),

    // 주문 삭제
    deleteOrder: catchAsync(async (req, res) => {
        await Order.delete(parseInt(req.params.id));
        res.success(null, '주문이 삭제되었습니다.');
    }),

    // 통계 조회
    getStats: catchAsync(async (req, res) => {
        const { start_date, end_date } = req.query;
        const stats = await Order.getStats(req.params.storeId, start_date, end_date);
        res.success(stats);
    }),

    // 상세 통계 조회
    getDetailedStats: catchAsync(async (req, res) => {
        const { start_date, end_date } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({ error: '시작일과 종료일이 필요합니다.' });
        }
        const stats = await Order.getDetailedStats(req.params.storeId, start_date, end_date);
        res.success(stats);
    }),

    /**
     * [POST] 고객 모바일 토글 FCM 푸시 토큰 전역 등록 (역방향 알림 온보딩)
     */
    registerCustomerToken: catchAsync(async (req, res) => {
        const orderId = parseInt(req.params.orderId);
        const { token } = req.body;

        if (isNaN(orderId)) {
            return res.status(400).json({ error: 'invalid_request', message: '올바르지 않은 주문 ID 형식입니다.' });
        }
        if (!token) {
            return res.status(400).json({ error: 'invalid_request', message: 'FCM 토큰이 제공되지 않았습니다.' });
        }

        // 1. 주문 모델 내 customer_fcm_token 갱신 (역방향 알림 및 픽업 호출 타겟 동기화)
        const order = await prisma.orders.update({
            where: { id: orderId },
            data: { customer_fcm_token: token }
        });

        // 2. 해당 주문에 연결된 고객 전화번호가 존재한다면, 단골고객 테이블(store_customers)의 fcm_token도 자동 갱신 (CRM 알림 동기화)
        if (order.customer_phone) {
            await prisma.store_customers.updateMany({
                where: { 
                    store_id: order.store_id, 
                    customer_phone: order.customer_phone 
                },
                data: { fcm_token: token }
            });
            logger.info(`[FCM Token] Synced customer PWA push token: Store ${order.store_id}`);
        }

        res.json({ success: true, message: '고객용 실시간 웹 푸시 온보딩 토큰이 성공적으로 등록되었습니다.' });
    })
};

module.exports = orderController;
