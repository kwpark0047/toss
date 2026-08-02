const { test, expect } = require('@playwright/test');

const API_URL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3000';

test.describe('주문 API 플로우', () => {
  let authToken;
  let storeId;
  let createdOrderId;

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
    expect(Array.isArray(data.data)).toBeTruthy();
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

    createdOrderId = data.order?.id || data.order_id;
  });

  test('주문 생성 - 유효하지 않은 데이터', async ({ request }) => {
    if (!authToken) {
      test.skip();
      return;
    }

    const response = await request.post(`${API_URL}/api/orders`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { store_id: 999999, items: [] }
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('주문 목록 조회', async ({ request }) => {
    if (!authToken) {
      test.skip();
      return;
    }

    const response = await request.get(`${API_URL}/api/orders`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data.orders || data)).toBeTruthy();
  });

  test('주문 통계 조회', async ({ request }) => {
    if (!authToken) {
      test.skip();
      return;
    }

    const response = await request.get(`${API_URL}/api/orders/stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    expect(response.ok()).toBeTruthy();
  });

  test('주문 삭제', async ({ request }) => {
    if (!authToken || !createdOrderId) {
      test.skip();
      return;
    }

    const response = await request.delete(`${API_URL}/api/orders/${createdOrderId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    expect(response.ok()).toBeTruthy();
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
    expect(Array.isArray(data.payments || data)).toBeTruthy();
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

test.describe('주문 → 결제 → 영수증 전체 플로우', () => {
  let authToken;
  let storeId;
  let orderId;

  test.beforeAll(async ({ request }) => {
    const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: 'test@example.com', password: 'testpass123' }
    });
    if (loginResponse.ok()) {
      const data = await loginResponse.json();
      authToken = data.token;
      storeId = data.user?.store_id;
    }
  });

  test('1. 주문 생성', async ({ request }) => {
    if (!authToken || !storeId) {
      test.skip();
      return;
    }

    const response = await request.post(`${API_URL}/api/orders`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        store_id: storeId,
        items: [
          { product_id: 1, product_name: '아이스 아메리카노', quantity: 2, price: 4500 },
          { product_id: 2, product_name: '카페라떼', quantity: 1, price: 5000 }
        ],
        total_amount: 14000,
        payment_method: 'card',
        phone: '01012345678'
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('order_number');
    expect(data).toHaveProperty('payment');

    orderId = data.order?.id || data.order_id;
    expect(orderId).toBeTruthy();
  });

  test('2. 주문 상세 조회', async ({ request }) => {
    if (!authToken || !orderId) {
      test.skip();
      return;
    }

    const response = await request.get(`${API_URL}/api/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('order_number');
    expect(data).toHaveProperty('payment');
    expect(data).toHaveProperty('items');
    expect(Array.isArray(data.items)).toBeTruthy();
  });

  test('3. 영수증 페이지 접근', async ({ page }) => {
    await page.goto(`/payment/success?order_id=${orderId || ''}`);
    // React 마운트 전 body가 빈 상태로 읽히는 레이스 방지 — 텍스트가 채워질 때까지 대기
    await expect(page.locator('body')).toContainText(/.+/, { timeout: 15000 });
  });

  test('4. 주문 취소', async ({ request }) => {
    if (!authToken || !orderId) {
      test.skip();
      return;
    }

    const response = await request.delete(`${API_URL}/api/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    expect(response.ok()).toBeTruthy();
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
    if (!authToken) {
      test.skip();
      return;
    }

    const response = await request.get(`${API_URL}/api/reservations/store/1`, {
      headers: { Authorization: `Bearer ${authToken}` }
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
    const response = await request.get(`${API_URL}/api/orders/store/1`, {
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
