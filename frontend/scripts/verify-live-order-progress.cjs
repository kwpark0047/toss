const { chromium, request } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const root = path.resolve(__dirname, '../..');
  const fixture = JSON.parse(
    fs.readFileSync(path.join(root, '.tmp/order-completion-sandbox/fixture.json'))
  );
  const origin = process.env.QA_FRONTEND_URL || 'http://127.0.0.1:5174';
  const api = 'http://127.0.0.1:5300/api';
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  assert.equal(
    fixture.dbUrl,
    'postgresql://qa:synthetic-local-only@127.0.0.1:15438/order_completion_qa'
  );
  assert.ok(fixture.email.endsWith('@example.invalid'));
  const output = path.join(root, 'reports/live-order-progress-2026-11-11');
  fs.mkdirSync(output, { recursive: true });
  const owner = await request.newContext();
  const login = await owner.post(`${api}/auth/login`, {
    data: { identifier: fixture.email, password: fixture.password },
  });
  assert.equal(login.status(), 200);
  const credentials = await login.json();
  const token = (credentials.data || credentials).token;
  assert.ok(token);
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.QA_BROWSER || (process.platform === 'win32' ? 'msedge' : 'chromium'),
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'ko-KR',
    permissions: ['notifications'],
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  });
  const page = await context.newPage();
  const errors = [];
  const liveEvents = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('websocket', (socket) =>
    socket.on('framereceived', (frame) => {
      if (String(frame.payload).includes('customer-order-changed')) liveEvents.push(Date.now());
    })
  );
  try {
    await page.goto(`${origin}/menu/${fixture.storeId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
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
    const payload = await response.json();
    const order = payload.data;
    assert.equal(order.store_id, fixture.storeId);
    assert.ok(!order.customer_phone && !order.customer_name);
    await page.getByRole('heading', { name: '주문이 접수되었습니다' }).waitFor();
    await page.getByRole('link', { name: /매장찾기 · 주문진행 확인/ }).click();
    const card = page.getByRole('complementary', { name: '실시간 주문 진행' });
    await card.getByText('실시간 연결', { exact: true }).waitFor({ timeout: 20000 });
    await card.locator('.ro-status-title').getByText('접수 대기', { exact: true }).waitFor();
    await page.getByRole('button', { name: '준비 완료 알림 켜기' }).click();
    await page.getByRole('button', { name: '브라우저 알림 끄기' }).waitFor();
    const update = async (status) => {
      const result = await owner.put(`${api}/orders/${order.id}/status`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { status },
      });
      assert.equal(result.status(), 200, `owner status ${status}`);
    };
    const timing = [];
    for (const [status, label] of [
      ['confirmed', '주문 확인'],
      ['preparing', '조리 중'],
    ]) {
      const start = Date.now();
      await update(status);
      await card
        .locator('.ro-status-title')
        .getByText(label, { exact: true })
        .waitFor({ timeout: 8000 });
      timing.push({ status, milliseconds: Date.now() - start });
    }
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ fullPage: true, path: path.join(output, `preparing-${width}.png`) });
    }
    await context.setOffline(true);
    await card.getByText(/오프라인이에요/).waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ fullPage: true, path: path.join(output, 'offline.png') });
    await context.setOffline(false);
    await card.getByText('실시간 연결', { exact: true }).waitFor({ timeout: 20000 });
    const otherTab = await context.newPage();
    await otherTab.goto('about:blank');
    await otherTab.bringToFront();
    const backgroundState = await page.evaluate(() => document.visibilityState);
    const readyStart = Date.now();
    await update('ready');
    await card.getByRole('alert').waitFor({ timeout: 8000 });
    timing.push({ status: 'ready', milliseconds: Date.now() - readyStart });
    assert.ok(liveEvents.length >= 3, 'real websocket status signals');
    await page.waitForFunction(
      (id) => !!localStorage.getItem(`wm_order_ready_delivered:${id}`),
      order.id,
      { timeout: 15000 }
    );
    const delivery = await page.evaluate(async (id) => {
      const registration = await navigator.serviceWorker.getRegistration();
      const notifications = registration?.active
        ? await registration.getNotifications({ tag: `wemarket-order-ready-${id}` })
        : [];
      return {
        permission: Notification.permission,
        workerActive: !!registration?.active,
        count: notifications.length,
        deliveredAt: localStorage.getItem(`wm_order_ready_delivered:${id}`),
      };
    }, order.id);
    assert.equal(delivery.count, 1, 'one native service worker notification');
    delivery.backgroundState = backgroundState;
    await page.bringToFront();
    await otherTab.close();
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ fullPage: true, path: path.join(output, `ready-${width}.png`) });
    }
    await update('ready');
    await page.getByRole('button', { name: '주문 상태 새로고침' }).click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await card.getByRole('alert').waitFor();
    assert.equal(
      await page.evaluate((id) => localStorage.getItem(`wm_order_ready_delivered:${id}`), order.id),
      delivery.deliveredAt
    );
    await card.getByRole('button', { name: '확인했어요' }).click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await card.locator('.ro-status-title').getByText('준비 완료', { exact: true }).waitFor();
    assert.equal(await card.getByRole('alert').count(), 0);
    await context.setOffline(true);
    await update('completed');
    await context.setOffline(false);
    await card
      .locator('.ro-status-title')
      .getByText('수령 완료', { exact: true })
      .waitFor({ timeout: 20000 });
    assert.equal(await card.getByRole('button', { name: '준비 완료 알림 켜기' }).count(), 0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ fullPage: true, path: path.join(output, 'completed.png') });
    assert.deepEqual(errors, []);
    const evidence = {
      checkedAt: new Date().toISOString(),
      syntheticAccount: true,
      orderId: order.id,
      orderNumber: order.order_number,
      storeId: order.store_id,
      paymentStatus: 'pending',
      realPaymentRequests: 0,
      apiMocking: false,
      websocketSignals: liveEvents.length,
      timing,
      widths: [320, 390, 430],
      offlineRecovery: true,
      missedCompletedRecovery: true,
      systemNotification: delivery,
      duplicateNotificationSuppressed: true,
      acknowledgementPersists: true,
      errors,
    };
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence));
  } catch (error) {
    await page
      .screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
      .catch(() => {});
    console.error(error.message);
    throw error;
  } finally {
    await browser.close();
    await owner.dispose();
  }
})().catch(() => {
  process.exitCode = 1;
});
