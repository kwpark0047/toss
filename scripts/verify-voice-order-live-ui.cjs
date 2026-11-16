const { chromium } = require('playwright'),
  fs = require('fs'),
  path = require('path'),
  assert = require('assert/strict');
(async () => {
  const repository = path.resolve(__dirname, '..');
  process.chdir(path.join(repository, 'frontend'));
  const { createServer } = await import(
    require('url').pathToFileURL(require.resolve('vite', { paths: [process.cwd()] })).href
  );
  const server = await createServer({
    configFile: path.resolve('vite.config.js'),
    root: process.cwd(),
    server: { host: '127.0.0.1', port: 5182, strictPort: true, hmr: false },
    clearScreen: false,
  });
  await server.listen();
  let browser;
  try {
    const out = path.join(repository, 'reports/ai3-voice-live-20261114');
    fs.mkdirSync(out, { recursive: true });
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: 'block',
    });
    let denied = false,
      calls = 0,
      orderCalls = 0;
    await context.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.pathname.startsWith('/api/')) {
        if (u.pathname === '/api/ai/live/session') {
          calls++;
          return route.fulfill({
            status: denied ? 503 : 200,
            contentType: 'application/json',
            body: JSON.stringify(
              denied
                ? { error: 'disabled' }
                : { success: true, data: { sessionId: 'fixture', ticket: 'fixture-only' } }
            ),
          });
        }
        if (/orders|payments/.test(u.pathname)) orderCalls++;
        return route.abort();
      }
      return ['127.0.0.1', 'localhost'].includes(u.hostname) ? route.continue() : route.abort();
    });
    await context.addInitScript(() => {
      window.__stops = 0;
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: async () => {
            const t = {
              enabled: true,
              stop() {
                window.__stops++;
              },
            };
            return { getTracks: () => [t], getAudioTracks: () => [t] };
          },
        },
      });
      window.AudioContext = class {
        constructor() {
          this.audioWorklet = { addModule: async () => {} };
        }
        async resume() {}
        createMediaStreamSource() {
          return { connect() {}, disconnect() {} };
        }
        createGain() {
          return { gain: { value: 0 }, connect() {}, disconnect() {} };
        }
        async close() {}
      };
      window.AudioWorkletNode = class {
        constructor() {
          this.port = { close() {} };
        }
        connect() {}
        disconnect() {}
      };
      const Native = window.WebSocket;
      window.WebSocket = class {
        constructor(url) {
          if (!url.includes('/api/ai/live/connect')) return new Native(url);
          this.readyState = 1;
          this.bufferedAmount = 0;
          this.revision = 0;
          setTimeout(() => this.onopen?.(), 10);
        }
        send(raw) {
          const m = JSON.parse(raw),
            emit = (data) => this.onmessage?.({ data: JSON.stringify(data) });
          if (m.type === 'auth') setTimeout(() => emit({ type: 'state', state: 'LISTENING' }), 10);
          if (m.type === 'text') {
            const revision = ++this.revision;
            setTimeout(() => {
              emit({ type: 'state', state: 'TOOL_CALLING' });
              const quantity = revision === 1 ? 2 : 1;
              emit({
                type: 'draft',
                draftId: 'fixture:' + revision,
                draft: {
                  success: true,
                  items: [
                    {
                      product_id: 1,
                      name: 'QA 커피',
                      quantity,
                      base_price: 1000,
                      unit_price: 1000,
                      line_total: quantity * 1000,
                      selected_options: [],
                    },
                  ],
                  total: quantity * 1000,
                },
              });
              emit({ type: 'state', state: 'LISTENING' });
            }, 100);
          }
        }
        close() {
          this.readyState = 3;
        }
      };
    });
    const page = await context.newPage();
    const dimensions = [];
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 640 });
      await page.goto('http://127.0.0.1:5182/src/test/fixtures/voice-order-live.html', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      const before = calls;
      await page.getByRole('button', { name: 'Live로 주문하기', exact: true }).click();
      assert.equal(calls, before);
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: '대화 시작', exact: true }).click();
      const input = page.getByRole('textbox', { name: 'Live 주문 문장' });
      await page.getByRole('button', { name: '음소거', exact: true }).waitFor();
      await input.fill('커피 두 잔');
      await page.getByRole('button', { name: '수정 요청 보내기', exact: true }).click();
      await page.getByText('QA 커피 × 2', { exact: false }).waitFor();
      assert.equal(await page.getByLabel('테스트 장바구니').innerText(), '장바구니 0개');
      await page.screenshot({ path: out + '/draft-' + width + '.png', fullPage: true });
      await input.fill('하나 취소');
      assert.equal(
        await page.getByRole('button', { name: '확인 후 장바구니에 담기' }).isDisabled(),
        true
      );
      await page.getByRole('button', { name: '수정 요청 보내기', exact: true }).click();
      await page.getByText('QA 커피 × 1', { exact: false }).waitFor();
      const d = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      assert.equal(d.width, d.scrollWidth);
      dimensions.push(d);
      await page.getByRole('button', { name: '확인 후 장바구니에 담기' }).click();
      assert.equal(await page.getByLabel('테스트 장바구니').innerText(), '장바구니 1개');
      assert.equal(await page.evaluate(() => window.__stops), 1);
      await page.screenshot({ path: out + '/cart-' + width + '.png', fullPage: true });
    }
    denied = true;
    await page.getByRole('button', { name: 'Live로 주문하기', exact: true }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: '대화 시작', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: '실시간 주문을 종료했습니다' }).waitFor();
    await page.screenshot({ path: out + '/legacy-fallback-320.png', fullPage: true });
    assert.equal(orderCalls, 0);
    fs.writeFileSync(
      out + '/browser-check.json',
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          dimensions,
          providerFixtureOnly: true,
          realMicrophoneUsed: false,
          paidLiveCalls: 0,
          dbChanges: false,
          orderPaymentApiCalls: orderCalls,
          confirmedLatestSnapshotOnly: true,
          closedMicrophoneVerified: true,
          legacyFallbackVerified: true,
        },
        null,
        2
      )
    );
    console.log(JSON.stringify({ result: 'PASS', dimensions, orderPaymentApiCalls: orderCalls }));
  } finally {
    await browser?.close();
    await server.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
