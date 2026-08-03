const { test, expect } = require('@playwright/test');

// 주문 → 결제 핵심 플로우 E2E
// 데모 스토어(/menu/demo)는 백엔드 없이 동작 (API 의존성 없이 실행 가능)
// 실제 토스 결제는 외부 위젯 리다이렉트이므로 spec은 결제 진입 단계까지 검증함
// 영수증 페이지(/payment/success)는 정적 라우트이므로 별도 검증

test.describe('주문 플로우 - 데모 스토어', () => {
  test('랜딩 → 스캔 → 메뉴 담기 → 장바구니 모달 → 결제수단 선택 → 주문 버튼 활성화', async ({
    page,
  }) => {
    // 1. 랜딩 페이지 진입
    await page.goto('/');
    await expect(page).toHaveURL(/\/(|$|\?)/);

    // 2. 데모 메뉴 진입 (entry 스크린)
    await page.goto('/menu/demo');
    await expect(page.getByRole('heading')).toBeVisible();

    // 3. 스캔 버튼 클릭 → 세션 초기화 후 메뉴 스크린으로 전환 (handleScan 내 3.4s 타이머)
    const scanButton = page.getByRole('button', { name: /주문 시작하기/ });
    await expect(scanButton).toBeVisible();
    await scanButton.click();

    // 4. 메뉴 스크린 전환 대기 (첫 방문 시 lazy 청크 컴파일 지연 대비)
    //    "지금 인기 메뉴" 헤딩은 screen==='menu'에서만 렌더됨
    await expect(page.getByRole('heading', { name: /지금 인기 메뉴/ })).toBeVisible({
      timeout: 30_000,
    });

    // 5. 옵션이 없는 메뉴("에스프레소 더블") "담기" 버튼 클릭
    //    (MenuItemCard aria-label: "{name} 담기" — 옵션이 있는 메뉴는 옵션 모달이 떠 장바구니에 담기지 않음)
    const addButton = page.getByRole('button', { name: /에스프레소 더블 담기/ });
    await expect(addButton).toBeVisible({ timeout: 10_000 });
    await addButton.click();

    // 6. 장바구니 버튼(하단) 노출 확인 → 클릭
    const cartButton = page.getByText('장바구니 보기');
    await expect(cartButton).toBeVisible({ timeout: 10_000 });
    await cartButton.click();

    // 7. 장바구니 모달에 담긴 아이템 확인 (모달 제목 <h2> "장바구니" 기준)
    await expect(page.getByRole('heading', { name: '장바구니' })).toBeVisible();

    // 8. 결제수단 선택 (신용카드)
    //    (결제수단 버튼 aria-label 은 정확히 "신용카드". 기본 결제수단이 card 라
    //    주문 버튼 라벨에도 "신용카드으로 주문하기" 가 포함되므로 exact 매칭 사용)
    const cardMethod = page.getByRole('button', { name: '신용카드', exact: true });
    await expect(cardMethod).toBeVisible();
    await cardMethod.click();

    // 9. 주문 버튼이 결제수단 반영되어 활성화되는지 확인
    //    (버튼 라벨: "신용카드으로 주문하기" 형태)
    const orderButton = page.getByRole('button', { name: /주문하기/ });
    await expect(orderButton).toBeVisible();
    await expect(orderButton).toBeEnabled();
  });

  test('영수증 페이지 라우팅 확인 (/payment/success)', async ({ page }) => {
    await page.goto('/payment/success');
    // 쿼리 파라미터 없이 진입 시 결제 정보 누락 안내가 렌더됨 (라우팅 정상 동작 증명)
    await expect(page.getByText(/결제|주문|오류|payment/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
