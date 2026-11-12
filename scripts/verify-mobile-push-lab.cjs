const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const root = path.resolve(__dirname, '..'),
    state = JSON.parse(
      fs.readFileSync(path.join(root, '.tmp/order-completion-sandbox/mobile-lab/runtime.json'))
    );
  assert.equal(state.ready, true);
  assert.match(state.publicOrigin, /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/);
  assert.equal(state.autoReadyAfterMs, 30000);
  const origin = state.publicOrigin,
    output = path.join(root, 'reports/physical-mobile-push-2026-11-12/auto-ready-preflight');
  fs.mkdirSync(output, { recursive: true });
  const denied = [];
  for (const url of [
    '/api/auth/login',
    '/api/_devops',
    '/api/orders/store/1',
    '/api/payments/confirm',
  ]) {
    const response = await fetch(origin + url, { signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 403);
    denied.push({ path: url, status: response.status });
  }
  const probe = {
    store_id: 1,
    order_type: 'dine_in',
    payment_method: 'cash',
    total_amount: 10000,
    customer_phone: 'SYNTHETIC_REJECTION_PROBE',
    items: [
      {
        product_id: 1,
        product_name: 'QA 테스트 메뉴',
        price: 10000,
        quantity: 1,
        subtotal: 10000,
        options: {},
      },
    ],
  };
  const rejection = await fetch(origin + '/api/orders', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(probe),
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(rejection.status, 422);
  const context = await chromium.launchPersistentContext(
    path.join(root, '.tmp/order-completion-sandbox/mobile-lab/preflight-browser'),
    {
      channel: 'msedge',
      headless: false,
      args: ['--window-position=-32000,-32000'],
      ignoreDefaultArgs: ['--disable-background-networking'],
      permissions: ['notifications'],
      viewport: { width: 390, height: 1200 },
      isMobile: true,
      hasTouch: true,
      locale: 'ko-KR',
    }
  );
  const errors = [],
    payments = [];
  try {
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (r) => {
      if (/tosspayments\.com/.test(new URL(r.url()).hostname) && r.method() === 'POST')
        payments.push(r.url());
    });
    await page.goto(origin + '/menu/1', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('button').filter({ hasText: 'QA 테스트 메뉴' }).click();
    await page.getByRole('button', { name: /장바구니 보기/ }).click();
    await page.getByText('매장에서 먹기', { exact: true }).click();
    await page.getByRole('button', { name: '현금', exact: true }).click();
    const created = page.waitForResponse(
      (r) => r.url() === origin + '/api/orders' && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: '현금 주문하기', exact: true }).click();
    const response = await created;
    assert.equal(response.status(), 201);
    const order = (await response.json()).data;
    assert.ok(!order.customer_name && !order.customer_phone);
    assert.equal(order.payment_status, 'pending');
    assert.ok(order.lab_auto_ready_at);
    await page
      .locator('#lab-auto-ready-notice')
      .getByText(new RegExp(order.order_number))
      .waitFor();
    await page.getByRole('link', { name: /매장찾기 · 주문진행 확인/ }).click();
    const card = page.getByRole('complementary', { name: '실시간 주문 진행' });
    await card.getByText('실시간 연결', { exact: true }).waitFor({ timeout: 20000 });
    const enable = page.getByRole('button', { name: '준비 완료 알림 켜기', exact: true });
    if (await enable.count()) await enable.click();
    else await page.getByRole('button', { name: '페이지 닫아도 알림 받기', exact: true }).click();
    await card.getByText(/이 페이지를 닫아도 준비 완료 알림을 받아요/).waitFor({ timeout: 45000 });
    await page
      .getByText('주문이 완료되었습니다!', { exact: true })
      .waitFor({ state: 'hidden', timeout: 12000 });
    await page
      .locator('#lab-auto-ready-notice')
      .screenshot({ path: path.join(output, 'order-auto-ready-countdown.png') });
    await page.screenshot({ path: path.join(output, 'subscribed-before-page-close.png') });
    const provider = await page.evaluate(
      async () =>
        new URL(
          (await (await navigator.serviceWorker.ready).pushManager.getSubscription()).endpoint
        ).hostname
    );
    assert.ok(
      Date.now() < Date.parse(order.lab_auto_ready_at),
      'subscription must finish before the 30-second deadline'
    );
    for (const customerPage of context.pages())
      if (customerPage.url().startsWith(origin)) await customerPage.close();
    assert.equal(context.pages().filter((p) => p.url().startsWith(origin)).length, 0);
    const pagesClosedAt = new Date().toISOString(),
      readyAt = Date.parse(order.lab_auto_ready_at);
    let notification;
    for (let attempt = 0; attempt < 75; attempt++) {
      for (const worker of context.serviceWorkers()) {
        const found = await worker
          .evaluate(
            async (id) =>
              (await self.registration.getNotifications({ tag: `wemarket-order-ready-${id}` })).map(
                (n) => ({ title: n.title, data: n.data })
              ),
            order.id
          )
          .catch(() => []);
        if (found.length) notification = found[0];
      }
      if (notification) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    assert.equal(notification?.data.orderId, order.id);
    const receivedAfterMs = Date.now() - readyAt;
    const tracked = JSON.parse(
      fs.readFileSync(path.join(root, '.tmp/order-completion-sandbox/mobile-lab/runtime.json'))
    ).orders.find((o) => o.id === order.id);
    assert.equal(tracked.autoReadyStatus, 'ready');
    assert.equal(Date.parse(tracked.autoReadyAt) - Date.parse(tracked.createdAt), 30000);
    assert.ok(Date.parse(tracked.autoReadyTriggeredAt) >= readyAt);
    assert.ok(Date.parse(pagesClosedAt) < Date.parse(tracked.autoReadyTriggeredAt));
    const reopened = await context.newPage();
    await reopened.goto(`${origin}/search?orderId=${order.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    const finalCard = reopened.getByRole('complementary', { name: '실시간 주문 진행' });
    await finalCard
      .locator('.ro-status-title')
      .getByText('준비 완료', { exact: true })
      .waitFor({ timeout: 30000 });
    await finalCard.getByText(`주문 ${order.order_number}`, { exact: false }).waitFor();
    const install = reopened.getByText('위마켓 앱 설치', { exact: true });
    if (await install.count())
      await install.locator('..').locator('..').getByRole('button').last().click();
    await reopened.evaluate(() => scrollTo(0, 0));
    await reopened.screenshot({
      path: path.join(output, 'https-test-order-ready.png'),
      clip: await finalCard.boundingBox(),
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(payments, []);
    const evidence = {
      checkedAt: new Date().toISOString(),
      scope: 'Windows Edge environment preflight; NOT Android/iPhone evidence',
      httpsOrigin: origin,
      nativeProviderHost: provider,
      allCustomerPagesClosedBeforeReady: true,
      realPushReceived: true,
      receivedAfterMs,
      orderId: order.id,
      orderNumber: order.order_number,
      paymentStatus: 'pending',
      customerName: null,
      customerPhone: null,
      cardProviderRequests: payments.length,
      autoReadyAfterMs: 30000,
      pagesClosedAt,
      readyChange: tracked,
      manualReadyCommandUsed: false,
      actualNotificationClicked: false,
      orderPageNavigation: 'Direct test URL preflight, not notification activation',
      sameOrderReadyVerified: true,
      liveSocketBridgeVerified: true,
      blockedPublicEndpoints: denied,
      personalDataProbeRejected: rejection.status === 422,
      pageErrors: errors,
    };
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence));
  } catch (error) {
    for (const page of context.pages())
      await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
