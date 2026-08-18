const prisma = require('../config/prisma');

/**
 * Plan (플랜 정의) 리포지토리
 * 관리자가 설정하는 플랜 정의(가격, 기능, 제한 등)를 관리
 */
class PlanRepository {
  /**
   * 전체 활성 플랜 조회 (관리자/고객용)
   */
  async findActive() {
    return await prisma.plan.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    });
  }

  /**
   * 전체 플랜 조회 (비활성 포함, 관리자용)
   */
  async findAll() {
    return await prisma.plan.findMany({
      orderBy: { sort_order: 'asc' },
    });
  }

  /**
   * 플랜 ID로 단일 조회
   */
  async findById(id) {
    return await prisma.plan.findUnique({
      where: { id },
    });
  }

  /**
   * 플랜 이름으로 단일 조회
   */
  async findByName(name) {
    return await prisma.plan.findUnique({
      where: { name },
    });
  }

  /**
   * 플랜 생성 (관리자용)
   */
  async create(data) {
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
    } = data;

    return await prisma.plan.create({
      data: {
        name,
        display_name,
        description,
        price_monthly: price_monthly || 0,
        price_yearly: price_yearly || 0,
        features: features || {},
        limits: limits || {},
        is_active: is_active !== false,
        sort_order: sort_order || 0,
        trial_days: trial_days || 0,
      },
    });
  }

  /**
   * 플랜 수정 (관리자용)
   */
  async update(id, data) {
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
    } = data;

    return await prisma.plan.update({
      where: { id },
      data: {
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
        updated_at: new Date(),
      },
    });
  }

  /**
   * 플랜 삭제 (비활성화)
   */
  async delete(id) {
    return await prisma.plan.update({
      where: { id },
      data: { is_active: false },
    });
  }

  /**
   * 플랜 순서 변경
   */
  async reorder(plans) {
    return await prisma.$transaction(
      plans.map((p, idx) =>
        prisma.plan.update({
          where: { id: p.id },
          data: { sort_order: idx },
        })
      )
    );
  }
}

module.exports = new PlanRepository();
