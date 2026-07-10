const CustomerService = require('../services/CustomerService');
const StoreCustomer = require('../repositories/StoreCustomer');
const prisma = require('../config/prisma');

const customerService = new CustomerService();

const customerController = {
    // POST /phone-join — 고객 휴대폰 번호 통합 등록
    async phoneJoin(req, res) {
        const { phone, store_id } = req.body;
        if (!phone || !store_id) {
            return res.status(400).json({ success: false, message: '휴대폰 번호와 매장 ID는 필수입니다.' });
        }
        const result = await customerService.phoneJoin(req.body);
        if (result.duplicate) {
            return res.json({ success: false, message: result.message, already_joined: true });
        }
        res.json({ success: true, ...result });
    },

    // GET /:storeId/stats — 매장별 단골고객 통계
    async getStats(req, res) {
        const data = await customerService.getStats(req.params.storeId);
        res.json({ success: true, data });
    },

    // GET /:storeId/customer/:customerId/history — 고객 상세 이력
    async getHistory(req, res) {
        const data = await customerService.getHistory(req.params.storeId, req.params.customerId);
        if (!data) return res.status(404).json({ success: false, error: '고객 정보 없음' });
        res.json({ success: true, data });
    },

    // GET /:storeId/coupons — 매장 쿠폰 목록
    async getCoupons(req, res) {
        const coupons = await prisma.coupons.findMany({
            where: { store_id: parseInt(req.params.storeId), is_active: 1 },
            orderBy: { created_at: 'desc' },
        });
        res.json({ success: true, data: coupons });
    },

    // POST /:storeId/customer/:customerId/coupon — 고객에게 쿠폰 발급
    async issueCoupon(req, res) {
        const { coupon_id } = req.body;
        if (!coupon_id) return res.status(400).json({ success: false, error: '쿠폰 ID가 필요합니다.' });
        const result = await customerService.issueCoupon(req.params.storeId, req.params.customerId, coupon_id);
        if (result.error) return res.status(result.status).json({ success: false, error: result.error });
        res.json({ success: true, data: result.issued, message: `${result.couponName} 쿠폰이 발급되었습니다.` });
    },

    // GET /detail/:customerId — 특정 단골고객 상세 조회
    async getDetail(req, res) {
        const result = await customerService.getCustomerDetail(req.params.customerId, req.user.id, req.user.role);
        if (result.error) return res.status(result.status).json({ success: false, error: result.error });
        res.json({ success: true, data: result.customer });
    },

    // GET /:storeId — 매장별 단골고객 리스트
    async getCustomers(req, res) {
        const { sortBy, order, limit, search } = req.query;
        const customers = await StoreCustomer.findByStoreId(req.params.storeId, {
            sortBy, order, limit: limit ? parseInt(limit) : 50, search
        });
        res.json({ success: true, data: customers });
    },

    // POST /update-location — 고객 실시간 위치 업데이트
    async updateLocation(req, res) {
        const { phone, latitude, longitude } = req.body;
        const notificationService = require('../utils/notifications');
        const result = await customerService.updateLocation({ phone, latitude, longitude });
        if (result) {
            await notificationService.sendPushNotification(result.fcm_token, {
                title: `지금 ${result.store.name}이 근처에 있어요!`,
                body: `'${result.coupon.name}' 쿠폰이 준비되어 있습니다. 지금 방문해 보세요!`,
                data: { storeId: result.store.id.toString(), type: 'GEO_MARKETING' }
            });
            return res.json({ success: true, message: '근처 매장 혜택 알림을 발송했습니다.', storeName: result.store.name });
        }
        res.json({ success: true, message: '업데이트 완료 (근처 혜택 없음)' });
    },

    // POST /fcm-token — FCM 토큰 등록
    async registerFcmToken(req, res) {
        const { phone, store_id, fcm_token } = req.body;
        if (!phone || !store_id || !fcm_token) {
            return res.status(400).json({ success: false, message: 'phone, store_id, fcm_token은 필수입니다.' });
        }
        await customerService.registerFcmToken({ phone, store_id, fcm_token });
        res.json({ success: true, message: '알림 토큰이 등록되었습니다.' });
    },
};

module.exports = customerController;
