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
