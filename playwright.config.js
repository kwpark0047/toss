// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * WeMarket 크로스 브라우저·기기 테스트 설정
 *
 * 실행:
 *   npx playwright test                   # 전체
 *   npx playwright test --project=mobile  # 모바일만
 *   npx playwright test --headed          # 헤드 모드
 *   npx playwright test --ui              # UI 모드
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const API_URL  = process.env.PLAYWRIGHT_API_URL  || 'http://localhost:3000';

module.exports = defineConfig({
    testDir: './tests/e2e',
    testMatch: '**/*.spec.js',
    timeout: 45_000,
    expect: { timeout: 8_000 },
    fullyParallel: false, // 주문 동시성 테스트 충돌 방지
    retries: process.env.CI ? 2 : 1,
    reporter: [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['list'],
        ['json', { outputFile: 'playwright-report/results.json' }],
    ],
    use: {
        baseURL: BASE_URL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        // 느린 네트워크 시뮬레이션 (3G)
        // launchOptions: { slowMo: 50 },
    },

    projects: [
        // ── 데스크톱 ─────────────────────────────────────────────────────────
        {
            name: 'chromium-desktop',
            use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
            testMatch: '**/*.spec.js',
        },
        {
            name: 'firefox-desktop',
            use: { ...devices['Desktop Firefox'] },
            testMatch: '**/*.spec.js',
        },
        {
            name: 'webkit-desktop',
            use: { ...devices['Desktop Safari'] },
            testMatch: '**/*.spec.js',
        },

        // ── 최신 모바일 ───────────────────────────────────────────────────────
        {
            name: 'mobile-chrome',
            use: { ...devices['Pixel 7'] },
            testMatch: '**/*.spec.js',
        },
        {
            name: 'mobile-safari',
            use: { ...devices['iPhone 14'] },
            testMatch: '**/*.spec.js',
        },

        // ── 구형 안드로이드 (Android 8, Chrome 68 수준 시뮬레이션) ───────────
        {
            name: 'android-legacy',
            use: {
                ...devices['Galaxy S8'],
                userAgent: 'Mozilla/5.0 (Linux; Android 8.0.0; SM-G950F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.91 Mobile Safari/537.36',
                viewport: { width: 360, height: 740 },
                // 저사양 기기: CPU/메모리 스로틀링 시뮬레이션
                launchOptions: {
                    args: ['--disable-gpu', '--disable-web-security'],
                },
                javaScriptEnabled: true,
                hasTouch: true,
                isMobile: true,
            },
            testMatch: '**/cross-browser.spec.js',
        },

        // ── 저사양 데스크톱 (2015년 수준) ────────────────────────────────────
        {
            name: 'low-spec-desktop',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1024, height: 768 },
                // CPU 스로틀링은 DevTools Protocol로 설정
            },
            testMatch: '**/animation-fallback.spec.js',
        },
    ],

    // 테스트 전 로컬 서버 기동. reuseExistingServer:true 이므로 이미 떠 있으면 그대로 사용.
    // 데모 스토어(/menu/demo)는 하드코딩 mock 데이터라 백엔드 없이 동작 → 프론트(Vite dev)만 기동.
    // 백엔드 의존 스펙이 추가되면 아래 backend entry를 복원할 것:
    //   { command: 'npm run start', url: API_URL, reuseExistingServer: true, timeout: 120_000 }
    webServer: [
        { command: 'cd frontend && npm run dev', url: BASE_URL, reuseExistingServer: false, timeout: 120_000 },
    ],

    // globalSetup: './tests/e2e/setup/global-setup.js',
    // globalTeardown: './tests/globalTeardown.js',
});
