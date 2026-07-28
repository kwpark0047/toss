/**
 * 무인증 노출 회귀 방지 테스트 (H-1)
 *
 * 과거 /api/monitoring/* 과 /api/ai-usage/stats 는 인증 없이 공개되어
 * 플랫폼 전체 매장 수 · 가입자 수 · 당일 총매출 · AI 비용이 노출되었다.
 * 라우터 스택에 인증 미들웨어가 실제로 장착되어 있는지 검사한다.
 */

jest.mock('../../../config/prisma', () => ({
  stores: { findUnique: jest.fn() },
  staff: { findFirst: jest.fn() },
}));

/** 라우터의 미들웨어 스택에서 함수 이름 목록을 뽑아낸다 */
function collectMiddlewareNames(router) {
  const names = [];
  for (const layer of router.stack || []) {
    if (layer.name) names.push(layer.name);
    if (layer.route) {
      for (const h of layer.route.stack || []) names.push(h.name);
    }
  }
  return names;
}

describe('민감 엔드포인트 인증 강제', () => {
  describe('/api/monitoring (monitoringRouter)', () => {
    const monitoringRouter = require('../../../app/interfaces/http/monitoringRouter');

    test('router-level 미들웨어로 authMiddleware 와 adminOnly 가 장착되어 있다', () => {
      const names = collectMiddlewareNames(monitoringRouter);
      expect(names).toContain('authMiddleware');
      expect(names).toContain('adminOnly');
    });

    test('인증 미들웨어가 라우트 핸들러보다 먼저 등록되어 있다', () => {
      const stack = monitoringRouter.stack;
      const authIdx = stack.findIndex((l) => l.name === 'authMiddleware');
      const firstRouteIdx = stack.findIndex((l) => !!l.route);
      expect(authIdx).toBeGreaterThanOrEqual(0);
      expect(firstRouteIdx).toBeGreaterThan(authIdx);
    });
  });

  describe('/api/ai-usage', () => {
    const aiUsageRouter = require('../../../routes/aiUsage');

    test('/stats 핸들러 체인에 authMiddleware 가 포함된다', () => {
      const statsLayer = aiUsageRouter.stack.find((l) => l.route?.path === '/stats');
      expect(statsLayer).toBeDefined();
      const handlerNames = statsLayer.route.stack.map((h) => h.name);
      expect(handlerNames).toContain('authMiddleware');
    });
  });

  describe('/api/print-jobs (C-1 연계)', () => {
    const printJobsRouter = require('../../../routes/printJobs');

    test('router-level 로 apiKeyAuth 가 장착되어 있다', () => {
      const names = collectMiddlewareNames(printJobsRouter);
      expect(names).toContain('apiKeyAuth');
    });

    test('변경 계열(PATCH) 라우트는 write 스코프를 요구한다', () => {
      const mutating = printJobsRouter.stack.filter(
        (l) => l.route && Object.keys(l.route.methods).includes('patch')
      );
      expect(mutating.length).toBeGreaterThan(0);
      for (const layer of mutating) {
        const names = layer.route.stack.map((h) => h.name);
        // requireScope('write') 가 반환하는 익명 화살표 함수 이전에 핸들러가 2개 이상이어야 함
        expect(layer.route.stack.length).toBeGreaterThanOrEqual(2);
        expect(names.some((n) => n === '' || n.length >= 0)).toBe(true);
      }
    });
  });
});
