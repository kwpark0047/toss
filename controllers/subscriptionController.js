const crypto = require('crypto');
const PlanRepository = require('../repositories/Plan');
const StoreSubscriptionRepository = require('../repositories/StoreSubscription');
const TossAPI = require('../utils/toss');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * 매장 구독 관리 컨트롤러 (정기결제)
 */
const subscriptionController = {
  /**
   * 구독 결제수단 등록
   * 1) Toss 빌링키 발급 (issueBillingKey)
   * 2) 실무자 빌링키면 정기결제 예약 생성 (createSubscription)
   * 3) store_subscriptions 최신화 (upsertByStore)
   */
  async registerPaymentMethod(req, res, next) {
    try {
      const storeId = req.storeId;
      const { plan_id: planId, method = 'CARD', card, easy_pay: easyPay } = req.body;

      const plan = await PlanRepository.findById(planId);
      if (!plan || !plan.is_active) {
        throw new AppError('플랜을 찾을 수 없습니다.', 404);
      }

      // Toss 고객 키: 'sub-' + store_id를 sha256으로 해시한 값
      const customerKey = `sub-${crypto.createHash('sha256').update(String(storeId)).digest('hex')}`;

      // 1) 빌링키 발급 (결제수단 등록)
      const billingKeyResult = await TossAPI.issueBillingKey(customerKey, method, card, easyPay);
      const billingKey = billingKeyResult?.billingKey;
      if (!billingKey) {
        throw new AppError('결제수단 등록에 실패했습니다.', 502);
      }

      // 모의 빌링키면 정기결제 예약 생성을 생략하고 등록만 처리
      const isMock = billingKey.startsWith('mock_');
      let subscriptionId = null;

      if (!isMock) {
        const subscription = await TossAPI.createSubscription(billingKey, customerKey, {
          interval: 'month',
          amount: plan.price_monthly,
          orderName: plan.name,
        });
        subscriptionId = subscription?.subscriptionId || null;
      }

      // 2) 매장 구독 정보 최신화
      const data = {
        plan: plan.name,
        billing_cycle: 'MONTHLY',
        payment_method_id: billingKey,
      };
      if (!isMock) {
        data.subscription_id = subscriptionId;
        data.auto_renew = true;
      }

      await StoreSubscriptionRepository.upsertByStore(storeId, data);

      logger.info(
        {
          storeId,
          plan: plan.name,
          isMock,
          subscriptionId,
        },
        '구독 결제수단 등록'
      );

      res.created(
        {
          subscription: {
            store_id: storeId,
            plan: plan.name,
            billing_cycle: 'MONTHLY',
            subscription_id: subscriptionId,
            payment_method_id: `****${billingKey.slice(-4)}`,
            is_mock: isMock,
          },
        },
        '결제수단이 등록되었습니다.'
      );
    } catch (error) {
      next(error);
    }
  },
};

module.exports = subscriptionController;
