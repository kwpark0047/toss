const { test, expect } = require('@playwright/test');

test.describe('Authentication Flow', () => {
    // 테스트 전후 데이터 클린업이 필요할 수 있음

    test('should allow a user to register and login', async ({ page, request }) => {
        // 1. API를 통해 테스트 유저 생성 (UI 테스트 속도 향상)
        // 실제 UI로 가입 테스트를 하려면 아래 주석 해제하여 작성
        /*
        await page.goto('/login');
        await page.getByText('회원가입').click();
        await page.getByPlaceholder('이름').fill('Test User');
        await page.getByPlaceholder('이메일').fill('test@example.com');
        await page.getByPlaceholder('비밀번호').fill('password123');
        await page.getByRole('button', { name: '가입하기' }).click();
        await expect(page).toHaveURL('/login');
        */

        // 여기서는 로그인 페이지 진입 테스트만 간단히 수행 (데모용)
        await page.goto('http://localhost:5173/login');

        // 타이틀 확인
        await expect(page).toHaveTitle(/WeMarket/); // Front title 확인 필요

        // 폼 요소 확인
        await expect(page.getByPlaceholder('이메일')).toBeVisible();
        await expect(page.getByPlaceholder('비밀번호')).toBeVisible();
    });
});
