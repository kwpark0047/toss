const CouponsService = require('../services/CouponsService');

const couponsService = new CouponsService();

/**
 * [쿠폰 및 캠페인 컨트롤러]
 * 외부 가맹점 매니저 대시보드 및 사용자 지갑 쿠폰 조회 HTTP 연결부입니다.
 */
const couponsController = {
    /**
     * GET /api/coupons/stores/:storeId/coupons
     * 특정 매장의 활성화된 전체 마스터 쿠폰 목록을 조회합니다.
     */
    async getStoreCoupons(req, res) {
        const { storeId } = req.params;
        const coupons = await couponsService.getStoreCoupons(storeId);
        res.success(coupons);
    },

    /**
     * POST /api/coupons/stores/:storeId/coupons
     * 신규 마스터 쿠폰 정의를 등록합니다.
     */
    async createCoupon(req, res) {
        const { storeId } = req.params;
        const coupon = await couponsService.createCoupon(storeId, req.body);
        res.success(coupon, '쿠폰이 성공적으로 생성되었습니다.');
    },

    /**
     * GET /api/coupons/stores/:storeId/campaigns
     * 특정 매장에 적용된 전체 자동 혜택 캠페인 목록을 조회합니다.
     */
    async getStoreCampaigns(req, res) {
        const { storeId } = req.params;
        const campaigns = await couponsService.getStoreCampaigns(storeId);
        res.success(campaigns);
    },

    /**
     * POST /api/coupons/stores/:storeId/campaigns
     * 매장 자동 혜택 마케팅 캠페인을 신규 생성하거나 수정합니다.
     */
    async saveCampaign(req, res) {
        const { storeId } = req.params;
        const campaign = await couponsService.saveCampaign(storeId, req.body);
        res.success(campaign, '마케팅 캠페인 설정이 정상적으로 저장되었습니다.');
    },

    /**
     * GET /api/coupons/my-coupons
     * 사용자 세션에 매핑된 실시간 보유 쿠폰들을 조회합니다 (비회원/회원 공통 휴대폰 기준).
     */
    async getMyCoupons(req, res) {
        const userId = req.user.id;
        const { store_id } = req.query;

        const coupons = await couponsService.getMyCoupons(userId, store_id);
        
        if (coupons.length === 0) {
            return res.success([], '보유 중인 미사용 쿠폰이 존재하지 않습니다.');
        }

        res.success(coupons);
    }
};

module.exports = couponsController;
