// Run against a disposable DB initialized from prisma/schema.prisma:
// P0_TEST_DATABASE_URL=postgresql://.../wemarket_test_... node --test <this file>
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const url = process.env.P0_TEST_DATABASE_URL;
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
    !/^\/wemarket_test_[a-z0-9_]+$/.test(new URL(url).pathname)) {
  throw new Error('Explicit isolated local wemarket_test database required');
}
// Set before loading the real service; never route reads to a configured replica.
process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;
process.env.REPLICA_URL = url;
process.env.NODE_ENV = 'test';

const prisma = require('../../config/prisma');
const StoreService = require('../../services/StoreService');

test('real PostgreSQL excludes hidden addresses from search rows and total', async (t) => {
  const token = randomUUID().replaceAll('-', '');
  const detail = `통합검증로 ${token} 123`;
  const service = new StoreService();
  let owner;
  const ids = [];
  try {
    const version = await prisma.$queryRawUnsafe('SELECT version() AS version');
    assert.match(version[0].version, /PostgreSQL/);
    t.diagnostic(version[0].version.split(' on ')[0]);
    owner = await prisma.users.create({ data: {
      name: `privacy-fixture-${token}`, password: 'not-a-login-password',
    } });
    const variants = [
      { name: 'hidden', channels: { dine_in_enabled: false, hide_exact_address: true } },
      { name: 'no-channel', channels: null },
      { name: 'dine-in', channels: { dine_in_enabled: true, hide_exact_address: true } },
      { name: 'visible-online', channels: { dine_in_enabled: false, hide_exact_address: false } },
    ];
    for (const variant of variants) {
      const store = await prisma.stores.create({ data: {
        user_id: owner.id, name: `${variant.name}-${token}`,
        address: `서울 강남구 ${detail} 비밀시`, is_active: true,
        latitude: 37.5, longitude: 127.03,
        ...(variant.channels ? { store_order_channels: { create: variant.channels } } : {}),
      } });
      ids.push(store.id);
    }
    const [hiddenId, ...publicIds] = ids;
    const check = (result, expected, total = expected.length) => {
      assert.deepEqual(result.stores.map((s) => s.id).sort((a, b) => a - b),
        [...expected].sort((a, b) => a - b));
      assert.equal(result.pagination.total, total);
    };

    await t.test('detailed address q and district count only public stores', async () => {
      for (const field of ['q', 'district']) {
        check(await service.searchStores({ [field]: detail }), publicIds);
        check(await service.searchStores({ [field]: `  ${detail}  ` }), publicIds);
      }
    });
    await t.test('hidden-only detailed and partial address produce zero results and total', async () => {
      // Narrow by the public name while probing private address fragments.
      for (const district of [detail, token, '비밀시', '강남구']) {
        check(await service.searchStores({ q: `hidden-${token}`, district }), []);
      }
      // q alone must not match an address unique to the hidden store either.
      const privateDetail = `숨김전용로 ${token} 987`;
      await prisma.stores.update({ where: { id: hiddenId }, data: { address: privateDetail } });
      for (const fragment of [privateDetail, `숨김전용로 ${token}`]) {
        check(await service.searchStores({ q: fragment }), []);
        check(await service.searchStores({ district: fragment }), []);
      }
    });
    await t.test('public name search retains hidden store with masked address and coordinates', async () => {
      const result = await service.searchStores({ q: `hidden-${token}` });
      check(result, [hiddenId]);
      assert.equal(result.stores[0].address_hidden, true);
      assert.ok(!String(result.stores[0].address).includes(token));
      assert.equal(result.stores[0].latitude, null);
      assert.equal(result.stores[0].longitude, null);
    });
    await t.test('pagination total excludes hidden store even on an empty page', async () => {
      await prisma.stores.update({ where: { id: hiddenId }, data: { address: detail } });
      const first = await service.searchStores({ q: detail, limit: 1 });
      assert.equal(first.stores.length, 1);
      assert.ok(publicIds.includes(first.stores[0].id));
      assert.equal(first.pagination.total, 3);
      assert.equal(first.pagination.hasMore, true);
      const later = await service.searchStores({ q: detail, limit: 1, page: 4 });
      check(later, [], 3);
      assert.equal(later.pagination.hasMore, false);
    });
    await t.test('changing privacy flag changes address results and total together', async () => {
      await prisma.store_order_channels.update({
        where: { store_id: hiddenId }, data: { hide_exact_address: false },
      });
      check(await service.searchStores({ q: detail }), ids);
      await prisma.store_order_channels.update({
        where: { store_id: hiddenId }, data: { hide_exact_address: true },
      });
      check(await service.searchStores({ q: detail }), publicIds);
    });
  } finally {
    try {
      if (ids.length) await prisma.stores.deleteMany({ where: { id: { in: ids } } });
      if (owner) await prisma.users.delete({ where: { id: owner.id } });
    } finally {
      await prisma.disconnectAll();
      await require('../../utils/runtimeResources').closeRuntimeResources();
    }
  }
});
