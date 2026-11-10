const { chromium, request } = require('@playwright/test');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
(async () => {
  const root = path.resolve(__dirname, '../..');
  const fixture = JSON.parse(
    fs.readFileSync(path.join(root, '.tmp/order-completion-sandbox/fixture.json'))
  );
  assert.equal(
    fixture.dbUrl,
    'postgresql://qa:synthetic-local-only@127.0.0.1:15438/order_completion_qa'
  );
  assert.ok(fixture.email.endsWith('@example.invalid'));
  const origin = 'http://127.0.0.1:5174',
    api = 'http://127.0.0.1:5300/api';
  const output = path.join(root, 'reports/order-server-push-2026-11-11');
  fs.mkdirSync(output, { recursive: true });
  const owner = await request.newContext();
  const login = await owner.post(`${api}/auth/login`, {
    data: { identifier: fixture.email, password: fixture.password },
  });
  assert.equal(login.status(), 200);
  const auth = await login.json(),
    token = (auth.data || auth).token;
  const context = await chromium.launchPersistentContext(
    path.join(root, '.tmp/order-completion-sandbox/order-push-browser'),
    {
      channel: 'msedge',
      headless: false,
      args: ['--window-position=-32000,-32000'],
      ignoreDefaultArgs: ['--disable-background-networking'],
      permissions: ['notifications'],
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      locale: 'ko-KR',
      userAgent:
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    }
  );
  let phase = 'start';
  const errors = [];
  try {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${origin}/menu/${fixture.storeId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });
    await page.getByRole('button').filter({ hasText: 'QA 테스트 메뉴' }).click();
    await page.getByRole('button', { name: /장바구니 보기/ }).click();
    await page.getByText('매장에서 먹기', { exact: true }).click();
    await page.getByRole('button', { name: '현금', exact: true }).click();
    const created = page.waitForResponse(
      (r) => r.url() === `${api}/orders` && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: '현금 주문하기', exact: true }).click();
    const response = await created;
    assert.equal(response.status(), 201);
    const order = (await response.json()).data;
    assert.ok(!order.customer_name && !order.customer_phone);
    await page.getByRole('link', { name: /매장찾기 · 주문진행 확인/ }).click();
    const card = page.getByRole('complementary', { name: '실시간 주문 진행' });
    await card.getByText('실시간 연결', { exact: true }).waitFor();
    const enable = page.getByRole('button', { name: '준비 완료 알림 켜기', exact: true });
    if (await enable.count()) await enable.click();
    else await page.getByRole('button', { name: '페이지 닫아도 알림 받기', exact: true }).click();
    await card.getByText(/이 페이지를 닫아도 준비 완료 알림을 받아요/).waitFor({ timeout: 45000 });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: path.join(output, 'subscription-mobile-390.png'),
      clip: await card.boundingBox(),
    });
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false
      );
    }
    const update = async (status) => {
      const result = await owner.put(`${api}/orders/${order.id}/status`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { status },
      });
      assert.equal(result.status(), 200);
    };
    await update('confirmed');
    await update('preparing');
    for (const customerPage of context.pages())
      if (customerPage.url().startsWith(origin)) await customerPage.close();
    assert.equal(context.pages().filter((p) => p.url().startsWith(origin)).length, 0);
    phase = 'all-customer-pages-closed';
    const readyAt = Date.now();
    await update('ready');
    let notification;
    for (let attempt = 0; attempt < 45; attempt++) {
      for (const worker of context.serviceWorkers()) {
        const found = await worker
          .evaluate(
            async (id) =>
              (await self.registration.getNotifications({ tag: `wemarket-order-ready-${id}` })).map(
                (n) => ({ title: n.title, body: n.body, data: n.data })
              ),
            order.id
          )
          .catch(() => []);
        if (found.length) notification = found[0];
      }
      if (notification) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    assert.equal(
      notification?.data.orderId,
      order.id,
      'real provider push while all customer pages closed'
    );
    const receivedAfterMs = Date.now() - readyAt;
    phase = 'testing-notification-activation';
    fs.writeFileSync(
      path.join(root, '.tmp/order-completion-sandbox/push-status.json'),
      JSON.stringify({ phase, orderId: order.id, notification, receivedAfterMs })
    );
    console.log(JSON.stringify({ phase, orderId: order.id, receivedAfterMs }));
    const destination = await context.newPage();
    await destination.goto(`${origin}/offline.html`, { waitUntil: 'domcontentloaded' });
    let clickDispatched = false;
    for (const worker of context.serviceWorkers()) {
      const result = await worker
        .evaluate(async (id) => {
          const notification = (
            await self.registration.getNotifications({ tag: `wemarket-order-ready-${id}` })
          )[0];
          if (!notification) return false;
          const event = new NotificationEvent('notificationclick', { notification });
          const tasks = [];
          Object.defineProperty(event, 'waitUntil', { value: (promise) => tasks.push(promise) });
          self.dispatchEvent(event);
          await Promise.allSettled(tasks);
          return true;
        }, order.id)
        .catch(() => false);
      if (result) {
        clickDispatched = true;
        break;
      }
    }
    assert.ok(clickDispatched, 'received notification activation handler exercised');
    await destination.waitForURL(`**/search?orderId=${order.id}`, { timeout: 30000 });
    const resultCard = destination.getByRole('complementary', { name: '실시간 주문 진행' });
    await resultCard
      .locator('.ro-status-title')
      .getByText('준비 완료', { exact: true })
      .waitFor({ timeout: 30000 });
    await resultCard.getByText(`주문 ${order.order_number}`, { exact: false }).waitFor();
    await resultCard.getByText(/이 페이지를 닫아도 준비 완료 알림을 받아요/).waitFor();
    const install = destination.getByText('위마켓 앱 설치', { exact: true });
    if (await install.count())
      await install.locator('..').locator('..').getByRole('button').last().click();
    await destination.evaluate(() => scrollTo(0, 0));
    await destination.setViewportSize({ width: 390, height: 1200 });
    await destination.screenshot({
      path: path.join(output, 'notification-click-mobile-390.png'),
      clip: await resultCard.boundingBox(),
    });
    assert.deepEqual(errors, []);
    const evidence = {
      checkedAt: new Date().toISOString(),
      orderId: order.id,
      syntheticAccount: true,
      customerInformation: false,
      cardRequests: 0,
      apiMocking: false,
      pushProvider: 'WNS / standard Web Push',
      customerPagesClosedBeforeReady: true,
      receivedAfterMs,
      notificationTitle: notification.title,
      nativeNotificationClicked: false,
      notificationClickEventReplayed: true,
      clickUrl: destination.url(),
      readyOrderVerified: true,
      widths: [320, 390, 430],
      pageErrors: errors,
    };
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence));
    phase = 'completed';
  } catch (error) {
    for (const page of context.pages())
      await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
    console.error(phase, error.message);
    throw error;
  } finally {
    await context.close();
    await owner.dispose();
  }
})().catch(() => {
  process.exitCode = 1;
});
