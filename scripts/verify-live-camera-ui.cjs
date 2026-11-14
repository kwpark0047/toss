const { chromium } = require('playwright'),
  fs = require('fs'),
  path = require('path'),
  assert = require('assert/strict');
(async () => {
  const repository = path.resolve(__dirname, '..');
  process.chdir(path.join(repository, 'frontend'));
  process.env.VITE_AI_LIVE_UI_ENABLED = 'true';
  process.env.VITE_AI_LIVE_CAMERA_UI_ENABLED = 'true';
  const { createServer } = await import(
    require('url').pathToFileURL(require.resolve('vite', { paths: [process.cwd()] })).href
  );
  const server = await createServer({
    configFile: path.resolve('vite.config.js'),
    root: process.cwd(),
    server: { host: '127.0.0.1', port: 5184, strictPort: true, hmr: false },
    clearScreen: false,
  });
  await server.listen();
  let browser;
  try {
    const out = path.join(repository, 'reports/ai3-camera-20261114');
    fs.mkdirSync(out, { recursive: true });
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: 'block',
    });
    await context.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.pathname.startsWith('/api/'))
        return u.pathname === '/api/ai/live/session'
          ? route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                data: { sessionId: 'camera-fixture', ticket: 'fixture-only', cameraAllowed: true },
              }),
            })
          : route.abort();
      return ['127.0.0.1', 'localhost'].includes(u.hostname) ? route.continue() : route.abort();
    });
    await context.addInitScript(() => {
      window.__cameraCalls = 0;
      window.__images = [];
      window.__cameraTracks = [];
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: async (constraints) => {
            if (constraints.video) {
              window.__cameraCalls++;
              if (window.__denyCamera) throw Error('NotAllowedError');
              const c = document.createElement('canvas');
              c.width = 320;
              c.height = 240;
              const x = c.getContext('2d');
              x.fillStyle = 'white';
              x.fillRect(0, 0, 320, 240);
              x.fillStyle = 'black';
              x.font = '20px sans-serif';
              x.fillText('QA MENU', 20, 50);
              const stream = c.captureStream(1);
              window.__cameraTracks.push(...stream.getTracks());
              return stream;
            }
            return { getTracks: () => [{ stop() {} }] };
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
          if (m.type === 'image') {
            window.__images.push({ bytes: atob(m.data).length, time: performance.now() });
            setTimeout(
              () =>
                emit(
                  window.__rejectCamera
                    ? {
                        type: 'cameraState',
                        enabled: false,
                        error: '카메라 전송을 중지했습니다. 음성·텍스트로 이어가세요.',
                      }
                    : {
                        type: 'transcript',
                        direction: 'outputTranscription',
                        text: '합성 메뉴판을 확인했습니다. 가격은 매장 메뉴에서 확인해 주세요.',
                      }
                ),
              10
            );
          }
        }
        close() {
          this.readyState = 3;
        }
      };
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5184/src/test/fixtures/tinkerbell-live.html', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.getByRole('button', { name: '음성 대화', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: '대화 시작', exact: true }).click();
    await page.getByRole('button', { name: '음소거', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__cameraCalls), 0);
    await page.getByRole('checkbox').last().check();
    await page.getByRole('button', { name: '카메라 켜기', exact: true }).click();
    await page.getByRole('button', { name: '사진 확인', exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('video').videoWidth === 320);
    await page.getByRole('button', { name: '사진 확인', exact: true }).click();
    await page.getByAltText('전송 전 사진').waitFor();
    await page.getByRole('button',{name:'이 사진 전송',exact:true}).scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => window.__images.length), 0);
    await page.screenshot({ path: out + '/camera-preview-390.png', fullPage: true });
    await page.getByRole('button', { name: '이 사진 전송', exact: true }).click();
    await page.waitForFunction(() => window.__images.length === 1);
    assert.ok(await page.evaluate(() => window.__images[0].bytes <= 16384));
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.getByRole('button', { name: '카메라 켜기', exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() => window.__cameraTracks.every((t) => t.readyState === 'ended')),
      true
    );
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      window.__denyCamera = true;
    });
    await page.getByRole('button', { name: '카메라 켜기', exact: true }).click();
    await page
      .getByText('카메라를 사용할 수 없습니다. 음성·텍스트로 이어가세요.', { exact: true })
      .waitFor();
    assert.equal(await page.getByRole('textbox', { name: '메시지' }).isEnabled(), true);
    await page.screenshot({ path: out + '/camera-denied-voice-390.png', fullPage: true });
    await page.setViewportSize({ width: 320, height: 640 });
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.equal(dimensions.width, dimensions.scrollWidth);
    await page.screenshot({ path: out + '/camera-fallback-320.png', fullPage: true });
    fs.writeFileSync(
      out + '/browser-check.json',
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          dimensions,
          syntheticCanvasCamera: true,
          physicalCameraUsed: false,
          paidApiCalls: 0,
          dbChanges: false,
          explicitConsentVerified: true,
          previewBeforeSend: true,
          oneBoundedJpegSent: true,
          hiddenTracksEnded: true,
          denialPreservesVoice: true,
        },
        null,
        2
      )
    );
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    console.log(
      JSON.stringify({ result: 'PASS', dimensions, physicalCameraUsed: false, paidApiCalls: 0 })
    );
  } finally {
    await browser?.close();
    await server.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
