const { defineConfig, devices } = require('@playwright/test');

// 역할별 staging E2E 전용 설정. 로컬 preview 서버를 띄우지 않고 E2E_BASE_URL 로 지정한
// staging 환경을 대상으로 실행한다. 필요한 환경 변수는 docs/runbooks/ROLE_E2E_STAGING.md 참고.
//   E2E_BASE_URL=https://staging.example.com npx playwright test -c playwright.roles.config.js
module.exports = defineConfig({
  testDir: './tests/e2e-roles',
  testMatch: ['**/*.spec.js'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/roles', open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: true,
    serviceWorkers: 'block',
  },
  timeout: 90_000,
  expect: { timeout: 15_000 },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
});
