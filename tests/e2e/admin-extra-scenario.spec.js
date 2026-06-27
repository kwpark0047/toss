const { test, expect } = require('@playwright/test');

test.describe('Admin Extra Features Scenario', () => {
    // 테스트용 계정 정보
    const TEST_EMAIL = 'superadmin@wemarket.com';
    const TEST_PASSWORD = 'password123';

    // 테스트 전체 타임아웃 2분
    test.setTimeout(120000);

    test.beforeEach(async ({ page }) => {
        // 1. 로그인 수행
        await page.goto('/login', { waitUntil: 'networkidle' });
        await page.getByPlaceholder('email@example.com').fill(TEST_EMAIL);
        await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
        await page.getByRole('button', { name: '로그인' }).click();

        // 로그인 성공 대기
        await expect(page).toHaveURL(/\/admin/);
    });

    test('Staff Management: Create and List', async ({ page }) => {
        // 1. 직원 관리 페이지 이동
        await page.goto('/admin/stores/1/staff', { waitUntil: 'networkidle' });

        // 2. 직원 추가 모달 열기
        await page.getByRole('button', { name: '직원 추가' }).click();

        // 3. 폼 입력
        const timestamp = Date.now();
        const staffName = `Staff ${timestamp}`;
        const staffEmail = `staff_${timestamp}@test.com`;

        await page.getByPlaceholder('홍길동').fill(staffName);
        await page.getByPlaceholder('staff@example.com').fill(staffEmail);
        await page.getByPlaceholder('6자 이상').fill('password123');

        // 역할 선택 (name이 없으므로 label로 찾거나 n번째 select)
        // StaffManager.jsx를 보면 form 내부의 유일한 select임
        await page.locator('select').selectOption('staff');

        // 4. 등록
        await page.getByRole('button', { name: '등록' }).click();

        // 모달이 닫힐 때까지 대기 (성공 시 닫힘)
        // 만약 에러가 있다면 닫히지 않고 에러 메시지가 뜸
        try {
            await expect(page.locator('h2:has-text("직원 추가")')).toBeHidden({ timeout: 5000 });
        } catch (e) {
            console.log('직원 추가 모달이 닫히지 않았습니다.');
            await page.screenshot({ path: 'debug_staff_add_fail.png' });
            // 에러 메시지 확인
            const errorMsg = await page.locator('.text-red-600').textContent();
            console.log('Error message:', errorMsg);
            throw e;
        }

        // 5. 등록 확인
        // 리스트 갱신 대기
        await page.waitForTimeout(2000);
        await expect(page.getByText(staffName)).toBeVisible();

        // 스크린샷 캡처
        await page.screenshot({ path: 'debug_staff_list.png' });
    });

    test('Customer Management: Load List', async ({ page }) => {
        // 1. 고객 관리 페이지 이동
        await page.goto('/admin/stores/1/customers', { waitUntil: 'networkidle' });

        // 2. 헤더 확인
        await expect(page.getByText('단골고객 관리')).toBeVisible();

        // 3. 필터 UI 확인
        await expect(page.getByPlaceholder('고객명 또는 휴대폰 번호 검색...')).toBeVisible();

        // 4. 리스트 또는 "데이터가 없습니다" 메시지 확인
        // 데이터가 있을 수도 있고 없을 수도 있음. 에러가 나지 않는지 확인이 중요.
        const hasData = await page.locator('.grid.grid-cols-1').isVisible();
        const hasNoDataMessage = await page.getByText('데이터가 없습니다').isVisible();

        expect(hasData || hasNoDataMessage).toBeTruthy();

        // 스크린샷 캡처
        await page.screenshot({ path: 'debug_customer_list.png' });
    });

    test('Settlement Management: View Settlements', async ({ page }) => {
        // 1. 정산 관리 페이지 이동
        await page.goto('/admin/stores/1/settlements', { waitUntil: 'networkidle' });

        // 2. 헤더 확인
        await expect(page.getByText('정산 관리 시스템')).toBeVisible();

        // 3. 요약 카드 확인 (누적 정산액 등)
        await expect(page.getByText('누적 정산액')).toBeVisible();

        // 4. 정산 데이터 생성 버튼 확인
        await expect(page.getByRole('button', { name: '정산 데이터 생성' })).toBeVisible();

        // 스크린샷 캡처
        await page.screenshot({ path: 'debug_settlement_list.png' });
    });
});
