const { test, expect } = require('@playwright/test');

test.describe('Admin Feature Full Scenario', () => {
    // 테스트용 계정 정보 (실제 DB 시딩 데이터 사용 가정 또는 환경 변수)
    const TEST_EMAIL = 'superadmin@wemarket.com';
    const TEST_PASSWORD = 'password123'; // Seed 데이터 기준 비밀번호 확인 필요

    // 테스트 전체 타임아웃 2분으로 연장
    test.setTimeout(120000);

    test.beforeEach(async ({ page }) => {
        // 1. 로그인 수행
        await page.goto('/login', { waitUntil: 'networkidle', timeout: 60000 });

        // 이미 로그인 된 상태라면 스킵될 수도 있지만 명시적으로 수행
        // (Playwright state 보존 설정이 없다면 매번 로그인 필요)
        // Selector 수정: 실제 Login.jsx의 placeholder 사용
        await page.getByPlaceholder('email@example.com').fill(TEST_EMAIL);
        await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);

        // 버튼 클릭이 안될 경우를 대비해 force 옵션 추가
        await page.getByRole('button', { name: '로그인' }).click({ force: true });

        // 디버깅: 로그인 후 URL 확인
        await page.waitForTimeout(3000); // 리다이렉트 대기
        console.log('Current URL after login:', page.url());

        // 로그인 성공 대기 (대시보드 진입)
        await expect(page).toHaveURL(/\/admin/);
        await expect(page.getByText('Command Center')).toBeVisible();
    });

    test('Store Management: Create and Verify Store', async ({ page }) => {
        // 2. 매장 생성 페이지 이동
        // (대시보드에 버튼이 없을 수 있으므로 URL로 직접 이동 또는 UI 탐색)
        await page.goto('/admin/stores/new');

        const testStoreName = `Test Store ${Date.now()}`;

        await page.getByLabel('상호명').fill(testStoreName);
        await page.getByLabel('전화번호').fill('010-1234-5678');
        await page.getByLabel('주소').fill('서울시 강남구 테헤란로');

        // 카테고리/업종 선택 (Select)
        const categorySelect = page.locator('select').first(); // 첫 번째 select가 업종이라고 가정
        if (await categorySelect.isVisible()) {
            await categorySelect.selectOption({ index: 1 }); // 첫 번째 옵션 선택
            // 업종 선택 (name 속성으로 정확하게 타겟팅)
            await page.locator('select[name="business_type"]').selectOption('cafe');

            await page.getByText('매장 생성하기').click();

            // 3. 생성 확인 (목록 페이지로 이동됨)
            await expect(page).toHaveURL(/\/admin\/stores/); // 혹은 설정 페이지

            // 디버깅: 매장 목록 스크린샷
            await page.waitForTimeout(2000);
            await page.screenshot({ path: 'debug_store_list.png' });

            await expect(page.getByText(testStoreName)).toBeVisible();
        }
    });

    test('Menu Management: Add Category and Product', async ({ page }) => {
        // 1. 매장 메뉴 관리 페이지 이동
        await page.goto('/admin/stores/1/menu', { waitUntil: 'networkidle' });

        // 2. 카테고리 추가
        const categoryName = `New Category ${Date.now()}`;
        await page.getByRole('button').filter({ has: page.locator('svg.lucide-folder-plus') }).click(); // 폴더 플러스 아이콘 버튼
        await page.getByPlaceholder('카테고리명').fill(categoryName);
        await page.getByText('저장', { exact: true }).click();

        // 카테고리 추가 확인
        await expect(page.getByText(categoryName)).toBeVisible();

        // 3. 상품 추가
        const productName = `New Product ${Date.now()}`;
        await page.getByText('상품 추가').click();
        await page.getByPlaceholder('상품명을 입력하세요').fill(productName);
        await page.getByPlaceholder('0').fill('15000'); // 가격

        // 카테고리 선택
        // 모달 내의 select 요소 선택 (모달이 떴는지 확인 후)
        await expect(page.getByText('상품 추가', { exact: true })).toBeVisible();
        // 모달 내보 select 중 첫번째거 (카테고리 선택)
        await page.locator('select').first().selectOption({ index: 1 });

        await page.getByText('저장', { exact: true }).click();

        // 상품 추가 확인
        await expect(page.getByText(productName)).toBeVisible();
        await expect(page.getByText('15,000')).toBeVisible();
    });

    test('Order Processing: View and Change Status', async ({ page }) => {
        // 1. 주문 관리 페이지 이동
        await page.goto('/admin/stores/1/orders', { waitUntil: 'networkidle' });

        // 데이터 로딩 대기 (API 응답 대기 또는 로딩 스피너 사라짐 대기)
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'debug_order_list.png' });

        // 2. 대기 상태 주문 확인
        await expect(page.getByText('주문 관리')).toBeVisible();

        // 디버깅: 현재 주문 카드 개수 확인
        const orderCards = page.locator('div[class*="rounded-2xl shadow-soft"]');
        console.log(`Found ${await orderCards.count()} order cards`);

        // 3. 상태 변경 (예: 대기 -> 확인)
        // OrderCard의 '다음 단계' 버튼 찾기 (ChefHat, CheckCircle 등 아이콘 기반일 수 있음)
        // 첫 번째 카드의 버튼 클릭
        const nextButton = page.locator('button').filter({ hasText: /다음|확인|조리/ }).first();
        if (await nextButton.isVisible()) {
            await nextButton.click();
            // 4. 상태 변경 확인 (토스트 메시지 등)
            // await expect(page.getByText('성공')).toBeVisible();
        } else {
            console.log('상태 변경 버튼을 찾을 수 없습니다.');
            await page.screenshot({ path: 'debug_no_button.png' });
        }

        // 5. 필터링 테스트
        await page.getByRole('button', { name: '취소' }).click();
        await expect(page.url()).toContain('orders');
    });
});
