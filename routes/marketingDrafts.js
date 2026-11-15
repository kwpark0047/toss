const express = require('express');
const { rateLimit } = require('express-rate-limit');
async function readCatalogue(storeId) {
  const prisma = require('../config/prisma');
  const store = await prisma.stores.findUnique({
    where: { id: storeId },
    select: { id: true, name: true },
  });
  if (!store) throw Object.assign(Error('매장을 찾을 수 없습니다.'), { statusCode: 404 });
  const products = await prisma.products.findMany({
    where: { store_id: storeId, is_active: true, is_sold_out: false },
    select: { id: true, name: true, price: true },
    orderBy: { id: 'asc' },
    take: 200,
  });
  return { store, products };
}
function createMarketingDraftRouter({
  identity,
  authorize,
  catalogue = readCatalogue,
  service,
} = {}) {
  const router = express.Router();
  router.use(identity || require('../middleware/auth'));
  router.use(
    rateLimit({ windowMs: 60000, limit: 10, standardHeaders: true, legacyHeaders: false })
  );
  router.use(async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const raw = req.method === 'GET' ? req.query.store_id : req.body?.store_id;
    const storeId = Number(raw);
    if (
      !['number', 'string'].includes(typeof raw) ||
      !Number.isSafeInteger(storeId) ||
      storeId < 1 ||
      storeId > 2147483647 ||
      (req.method !== 'GET' && req.query.store_id != null)
    )
      return res.status(400).json({ success: false, error: '매장 ID를 확인해 주세요.' });
    try {
      if (authorize) await authorize(req.user, storeId);
      else if (req.user.role !== 'super_admin') {
        const { getStoreRole, rolePermissions } = require('../middleware/storeAuth');
        const role = await getStoreRole(req.user.id, storeId);
        if (role !== 'owner' && !rolePermissions[role]?.includes('store:update'))
          throw Error('forbidden');
      }
    } catch {
      return res.status(403).json({ success: false, error: '이 매장의 운영 권한이 필요합니다.' });
    }
    req.marketingStoreId = storeId;
    next();
  });
  router.get('/', async (req, res) => {
    try {
      res.json({ success: true, data: await catalogue(req.marketingStoreId) });
    } catch {
      res.status(502).json({ success: false, error: '메뉴를 불러오지 못했습니다.' });
    }
  });
  router.post('/', async (req, res) => {
    try {
      const facts = await catalogue(req.marketingStoreId);
      const generator =
        service || new (require('../services/MarketingDraftService').MarketingDraftService)();
      res.json({ success: true, data: await generator.generate(facts, req.body) });
    } catch (error) {
      const status = [400, 503].includes(error.statusCode) ? error.statusCode : 502;
      res.status(status).json({
        success: false,
        error:
          status === 502
            ? '초안을 만들지 못했습니다. 기본 초안으로 다시 시도해 주세요.'
            : error.message,
      });
    }
  });
  return router;
}
module.exports = { createMarketingDraftRouter };
