const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });

  // Render 먼저 깨우기
  await fetch('https://wemarket.onrender.com/api/health').catch(() => {});

  // 모바일 컨텍스트 (iPhone 14 Pro)
  const ctx = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  page.on('response', async res => {
    if (res.url().includes('onrender')) {
      const p = res.url().split('/api/')[1];
      if (p) process.stdout.write('[' + res.status() + ':' + p.slice(0,30) + '] ');
    }
  });

  // 로그인
  await page.goto('https://wemarket.vercel.app/auth', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('input', { timeout: 15000 });
  await page.fill('input[type="text"]', 'test_cafe@wemarket.kr');
  await page.fill('input[type="password"]', 'test1234');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin**', { timeout: 20000 });
  await page.waitForTimeout(5000);

  // 대시보드
  await page.screenshot({ path: 'D:/wemarket-toss/ss_m1_dash.png' });
  console.log('\n[1] 대시보드');

  // 더보기 바텀시트
  await page.locator('button').filter({ hasText: '더보기' }).first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'D:/wemarket-toss/ss_m2_more.png' });
  console.log('[2] 더보기 시트');

  // 닫고 스크롤 다운
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.evaluate(function() { window.scrollTo(0, 500); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'D:/wemarket-toss/ss_m3_scrolled.png' });
  console.log('[3] 스크롤 다운');

  // 어드민 매장 선택 후 주문서 화면
  await page.goto('https://wemarket.vercel.app/admin/stores/4/orders', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: 'D:/wemarket-toss/ss_m4_orders.png' });
  console.log('[4] 주문서 화면');

  await browser.close();
  console.log('\n완료');
})().catch(e => console.error('ERROR:', e.message));
