const { test, expect } = require('@playwright/test');

const API_URL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3000';

test.describe('주문 API 플로우', () => {
  let authToken;
  let storeId;

  test.beforeAll(async ({ request }) => {
    const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: 'test@example.com',
        password: 'testpass123'
      }
    });
    if (loginResponse.ok()) {
      const data = await loginResponse.json();
      authToken = data.token;
      storeId = data.user?.store_id;
    }
  });

  test('매장 목록 조회', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/stores`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('stores');
    expect(Array.isArray(data.stores)).toBeTruthy();
  });

  test('주문 생성 - 현금 결제', async ({ request }) => {
    if (!authToken || !storeId) {
      test.skip();
      return;
    }

    const response = await request.post(`${API_URL}/api/orders`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        store_id: storeId,
        items: [
          { product_id: 1, product_name: '테스트 상품', quantity: 2, price: 10000 }
        ],
        total_amount: 20000,
        payment_method: 'cash',
        phone: '01012345678'
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('order_number');
    expect(data).toHaveProperty('payment');
  });

  test('결제 상태 조회', async ({ request }) => {
    if (!authToken) {
      test.skip();
      return;
    }

    const response = await request.get(`${API_URL}/api/payments`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data.payments) || Array.isArray(data)).toBeTruthy();
  });

  test('결제 취소 - 존재하지 않는 결제', async ({ request }) => {
    if (!authToken) {
      test.skip();
      return;
    }

    const response = await request.post(`${API_URL}/api/payments/99999/cancel`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { reason: '테스트 취소' }
    });

    expect(response.status()).toBe(404);
  });
});

test.describe('예약 API 플로우', () => {
  let authToken;

  test.beforeAll(async ({ request }) => {
    const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: 'test@example.com',
        password: 'testpass123'
      }
    });
    if (loginResponse.ok()) {
      const data = await loginResponse.json();
      authToken = data.token;
    }
  });

  test('예약 목록 조회', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/reservations`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
    });

    expect(response.ok()).toBeTruthy();
  });

  test('예약 생성 - 유효하지 않은 데이터', async ({ request }) => {
    if (!authToken) {
      test.skip();
      return;
    }

    const response = await request.post(`${API_URL}/api/reservations`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        store_id: 1,
        customer_name: '테스트',
        reservation_date: 'invalid-date',
        party_size: 0
      }
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('에러 핸들링', () => {
  test('인증 없이 보호된 엔드포인트 접근', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/orders`, {
      headers: { Authorization: 'Bearer invalid-token' }
    });

    expect(response.status()).toBe(401);
  });

  test('존재하지 않는 엔드포인트 접근', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/nonexistent`);
    expect(response.status()).toBe(404);
  });

  test('잘못된 JSON 요청', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: 'invalid json'
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});
