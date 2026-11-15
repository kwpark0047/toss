const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');

test.each(['logger', 'auth'])('tsx ESM and CJS share canonical %s behavior', (mode) => {
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-canonical-'));
  try {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', path.join(root, 'tests/fixtures/canonical-logging-auth.mts'), mode],
      {
        cwd: root,
        env: {
          ...process.env,
          NODE_OPTIONS: '',
          NODE_ENV: 'test',
          LOG_DIR: logDir,
          JWT_SECRET: 'canonical-auth-fixture-only',
          USE_HTTPONLY_COOKIE: 'false',
        },
        encoding: 'utf8',
        timeout: 15000,
      }
    );
    expect({ status: result.status, stderr: result.stderr, error: result.error?.message }).toEqual({
      status: 0,
      stderr: '',
      error: undefined,
    });
    expect(JSON.parse(result.stdout)).toEqual({ mode, networkCalls: 0, passed: true });
  } finally {
    fs.rmSync(logDir, { recursive: true, force: true });
  }
});

test('server entrypoints use the canonical JS logger without stale implementations', () => {
  for (const entry of ['app.mts', 'index.mts']) {
    expect(fs.readFileSync(path.join(root, entry), 'utf8')).toContain(
      "import logger from './utils/logger.js'"
    );
  }
  expect(fs.existsSync(path.join(root, 'utils/logger.ts'))).toBe(false);
  expect(fs.existsSync(path.join(root, 'middleware/auth.ts'))).toBe(false);
});
