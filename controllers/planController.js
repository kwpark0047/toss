const PlanService = require('../services/PlanService');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * 관리자용 플랜 관리 컨트롤러
 */
const planController = {
  // 플랜 목록 조회 (관리자용 - 전체 포함 비활성)
  async getAllPlans(req, res, next) {
    try {
      const plans = await require('../repositories/Plan').findActive(); // 관리자는 전체 보면 좋음
      res.success(plans);
    } catch (error) {
      next(error);
    }
  },

  // 플랜 상세 조회
  async getPlanById(req, res, next) {
    try {
      const plan = await PlanService.getPlanById(req.params.id);
      res.success(plan);
    } catch (error) {
      next(error);
    }
  },

  // 플랜 생성
  async createPlan(req, res, next) {
    try {
      const {
        name,
        display_name,
        description,
        price_monthly,
        price_yearly,
        features,
        limits,
        is_active,
        sort_order,
        trial_days,
      } = req.body;

      if (!name || !display_name || price_monthly === undefined) {
        return next(
          new AppError('필수 필드(name, display_name, price_monthly)가 누락되었습니다', 400)
        );
      }

      const plan = await PlanService.createPlan({
        name,
        display_name,
        description,
        price_monthly,
        price_yearly,
        features,
        limits,
        is_active,
        sort_order,
        trial_days,
      });

      logger.info({ planId: plan.id, name: plan.name }, '관리자 플랜 생성');
      res.created(plan, '플랜이 생성되었습니다');
    } catch (error) {
      next(error);
    }
  },

  // 플랜 수정
  async updatePlan(req, res, next) {
    try {
      const plan = await PlanService.updatePlan(req.params.id, req.body);
      logger.info({ planId: req.params.id }, '관리자 플랜 수정');
      res.success(plan, '플랜이 수정되었습니다');
    } catch (error) {
      next(error);
    }
  },

  // 플랜 비활성화
  async deactivatePlan(req, res, next) {
    try {
      const plan = await PlanService.deactivatePlan(req.params.id);
      logger.info({ planId: req.params.id }, '관리자 플랜 비활성화');
      res.success(plan, '플랜이 비활성화되었습니다');
    } catch (error) {
      next(error);
    }
  },

  // 플랜 순서 변경
  async reorderPlans(req, res, next) {
    try {
      const { plans } = req.body; // [{ id, sort_order }]

      if (!Array.isArray(plans) || plans.length === 0) {
        return res.status(400).json({ error: 'plans 배열이 필요합니다' });
      }

      await require('../services/PlanService').reorderPlans(plans);
      logger.info('플랜 순서 변경');
      res.success({ message: '플랜 순서가 변경되었습니다' });
    } catch (error) {
      next(error);
    }
  },

  // 구독 현황 통계 (대시보드용)
  async getSubscriptionStats(req, res, next) {
    try {
      const stats = await require('../services/SubscriptionService').getStats();
      res.success(stats);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = planController;
