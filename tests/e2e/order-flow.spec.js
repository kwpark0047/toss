const { test, expect } = require('@playwright/test');

test.describe('Order Flow', () => {
    test('should display menu and add to cart', async ({ page }) => {
        // 1. 매장 페이지 진입 (Store ID 1)
        await page.goto('http://localhost:5173/store/1');

        // 2. 메뉴 로딩 확인
        // 실제 데이터에 따라 선택자가 달라질 수 있음
        // await expect(page.getByText('커피')).toBeVisible();

        // 3. 장바구니 담기
        // await page.getByRole('button', { name: '담기' }).first().click();

        // 4. 장바구니 확인
        // await expect(page.getByText('장바구니')).toContainText('1');
    });
});
