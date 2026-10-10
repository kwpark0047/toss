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
});
