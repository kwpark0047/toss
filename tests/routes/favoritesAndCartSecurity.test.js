const express = require('express');
const request = require('supertest');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'favorites-test-secret';

const mockGetFavorites = jest.fn((req, res) =>
  res.json({ success: true, phone: req.params.phone })
);
jest.mock(
  '../../controllers/storeController',
  () =>
    new Proxy(
      { getFavorites: (...a) => mockGetFavorites(...a) },
      { get: (t, k) => t[k] || ((req, res) => res.json({ success: true })) }
    )
);
jest.mock('../../config/prisma', () => ({}));
jest.mock('../../controllers/cartController', () => ({
  getCart: (req, res) => res.json({ success: true }),
  updateCart: (req, res) => res.json({ success: true }),
  clearCart: (req, res) => res.json({ success: true }),
}));

const { createCustomerCapability } = require('../../utils/orderCapability');

const app = express();
app.use(express.json());
app.use('/api/stores', require('../../routes/stores'));
app.use('/api/cart', require('../../routes/cart'));

describe('번호 단위 공개 API 보호', () => {
  test('즐겨찾기는 손님 토큰 없이 조회할 수 없다', async () => {
    expect((await request(app).get('/api/stores/favorites/01012345678')).status).toBe(401);
  });

  test('토큰이 있으면 경로의 번호가 아니라 토큰의 번호로 조회한다', async () => {
    const token = createCustomerCapability('010-1234-5678');
    const res = await request(app)
      .get('/api/stores/favorites/01099999999')
      .set('x-customer-capability', token);
    expect(res.status).toBe(200);
    expect(res.body.phone).toBe('01012345678');
  });

  test('예전 장바구니 API는 더 이상 열려 있지 않다', async () => {
    expect((await request(app).get('/api/cart/1')).status).toBe(410);
    expect((await request(app).delete('/api/cart/1')).status).toBe(410);
  });
});
