const { chromium } = require('playwright');
const fs = require('fs'),
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
    server: { host: '127.0.0.1', port: 5186, strictPort: true, hmr: false },
  });
  await server.listen();
  let browser;
  const out = path.join(repository, 'reports/ai3-marketing-20261114');
  fs.mkdirSync(out, { recursive: true });
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const requests = [],
      external = [];
    const catalogue = {
      store: { id: 3, name: 'QA 마케팅 테스트 매장' },
      products: [{ id: 7, name: 'QA 테스트 메뉴', price: 1000 }],
    };
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: 'block',
    });
    await context.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.pathname.startsWith('/api/')) {
        const method = route.request().method();
        requests.push({ path: u.pathname, method });
        if (u.pathname !== '/api/ai/marketing-drafts') return route.abort();
        if (method === 'GET')
          return route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: catalogue }),
          });
        const input = route.request().postDataJSON();
        assert.equal(input.store_id, 3);
        assert.deepEqual(input.product_ids, [7]);
        if (input.use_ai)
          return route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'AI 생성은 비활성화되어 있습니다.' }),
          });
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              store_id: 3,
              draft_only: true,
              source: 'template',
              channel: input.channel,
              content:
                'QA 마케팅 테스트 매장\nQA 테스트 메뉴\n오늘은 이 메뉴 어떠세요? 매장에서 만나요!',
              hashtags: ['#매장소식', '#메뉴소개'],
              facts: catalogue,
            },
          }),
        });
      }
      if (!['127.0.0.1', 'localhost'].includes(u.hostname)) {
        external.push(u.origin);
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text) => {
            window.__copied = text;
          },
        },
      });
    });
    await page.goto('http://127.0.0.1:5186/src/test/fixtures/marketing-draft.html', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.getByRole('checkbox', { name: /QA 테스트 메뉴/ }).check();
    await page.getByRole('button', { name: '초안 만들기' }).click();
    const copy = page.getByRole('button', { name: '검토한 초안 복사' });
    await copy.waitFor();
    assert.equal(await copy.isDisabled(), true);
    await page.screenshot({ path: path.join(out, 'draft-390.png'), fullPage: true });
    await page.getByRole('checkbox', { name: /가격·혜택·표현/ }).check();
    await copy.click();
    assert.match(await page.evaluate(() => window.__copied), /QA 테스트 메뉴/);
    await page
      .getByRole('textbox', { name: '홍보 문구 초안' })
      .fill('사업자가 수정한 QA 홍보 문구');
    assert.equal(await copy.isDisabled(), true);
    await page.screenshot({ path: path.join(out, 'review-edit-390.png'), fullPage: true });
    await page.setViewportSize({ width: 320, height: 844 });
    await page.getByRole('checkbox', { name: 'AI 생성 사용 (관리자 활성화 시)' }).check();
    assert.equal(await page.getByRole('button', { name: '초안 만들기' }).isDisabled(), true);
    await page.getByRole('checkbox', { name: /AI에 전송/ }).check();
    await page.getByRole('button', { name: '초안 만들기' }).click();
    await page.getByRole('status').filter({ hasText: '초안 생성이 불가능합니다.' }).waitFor();
    await page.screenshot({ path: path.join(out, 'disabled-ai-320.png'), fullPage: true });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false
    );
    assert.equal(
      requests.filter((r) => r.method !== 'GET' && r.path !== '/api/ai/marketing-drafts').length,
      0
    );
    assert.deepEqual(external, []);
    fs.writeFileSync(
      path.join(out, 'browser-check.json'),
      JSON.stringify(
        {
          viewports: [390, 320],
          copyRequiresReview: true,
          editRevokesApproval: true,
          consentRequired: true,
          disabledAiFallback: true,
          externalRequests: external,
          requests,
        },
        null,
        2
      )
    );
    console.log(
      'Marketing mobile fixture PASS: review, copy, edit reset, consent, disabled AI, no external calls or writes.'
    );
  } finally {
    await browser?.close();
    await server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
