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
    server: { host: '127.0.0.1', port: 5185, strictPort: true, hmr: false },
    clearScreen: false,
  });
  await server.listen();
  let browser;
  try {
    const out = path.join(repository, 'reports/ai3-menu-photo-20261114');
    fs.mkdirSync(out, { recursive: true });
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: 'block',
    });
    const saves = [];
    let scans = 0,
      denied = false;
    await context.route('**/*', (route) => {
      const u = new URL(route.request().url()),
        p = u.pathname,
        method = route.request().method();
      const reply = (data) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data }),
        });
      if (p.startsWith('/api/')) {
        if (p === '/api/ai/scan-menu-image') {
          scans++;
          const body = route.request().postDataJSON();
          assert.equal(body.store_id, 3);
          assert.equal(body.consent, true);
          return denied
            ? route.fulfill({
                status: 503,
                contentType: 'application/json',
                body: '{"error":"매장 AI 공용 예산 또는 사용량을 확인할 수 없습니다."}',
              })
            : route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                  success: true,
                  suggestions: [
                    {
                      name: 'QA 커피',
                      category_name: '음료',
                      description: '검토할 초안',
                      ingredient_review: '우유 원재료 확인',
                      price: 99999,
                      allergens: '없음',
                      image_url: 'https://untrusted.invalid/ignore',
                    },
                  ],
                }),
              });
        }
        if (p === '/api/products' && method === 'POST') {
          saves.push(route.request().postDataJSON());
          return reply({ id: 123 });
        }
        if (method === 'GET') {
          if (p.includes('subscription')) return reply({ effective_plan: 'free' });
          if (p.includes('option-template')) return reply([]);
          return reply({ id: 3, plan: 'free' });
        }
        return route.abort();
      }
      return ['127.0.0.1', 'localhost'].includes(u.hostname) ? route.continue() : route.abort();
    });
    const page = await context.newPage(),
      photo = Buffer.from(
        JSON.parse(
          fs.readFileSync(path.join(repository, 'tests/fixtures/live-camera-frame.json'), 'utf8')
        ).data,
        'base64'
      );
    await page.goto('http://127.0.0.1:5185/src/test/fixtures/menu-photo-draft.html', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page
      .getByLabel('메뉴 사진 선택')
      .setInputFiles({ name: 'qa.jpg', mimeType: 'image/jpeg', buffer: photo });
    await page.getByAltText('분석 전 메뉴 사진').waitFor();
    assert.equal(scans, 0);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: '사진 분석 초안 만들기' }).click();
    await page.getByRole('button', { name: '이 초안을 등록 화면에서 검토' }).waitFor();
    assert.equal(saves.length, 0);
    await page.screenshot({ path: out + '/photo-draft-390.png', fullPage: true });
    await page.getByRole('button', { name: '이 초안을 등록 화면에서 검토' }).click();
    const save = page.getByRole('button', { name: '메뉴 등록', exact: true });
    assert.equal(await save.isDisabled(), true);
    assert.equal(await page.getByPlaceholder('0', { exact: true }).inputValue(), '');
    assert.equal(
      await page.getByRole('textbox', { name: '사업자 확인 알레르기' }).inputValue(),
      ''
    );
    await page.getByPlaceholder('0', { exact: true }).fill('1000');
    await page.getByRole('textbox', { name: '사업자 확인 알레르기' }).fill('우유');
    await page.getByRole('checkbox', { name: '가격을 직접 입력하고 확인했습니다.' }).check();
    await page.getByRole('checkbox', { name: '알레르기 정보를 원재료와 대조했습니다.' }).check();
    assert.equal(await save.isDisabled(), true);
    await page
      .getByRole('checkbox', { name: '초안 전체를 검토했으며 메뉴 등록을 승인합니다.' })
      .check();
    assert.equal(saves.length, 0);
    await page.screenshot({ path: out + '/owner-review-390.png', fullPage: true });
    await save.click();
    await page.getByText('가짜 메뉴 등록 완료', { exact: true }).waitFor();
    assert.equal(saves.length, 1);
    assert.equal(saves[0].price, 1000);
    assert.equal(saves[0].allergens, '우유');
    assert.equal(saves[0].image_url, '');
    denied = true;
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('http://127.0.0.1:5185/src/test/fixtures/menu-photo-draft.html', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page
      .getByLabel('메뉴 사진 선택')
      .setInputFiles({ name: 'qa.jpg', mimeType: 'image/jpeg', buffer: photo });
    await page.getByAltText('분석 전 메뉴 사진').waitFor();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: '사진 분석 초안 만들기' }).click();
    await page.getByRole('alert').waitFor();
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.equal(dimensions.width, dimensions.scrollWidth);
    await page.screenshot({ path: out + '/denied-manual-320.png', fullPage: true });
    await page.getByRole('button', { name: '수동 메뉴 등록' }).click();
    await page.getByRole('button', { name: '메뉴 등록', exact: true }).waitFor();
    assert.equal(saves.length, 1);
    fs.writeFileSync(
      out + '/browser-check.json',
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          dimensions,
          syntheticPhoto: true,
          paidApiCalls: 0,
          dbChanges: false,
          noSaveBeforeOwnerApproval: true,
          aiPriceAndAllergensDiscarded: true,
          manualPrice: 1000,
          manualAllergens: '우유',
          fakeProductWrites: saves.length,
          deniedManualFallback: true,
          budgetDeniedManualFallback: true,
        },
        null,
        2
      )
    );
    console.log(
      JSON.stringify({
        result: 'PASS',
        dimensions,
        fakeProductWrites: saves.length,
        paidApiCalls: 0,
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
