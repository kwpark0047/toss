jest.mock('../../../services/SubscriptionService', () => ({
  getSubscription: jest.fn(),
}));

const SubscriptionService = require('../../../services/SubscriptionService');
const {
  checkPlanFeature,
  checkPlanLimit,
  requirePlanFeature,
  requirePlanLimit,
  getCurrentPlan,
  PLAN_FEATURES,
} = require('../../../middleware/planFeatures');

describe('middleware/planFeatures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PLAN_FEATURES', () => {
    test('플랜별 기능 매트릭스를 정의한다', () => {
      expect(PLAN_FEATURES.aiRecommendations.free).toBe(false);
      expect(PLAN_FEATURES.aiRecommendations.pro).toBe(true);
      expect(PLAN_FEATURES.maxMenus.enterprise).toBe(-1);
      expect(PLAN_FEATURES.analytics.free).toBe('basic');
    });
  });

  describe('checkPlanFeature', () => {
    test('정의되지 않은 기능은 허용', () => {
      expect(checkPlanFeature('free', 'nonexistentFeature')).toBe(true);
    });

    test('불리언 기능 체크', () => {
      expect(checkPlanFeature('free', 'aiRecommendations')).toBe(false);
      expect(checkPlanFeature('pro', 'aiRecommendations')).toBe(true);
      expect(checkPlanFeature('enterprise', 'aiRecommendations')).toBe(true);
    });

    test('숫자형 기능은 양수 한도면 true, -1(무제한)은 false', () => {
      expect(checkPlanFeature('free', 'maxMenus')).toBe(true);
      expect(checkPlanFeature('enterprise', 'maxMenus')).toBe(false);
    });

    test('문자열 등급은 free의 basic일 때만 거부', () => {
      expect(checkPlanFeature('free', 'analytics')).toBe(false);
      expect(checkPlanFeature('pro', 'analytics')).toBe(true);
    });

    test('정의되지 않은 플랜 이름은 false', () => {
      expect(checkPlanFeature('gold', 'aiRecommendations')).toBe(false);
    });
  });

  describe('checkPlanLimit', () => {
    test('정의되지 않은 limitKey는 항상 허용', () => {
      const result = checkPlanLimit('free', 'nonexistent', 5);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBeNull();
    });

    test('무제한(-1)은 허용', () => {
      const result = checkPlanLimit('enterprise', 'maxMenus', 999);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
    });

    test('한도 초과 시 allowed false + remaining 계산', () => {
      const result = checkPlanLimit('free', 'maxMenus', 60);
      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(50);
      expect(result.usage).toBe(60);
      expect(result.remaining).toBe(0);
    });

    test('한도 미만 시 allowed true', () => {
      const result = checkPlanLimit('pro', 'maxStaff', 3);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(7);
    });

    test('문자열 limit은 허용', () => {
      const result = checkPlanLimit('free', 'analytics', 1);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBeNull();
    });
  });

  describe('requirePlanFeature', () => {
    const next = jest.fn();
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    beforeEach(() => {
      next.mockClear();
      res.status.mockClear();
      res.json.mockClear();
    });

    test('super_admin은 통과', async () => {
      const mw = requirePlanFeature('aiRecommendations');
      await mw({ params: {}, body: {}, query: {}, user: { role: 'super_admin' } }, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    test('storeId 없으면 400', async () => {
      const mw = requirePlanFeature('aiRecommendations');
      await mw({ params: {}, body: {}, query: {}, user: { role: 'owner' } }, res, next);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(400);
    });

    test('구독 없으면 404', async () => {
      SubscriptionService.getSubscription.mockResolvedValue(null);
      const mw = requirePlanFeature('aiRecommendations');
      await mw({ params: { storeId: '1' }, user: { role: 'owner' } }, res, next);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(404);
    });

    test('기능 미허용 플랜이면 403', async () => {
      SubscriptionService.getSubscription.mockResolvedValue({ plan: { name: 'free' } });
      const mw = requirePlanFeature('aiRecommendations');
      const req = { params: { storeId: '1' }, user: { role: 'owner' } };
      await mw(req, res, next);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(403);
    });

    test('허용 플랜이면 req.plan 설정 후 통과', async () => {
      const sub = { plan: { name: 'pro' } };
      SubscriptionService.getSubscription.mockResolvedValue(sub);
      const mw = requirePlanFeature('aiRecommendations');
      const req = { params: {}, body: { store_id: '1' }, user: { role: 'owner' } };
      await mw(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.plan).toEqual({ name: 'pro', subscription: sub });
    });

    test('서비스 에러는 next로 전파', async () => {
      SubscriptionService.getSubscription.mockRejectedValue(new Error('boom'));
      const mw = requirePlanFeature('aiRecommendations');
      await mw({ params: { storeId: '1' }, user: { role: 'owner' } }, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('requirePlanLimit', () => {
    const next = jest.fn();

    beforeEach(() => next.mockClear());

    test('super_admin은 통과', async () => {
      const mw = requirePlanLimit('maxMenus', jest.fn());
      await mw({ params: {}, body: {}, query: {}, user: { role: 'super_admin' } }, {}, next);
      expect(next).toHaveBeenCalledWith();
    });

    test('storeId 없으면 400', async () => {
      const mw = requirePlanLimit('maxMenus', jest.fn());
      await mw({ params: {}, body: {}, query: {}, user: { role: 'owner' } }, {}, next);
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });

    test('구독 없으면 404', async () => {
      SubscriptionService.getSubscription.mockResolvedValue(null);
      const mw = requirePlanLimit('maxMenus', jest.fn());
      await mw({ params: { storeId: '1' }, user: { role: 'owner' } }, {}, next);
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });

    test('사용량 초과 시 403', async () => {
      SubscriptionService.getSubscription.mockResolvedValue({ plan: { name: 'free' } });
      const mw = requirePlanLimit('maxMenus', async () => 60);
      await mw({ params: { storeId: '1' }, user: { role: 'owner' } }, {}, next);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(403);
      expect(err.message).toContain('maxMenus');
    });

    test('허용 시 req.planLimit 설정 후 통과', async () => {
      SubscriptionService.getSubscription.mockResolvedValue({ plan: { name: 'pro' } });
      const mw = requirePlanLimit('maxMenus', async () => 10);
      const req = { params: { storeId: '1' }, user: { role: 'owner' } };
      await mw(req, {}, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.planLimit.allowed).toBe(true);
    });

    test('getCurrentUsage 미제공 시 기본 0 사용', async () => {
      SubscriptionService.getSubscription.mockResolvedValue({ plan: { name: 'pro' } });
      const mw = requirePlanLimit('maxMenus');
      const req = { params: { storeId: '1' }, user: { role: 'owner' } };
      await mw(req, {}, next);
      expect(req.planLimit.usage).toBe(0);
    });
  });

  describe('getCurrentPlan', () => {
    test('storeId 없으면 기본 free 반환', async () => {
      const plan = await getCurrentPlan({ params: {}, body: {}, query: {} });
      expect(plan.name).toBe('free');
      expect(plan.subscription).toBeNull();
    });

    test('구독 기반 플랜 반환', async () => {
      const sub = { plan: { name: 'enterprise' } };
      SubscriptionService.getSubscription.mockResolvedValue(sub);
      const plan = await getCurrentPlan({ params: { storeId: '1' } });
      expect(plan.name).toBe('enterprise');
      expect(plan.subscription).toBe(sub);
    });

    test('구독 없으면 free 폴백', async () => {
      SubscriptionService.getSubscription.mockResolvedValue(null);
      const plan = await getCurrentPlan({ params: { storeId: '1' } });
      expect(plan.name).toBe('free');
    });
  });
});
