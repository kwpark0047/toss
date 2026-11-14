const { chromium } = require('playwright'),
  fs = require('fs'),
  path = require('path'),
  assert = require('assert/strict');
(async () => {
  const repository = path.resolve(__dirname, '..');
  process.chdir(path.join(repository, 'frontend'));
  process.env.VITE_AI_LIVE_UI_ENABLED = 'true';
  const { createServer } = await import(
    require('url').pathToFileURL(require.resolve('vite', { paths: [process.cwd()] })).href
  );
  const server = await createServer({
    configFile: path.resolve('vite.config.js'),
    root: process.cwd(),
    server: { host: '127.0.0.1', port: 5183, strictPort: true, hmr: false },
    clearScreen: false,
  });
  await server.listen();
  let browser;
  try {
    const out = path.join(repository, 'reports/ai3-manager-live-20261114');
    fs.mkdirSync(out, { recursive: true });
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: 'block',
    });
    let owner = true,
      status = 'proposed',
      denied = false;
    const mutations = [];
    await context.route('**/*', (route) => {
      const u = new URL(route.request().url()),
        p = u.pathname;
      const reply = (data) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data }),
        });
      if (p.startsWith('/api/')) {
        if (p === '/api/ai/live/session') {
          assert.equal(route.request().postDataJSON().purpose, 'manager');
          return denied
            ? route.fulfill({
                status: 403,
                contentType: 'application/json',
                body: '{"error":"forbidden"}',
              })
            : reply({ sessionId: 'fixture-manager', ticket: 'fixture-only' });
        }
        if (p.endsWith('/briefing'))
          return reply({
            store: { id: 3, name: 'QA 매장' },
            can_execute: owner,
            current: { revenue: 1000, orders: 2 },
            historical: { days: 0 },
            review: { count: 0 },
            actions: [
              {
                id: 'qa-action',
                status,
                created_at: new Date().toISOString(),
                payload: { title: 'QA 메뉴 노출', reason: '테스트 제안' },
              },
            ],
          });
        if (p.includes('/actions/') && route.request().method() === 'POST') {
          assert.equal(owner, true);
          const event = p.split('/').pop();
          mutations.push(event);
          status = event === 'approve' ? 'approved' : 'running';
          return reply({});
        }
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
          setTimeout(() => this.onopen?.(), 10);
        }
        send(raw) {
          const m = JSON.parse(raw),
            emit = (data) => this.onmessage?.({ data: JSON.stringify(data) });
          if (m.type === 'auth') setTimeout(() => emit({ type: 'state', state: 'LISTENING' }), 10);
          if (m.type === 'text')
            setTimeout(() => {
              emit({
                type: 'managerFacts',
                kind: 'get_manager_briefing',
                data: { current: { revenue: 1000, orders: 2 }, basis: 'QA 자체 주문 집계' },
              });
              emit({
                type: 'transcript',
                direction: 'outputTranscription',
                text: '집계는 1,000원입니다. 변경은 기존 제안에서 승인 후 실행해 주세요.',
              });
            }, 10);
        }
        close() {
          this.readyState = 3;
        }
      };
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5183/src/test/fixtures/manager-live.html', {waitUntil:'domcontentloaded',timeout:60000});
    await page.getByRole('button', { name: 'Live 상담 시작' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Live 상담 시작' }).isDisabled(), true);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Live 상담 시작' }).click();
    const question = page.getByRole('textbox', { name: 'Live 매장 상담 질문' });
    await question.fill('오늘 매출 확인하고 제안 실행해 줘');
    await page.getByRole('button', { name: '질문 보내기' }).click();
    await page.getByLabel('서버 조회 집계').waitFor();
    assert.equal(mutations.length, 0);
    await page.screenshot({ path: out + '/owner-live-facts-390.png', fullPage: true });
    await page.getByRole('button', { name: '기존 제안·승인 화면 보기' }).click();
    assert.equal(mutations.length, 0);
    await page.getByRole('button', { name: '제안 승인', exact: true }).click();
    await page.getByRole('button', { name: '미리보기 확인 후 적용' }).waitFor();
    assert.deepEqual(mutations, ['approve']);
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: '미리보기 확인 후 적용' }).click();
    assert.deepEqual(mutations, ['approve']);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '미리보기 확인 후 적용' }).click();
    await page.getByRole('button', { name: '노출 중단' }).waitFor();
    assert.deepEqual(mutations, ['approve', 'execute']);
    await page.screenshot({ path: out + '/owner-approved-fixture-390.png', fullPage: true });
    owner = false;
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('http://127.0.0.1:5183/src/test/fixtures/manager-live.html', {waitUntil:'domcontentloaded',timeout:60000});
    await page.getByRole('button', { name: 'Live 상담 시작' }).waitFor();
    assert.equal(await page.getByRole('button', { name: '제안 승인', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '노출 중단' }).count(), 0);
    denied = true;
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Live 상담 시작' }).click();
    await page.getByRole('status').filter({ hasText: '기존 텍스트 상담' }).waitFor();
    await page.screenshot({ path: out + '/manager-denied-fallback-320.png', fullPage: true });
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.equal(dimensions.width, dimensions.scrollWidth);
    fs.writeFileSync(
      out + '/browser-check.json',
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          dimensions,
          providerFixtureOnly: true,
          paidLiveCalls: 0,
          dbChanges: false,
          liveMutationCalls: 0,
          fixtureManualTransitions: mutations,
          ownerCancelBlocksExecution: true,
          managerMutationsHidden: true,
          deniedFallbackVerified: true,
        },
        null,
        2
      )
    );
    console.log(
      JSON.stringify({
        result: 'PASS',
        dimensions,
        liveMutationCalls: 0,
        fixtureManualTransitions: mutations,
      })
    );
  } finally {
    await browser?.close();
    await server.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
