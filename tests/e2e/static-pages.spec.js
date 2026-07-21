const { test, expect } = require('@playwright/test');

test.describe('정적 페이지 렌더', () => {
  test.describe.configure({ timeout: 20000 });

  test('랜딩 페이지 로드 — 주요 섹션 존재', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // features 섹션
    const features = page.locator('#features');
    await expect(features).toBeVisible({ timeout: 10000 });

    // how-to 섹션
    const howTo = page.locator('#how-to');
    await expect(howTo).toBeVisible();

    // popular 섹션 (인기 스토어)
    const popular = page.locator('#popular');
    await expect(popular).toBeVisible();

    // 페이지 타이틀 (h1 또는 유의미한 메인 타이틀)
    await expect(page).toHaveTitle(/WeMarket|wemarket|위마켓/i);
  });

  test('랜딩 페이지 — 주요 내비게이션 링크', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // 헤더 nav 링크 존재 확인 (features, pricing, contact 등)
    const navLinks = page.locator('nav a, header a');
    const linkCount = await navLinks.count();

    expect(linkCount).toBeGreaterThanOrEqual(3); // 최소 3개 이상 nav 링크
  });

  test('/features — 기능 소개 페이지 로드', async ({ page }) => {
    await page.goto('/features', { waitUntil: 'networkidle' });
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    const text = await page.locator('body').innerText();
    expect(text.length).toBeGreaterThan(50); // 내용이 비어있지 않음
  });

  test('/pricing — 가격 페이지 로드', async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'networkidle' });
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('/contact — 문의 페이지 로드', async ({ page }) => {
    await page.goto('/contact', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    const text = await page.locator('body').innerText();
    expect(text.length).toBeGreaterThan(10); // 내용이 비어있지 않음
  });

  test('/payment/success — 영수증 페이지 렌더 (인자 없이도 로드됨)', async ({ page }) => {
    await page.goto('/payment/success', { waitUntil: 'networkidle' });
    // 쿼리 파라미터 없으면 "결제 정보가 누락" 오류 문구 확인
    const body = page.locator('body');
    await expect(body).toBeVisible({ timeout: 10000 });
    const text = await body.innerText();
    expect(text).toContain('결제');
  });

  test('/payment/fail — 결제 실패 페이지 로드', async ({ page }) => {
    await page.goto('/payment/fail', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('404 — 존재하지 않는 경로', async ({ page }) => {
    await page.goto('/this-path-does-not-exist-12345', { waitUntil: 'networkidle' });
    const body = page.locator('body');
    await expect(body).toBeVisible({ timeout: 10000 });
    const text = await body.innerText();
    expect(text).toContain('404');
  });

  test('/menu/demo — 데모 메뉴 페이지 로드', async ({ page }) => {
    await page.goto('/menu/demo', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
    const text = await page.locator('body').innerText();

    // 스캔 버튼 존재
    expect(text).toContain('주문 시작하기');
  });
});
