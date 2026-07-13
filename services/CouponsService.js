const prisma = require('../config/prisma');
const Coupon = require('../repositories/Coupon');
const logger = require('../utils/logger');

/**
 * [쿠폰 및 캠페인 비즈니스 서비스]
 * 수동/자동 마케팅 쿠폰 및 정기 캠페인 설정에 관한 코어 로직을 통합 처리합니다.
 */
class CouponsService {
    /**
     * 특정 매장의 활성화된 전체 마스터 쿠폰 목록을 조회합니다.
     */
    async getStoreCoupons(storeId) {
        if (!storeId) throw new Error('매장 ID는 필수입니다.');
        return await Coupon.getStoreCoupons(storeId);
    }

    /**
     * 신규 마스터 쿠폰을 발급 및 정의합니다.
     */
    async createCoupon(storeId, couponData) {
        if (!storeId) throw new Error('매장 ID는 필수입니다.');
        
        const data = {
            store_id: parseInt(storeId),
            name: couponData.name,
            type: couponData.type,
            amount: parseInt(couponData.amount) || 0,
            min_order_amount: parseInt(couponData.min_order_amount) || 0,
            valid_days: parseInt(couponData.valid_days) || 30,
            is_active: couponData.is_active ?? 1
        };

        const coupon = await Coupon.create(data);
        logger.info(`[쿠폰] 매장 ${storeId}번에 신규 마스터 쿠폰 "${data.name}"(이)가 정의되었습니다.`);
        return coupon;
    }

    /**
     * 매장별 자동 발급 타겟 캠페인 목록을 조회하고 해당 마스터 쿠폰 정보를 결합합니다.
     */
    async getStoreCampaigns(storeId) {
        if (!storeId) throw new Error('매장 ID는 필수입니다.');
        const sid = parseInt(storeId);

        // 1. 해당 매장의 전체 캠페인 설정 조회
        const campaigns = await prisma.campaign_settings.findMany({
            where: { store_id: sid }
        });

        // 2. 캠페인과 연계된 고유 마스터 쿠폰 ID 필터링
        const couponIds = [...new Set(campaigns.map(c => c.coupon_id).filter(Boolean))];
        
        // 3. 연관된 쿠폰 데이터 로드 및 맵 변환
        const coupons = couponIds.length
            ? await prisma.coupons.findMany({ where: { id: { in: couponIds } } })
            : [];
        const couponMap = Object.fromEntries(coupons.map(c => [c.id, c]));

        // 4. 캠페인 객체와 쿠폰 오브젝트 결합 반환
        return campaigns.map(c => ({
            ...c,
            coupon: couponMap[c.coupon_id] ?? null
        }));
    }

    /**
     * 자동 혜택 마케팅 캠페인을 신규 생성하거나 기존 캠페인을 업데이트합니다.
     */
    async saveCampaign(storeId, campaignData) {
        if (!storeId) throw new Error('매장 ID는 필수입니다.');
        const sid = parseInt(storeId);

        const data = {
            store_id: sid,
            trigger_type: campaignData.trigger_type,
            target_tier: campaignData.target_tier || null,
            coupon_id: parseInt(campaignData.coupon_id),
            is_active: campaignData.is_active ?? 1,
            updated_at: new Date()
        };

        let campaign;
        if (campaignData.id) {
            campaign = await prisma.campaign_settings.update({
                where: { id: parseInt(campaignData.id) },
                data
            });
            logger.info(`[캠페인] 매장 ${sid}번 캠페인 ID ${campaignData.id}번이 갱신되었습니다.`);
        } else {
            campaign = await prisma.campaign_settings.create({
                data
            });
            logger.info(`[캠페인] 매장 ${sid}번에 신규 마케팅 캠페인이 등록되었습니다.`);
        }

        return campaign;
    }

    /**
     * 로그인된 회원 본인의 실시간 사용 가능한 가맹 쿠폰 목록을 반환합니다.
     */
    async getMyCoupons(userId, storeId = null) {
        if (!userId) throw new Error('사용자 세션 인증이 유효하지 않습니다.');

        // 1. 해당 사용자의 지갑(전화번호) 메타 조회
        const userPoints = await prisma.user_points.findFirst({
            where: { user_id: parseInt(userId) }
        });

        if (!userPoints || !userPoints.phone) {
            return [];
        }

        // 2. 해당 지갑(휴대폰 번호)에 발급된 사용하지 않은 유효 쿠폰 반환
        return await Coupon.getCustomerCoupons(userPoints.phone, storeId);
    }
}

module.exports = CouponsService;
