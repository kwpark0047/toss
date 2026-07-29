const request = require('supertest');
const { app } = require('../../app');

let mockUser = { id: 1, name: '장사장', role: 'user', store_id: 1 };

jest.mock('../../middleware/auth', () => {
  const mockAuthMiddleware = (req, res, next) => {
    if (!mockUser) {
      return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    }
    req.user = mockUser;
    req.storeId = mockUser.store_id;
    next();
  };
  mockAuthMiddleware.authMiddleware = mockAuthMiddleware;
  mockAuthMiddleware.optionalAuth = (req, res, next) => {
    req.user = mockUser;
    next();
  };
  mockAuthMiddleware.adminOnly = (req, res, next) => {
    if (!mockUser || mockUser.role !== 'super_admin') {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }
    next();
  };
  return mockAuthMiddleware;
});

jest.mock('../../config/prisma', () => ({
  stores: { findUnique: jest.fn() },
  staff: { findFirst: jest.fn() },
  orders: { aggregate: jest.fn(), count: jest.fn() },
}));

jest.mock('../../repositories/Order', () => ({
  getDetailedStats: jest.fn(),
  getComparisonStats: jest.fn(),
  getAdvancedInsights: jest.fn(),
  getForecast: jest.fn(),
}));

const Order = require('../../repositories/Order');
const prisma = require('../../config/prisma');

