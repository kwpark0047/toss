describe('deployment verification rejects unhealthy successful HTTP responses', () => {
  let originalFetch;
  beforeEach(() => {
    jest.resetModules();
    originalFetch = global.fetch;
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    process.exitCode = 0;
  });
  test.each(['database', 'operationalConfig'])(
    'rejects %s error even when top-level status is ok',
    async (field) => {
      global.fetch = jest.fn(async (url) => ({
        status: 200,
        text: async () =>
          url.endsWith('/deep')
            ? JSON.stringify({
                status: 'ok',
                checks: {
                  database: { status: 'ok' },
                  operationalConfig: { status: 'ok' },
                  [field]: { status: 'error' },
                },
              })
            : url.endsWith('/health')
              ? JSON.stringify({ status: 'ok', db: 'connected' })
              : '<html></html>',
      }));
      const { main } = require('../../../scripts/smoke-deploy');
      await main();
      expect(process.exitCode).toBe(1);
    }
  );
  test('does not print a failed HTTP body containing secrets', async () => {
    global.fetch = jest.fn(async () => ({
      status: 503,
      text: async () => 'private-secret-sentinel',
    }));
    const { check } = require('../../../scripts/smoke-deploy');
    expect(await check('https://example.invalid/health')).toBe(false);
    expect(JSON.stringify(console.log.mock.calls)).not.toContain('private-secret-sentinel');
  });
  test('accepts healthy database and operational configuration', async () => {
    process.exitCode = 0;
    global.fetch = jest.fn(async (url) => ({
      status: 200,
      text: async () =>
        url.endsWith('/deep')
          ? JSON.stringify({
              status: 'ok',
              checks: { database: { status: 'ok' }, operationalConfig: { status: 'ok' } },
            })
          : url.endsWith('/health')
            ? JSON.stringify({ status: 'ok', db: 'connected' })
            : '<html></html>',
    }));
    await require('../../../scripts/smoke-deploy').main();
    expect(process.exitCode).toBe(0);
  });

  const healthyDeep = JSON.stringify({
    status: 'ok',
    checks: { database: { status: 'ok' }, operationalConfig: { status: 'ok' } },
  });
  const NEW = 'b'.repeat(40);
  const OLD = 'a'.repeat(40);

  test('keeps waiting until the backend reports the expected revision', async () => {
    process.env.EXPECTED_COMMIT_SHA = NEW;
    let healthCalls = 0;
    global.fetch = jest.fn(async (url) => {
      if (url.endsWith('/health')) healthCalls++;
      const html = `<html><meta name="app-commit" content="${NEW}"></html>`;
      return {
        status: 200,
        text: async () =>
          url.endsWith('/deep')
            ? healthyDeep
            : url.endsWith('/health')
              ? JSON.stringify({
                  status: 'ok',
                  db: 'connected',
                  revision: healthCalls < 4 ? OLD : NEW,
                })
              : html,
      };
    });
    const sleep = jest.fn(async () => {});
    await require('../../../scripts/smoke-deploy').main({ waitMs: 60000, intervalMs: 1, sleep });
    expect(process.exitCode).toBe(0);
    expect(healthCalls).toBe(4);
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(console.log.mock.calls.flat().join('\n')).toContain(
      'WAIT backend revision aaaaaaa → expected bbbbbbb'
    );
    delete process.env.EXPECTED_COMMIT_SHA;
  });

  test('fails with a clear message when the new revision never arrives', async () => {
    process.env.EXPECTED_COMMIT_SHA = NEW;
    global.fetch = jest.fn(async (url) => ({
      status: 200,
      text: async () =>
        url.endsWith('/deep')
          ? healthyDeep
          : url.endsWith('/health')
            ? JSON.stringify({ status: 'ok', db: 'connected', revision: OLD })
            : `<html><meta name="app-commit" content="${NEW}"></html>`,
    }));
    let now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const sleep = jest.fn(async (ms) => {
      now += ms;
    });
    await require('../../../scripts/smoke-deploy').main({
      waitMs: 30000,
      intervalMs: 10000,
      sleep,
    });
    expect(process.exitCode).toBe(1);
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(console.log.mock.calls.flat().join('\n')).toContain(
      'did not report the expected revision within 30s'
    );
    delete process.env.EXPECTED_COMMIT_SHA;
  });

  test('defaults to a 10 minute wait and honours environment overrides within bounds', async () => {
    jest.resetModules();
    process.env.EXPECTED_COMMIT_SHA = NEW;
    process.env.SMOKE_BACKEND_WAIT_MS = '999999999';
    global.fetch = jest.fn(async (url) => ({
      status: 200,
      text: async () =>
        url.endsWith('/deep')
          ? healthyDeep
          : url.endsWith('/health')
            ? JSON.stringify({ status: 'ok', db: 'connected', revision: OLD })
            : '<html></html>',
    }));
    let now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const sleep = jest.fn(async (ms) => {
      now += ms;
    });
    await require('../../../scripts/smoke-deploy').main({ intervalMs: 60000, sleep });
    // 상한 30분으로 제한된다
    expect(console.log.mock.calls.flat().join('\n')).toContain('within 1800s');
    delete process.env.SMOKE_BACKEND_WAIT_MS;
    jest.resetModules();
    now = 0;
    console.log.mockClear();
    await require('../../../scripts/smoke-deploy').main({ intervalMs: 60000, sleep });
    expect(console.log.mock.calls.flat().join('\n')).toContain('within 600s');
    delete process.env.EXPECTED_COMMIT_SHA;
  });
});
