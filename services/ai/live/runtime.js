const { loadPolicy } = require('./LivePolicy');
const { RedisLiveStore } = require('./RedisLiveStore');
const { LiveGateway } = require('./LiveGateway');
let runtime;
function getGateway() {
  if (runtime) return runtime.gateway;
  let policy;
  try {
    policy = loadPolicy();
  } catch {
    policy = { enabled: false };
  }
  let redis;
  const storage = {
    async ready() {
      if (!redis) {
        if (!process.env.AI_LIVE_REDIS_URL)
          throw Error('Dedicated Live reservation store required');
        const Redis = require('ioredis');
        redis = new Redis(process.env.AI_LIVE_REDIS_URL, {
          lazyConnect: true,
          enableOfflineQueue: false,
          retryStrategy: null,
          maxRetriesPerRequest: 0,
          connectTimeout: 1500,
          commandTimeout: 1500,
        });
        redis.on('error', () => {});
        await redis.connect();
      }
      if (redis.status !== 'ready') throw Error('Live reservation store unavailable');
      return new RedisLiveStore(redis);
    },
    async reserve(s) {
      return (await this.ready()).reserve(s);
    },
    async claim(...args) {
      return (await this.ready()).claim(...args);
    },
    async finish(...args) {
      return (await this.ready()).finish(...args);
    },
    async auditTool(...args) {
      return (await this.ready()).auditTool(...args);
    },
    async recordUsage(...args) {
      return (await this.ready()).recordUsage(...args);
    },
  };
  const prisma = require('../../../config/prisma');
  const managerReads = new (require('./ManagerLiveReadService').ManagerLiveReadService)();
  const gateway = new LiveGateway({
    policy,
    store: storage,
    authorize: async (storeId, purpose, user) => {
      const store = await prisma.stores.findUnique({
        where: { id: storeId },
        select: { id: true, is_active: true },
      });
      if (!store || store.is_active === false) throw Error('Store unavailable');
      if (purpose === 'manager') {
        if (!user?.id) throw Error('Manager authentication required');
        const verified = await require('../../AuthSessionService').verifyAccess(user);
        const actualUser = await prisma.users.findUnique({
          where: { id: user.id },
          select: { role: true, auth_status: true },
        });
        const role = await require('../../../middleware/storeAuth').getStoreRole(user.id, storeId);
        if (
          !verified ||
          !actualUser ||
          actualUser.auth_status !== 'active' ||
          !(actualUser.role === 'super_admin' || ['owner', 'manager'].includes(role))
        )
          throw Error('Manager forbidden');
      }
    },
    catalog: (storeId) =>
      prisma.products.findMany({
        where: {
          store_id: storeId,
          is_active: true,
          AND: [
            { OR: [{ is_sold_out: false }, { is_sold_out: null }] },
            { OR: [{ stock_quantity: null }, { stock_quantity: { gt: 0 } }] },
          ],
        },
        select: { id: true, name: true, price: true, options: true },
        take: 100,
        orderBy: { id: 'asc' },
      }),
    summary: async (storeId) => {
      const stats = await require('../../../repositories/Order').getStats(storeId);
      return {
        total_orders: stats.total_orders,
        total_sales: stats.total_sales,
        sales_basis: stats.sales_basis,
      };
    },
    managerBriefing: (storeId) => managerReads.briefing(storeId),
    managerActions: (storeId) => managerReads.actions(storeId),
  });
  runtime = { gateway, close: () => redis?.disconnect() };
  require('../../../utils/runtimeResources').registerResource(() => runtime.close());
  return gateway;
}
module.exports = { getGateway };
