/**
 * printJobsController 단위 테스트 — 매장 스코프 강제(IDOR 방지) 회귀 테스트
 *
 * 배경: 과거 /api/print-jobs/* 는 인증이 전혀 없었고 클라이언트가 보낸
 *       store_id 를 그대로 신뢰해 전 매장 인쇄작업 열람/탈취가 가능했다.
 *       본 테스트는 그 회귀를 막는다.
 */
const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
};
jest.mock('../../../config/prisma', () => mockPrisma);

const printJobsController = require('../../../controllers/printJobsController');

describe('printJobsController — 매장 스코프 강제', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: {},
      query: {},
      body: {},
      ip: '127.0.0.1',
      apiClient: { storeId: 42, scopes: ['read', 'write'], keyId: 1 },
    };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  });

  describe('인증 누락', () => {
    test.each(['getPending', 'claim', 'complete', 'fail'])(
      '%s: apiClient 없으면 401',
      async (method) => {
        req.apiClient = undefined;
        req.params.jobId = '1';
        await printJobsController[method](req, res);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
        expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
      }
    );
  });

  describe('타 매장 접근 차단', () => {
    test('query.store_id 가 API 키 매장과 다르면 403', async () => {
      req.query.store_id = '99';
      await printJobsController.getPending(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    test('params.storeId 가 API 키 매장과 다르면 403', async () => {
      req.params.storeId = '99';
      await printJobsController.getPending(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });
  });

  describe('getPending', () => {
    test('클라이언트 store_id 를 무시하고 API 키 매장으로만 조회한다', async () => {
      req.query.store_id = '42';
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ id: 1, store_id: 42 }]);

      await printJobsController.getPending(req, res);

      const [sql, boundStoreId] = mockPrisma.$queryRawUnsafe.mock.calls[0];
      expect(sql).toContain('store_id = $1');
      expect(boundStoreId).toBe(42); // 문자열이 아닌 API 키 매장 정수
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id: 1, store_id: 42 }] });
    });

    test('store_id 미지정이어도 API 키 매장으로 조회된다', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
      await printJobsController.getPending(req, res);
      expect(mockPrisma.$queryRawUnsafe.mock.calls[0][1]).toBe(42);
    });
  });

  describe('claim', () => {
    test('UPDATE 에 store_id 조건이 포함된다', async () => {
      req.params.jobId = '7';
      mockPrisma.$executeRawUnsafe.mockResolvedValue(1);

      await printJobsController.claim(req, res);

      const [sql, jobId, storeId] = mockPrisma.$executeRawUnsafe.mock.calls[0];
      expect(sql).toContain('store_id = $2');
      expect(sql).toContain("status = 'pending'");
      expect(jobId).toBe(7);
      expect(storeId).toBe(42);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    test('영향 행이 0이면 409 (타 매장 작업 or 이미 점유)', async () => {
      req.params.jobId = '7';
      mockPrisma.$executeRawUnsafe.mockResolvedValue(0);
      await printJobsController.claim(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
    });

    test('잘못된 jobId 형식은 400', async () => {
      req.params.jobId = 'abc';
      await printJobsController.claim(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    test('printing 상태 + 자기 매장일 때만 done 처리하며 스키마 컬럼(printed_at)을 사용한다', async () => {
      req.params.jobId = '7';
      mockPrisma.$executeRawUnsafe.mockResolvedValue(1);

      await printJobsController.complete(req, res);

      const [sql] = mockPrisma.$executeRawUnsafe.mock.calls[0];
      expect(sql).toContain("status = 'done'");
      expect(sql).toContain('printed_at = NOW()');
      expect(sql).not.toContain('completed_at'); // 스키마에 없는 컬럼 회귀 방지
      expect(sql).toContain('store_id = $2');
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    test('점유 중이 아니면 409', async () => {
      req.params.jobId = '7';
      mockPrisma.$executeRawUnsafe.mockResolvedValue(0);
      await printJobsController.complete(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe('fail', () => {
    test('MAX_ATTEMPTS 미만이면 pending 으로 복귀한다', async () => {
      req.params.jobId = '7';
      req.body.error = 'printer offline';
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ attempts: 1 }]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(1);

      await printJobsController.fail(req, res);

      const [, status, reason, jobId, storeId] = mockPrisma.$executeRawUnsafe.mock.calls[0];
      expect(status).toBe('pending');
      expect(reason).toBe('printer offline');
      expect(jobId).toBe(7);
      expect(storeId).toBe(42);
    });

    test('MAX_ATTEMPTS 이상이면 failed 로 확정한다', async () => {
      req.params.jobId = '7';
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ attempts: 3 }]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(1);

      await printJobsController.fail(req, res);

      expect(mockPrisma.$executeRawUnsafe.mock.calls[0][1]).toBe('failed');
    });

    test('타 매장 작업이면 조회 결과가 없어 409', async () => {
      req.params.jobId = '7';
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
      await printJobsController.fail(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    test('에러 사유는 300자로 절단된다', async () => {
      req.params.jobId = '7';
      req.body.error = 'x'.repeat(1000);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ attempts: 0 }]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(1);

      await printJobsController.fail(req, res);

      expect(mockPrisma.$executeRawUnsafe.mock.calls[0][2]).toHaveLength(300);
    });
  });
});
