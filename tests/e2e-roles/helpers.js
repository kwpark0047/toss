const { expect } = require('@playwright/test');

// 역할별 계정은 staging 전용 시드 계정만 사용한다. 운영 계정·비밀번호를 넣지 않는다.
const ROLES = ['owner', 'manager', 'staff', 'kitchen', 'customer', 'superadmin'];

function roleCredentials(role) {
  const key = role.toUpperCase();
  const identifier = process.env[`E2E_${key}_ID`];
  const password = process.env[`E2E_${key}_PASSWORD`];
  return identifier && password ? { identifier, password } : null;
}

function storeId() {
  return process.env.E2E_STORE_ID;
}

function writesAllowed() {
  return process.env.E2E_ALLOW_WRITES === 'true';
}

// 운영 도메인을 실수로 대상으로 삼지 않도록 막는다.
function assertStagingTarget() {
  const base = process.env.E2E_BASE_URL || '';
  const blocked = (
    process.env.E2E_BLOCKED_HOSTS ||
    'wemarket-saas.vercel.app,wemarket-eiw4.onrender.com,wemarket.onrender.com'
  )
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  if (!base) throw new Error('E2E_BASE_URL 이 설정되지 않았습니다.');
  const host = new URL(base).host;
  if (blocked.includes(host))
    throw new Error(`운영 호스트(${host})에서는 역할 E2E를 실행하지 않습니다.`);
}

async function apiLogin(request, role) {
  const creds = roleCredentials(role);
  const res = await request.post('/api/auth/login', { data: creds });
  expect(res.status(), `${role} 로그인 응답`).toBe(200);
  const body = await res.json();
  const data = body.data || body;
  expect(
    data.two_factor_required,
    `${role} 계정은 staging에서 2FA 없이 로그인 가능해야 합니다`
  ).toBeFalsy();
  expect(data.token, `${role} 토큰`).toBeTruthy();
  return data;
}

// API 로그인 결과를 브라우저 저장소에 넣어 UI 세션을 만든다 (헤더 모드 기준).
async function uiLogin(page, request, role) {
  const data = await apiLogin(request, role);
  await page.goto('/');
  await page.evaluate(({ token, refreshToken }) => {
    localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
  }, data);
  return data;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function expectPageLoaded(page, path) {
  await page.goto(path);
  await expect(page).not.toHaveURL(/\/auth(\?|$)/);
  await expect(page.locator('body')).not.toContainText(/권한이 (없습니다|필요합니다)|Forbidden/);
}

module.exports = {
  ROLES,
  roleCredentials,
  storeId,
  writesAllowed,
  assertStagingTarget,
  apiLogin,
  uiLogin,
  authHeaders,
  expectPageLoaded,
};
