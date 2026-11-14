const { buildProbeConfig, runProbe } = require('../../../scripts/test_region');
const env = () => ({
  ALLOW_REGION_PROBE: 'true',
  SUPABASE_PROJECT_REF: 'abcdefghijklmnopqrst',
  SUPABASE_DB_PASSWORD: 'fixture:@/#? password',
  SUPABASE_POOLER_HOST: 'aws-0-ap-southeast-1.pooler.supabase.com',
});
test.each([
  {},
  { ...env(), ALLOW_REGION_PROBE: 'false' },
  { ...env(), SUPABASE_DB_PASSWORD: '' },
  { ...env(), SUPABASE_PROJECT_REF: 'bad/host' },
  { ...env(), SUPABASE_POOLER_HOST: '' },
  { ...env(), SUPABASE_POOLER_HOST: 'foreign.invalid' },
  { ...env(), SUPABASE_POOLER_HOST: 'aws-0-ap-southeast-1.pooler.supabase.com@foreign.invalid' },
])('rejects incomplete or unapproved config before client creation', async (input) => {
  const createClient = jest.fn();
  await expect(runProbe({ env: input, createClient })).rejects.toThrow(
    'REGION_PROBE_CONFIGURATION_REQUIRED'
  );
  expect(createClient).not.toHaveBeenCalled();
});
test('encodes credentials without allowing authority/path injection', () => {
  const url = new URL(buildProbeConfig(env()).datasources.db.url);
  expect(decodeURIComponent(url.password)).toBe(env().SUPABASE_DB_PASSWORD);
  expect(url.hostname).toBe(env().SUPABASE_POOLER_HOST);
  expect(url.searchParams.get('sslmode')).toBe('require');
});
test('successful read disconnects once and never probes another host', async () => {
  const log = jest.fn(),
    disconnect = jest.fn(async () => {}),
    query = jest.fn(async () => {});
  const factory = jest.fn(() => ({ $queryRaw: query, $disconnect: disconnect }));
  expect(await runProbe({ env: env(), log, createClient: factory })).toBe(true);
  expect(factory).toHaveBeenCalledTimes(1);
  expect(query).toHaveBeenCalledTimes(1);
  expect(disconnect).toHaveBeenCalledTimes(1);
});
test('provider and disconnect errors stay redacted and return failure without retries', async () => {
  const log = jest.fn(),
    disconnect = jest.fn(async () => {
      throw Error('sensitive');
    });
  const factory = jest.fn(() => ({
    $queryRaw: async () => {
      throw Error(env().SUPABASE_DB_PASSWORD);
    },
    $disconnect: disconnect,
  }));
  expect(await runProbe({ env: env(), log, createClient: factory })).toBe(false);
  expect(factory).toHaveBeenCalledTimes(1);
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(log.mock.calls).toEqual([['connection failed']]);
});
