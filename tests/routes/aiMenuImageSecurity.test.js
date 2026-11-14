const express = require('express');
// 세션 저장소와 분리해 라우트의 인증·매장 권한만 검증한다.
jest.mock('../../services/AuthSessionService', () => ({
  verifyAccess: jest.fn(async (decoded) => decoded),
}));
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-ai-menu-image';

const mockPrisma = {
  stores: { findUnique: jest.fn() },
  staff: { findFirst: jest.fn() },
  $queryRawUnsafe: jest.fn().mockResolvedValue([]),
};
jest.mock('../../config/prisma', () => mockPrisma);
const mockGenerate = jest.fn((_req, res) => res.status(200).json({ success: true }));
jest.mock('../../controllers/aiController', () =>
  new Proxy({}, { get: (_t, key) => (key === 'generateMenuImage' ? mockGenerate : (_req, res) => res.json({})) })
);
jest.mock('../../utils/aiRateLimiter', () => ({ createAIRateLimiter: () => (_req, _res, next) => next() }));

const app = express();
app.use(express.json());
app.use('/api/ai', require('../../routes/ai'));
app.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ error: err.message }));

const tokenFor = (id, role = 'owner') => jwt.sign({ id, role, type: 'access' }, process.env.JWT_SECRET);
const body = { store_id: 42, name: '바닐라 라떼' };

describe('POST /api/ai/generate-menu-image 접근 제어', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.stores.findUnique.mockResolvedValue({ user_id: 1 });
    mockPrisma.staff.findFirst.mockResolvedValue(null);
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
  });

  test('로그인하지 않은 요청은 401로 거부하고 AI를 호출하지 않는다', async () => {
    const res = await request(app).post('/api/ai/generate-menu-image').send(body);
    expect(res.status).toBe(401);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  test('다른 매장 사용자는 403으로 거부한다', async () => {
    const res = await request(app)
      .post('/api/ai/generate-menu-image')
      .set('Authorization', `Bearer ${tokenFor(2)}`)
      .send(body);
    expect(res.status).toBe(403);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  test('메뉴 편집 권한이 없는 직원(staff)은 403으로 거부한다', async () => {
    mockPrisma.staff.findFirst.mockResolvedValue({ role: 'staff' });
    const res = await request(app)
      .post('/api/ai/generate-menu-image')
      .set('Authorization', `Bearer ${tokenFor(3)}`)
      .send(body);
    expect(res.status).toBe(403);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  test('매장 소유자와 매니저는 호출할 수 있다', async () => {
    const owner = await request(app)
      .post('/api/ai/generate-menu-image')
      .set('Authorization', `Bearer ${tokenFor(1)}`)
      .send(body);
    expect(owner.status).toBe(200);

    mockPrisma.staff.findFirst.mockResolvedValue({ role: 'manager' });
    const manager = await request(app)
      .post('/api/ai/generate-menu-image')
      .set('Authorization', `Bearer ${tokenFor(4)}`)
      .send(body);
    expect(manager.status).toBe(200);
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  test('잘못된 store_id는 권한 확인 전에 거부한다', async () => {
    const res = await request(app)
      .post('/api/ai/generate-menu-image')
      .set('Authorization', `Bearer ${tokenFor(1)}`)
      .send({ store_id: 'abc', name: '라떼' });
    expect(res.status).toBe(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});