describe('Store-Level Analytics Integration Tests', () => {
  const baseUrl = '/api/analytics/store/1';

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 1, name: '장사장', role: 'user', store_id: 1 };
    prisma.stores.findUnique.mockResolvedValue({ user_id: 1 });
  });

  describe('GET /analytics/store/:storeId/sales', () => {
    it('should return 400 when start_date or end_date is missing', async () => {
      const res = await request(app).get(`${baseUrl}/sales`).expect(400);

      expect(res.body.error).toBe('시작일과 종료일이 필요합니다.');
    });

    it('should return sales summary and daily data', async () => {
      Order.getDetailedStats.mockResolvedValue({
        daily: [
          { date: '2026-07-01', amount: 150000, count: 10 },
          { date: '2026-07-02', amount: 200000, count: 15 },
        ],
        hourly: [{ hour: 12, amount: 50000, count: 3 }],
        dayOfWeek: [{ day: 1, amount: 150000, count: 10 }],
        products: [],
      });

      const res = await request(app)
        .get(`${baseUrl}/sales?start_date=2026-07-01&end_date=2026-07-02`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.total_sales).toBe(350000);
      expect(res.body.data.summary.total_orders).toBe(25);
      expect(res.body.data.summary.avg_order_amount).toBe(14000);
      expect(res.body.data.data).toHaveLength(2);
      expect(res.body.data.data[0].label).toBe('07-01');
    });

    it('should return 400 for invalid storeId', async () => {
      const res = await request(app)
        .get('/api/analytics/store/invalid/sales?start_date=2026-07-01&end_date=2026-07-02')
        .expect(400);

      expect(res.body.error).toBe('유효하지 않은 매장 ID입니다.');
    });
  });

  describe('GET /analytics/store/:storeId/products', () => {
    it('should return popular products with ranking', async () => {
      Order.getDetailedStats.mockResolvedValue({
        daily: [],
        hourly: [],
        dayOfWeek: [],
        products: [
          { product_name: '김치볶음밥', total_quantity: 50, total_amount: 750000 },
          { product_name: '된장국', total_quantity: 30, total_amount: 300000 },
        ],
      });

      const res = await request(app)
        .get(`${baseUrl}/products?start_date=2026-07-01&end_date=2026-07-07`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.products).toHaveLength(2);
      expect(res.body.data.products[0].rank).toBe(1);
      expect(res.body.data.products[0].product_name).toBe('김치볶음밥');
      expect(res.body.data.products[0].total_quantity).toBe(50);
    });

    it('should limit results when limit query param is provided', async () => {
      Order.getDetailedStats.mockResolvedValue({
        daily: [],
        hourly: [],
        dayOfWeek: [],
        products: Array.from({ length: 15 }, (_, i) => ({
          product_name: `상품${i}`,
          total_quantity: 10 - i,
          total_amount: 10000 * (10 - i),
        })),
      });

      const res = await request(app)
        .get(`${baseUrl}/products?start_date=2026-07-01&end_date=2026-07-07&limit=5`)
        .expect(200);

      expect(res.body.data.products).toHaveLength(5);
    });

    it('should use default date range when dates not provided', async () => {
      Order.getDetailedStats.mockResolvedValue({
        daily: [],
        hourly: [],
        dayOfWeek: [],
        products: [],
      });

      const res = await request(app).get(`${baseUrl}/products`).expect(200);

      expect(Order.getDetailedStats).toHaveBeenCalled();
    });
  });

  describe('GET /analytics/store/:storeId/comparison', () => {
    it('should return comparison stats with default weekly type', async () => {
      Order.getComparisonStats.mockResolvedValue({
        current: { sales: 500000, orders: 30 },
        previous: { sales: 450000, orders: 28 },
        growth: { sales: 11.1, orders: 7.1 },
      });

      const res = await request(app).get(`${baseUrl}/comparison`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.current.sales).toBe(500000);
      expect(res.body.data.growth.sales).toBe(11.1);
    });

    it('should pass type parameter to repository', async () => {
      Order.getComparisonStats.mockResolvedValue({
        current: { sales: 0, orders: 0 },
        previous: { sales: 0, orders: 0 },
        growth: { sales: 0, orders: 0 },
      });

      await request(app).get(`${baseUrl}/comparison?type=monthly`).expect(200);

      expect(Order.getComparisonStats).toHaveBeenCalledWith(1, 'monthly');
    });
  });

  describe('GET /analytics/store/:storeId/insights', () => {
    it('should return advanced insights with heatmap and categories', async () => {
      Order.getAdvancedInsights.mockResolvedValue({
        heatmap: [{ day: 1, hour: 12, amount: 50000, count: 3 }],
        categories: [{ category: '한식', sales: 300000, quantity: 20 }],
        repeat: { rate: 45, total_customers: 100, repeat_customers: 45 },
      });

      const res = await request(app)
        .get(`${baseUrl}/insights?start_date=2026-07-01&end_date=2026-07-31`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.heatmap).toHaveLength(1);
      expect(res.body.data.categories[0].category).toBe('한식');
      expect(res.body.data.repeat.rate).toBe(45);
    });

    it('should return 400 when dates missing', async () => {
      const res = await request(app).get(`${baseUrl}/insights`).expect(400);

      expect(res.body.error).toBe('시작일과 종료일이 필요합니다.');
    });
  });

  describe('GET /analytics/store/:storeId/forecast', () => {
    it('should return forecast predictions', async () => {
      Order.getForecast.mockResolvedValue({
        predictions: [
          { date: '2026-07-08', predicted: 450000 },
          { date: '2026-07-09', predicted: 480000 },
        ],
        accuracy: 0.87,
      });

      const res = await request(app).get(`${baseUrl}/forecast?days=2`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.predictions).toHaveLength(2);
      expect(res.body.data.accuracy).toBe(0.87);
    });

    it('should cap days at 30', async () => {
      Order.getForecast.mockResolvedValue({
        predictions: [],
        accuracy: 0.9,
      });

      await request(app).get(`${baseUrl}/forecast?days=999`).expect(200);

      expect(Order.getForecast).toHaveBeenCalledWith(1, 30);
    });

    it('should default to 7 days when not specified', async () => {
      Order.getForecast.mockResolvedValue({
        predictions: [],
        accuracy: 0.9,
      });

      await request(app).get(`${baseUrl}/forecast`).expect(200);

      expect(Order.getForecast).toHaveBeenCalledWith(1, 7);
    });
  });
});
