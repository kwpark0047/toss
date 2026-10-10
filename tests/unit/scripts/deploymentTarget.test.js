const { spawnSync } = require('node:child_process');
const path = require('node:path');
const expected = require('../../../config/deployment-targets.json').production;
const script = path.resolve(__dirname, '../../../scripts/validate-deployment-target.cjs');
test('wrong production account/project is rejected without printing credentials', () => {
  const result = spawnSync(process.execPath, [script], {
    env: { ...process.env, VERCEL_PROJECT_ID: 'private-sentinel', VERCEL_ORG_ID: 'wrong' },
    encoding: 'utf8',
  });
  expect(result.status).toBe(1);
  expect(result.stderr).not.toContain('private-sentinel');
});
test('verified production project is accepted', () => {
  const result = spawnSync(process.execPath, [script], {
    env: {
      ...process.env,
      VERCEL_PROJECT_ID: expected.vercelProjectId,
      VERCEL_ORG_ID: expected.vercelOrgId,
    },
  });
  expect(result.status).toBe(0);
});
test('stale API or socket target is rejected before deployment', () => {
  for (const key of ['VITE_API_URL', 'VITE_SOCKET_URL']) {
    const result = spawnSync(process.execPath, [script], {
      env: {
        ...process.env,
        VERCEL_PROJECT_ID: expected.vercelProjectId,
        VERCEL_ORG_ID: expected.vercelOrgId,
        [key]: 'https://stale.invalid/api',
      },
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain('stale.invalid');
  }
});
test.each([
  'https://api.render.com/deploy/srv-wrong?key=private-hook-key',
  'https://evil.invalid/deploy/' + expected.renderServiceId + '?key=private-hook-key',
  'https://api.render.com/deploy/' + expected.renderServiceId,
])('rejects wrong or incomplete Render hook without exposing it', (hook) => {
  const result = spawnSync(process.execPath, [script], {
    env: {
      ...process.env,
      VERCEL_PROJECT_ID: expected.vercelProjectId,
      VERCEL_ORG_ID: expected.vercelOrgId,
      RENDER_DEPLOY_HOOK_URL: hook,
    },
    encoding: 'utf8',
  });
  expect(result.status).toBe(1);
  expect(result.stderr).not.toContain('private-hook-key');
});
