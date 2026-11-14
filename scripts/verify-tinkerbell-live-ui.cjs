const { chromium } = require('playwright'),
  fs = require('fs'),
  assert = require('assert/strict');
(async () => {
  const path = require('path');
  const repository = path.resolve(__dirname, '..');
  process.chdir(path.join(repository, 'frontend'));
  const { createServer } = await import(
    require('url').pathToFileURL(require.resolve('vite', { paths: [process.cwd()] })).href
  );
  const server = await createServer({
    configFile: path.resolve('vite.config.js'),
    root: process.cwd(),
    server: { host: '127.0.0.1', port: 5181, strictPort: true, hmr: false },
    clearScreen: false,
  });
  await server.listen();
  console.log('Local fixture server ready', server.httpServer.address());
  let browser;
  try {
    const out = path.join(repository, 'reports/ai3-p1-tinkerbell-20261114');
    fs.mkdirSync(out, { recursive: true });
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    let denied = true,
      calls = 0;
    await context.route('**/*', async (route) => {
      if (
        !['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) &&
        !new URL(route.request().url()).pathname.startsWith('/api/')
      )
        return route.abort();
      if (!new URL(route.request().url()).pathname.startsWith('/api/')) return route.continue();
      if (new URL(route.request().url()).pathname === '/api/ai/live/session') {
        calls++;
        return route.fulfill({
          status: denied ? 503 : 200,
          contentType: 'application/json',
          body: JSON.stringify(
            denied
              ? { error: 'disabled' }
              : {
                  success: true,
                  data: { sessionId: 'fixture-session', ticket: 'fixture-only-not-real' },
                }
          ),
        });
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      window.__stops = 0;
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: async () => {
            const track = {
              enabled: true,
              stop() {
                window.__stops++;
              },
            };
            window.__track = track;
            return { getTracks: () => [track], getAudioTracks: () => [track] };
          },
        },
      });
      window.AudioContext = class {
        constructor() {
          this.audioWorklet = { addModule: async () => {} };
          this.state = 'running';
        }
        async resume() {}
        createMediaStreamSource() {
          return { connect() {}, disconnect() {} };
        }
        createGain() {
          return { gain: { value: 0 }, connect() {}, disconnect() {} };
        }
        async close() {
          this.state = 'closed';
        }
      };
      window.AudioWorkletNode = class {
        constructor() {
          this.port = { close() {} };
        }
        connect() {}
        disconnect() {}
      };
      const native = window.WebSocket;
      window.WebSocket = class {
        constructor(url) {
          if (!url.includes('/api/ai/live/connect')) return new native(url);
          this.readyState = 1;
          this.bufferedAmount = 0;
          setTimeout(() => this.onopen?.(), 10);
        }
        send(raw) {
          const m = JSON.parse(raw);
          if (m.type === 'auth')
            setTimeout(() => {
              this.onmessage?.({ data: JSON.stringify({ type: 'state', state: 'LISTENING' }) });
              this.onmessage?.({
                data: JSON.stringify({
                  type: 'transcript',
                  direction: 'outputTranscription',
                  text: '판매 중인 메뉴를 확인해 드릴게요.',
                }),
              });
            }, 10);
        }
        close() {
          this.readyState = 3;
        }
      };
    });
    await page.goto('http://127.0.0.1:5181/src/test/fixtures/tinkerbell-live.html');
    await page.getByRole('button', { name: '음성 대화', exact: true }).click();
    assert.equal(calls, 0);
    await page.screenshot({ path: out + '/consent-ko-390.png', fullPage: true });
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: '대화 시작', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '일반 음성 안내로 전환했습니다' }).waitFor();
    await page.screenshot({ path: out + '/fallback-ko-390.png', fullPage: true });
    assert.equal(await page.evaluate(() => window.__track), undefined);
    denied = false;
    await page.getByRole('button', { name: '대화 시작', exact: true }).click();
    await page.getByText('판매 중인 메뉴를 확인해 드릴게요.').waitFor();
    await page.getByRole('button', { name: '음소거', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__track.enabled), false);
    await page.screenshot({ path: out + '/captions-muted-ko-390.png', fullPage: true });
    const mobile = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      dialogWidth: document.querySelector('[role=dialog]').getBoundingClientRect().width,
    }));
    assert.equal(mobile.width, mobile.scrollWidth);
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__stops), 1);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('http://127.0.0.1:5181/src/test/fixtures/tinkerbell-live.html?lang=en');
    await page.getByRole('button', { name: 'Voice chat', exact: true }).click();
    await page.screenshot({ path: out + '/consent-en-320.png', fullPage: true });
    const small = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.equal(small.width, small.scrollWidth);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: out + '/consent-en-desktop.png', fullPage: true });
    fs.writeFileSync(
      out + '/browser-check.json',
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          mobile,
          small,
          fixtureProviderOnly: true,
          realMicrophoneUsed: false,
          paidLiveCalls: 0,
          dbChanges: false,
          disabledNoMicrophone: true,
          muteTrackVerified: true,
          closeTrackStopped: true,
          consentBeforeConnection: true,
        },
        null,
        2
      )
    );
    await browser.close();
    console.log(
      JSON.stringify({ result: 'PASS', mobile, small, fixtureProviderOnly: true, paidLiveCalls: 0 })
    );
  } catch (error) {
    console.error(error.message);
    throw error;
  } finally {
    await browser?.close();
    await server.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
