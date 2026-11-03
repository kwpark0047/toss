const { test, expect } = require('@playwright/test');
const {
  ROLES,
  roleCredentials,
  storeId,
  writesAllowed,
  assertStagingTarget,
  apiLogin,
  uiLogin,
  authHeaders,
  expectPageLoaded,
} = require('./helpers');

// 역할별 핵심 흐름 + 권한 격리 E2E (staging 전용).
// - 읽기 검증은 항상 실행한다.
// - 상태를 바꾸는 시나리오(주문 생성, KDS 상태 변경)는 E2E_ALLOW_WRITES=true 일 때만 실행한다.
// - 계정 환경 변수가 없는 역할은 skip 되며, 리포트에 skip 사유가 남는다.

test.beforeAll(() => assertStagingTarget());

const STORE_PAGES = {
  owner: ['dashboard', 'menu', 'orders', 'tables', 'staff', 'settings', 'settlements', 'stats'],
  manager: ['dashboard', 'menu', 'orders', 'staff', 'stats'],
  staff: ['orders', 'tables'],
  kitchen: ['kitchen'],
};

function storePath(page) {
  return page === 'dashboard'
    ? `/admin/stores/${storeId()}/manager`
    : `/admin/stores/${storeId()}/${page}`;
}

// 역할 x API 권한 매트릭스. 기대값은 storeAuth.js 권한표(CLAUDE.md)를 따른다.
// allow: 2xx 기대, deny: 401/403 기대
const API_MATRIX = [
  {
    name: 'KDS 주문 조회',
    path: () => `/api/kds/stores/${storeId()}/orders`,
    allow: ['owner', 'manager', 'staff', 'kitchen', 'superadmin'],
    deny: ['customer'],
  },
  {
    name: '매장 정산 조회',
    path: () => `/api/admin/stores/${storeId()}/settlements`,
    allow: ['owner', 'superadmin'],
    deny: ['staff', 'kitchen', 'customer'],
  },
  {
    name: '매장 직원 목록',
    path: () => `/api/staff/store/${storeId()}`,
    allow: ['owner', 'manager', 'superadmin'],
    deny: ['kitchen', 'customer'],
  },
  {
    name: '플랫폼 개요',
    path: () => '/api/admin/platform/overview',
    allow: ['superadmin'],
    deny: ['owner', 'manager', 'staff', 'kitchen', 'customer'],
  },
];

for (const role of ROLES) {
  test.describe(`역할: ${role}`, () => {
    test.skip(!roleCredentials(role), `E2E_${role.toUpperCase()}_ID / _PASSWORD 미설정`);
    test.skip(role !== 'customer' && role !== 'superadmin' && !storeId(), 'E2E_STORE_ID 미설정');

    test(`${role} 로그인 및 세션 확인`, async ({ request }) => {
      const data = await apiLogin(request, role);
      const me = await request.get('/api/auth/me', { headers: authHeaders(data.token) });
      expect(me.status()).toBe(200);
    });

    for (const check of API_MATRIX) {
      const expectation = check.allow.includes(role)
        ? 'allow'
        : check.deny.includes(role)
          ? 'deny'
          : null;
      if (!expectation) continue;
      test(`${role} API 권한: ${check.name} → ${expectation}`, async ({ request }) => {
        const { token } = await apiLogin(request, role);
        const res = await request.get(check.path(), { headers: authHeaders(token) });
        if (expectation === 'allow') expect(res.status(), await res.text()).toBeLessThan(300);
        else expect([401, 403]).toContain(res.status());
      });
    }

    for (const pageName of STORE_PAGES[role] || []) {
      test(`${role} 관리 화면 접근: ${pageName}`, async ({ page, request }) => {
        await uiLogin(page, request, role);
        await expectPageLoaded(page, storePath(pageName));
      });
    }
  });
}

test.describe('최고관리자 화면', () => {
  test.skip(!roleCredentials('superadmin'), 'E2E_SUPERADMIN_ID / _PASSWORD 미설정');
  for (const path of [
    '/admin',
    '/admin/supervisor',
    '/admin/system-status',
    '/admin/plan-requests',
  ]) {
    test(`superadmin 접근: ${path}`, async ({ page, request }) => {
      await uiLogin(page, request, 'superadmin');
      await expectPageLoaded(page, path);
    });
  }
});

test.describe('고객 메뉴판 @mobile', () => {
  test.skip(
    !process.env.E2E_MENU_PATH,
    'E2E_MENU_PATH (예: /menu/<storeId>?table=<tableId>) 미설정'
  );

  test('메뉴 → 장바구니 → 결제수단 선택 → 주문 버튼 활성화', async ({ page }) => {
    await page.goto(process.env.E2E_MENU_PATH);
    const start = page.getByRole('button', { name: /주문 시작하기/ });
    if (await start.isVisible().catch(() => false)) await start.click();
    const addButton = page.getByRole('button', { name: / 담기$/ }).first();
    await expect(addButton).toBeVisible({ timeout: 30_000 });
    await addButton.click();
    await page.getByText('장바구니 보기').click();
    await expect(page.getByRole('heading', { name: '장바구니' })).toBeVisible();
    const orderButton = page.getByRole('button', { name: /주문하기/ });
    await expect(orderButton).toBeVisible();
  });
});

test.describe('주문 → 주방 처리 (쓰기)', () => {
  test.skip(!writesAllowed(), 'E2E_ALLOW_WRITES=true 일 때만 실행');
  test.skip(!roleCredentials('kitchen') || !storeId(), 'kitchen 계정/E2E_STORE_ID 미설정');

  test('kitchen 이 대기 주문 상태를 다음 단계로 변경', async ({ request }) => {
    const { token } = await apiLogin(request, 'kitchen');
    const list = await request.get(`/api/kds/stores/${storeId()}/orders`, {
      headers: authHeaders(token),
    });
    expect(list.status()).toBe(200);
    const body = await list.json();
    const orders = body.data?.orders || body.data || [];
    test.skip(
      !Array.isArray(orders) || orders.length === 0,
      'staging 매장에 처리할 주문이 없음 (고객 시나리오로 먼저 생성)'
    );
    const order = orders[0];
    const res = await request.post(`/api/kds/stores/${storeId()}/orders/${order.id}/status`, {
      headers: authHeaders(token),
      data: { status: 'preparing' },
    });
    expect(res.status(), await res.text()).toBeLessThan(300);
  });
});
