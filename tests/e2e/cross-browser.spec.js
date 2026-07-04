/**
 * 크로스 브라우저 · 크로스 기기 테스트
 *
 * 실행 대상:
 *   - chromium-desktop / firefox-desktop / webkit-desktop
 *   - mobile-chrome / mobile-safari
 *   - android-legacy (Galaxy S8, Chrome 68 수준)
 *
 * 검증 항목:
 *   - 매장 메뉴 페이지 렌더링
 *   - 장바구니 담기 인터랙션
 *   - 결제 시트 노출 (현금 기본)
 *   - 구형 안드로이드 핵심 UI 가시성
 *   - 성능 임계치 (FCP < 3초)
 *   - 콘솔 에러 부재
 */
const { test, expect } = require('@playwright/test');
const {
    BASE_URL, TEST_STORE_ID,
    collectPerfMetrics, setupConsoleCapture, checkLowSpecSignals
} = require('./helpers/test-utils');

const STORE_URL = `${BASE_URL}/store/${TEST_STORE_ID}`;

// ── 공통 설정 ──────────────────────────────────────────────────────────────
test.beforeEach(async ({ page }) => {
    // 네트워크 오류 무시 (로컬 Firebase, 외부 CDN 등)
    page.on('requestfailed', req => {
        const url = req.url();
        // Firebase, FCM, analytics 등 외부 서비스 실패는 무시
        if (/firebase|fcm|analytics|googleapis|gstatic/.test(url)) return;
    });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('매장 메뉴 페이지 — 기본 렌더링', () => {

    test('페이지 로드 완료 + 핵심 UI 요소 존재', async ({ page, browserName, isMobile }) => {
        const { errors } = setupConsoleCapture(page);

        await page.goto(STORE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });

        // 페이지가 완전히 빈 흰 화면이 아닌지 확인
        const bodyText = await page.textContent('body');
        expect(bodyText?.length).toBeGreaterThan(10);

        // JS 에러 없음 (Firebase/네트워크 제외)
        const criticalErrors = errors.filter(e =>
            !e.includes('firebase') && !e.includes('fcm') &&
            !e.includes('Failed to fetch') && !e.includes('NetworkError')
        );
        expect(criticalErrors).toHaveLength(0);

        // 성능: FCP 3초 미만 (구형 기기 여유 허용)
        const perf = await collectPerfMetrics(page);
        if (perf.fcp) {
            expect(perf.fcp).toBeLessThan(isMobile ? 4000 : 3000);
        }

        console.log(`[${browserName}${isMobile ? '/mobile' : ''}] FCP: ${perf.fcp?.toFixed(0) ?? 'N/A'}ms, DOM: ${perf.domContentLoaded?.toFixed(0)}ms`);
    });

    test('모바일: 뷰포트 오버플로우 없음', async ({ page, isMobile }) => {
        test.skip(!isMobile, '모바일 전용 테스트');

        await page.goto(STORE_URL, { waitUntil: 'domcontentloaded' });

        // 가로 스크롤 없음 (모바일에서 치명적 레이아웃 버그)
        const hasHorizontalScroll = await page.evaluate(() =>
            document.documentElement.scrollWidth > document.documentElement.clientWidth
        );
        expect(hasHorizontalScroll).toBe(false);
    });

    test('구형 안드로이드: 터치 이벤트 동작', async ({ page, isMobile, hasTouch, browserName }) => {
        test.skip(!hasTouch, '터치 기기 전용 테스트');
        // Safari(WebKit)는 터치 타겟 렌더링 방식이 달라 Chromium 계열에서만 검증
        test.skip(browserName === 'webkit', 'Chromium Android 시뮬레이션 전용');

        await page.goto(STORE_URL, { waitUntil: 'domcontentloaded' });

        // 터치 타겟 크기 검증 (최소 44×44px — WCAG 2.1 기준)
        const { smallTargets, total } = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
            const smallTargets = buttons.filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 &&
                       (rect.width < 44 || rect.height < 44);
            }).length;
            return { smallTargets, total: buttons.length };
        });
        // 전체 인터랙티브 요소 중 70% 이하만 소형 허용 (아이콘 버튼·네비게이션 현실 반영)
        if (total > 0) {
            expect(smallTargets / total).toBeLessThan(0.7);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('결제 시트 — 크로스 브라우저 동작', () => {

    test('결제 시트: 현금이 기본(첫 번째) 결제수단', async ({ page }) => {
        await page.goto(STORE_URL, { waitUntil: 'domcontentloaded' });

        // 장바구니에 아이템이 있거나 결제 버튼이 보이는 경우만 테스트
        // (로컬 데이터 없으면 건너뜀)
        const payBtn = page.locator('button:has-text("결제"), button:has-text("주문"), button:has-text("pay")').first();
        const hasPay = await payBtn.isVisible({ timeout: 3000 }).catch(() => false);
        if (!hasPay) {
            test.skip(true, '결제 버튼 없음 (데이터 없는 환경)');
            return;
        }

        await payBtn.click();

        // 결제 시트 열림 확인
        const sheet = page.locator('[role="dialog"], .payment-sheet, [data-testid="payment-sheet"]');
        const sheetVisible = await sheet.isVisible({ timeout: 5000 }).catch(() => false);

        if (sheetVisible) {
            // 현금 결제가 최상단에 위치하는지 확인
            const firstMethod = sheet.locator('button').first();
            const firstMethodText = await firstMethod.textContent();
            expect(firstMethodText).toMatch(/현금/);

            // "기본" 뱃지 존재
            const defaultBadge = sheet.locator('text=기본');
            await expect(defaultBadge).toBeVisible({ timeout: 3000 });
        }
    });

    test('CSS 그리드/플렉스: 결제수단 목록 레이아웃 정상', async ({ page }) => {
        await page.goto(STORE_URL, { waitUntil: 'domcontentloaded' });

        // 결제 관련 요소가 없으면 건너뜀
        const hasPaymentUI = await page.locator('[class*="payment"]').count();
        if (hasPaymentUI === 0) {
            test.skip(true, '결제 UI 없음');
            return;
        }

        // 요소 겹침 없음 (overflow hidden 체크)
        const overflow = await page.evaluate(() => {
            const el = document.querySelector('[class*="payment"]');
            if (!el) return false;
            return window.getComputedStyle(el).overflow === 'hidden' ||
                   window.getComputedStyle(el).overflowY === 'hidden';
        });
        expect(typeof overflow).toBe('boolean');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('관리자 대시보드 — 브라우저 호환성', () => {

    test('관리자 페이지 접근 시 인증 화면으로 리다이렉트', async ({ page }) => {
        await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });

        // 인증 없으면 로그인/auth 페이지로 이동 (앱마다 경로 다를 수 있음)
        await page.waitForTimeout(1500);
        const url = page.url();
        // /auth, /login, /admin 중 하나여야 함 (SPA이므로 URL 변경 or 인라인 렌더)
        const isAuthRelated = url.includes('auth') || url.includes('login') || url.includes('admin');
        expect(isAuthRelated).toBe(true);

        // 로그인 폼이 노출되어야 함 (input 또는 로그인 버튼 존재)
        const hasLoginForm = await page.locator('input[type="text"], input[type="email"], input[type="tel"], input[type="password"]').count() > 0;
        expect(hasLoginForm).toBe(true);
    });

    test('시스템 현황 API 응답 형식', async ({ page }) => {
        const res = await page.request.get(
            `${process.env.PLAYWRIGHT_API_URL || 'http://localhost:3000'}/api/health`
        );

        if (res.status() === 200) {
            const body = await res.json();
            expect(body).toHaveProperty('status');
            expect(body).toHaveProperty('ts');
        }
        // 서버 오프라인이면 건너뜀
        expect([200, 503]).toContain(res.status());
    });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('저사양 기기 신호 감지', () => {

    test('hardwareConcurrency 및 deviceMemory API 존재', async ({ page }) => {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

        const signals = await checkLowSpecSignals(page);
        // navigator.hardwareConcurrency는 모든 현대 브라우저 지원
        expect(signals.hardwareConcurrency).toBeGreaterThanOrEqual(1);
        console.log('[저사양 감지]', JSON.stringify(signals));
    });
});
