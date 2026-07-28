/**
 * 라우트 계층 통합 테스트 — 보안 경계 검증 (M-1)
 *
 * 단위 테스트는 컨트롤러 내부 로직만 봤고 라우트 계층 커버리지는 사실상 0% 였다.
 * 여기서는 supertest 로 **미들웨어 체인을 실제로 통과시키며** 인증/권한/입력검증이
 * HTTP 경계에서 제대로 동작하는지 확인한다.
 *
 * 컨트롤러 뒤편(DB)은 목으로 대체하고, 관심사는 "누가 무엇에 접근 가능한가"에 둔다.
 */
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-route-guards';

// ── 공통 목 ────────────────────────────────────────────────────────
const mockPrisma = {
  $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  $executeRawUnsafe: jest.fn().mockResolvedValue(1),
  stores: { findUnique: jest.fn().mockResolvedValue(null) },
  staff: { findFirst: jest.fn().mockResolvedValue(null) },
  news: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
};
jest.mock('../../config/prisma', () => mockPrisma);

jest.mock('../../services/newsCrawlerService', () => ({
  crawlAllSources: jest.fn().mockResolvedValue(undefined),
  startNewsCron: jest.fn(),
}));

jest.mock('../../utils/aiUsageTracker', () => ({
  getUsageStats: jest.fn().mockResolvedValue({
    records: [],
    stats: { _sum: {}, _count: { id: 0 }, _avg: {} },
  }),
}));

/** 라우터를 최소 Express 앱에 마운트한다 */
function mountApp(mountPath, router) {
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);
  // 라우트에서 던진 에러가 500 으로 떨어지도록 최소 핸들러 부착

  app.use((err, req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message });
  });
  return app;
}

const tokenFor = (payload) => jwt.sign(payload, process.env.JWT_SECRET);
const USER_TOKEN = tokenFor({ id: 1, role: 'owner' });
const ADMIN_TOKEN = tokenFor({ id: 99, role: 'super_admin' });

