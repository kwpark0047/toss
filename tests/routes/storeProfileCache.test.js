jest.mock('../../utils/cache', () => ({ get: jest.fn(), set: jest.fn() }));
jest.mock(
  '../../controllers/storeController',
  () =>
    new Proxy(
      { getStore: jest.fn((req, res) => res.success({ id: 6, name: 'fixture store' })) },
      { get: (target, name) => target[name] || jest.fn() }
    )
);
const express = require('express'),
  request = require('supertest'),
  cache = require('../../utils/cache'),
  controller = require('../../controllers/storeController');
const app = express();
app.use(require('../../middleware/responseFormatter'));
app.use('/stores', require('../../routes/stores'));
test('async cache miss calls store controller instead of serializing Promise as empty profile', async () => {
  cache.get.mockResolvedValue(null);
  const response = await request(app).get('/stores/6');
  expect(response.status).toBe(200);
  expect(response.body.data.name).toBe('fixture store');
});
test('async cache hit returns the resolved store profile', async () => {
  cache.get.mockResolvedValue({ id: 6, name: 'cached store' });
  const response = await request(app).get('/stores/6');
  expect(response.body.data.name).toBe('cached store');
});
