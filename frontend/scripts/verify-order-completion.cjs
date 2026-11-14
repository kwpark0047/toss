const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const origin = process.env.ORDER_COMPLETION_BASE_URL || 'http://127.0.0.1:5190';
  const output = path.resolve(process.env.ORDER_COMPLETION_OUTPUT || path.resolve(__dirname, '../../reports/order-completion-2026-11-10'));
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: process.env.ORDER_COMPLETION_BROWSER || 'msedge' });
  const results = [];
  const order = {
    id: 7001, store_id: 3, store_name: '검증용 카페', order_number: 'QA-023',
    order_type: 'takeout', payment_status: 'paid', payment_method: 'card',
    status: 'preparing', total_amount: 13000, discount_amount: 1000,
    items: [
      { product_name: '아메리카노', quantity: 2, price: 4000, options: JSON.stringify([{ choiceName: '아이스 / 샷 추가' }]) },
      { product_name: '부드러운 수제 치즈케이크', quantity: 1, price: 6000 },
    ],
  };
  try {
    for (const width of [320, 390, 430]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      const errors = [];
      page.on('requestfailed', r => console.log('FAILED', r.url(), r.failure()));
      page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
      page.on('pageerror', error => errors.push(error.message));
      await page.route(/https:\/\/www\.(naver|youtube)\.com\//, route => route.fulfill({ contentType: 'text/html', body: '<p>검증용 외부 서비스 화면</p>' }));
      let confirmations = 0;
      await page.route('**/api/**', async route => {
        const request = route.request(), url = request.url();
        if (!new URL(url).pathname.startsWith('/api/')) return route.continue();
        const headers = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        let data = { success: true, data: {} };
        if (url.includes('/payments/10/confirm')) {
          confirmations++;
          data = { success: true, payment: { totalAmount: 13000, method: 'CARD' } };
        } else if (/\/orders\/7001(?:\?|$)/.test(url)) {
          if (request.headers()['x-order-capability'] !== 'fixture-owned-order') throw new Error('Missing order capability');
          data = { success: true, data: order };
        } else if (url.includes('/stores/search')) data = { success: true, data: { stores: [], pagination: { total: 0 } } };
        else if (url.includes('/eta')) data = { success: true, data: null };
        return route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify(data) });
      });
      await context.addInitScript(() => {
        if (!sessionStorage.getItem('wm_completed_payment:10')) sessionStorage.setItem('wm_pending_payment:10', JSON.stringify({ paymentId: '10', orderId: '7001', providerOrderId: 'QA-023', amount: 13000, capability: 'fixture-owned-order', createdAt: Date.now() }));
      });
      // All transactions are synthetic, intercepted responses; no payment provider is contacted.
      await page.goto(origin + '/payment/success?payment_id=10&paymentKey=fixture&orderId=QA-023&amount=13000');
      try { await page.getByRole('heading', { name: '결제가 완료되었습니다!' }).waitFor({timeout:15000}); } catch (error) { console.log('PAGE', await page.locator('body').innerText(), errors); await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}); throw error; }
      await page.getByText('아메리카노 × 2').waitFor();
      if (!(await page.getByText('13,000원', { exact: true }).isVisible())) throw new Error('Missing paid total');
      const graphic = page.locator('img.oc-art');
      if (!await graphic.evaluate(img => img.complete && img.naturalWidth > 0)) throw new Error('Thank-you graphic failed');
      for (const name of ['네이버', '유튜브']) {
        const link = page.getByRole('link', { name: new RegExp(name) });
        if (await link.getAttribute('target') !== '_blank') throw new Error('External destination must preserve current page');
        const popupPromise = page.waitForEvent('popup');
        await link.click();
        const popup = await popupPromise;
        await popup.waitForLoadState('domcontentloaded');
        if (!popup.url().includes(name === '네이버' ? 'naver.com' : 'youtube.com')) throw new Error('Wrong external destination');
        await popup.close();
      }
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Horizontal overflow at ${width}`);
      await page.screenshot({ path: path.join(output, `payment-${width}.png`), fullPage: true });
      await page.reload();
      await page.getByText('아메리카노 × 2').waitFor();
      if (confirmations !== 1) throw new Error('Duplicate confirmation after reload');
      await page.getByRole('link', { name: /매장찾기 · 주문진행 확인/ }).click();
      await page.getByRole('button', { name: '내 주문 진행 확인', exact: true }).waitFor();
      await page.screenshot({ path: path.join(output, `finder-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: '내 주문 진행 확인', exact: true }).click();
      await page.getByText('QA-023', { exact: false }).last().waitFor();
      await page.getByText('아메리카노', { exact: false }).last().waitFor();
      await page.screenshot({ path: path.join(output, `progress-${width}.png`), fullPage: true });
      // Stress long names, options, disclosure, and the saved receipt under dark system settings.
      await page.evaluate(() => {
        const key = 'wm_completed_payment:10';
        const cached = JSON.parse(sessionStorage.getItem(key));
        cached.receipt.order.items = Array.from({ length: 5 }, (_, i) => ({
          product_name: `아주 긴 이름의 수제 디카페인 바닐라 라테 메뉴 ${i + 1}`,
          quantity: 1, price: 2600,
          options: JSON.stringify([{ choiceName: '아이스 / 오트밀크 변경 / 샷 추가 / 시럽 적게' }]),
        }));
        sessionStorage.setItem(key, JSON.stringify(cached));
      });
      await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
      await page.goto(origin + '/payment/success?payment_id=10&paymentKey=fixture&orderId=QA-023&amount=13000');
      await page.getByText('나머지 메뉴 2개 보기').click();
      await page.getByText('아주 긴 이름의 수제 디카페인 바닐라 라테 메뉴 5 × 1').waitFor();
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Long-order overflow at ${width}`);
      await page.locator('.order-completion').screenshot({ path: path.join(output, `long-order-${width}.png`) });
      if (errors.length) throw new Error(errors.join('\n'));
      results.push({ width, payment: 'pass', image: 'pass', overflow: false, confirmations, finder: 'pass', progress: 'pass', longOrder: 'pass', darkMode: 'pass', errors });
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
