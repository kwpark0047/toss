const SubscriptionService = require('../services/SubscriptionService');
const { AppError } = require('../utils/errorHandler');

/**
 * 플랜 기능 접근 제어 미들웨어
 * 구독 플랜에 따라 API/기능 접근 제어
 */

const PLAN_FEATURES = {
  // 기능명: { free: boolean, pro: boolean, enterprise: boolean }
  aiRecommendations: { free: false, pro: true, enterprise: true },
  brandpay: { free: false, pro: true, enterprise: true },
  analytics: { free: 'basic', pro: 'advanced', enterprise: 'premium' },
  customDomain: { free: false, pro: true, enterprise: true },
  dedicatedManager: { free: false, pro: false, enterprise: true },
  apiAccess: { free: false, pro: false, enterprise: true },
  maxMenus: { free: 50, pro: 200, enterprise: -1 },
  maxStaff: { free: 1, pro: 10, enterprise: -1 },
  ordersPerMonth: { free: 1000, pro: 10000, enterprise: -1 },
};

/**
 * 플랜 기능 사용 가능 여부 체크
 */
function checkPlanFeature(planName, feature) {
  const featureDef = PLAN_FEATURES[feature];
  if (!featureDef) return true; // 정의되지 않은 기능은 허용

  const allowed = featureDef[planName];
  if (allowed === true) return true;
  if (allowed === false) return false;
  if (typeof allowed === 'number') return allowed > 0; // -1 = 무제한
  if (typeof allowed === 'string') return allowed !== 'basic' || planName !== 'free'; // basic도 허용

  return false;
}

/**
 * 플랜 제한 수량 체크
 */
function checkPlanLimit(planName, limitKey, currentUsage) {
  const featureDef = PLAN_FEATURES[limitKey];
  if (!featureDef) return { allowed: true, limit: null, usage: currentUsage };

  const limit = featureDef[planName];
  if (limit === -1) return { allowed: true, limit: -1, usage: currentUsage }; // 무제한
  if (typeof limit === 'number') {
    return {
      allowed: currentUsage < limit,
      limit,
      usage: currentUsage,
      remaining: Math.max(0, limit - currentUsage),
    };
  }
  return { allowed: true, limit: null, usage: currentUsage };
}

/**
 * 미들웨어: 특정 기능 접근 제어
 */
function requirePlanFeature(feature) {
  return async (req, res, next) => {
    try {
      const storeId = req.params.storeId || req.body.store_id || req.query.store_id;
      const userRole = req.user?.role;

      // super_admin은 모든 기능 접근 허용
      if (userRole === 'super_admin') {
        return next();
      }

      if (!storeId) {
        return next(new AppError('매장 ID가 필요합니다', 400));
      }

      const subscription = await require('../services/SubscriptionService').getSubscription(
        storeId
      );
      if (!subscription) {
        return next(new AppError('구독 정보를 찾을 수 없습니다', 404));
      }

      const planName = subscription.plan?.name || 'free';
      const allowed = checkPlanFeature(planName, feature);

      if (!allowed) {
        return next(
          new AppError(
            `현재 플랜(${planName})에서는 ${feature} 기능을 사용할 수 없습니다. 업그레이드가 필요합니다.`,
            403
          )
        );
      }

      req.plan = { name: planName, subscription };
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * 미들웨어: 사용량 제한 체크 (메뉴 수, 직원 수 등)
 */
function requirePlanLimit(limitKey, getCurrentUsage) {
  return async (req, res, next) => {
    try {
      const storeId = req.params.storeId || req.body.store_id || req.query.store_id;
      const userRole = req.user?.role;

      if (userRole === 'super_admin') {
        return next();
      }

      if (!storeId) {
        return next(new AppError('매장 ID가 필요합니다', 400));
      }

      const subscription = await require('../services/SubscriptionService').getSubscription(
        storeId
      );
      if (!subscription) {
        return next(new AppError('구독 정보를 찾을 수 없습니다', 404));
      }

      const planName = subscription.plan?.name || 'free';
      const currentUsage = getCurrentUsage ? await getCurrentUsage(storeId) : 0;
      const limitCheck = checkPlanLimit(planName, limitKey, currentUsage);

      if (!limitCheck.allowed) {
        return next(
          new AppError(
            `현재 플랜(${planName})의 ${limitKey} 제한(${limitCheck.limit}개)을 초과했습니다. 현재 사용: ${currentUsage}개. 업그레이드가 필요합니다.`,
            403
          )
        );
      }

      req.planLimit = limitCheck;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * 현재 플랜 정보 조회 헬퍼
 */
async function getCurrentPlan(req) {
  const storeId = req.params.storeId || req.body.store_id || req.query.store_id;
  if (!storeId) return { name: 'free', subscription: null };

  const subscription = await require('../services/SubscriptionService').getSubscription(storeId);
  return {
    name: subscription?.plan?.name || 'free',
    subscription,
    features: PLAN_FEATURES,
  };
}

module.exports = {
  checkPlanFeature,
  checkPlanLimit,
  requirePlanFeature,
  requirePlanLimit,
  getCurrentPlan,
  PLAN_FEATURES,
};
