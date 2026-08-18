// Staff 라우트 테넌트 인가 테스트 — 타 매장 사용자의 접근을 차단하는지 검증
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-staff-security';

const mockPrisma = {
  stores: { findUnique: jest.fn() },
  staff: { findFirst: jest.fn(), findUnique: jest.fn() },
};
jest.mock('../../config/prisma', () => mockPrisma);

const mockOk = jest.fn((_req, res) => res.status(200).json({ ok: true }));
jest.mock('../../controllers/staffController', () => ({
  getMyRole: mockOk,
  getStaffList: mockOk,
  selfRegister: mockOk,
  createStaff: mockOk,
  getAttendance: mockOk,
  clockIn: mockOk,
  clockOut: mockOk,
  updateStaffRole: mockOk,
  deleteStaff: mockOk,
  lookupUser: mockOk,
  addExistingUser: mockOk,
  getSchedules: mockOk,
  createSchedules: mockOk,
  updateSchedule: mockOk,
  deleteSchedule: mockOk,
}));

const app = express();
app.use(express.json());
app.use('/', require('../../routes/staff'));
app.use((err, _req, res, _next) =>
  res.status(err.statusCode || err.status || 500).json({ error: err.message })
);

const tokenFor = (id, role = 'owner') =>
  jwt.sign({ id, role, type: 'access' }, process.env.JWT_SECRET);
const OWNER_TOKEN = tokenFor(1);
const OUTSIDER_TOKEN = tokenFor(2);

// [method, path, body?]
const routeCases = [
  ['get', '/store/42', null],
  ['get', '/42/schedules', null],
  [
    'post',
    '/42/schedules',
    { staff_id: 1, date: '2026-08-20', start_time: '09:00', end_time: '18:00' },
  ],
  ['put', '/42/schedules/9', { start_time: '10:00' }],
  ['delete', '/42/schedules/9', null],
];

describe('staff 테넌트 인가', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.stores.findUnique.mockResolvedValue({ user_id: 1 });
    mockPrisma.staff.findFirst.mockResolvedValue(null);
    mockPrisma.staff.findUnique.mockResolvedValue({ store_id: 42 });
  });

  it.each(routeCases)('%s %s — 타 매장 사용자는 403을 받는다', async (method, path, body) => {
    const call = request(app)[method](path).set('Authorization', `Bearer ${OUTSIDER_TOKEN}`);
    const res = body ? await call.send(body) : await call;
    expect(res.status).toBe(403);
    expect(mockOk).not.toHaveBeenCalled();
  });

  it.each(routeCases)('%s %s — 매장 오너는 200을 받는다', async (method, path, body) => {
    const call = request(app)[method](path).set('Authorization', `Bearer ${OWNER_TOKEN}`);
    const res = body ? await call.send(body) : await call;
    expect(res.status).toBe(200);
    expect(mockOk).toHaveBeenCalled();
  });

  it('인증 없이 직원 목록 조회는 401을 받는다', async () => {
    const res = await request(app).get('/store/42');
    expect(res.status).toBe(401);
  });
});
