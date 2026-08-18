const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'audit-log-route-test-secret';

const mockController = {
  list: jest.fn((_req, res) => res.json({ success: true })),
  prune: jest.fn((_req, res) => res.json({ success: true })),
};
jest.mock('../../controllers/auditLogController', () => mockController);

const router = require('../../routes/auditLogs');

const tokenFor = (id, role) => jwt.sign({ id, role, type: 'access' }, process.env.JWT_SECRET);
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', router);
  return app;
};

describe('audit log route security', () => {
  beforeEach(() => jest.clearAllMocks());

  it('일반 사업자 계정은 감사 로그를 조회할 수 없다', async () => {
    const response = await request(buildApp())
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${tokenFor(7, 'owner')}`);

    expect(response.status).toBe(403);
    expect(mockController.list).not.toHaveBeenCalled();
  });

  it('슈퍼관리자만 감사 로그 조회·보존 정리를 실행할 수 있다', async () => {
    const app = buildApp();
    const token = `Bearer ${tokenFor(99, 'super_admin')}`;
    const list = await request(app).get('/api/admin/audit-logs').set('Authorization', token);
    const prune = await request(app)
      .delete('/api/admin/audit-logs/retention')
      .set('Authorization', token)
      .send({ retention_days: 90 });

    expect(list.status).toBe(200);
    expect(prune.status).toBe(200);
    expect(mockController.list).toHaveBeenCalled();
    expect(mockController.prune).toHaveBeenCalled();
  });
});
