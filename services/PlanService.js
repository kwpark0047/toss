const PlanRepository = require('../repositories/Plan');
const { AppError } = require('../utils/errorHandler');

/**
 * Plan 서비스 - 플랜 정의 관리
 */
class PlanService {
  /**
   * 활성 플랜 목록 조회 (고객용)
   */
  async getActivePlans() {
    return await PlanRepository.findActive();
  }

  /**
   * 플랜 상세 조회
   */
  async getPlanById(id) {
    const plan = await PlanRepository.findById(id);
    if (!plan) {
      throw new AppError('플랜을 찾을 수 없습니다', 404);
    }
    return plan;
  }

  /**
   * 플랜명으로 조회
   */
  async getPlanByName(name) {
    const plan = await PlanRepository.findByName(name);
    if (!plan) {
      throw new AppError('플랜을 찾을 수 없습니다', 404);
    }
    return plan;
  }

  /**
   * 플랜 생성 (관리자용)
   */
  async createPlan(data) {
    const { name } = data;

    // 중복 체크
    const existing = await PlanRepository.findByName(name);
    if (existing) {
      throw new AppError('이미 존재하는 플랜 이름입니다', 409);
    }

    // price_yearly 기본값: 월간 * 12 * 0.9 (10% 할인)
    const priceYearly = data.price_yearly || Math.round((data.price_monthly || 0) * 12 * 0.9);

    return await PlanRepository.create({
      ...data,
      price_yearly: priceYearly,
      features: data.features || {},
      limits: data.limits || {},
    });
  }

  /**
   * 플랜 수정 (관리자용)
   */
  async updatePlan(id, data) {
    const plan = await this.getPlanById(id);

    // 이름 변경 시 중복 체크
    if (data.name && data.name !== plan.name) {
      const existing = await PlanRepository.findByName(data.name);
      if (existing && existing.id !== id) {
        throw new AppError('이미 존재하는 플랜 이름입니다', 409);
      }
    }

    return await PlanRepository.update(id, data);
  }

  /**
   * 플랜 비활성화 (관리자용)
   */
  async deactivatePlan(id) {
    await this.getPlanById(id);
    return await PlanRepository.delete(id);
  }

  /**
   * 플랜 순서 변경
   */
  async reorderPlans(planOrders) {
    return await PlanRepository.reorder(planOrders);
  }

  /**
   * 플랜 기능/제한 체크 헬퍼
   */
  checkFeatureAccess(plan, feature) {
    return plan.features?.[feature] === true;
  }

  checkLimit(plan, limitKey) {
    const limit = plan.limits?.[limitKey];
    if (limit === -1 || limit === null || limit === undefined)
      return { allowed: true, limit: null };
    return { allowed: true, limit };
  }
}

module.exports = new PlanService();
