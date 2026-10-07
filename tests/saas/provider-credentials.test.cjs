const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
process.env.PROVIDER_SECRET_KEY = 'fixture-provider-encryption-key-32-chars';
const { seal, open } = require('../../utils/providerSecret');
const { ProviderCredentialService } = require('../../services/ProviderCredentialService');
function database() {
  const rows = new Map();
  return { rows, $queryRawUnsafe: async (_sql, scope, provider) => [rows.get(`${scope}:${provider}`)].filter(Boolean),
    $executeRawUnsafe: async (sql, ...args) => {
      if (sql.startsWith('INSERT')) { const [id, scope_key, store_id, provider, secret_ciphertext, enabled, updated_by] = args; rows.set(`${scope_key}:${provider}`, { id, scope_key, store_id, provider, secret_ciphertext, enabled, updated_by, updated_at: new Date(), last_test_status: 'untested' }); }
      if (sql.startsWith('DELETE')) rows.delete(`${args[0]}:${args[1]}`);
      return 1;
    } };
}
test('credentials are authenticated encrypted and bound to tenant/provider', () => {
  const secret = { api_key: 'fixture-secret-key' }, encrypted = seal(secret, 'store:3:pos');
  assert.ok(!encrypted.includes(secret.api_key)); assert.deepEqual(open(encrypted, 'store:3:pos'), secret);
  assert.throws(() => open(encrypted, 'store:4:pos'));
  const changed = Buffer.from(encrypted, 'base64'); changed[changed.length - 1] ^= 1;
  assert.throws(() => open(changed.toString('base64'), 'store:3:pos'));
  assert.throws(() => open(Buffer.alloc(27).toString('base64'), 'store:3:pos'));
});
test('store keys stay isolated, list never exposes plaintext, blank updates preserve existing secret', async () => {
  const db = database(), service = new ProviderCredentialService(db);
  await service.save('pos', 3, { api_key: 'fixture-pos-key-1234' }, 7);
  assert.equal(await service.resolve('pos', 4), null);
  assert.equal((await service.resolve('pos', 3)).values.api_key, 'fixture-pos-key-1234');
  assert.ok(!JSON.stringify(await service.list(3)).includes('fixture-pos-key-1234'));
  await service.save('pos', 3, { api_key: '', enabled: false }, 7);
  assert.equal(await service.resolve('pos', 3), null);
  await service.save('pos', 3, { enabled: true }, 7);
  assert.equal((await service.resolve('pos', 3)).values.api_key, 'fixture-pos-key-1234');
  await assert.rejects(service.save('pos', 3, { api_key: 'fixture-pos-key', store_id: 4 }, 7));
});
test('global public provider keys apply across stores and cannot be saved in a store scope', async () => {
  const service = new ProviderCredentialService(database());
  await service.save('weather', null, { api_key: 'fixture-weather-key' }, 1);
  assert.equal((await service.resolve('weather', 3)).values.api_key, 'fixture-weather-key');
  assert.equal((await service.resolve('weather', 4)).source, 'global');
  await assert.rejects(service.save('weather', 3, { api_key: 'fixture-forbidden' }, 7));
  const row = (await service.list(3)).find(row => row.provider === 'weather');
  assert.equal(row.read_only, true); assert.deepEqual(row.masked, {});
});
test('store Naver override wins and explicit disabled setting blocks environment fallback', async () => {
  const service = new ProviderCredentialService(database());
  await service.save('naver', null, { client_id: 'global-id', client_secret: 'global-secret' }, 1);
  await service.save('naver', 3, { client_id: 'store-id', client_secret: 'store-secret' }, 7);
  assert.equal((await service.resolve('naver', 3)).values.client_id, 'store-id');
  assert.equal((await service.resolve('naver', 4)).values.client_id, 'global-id');
  assert.deepEqual((await service.list(4)).find(row => row.provider === 'naver').masked, {});
  await service.save('naver', 3, { enabled: false }, 7);
  assert.equal(await service.resolve('naver', 3), null);
  await service.remove('naver', 3); assert.equal((await service.resolve('naver', 3)).source, 'global');
});
test('weather cache is station/key specific, missing keys and errors are explicitly marked fallback', async () => {
  let key = 'fixture-weather-key', requests = 0, failing = false;
  const context = { module: { exports: {} }, require: name => {
    if (name === './ProviderCredentialService') return { resolve: async () => key ? { values: { api_key: key } } : null };
    if (name === '../utils/logger') return { apiLogger: { warn() {} } };
    if (name === 'axios') return { get: async (_url, { params }) => { requests++; if (failing) throw new Error('Secret URL must not leak'); const parts = Array(26).fill('0'); parts[0] = '202610071200'; parts[1] = params.stn; parts[11] = params.stn === '108' ? '20' : '25'; parts[13] = '50'; return { data: parts.join(' ') }; } };
    return require(name);
  } };
  vm.runInNewContext(fs.readFileSync('services/weatherService.js', 'utf8'), context);
  const service = context.module.exports;
  assert.equal((await service.getCurrentWeather('108')).temp, 20);
  assert.equal((await service.getCurrentWeather('159')).temp, 25);
  await service.getCurrentWeather('108'); assert.equal(requests, 2);
  key = 'fixture-rotated-key'; await service.getCurrentWeather('108'); assert.equal(requests, 3);
  failing = true; assert.equal((await service.getCurrentWeather('101')).is_fallback, true);
  key = null; assert.equal((await service.getCurrentWeather('108')).source, 'unavailable');
  assert.equal(service.parseSfctm2('invalid provider error body'), null);
  await assert.rejects(service.getCurrentWeather('108&authKey=evil'));
});
