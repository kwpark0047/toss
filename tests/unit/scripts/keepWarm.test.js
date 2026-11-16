const { runKeepWarm } = require('../../../scripts/keep-warm.cjs');
test.each([
  {},
  { enabled: 'false', ref: 'refs/heads/main' },
  { enabled: 'TRUE', ref: 'refs/heads/main' },
  { enabled: 'true', ref: 'refs/heads/feature' },
])('does not access network without exact main opt-in %j', async (config) => {
  const fetcher = jest.fn();
  expect(await runKeepWarm({ ...config, fetcher })).toEqual({ skipped: true });
  expect(fetcher).not.toHaveBeenCalled();
});
test('explicit main opt-in performs only the fixed liveness read', async () => {
  const fetcher = jest.fn(async () => ({ ok: true }));
  expect(await runKeepWarm({ enabled: 'true', ref: 'refs/heads/main', fetcher })).toEqual({
    skipped: false,
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith(
    'https://wemarket-eiw4.onrender.com/api/health/live',
    expect.objectContaining({ method: 'GET', redirect: 'error' })
  );
});
test('HTTP and network failures fail the job rather than reporting success', async () => {
  await expect(
    runKeepWarm({ enabled: 'true', ref: 'refs/heads/main', fetcher: async () => ({ ok: false }) })
  ).rejects.toThrow();
  await expect(
    runKeepWarm({
      enabled: 'true',
      ref: 'refs/heads/main',
      fetcher: async () => {
        throw Error('offline');
      },
    })
  ).rejects.toThrow();
});
test('scheduled and manual workflow paths share a default-OFF job gate', () => {
  const fs = require('node:fs'),
    path = require('node:path');
  const workflow = require('yaml').parse(
    fs.readFileSync(path.resolve(__dirname, '../../../.github/workflows/keep-warm.yml'), 'utf8')
  );
  expect(Object.keys(workflow.on).sort()).toEqual(['schedule', 'workflow_dispatch']);
  expect(workflow.jobs.ping.if).toBe(
    "vars.ENABLE_RENDER_KEEP_WARM == 'true' && github.ref == 'refs/heads/main'"
  );
  expect(workflow.permissions).toEqual({ contents: 'read' });
  expect(workflow.jobs.ping.steps.at(-1).run).toBe('node scripts/keep-warm.cjs');
});
