const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'feature-flag-route-test-secret';

const mockController = {
  list: jest.fn((_req, res) => res.json({ success: true })),
  upsert: jest.fn((_req, res) => res.json({ success: true })),
  remove: jest.fn((_req, res) => res.json({ success: true })),
};
jest.mock('../../controllers/featureFlagController', () => mockController);

const router = require('../../routes/featureFlags');
const tokenFor = (id, role) => jwt.sign({ id, role, type: 'access' }, process.env.JWT_SECRET);
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', router);
  return app;
};

describe('feature flag route security', () => {
  beforeEach(() => jest.clearAllMocks());

  it('일반 계정은 flag를 조회하거나 변경할 수 없다', async () => {
    const token = `Bearer ${tokenFor(7, 'owner')}`;
    const list = await request(buildApp())
      .get('/api/admin/feature-flags')
      .set('Authorization', token);
    const update = await request(buildApp())
      .put('/api/admin/feature-flags/new_kds')
      .set('Authorization', token)
      .send({ enabled: true });

    expect(list.status).toBe(403);
    expect(update.status).toBe(403);
    expect(mockController.list).not.toHaveBeenCalled();
  });

  it('슈퍼관리자는 flag를 조회하고 변경할 수 있다', async () => {
    const token = `Bearer ${tokenFor(99, 'super_admin')}`;
    const response = await request(buildApp())
      .put('/api/admin/feature-flags/new_kds')
      .set('Authorization', token)
      .send({ enabled: true, rollout_percent: 25 });

    expect(response.status).toBe(200);
    expect(mockController.upsert).toHaveBeenCalled();
  });
});
