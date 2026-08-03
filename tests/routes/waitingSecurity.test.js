const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'waiting-route-test-secret';

const mockPrisma = {
  waiting_list: { findUnique: jest.fn() },
  stores: { findUnique: jest.fn() },
  staff: { findFirst: jest.fn() },
};
jest.mock('../../config/prisma', () => mockPrisma);
jest.mock('../../controllers/waitingController', () => ({
  getStoreStatus: (req, res) => res.json({ success: true }),
  getStoreWaitingList: (req, res) => res.json({ success: true }),
  register: (req, res) => res.json({ success: true }),
  updateStatus: (req, res) => res.json({ success: true }),
  getMyWaiting: (req, res) => res.json({ success: true }),
  getAISuggestions: (req, res) => res.json({ success: true }),
}));
jest.mock('../../utils/aiRateLimiter', () => ({
  createAIRateLimiter: () => (req, res, next) => next(),
}));

function buildApp() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/waiting', require('../../routes/waiting'));
  return instance;
}

// 커버리지 부하에서 HTTP 서버 부팅 오버헤드가 매 요청마다 반복되지 않도록
// 앱 인스턴스를 한 번만 생성해 재사용한다. (mock은 beforeEach에서 초기화됨)
const app = buildApp();

const token = jwt.sign({ id: 7, role: 'owner', type: 'access' }, process.env.JWT_SECRET);

describe('waiting route security', () => {
  beforeEach(() => jest.clearAllMocks());

  // 커버리지 부하 시 HTTP 요청이 5초 기본 타임아웃을 넘길 수 있어 명시적으로 상향
  jest.setTimeout(15000);

  test('keeps aggregate status and registration public', async () => {
    expect((await request(app).get('/api/waiting/store/3/status')).status).toBe(200);
    expect((await request(app).post('/api/waiting/register').send({})).status).toBe(200);
  });

  test('requires authentication for the PII-bearing store list', async () => {
    const response = await request(app).get('/api/waiting/store/3');
    expect(response.status).toBe(401);
  });

  test('requires permission for the requested waiting-list store', async () => {
    mockPrisma.stores.findUnique.mockResolvedValue({ user_id: 999 });
    mockPrisma.staff.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/waiting/store/3')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  test('derives the mutation store from the waiting entry before permission checks', async () => {
    mockPrisma.waiting_list.findUnique.mockResolvedValue({ store_id: 3 });
    mockPrisma.stores.findUnique.mockResolvedValue({ user_id: 7 });

    const response = await request(app)
      .patch('/api/waiting/12/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'called', store_id: 999 });

    expect(response.status).toBe(200);
    expect(mockPrisma.waiting_list.findUnique).toHaveBeenCalledWith({
      where: { id: 12 },
      select: { store_id: true },
    });
    expect(mockPrisma.stores.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 3 },
      })
    );
  });
});
