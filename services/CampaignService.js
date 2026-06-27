const prisma = require('../config/prisma');
const Coupon = require('../models/Coupon');
const logger = require('../utils/logger');
const { sendSms } = require('../utils/smsService');

/**
 * [캠페인 서비스]
 * 마케팅 트리거를 감지하여 자동으로 쿠폰을 발급합니다.
 */
class CampaignService {
    /**
     * [등급 승급 트리거 처리]
     */
    static async handleTierUp(storeId, customerPhone, newTier) {
        logger.info(`[Campaign] 등급 승급 감지: ${customerPhone} -> ${newTier}`);

        try {
            // 1. 해당 등급 승급 시 발급하도록 설정된 캠페인 조회
            const campaigns = await prisma.campaign_settings.findMany({
                where: {
                    store_id: parseInt(storeId),
                    trigger_type: 'TIER_UP',
                    target_tier: newTier,
                    is_active: 1
                }
            });

            for (const campaign of campaigns) {
                // 2. 쿠폰 발급
                await Coupon.issueToCustomer(customerPhone, campaign.coupon_id);
                logger.info(`[Campaign] 쿠폰 발급 완료: ${customerPhone} (Campaign ID: ${campaign.id})`);

                // 쿠폰 발급 알림 SMS 전송
                await sendSms(customerPhone, `[매장] 등급이 ${newTier}(으)로 올랐습니다! 특별 쿠폰이 발급되었습니다. 매장에서 확인해주세요.`);
            }
        } catch (error) {
            logger.error(error);
        }
    }

    static async handleWelcome(storeId, customerPhone) {
        logger.info(`[Campaign] 첫 방문(WELCOME) 감지: ${customerPhone}`);
        try {
            const campaigns = await prisma.campaign_settings.findMany({
                where: {
                    store_id: parseInt(storeId),
                    trigger_type: 'WELCOME',
                    is_active: 1
                }
            });

            for (const campaign of campaigns) {
                await Coupon.issueToCustomer(customerPhone, campaign.coupon_id);
                logger.info(`[Campaign] WELCOME 쿠폰 발급 완료: ${customerPhone}`);
                await sendSms(customerPhone, `[매장] 첫 방문을 환영합니다! 감사 쿠폰이 발급되었습니다. 다음 방문 시 사용해주세요.`);
            }
        } catch (error) {
            logger.error(error);
        }
    }
}

module.exports = CampaignService;