describe('라우트 보안 경계', () => {
  beforeEach(() => jest.clearAllMocks());

  // ════════════════════════════════════════════════════════════════
  describe('POST/GET /api/print-jobs — API 키 필수 (C-1)', () => {
    const app = mountApp('/api/print-jobs', require('../../routes/printJobs'));

    test('API 키 없이 목록 조회하면 401', async () => {
      const res = await request(app).get('/api/print-jobs/pending?store_id=1');
      expect(res.status).toBe(401);
      expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    test('API 키 없이 claim 하면 401 (타 매장 작업 탈취 차단)', async () => {
      const res = await request(app).patch('/api/print-jobs/1/claim');
      expect(res.status).toBe(401);
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    test('JWT 로는 접근할 수 없다 (API 키 전용 경로)', async () => {
      const res = await request(app)
        .get('/api/print-jobs/pending')
        .set('Authorization', `Bearer ${USER_TOKEN}`);
      expect(res.status).toBe(401);
    });

    test('폐기되었거나 존재하지 않는 API 키는 401', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]); // api_keys 조회 결과 없음
      const res = await request(app)
        .get('/api/print-jobs/pending')
        .set('X-API-Key', 'wm_live_' + 'a'.repeat(48));
      expect(res.status).toBe(401);
    });

    test('유효한 API 키면 자기 매장 작업만 조회한다', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ id: 1, store_id: 42, scopes: 'read,write', revoked: false }])
        .mockResolvedValueOnce([{ id: 7, store_id: 42 }]);

      const res = await request(app)
        .get('/api/print-jobs/pending?store_id=42')
        .set('X-API-Key', 'wm_live_' + 'a'.repeat(48));

      expect(res.status).toBe(200);
      const jobQuery = mockPrisma.$queryRawUnsafe.mock.calls[1];
      expect(jobQuery[1]).toBe(42); // API 키 매장으로 바인딩
    });

    test('API 키 매장과 다른 store_id 를 요청하면 403', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        { id: 1, store_id: 42, scopes: 'read,write', revoked: false },
      ]);

      const res = await request(app)
        .get('/api/print-jobs/pending?store_id=999')
        .set('X-API-Key', 'wm_live_' + 'a'.repeat(48));

      expect(res.status).toBe(403);
    });

    test('read 스코프만 있는 키는 claim 할 수 없다', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        { id: 1, store_id: 42, scopes: 'read', revoked: false },
      ]);

      const res = await request(app)
        .patch('/api/print-jobs/7/claim')
        .set('X-API-Key', 'wm_live_' + 'a'.repeat(48));

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('insufficient_scope');
    });
  });

  // ════════════════════════════════════════════════════════════════
  describe('GET /api/monitoring — super_admin 전용 (H-1)', () => {
    const app = mountApp('/api/monitoring', require('../../app/interfaces/http/monitoringRouter'));

    test('무인증 접근은 401 (플랫폼 매출 노출 차단)', async () => {
      const res = await request(app).get('/api/monitoring/stats');
      expect(res.status).toBe(401);
    });

    test('일반 점주 토큰은 403', async () => {
      const res = await request(app)
        .get('/api/monitoring/stats')
        .set('Authorization', `Bearer ${USER_TOKEN}`);
      expect(res.status).toBe(403);
    });

    test('errors 엔드포인트도 동일하게 보호된다', async () => {
      const res = await request(app).get('/api/monitoring/errors');
      expect(res.status).toBe(401);
    });

    test('만료된 토큰은 401 + TOKEN_EXPIRED 코드', async () => {
      const expired = jwt.sign({ id: 1, role: 'super_admin' }, process.env.JWT_SECRET, {
        expiresIn: '-1s',
      });
      const res = await request(app)
        .get('/api/monitoring/stats')
        .set('Authorization', `Bearer ${expired}`);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('TOKEN_EXPIRED');
    });
  });

  // ════════════════════════════════════════════════════════════════
  describe('GET /api/ai-usage/stats — 스코프별 권한 (H-1)', () => {
    const app = mountApp('/api/ai-usage', require('../../routes/aiUsage'));

    test('무인증은 401', async () => {
      const res = await request(app).get('/api/ai-usage/stats');
      expect(res.status).toBe(401);
    });

    test('일반 사용자가 storeId 없이(플랫폼 전체) 조회하면 403', async () => {
      const res = await request(app)
        .get('/api/ai-usage/stats')
        .set('Authorization', `Bearer ${USER_TOKEN}`);
      expect(res.status).toBe(403);
    });

    test('super_admin 은 플랫폼 전체 조회가 가능하다', async () => {
      const res = await request(app)
        .get('/api/ai-usage/stats')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.summary).toBeDefined();
    });

    test('권한 없는 매장 조회는 403', async () => {
      mockPrisma.stores.findUnique.mockResolvedValue({ user_id: 12345 }); // 남의 매장
      mockPrisma.staff.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/ai-usage/stats?storeId=5')
        .set('Authorization', `Bearer ${USER_TOKEN}`);

      expect(res.status).toBe(403);
    });

    test('본인 소유 매장은 조회 가능', async () => {
      mockPrisma.stores.findUnique.mockResolvedValue({ user_id: 1 });

      const res = await request(app)
        .get('/api/ai-usage/stats?storeId=5')
        .set('Authorization', `Bearer ${USER_TOKEN}`);

      expect(res.status).toBe(200);
    });

    test('잘못된 storeId 형식은 400', async () => {
      const res = await request(app)
        .get('/api/ai-usage/stats?storeId=abc')
        .set('Authorization', `Bearer ${USER_TOKEN}`);
      expect(res.status).toBe(400);
    });
  });

  // ════════════════════════════════════════════════════════════════
  describe('/api/news — 조회 공개 / 크롤링 관리자 (M-2)', () => {
    const app = mountApp('/api/news', require('../../routes/news'));

    test('목록 조회는 인증 없이 가능하다', async () => {
      const res = await request(app).get('/api/news');
      expect(res.status).toBeLessThan(500);
      expect(res.status).not.toBe(401);
    });

    test('크롤링 트리거는 무인증 시 401 (아웃바운드 남용 차단)', async () => {
      const res = await request(app).post('/api/news/crawl');
      expect(res.status).toBe(401);
    });

    test('일반 사용자의 크롤링 트리거는 403', async () => {
      const res = await request(app)
        .post('/api/news/crawl')
        .set('Authorization', `Bearer ${USER_TOKEN}`);
      expect(res.status).toBe(403);
    });
  });

  // ════════════════════════════════════════════════════════════════
  describe('/api/uploads — 인증 및 파일 검증 (M-9)', () => {
    const app = mountApp('/api/uploads', require('../../routes/uploads'));

    test('무인증 업로드는 401', async () => {
      const res = await request(app)
        .post('/api/uploads/image')
        .attach('image', Buffer.from('fake'), 'a.png');
      expect(res.status).toBe(401);
    });

    test('무인증 삭제는 401', async () => {
      const res = await request(app).delete('/api/uploads/image/a.png');
      expect(res.status).toBe(401);
    });

    test('경로 이탈 파일명 삭제 시도는 400', async () => {
      const res = await request(app)
        .delete('/api/uploads/image/..%2F..%2Fpackage.json')
        .set('Authorization', `Bearer ${USER_TOKEN}`);
      expect([400, 404]).toContain(res.status);
    });

    test('파일 없이 업로드하면 400', async () => {
      const res = await request(app)
        .post('/api/uploads/image')
        .set('Authorization', `Bearer ${USER_TOKEN}`);
      expect(res.status).toBe(400);
    });
  });
});
