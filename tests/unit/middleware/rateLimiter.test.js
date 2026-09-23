const express = require('express');
const request = require('supertest');

jest.mock('../../../utils/logger');
jest.mock('../../../utils/alerting', () => ({
  send: jest.fn(),
}));

const {
  generalLimiter,
  orderLimiter,
  authLimiter,
  paymentLimiter,
} = require('../../../middleware/rateLimiter');

const buildApp = (limiter) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    // 리미터가 req.ip 기반으로만 집계하도록 원격주소 삽입
    res.on('finish', () => {});
    next();
  });
  app.use('/api', limiter);
  app.use((req, res) => {
    res.json({ ok: true });
  });
  app.use((err, req, res, next) => {
    res.status(err.statusCode || err.status || 500).json({ error: err.message });
    next();
  });
  return app;
};

describe('rateLimiter middleware (Express 통합)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generalLimiter', () => {
    test('일반 API 요청은 정상 통과', async () => {
      const app = buildApp(generalLimiter);
      const res = await request(app).get('/api/stores/1');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    test('health 경로는 skip', async () => {
      const app = buildApp(generalLimiter);
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
    });

    test('임계(100/1분) 초과 시 429', async () => {
      const app = buildApp(generalLimiter);
      let lastStatus = 200;
      for (let i = 0; i < 102; i += 1) {
        const res = await request(app).get(`/api/stores/req${i}`);
        lastStatus = res.status;
      }
      expect(lastStatus).toBe(429);
    });
  });

  describe('orderLimiter', () => {
    test('동일 매장+IP 임계(30/1분) 초과 시 429', async () => {
      const app = buildApp(orderLimiter);
      let lastStatus = 200;
      for (let i = 0; i < 31; i += 1) {
        const res = await request(app).post('/api/orders').send({ store_id: 7 });
        lastStatus = res.status;
      }
      expect(lastStatus).toBe(429);
    });

    test('서로 다른 매장은 개별 키로 분리돼 모두 통과', async () => {
      const app = buildApp(orderLimiter);
      let blocked = false;
      for (let i = 0; i < 40; i += 1) {
        const res = await request(app)
          .post('/api/orders')
          .send({ store_id: i % 5 });
        if (res.status === 429) blocked = true;
      }
      expect(blocked).toBe(false);
    });
  });

  describe('authLimiter', () => {
    test('성공 요청은 skipSuccessfulRequests 로 미집계 — 15회 연속 통과', async () => {
      const app = buildApp(authLimiter);
      let lastStatus = 200;
      for (let i = 0; i < 15; i += 1) {
        const res = await request(app).post('/api/login').send({ id: 'u', password: 'p' });
        lastStatus = res.status;
      }
      expect(lastStatus).toBe(200);
    });
  });

  describe('paymentLimiter', () => {
    test('테스트 환경(한도 1000) 내 요청은 통과', async () => {
      const app = buildApp(paymentLimiter);
      const res = await request(app).post('/api/payments').send({});
      expect(res.status).toBe(200);
    });
  });
});
