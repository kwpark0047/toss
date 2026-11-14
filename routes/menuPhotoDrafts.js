const express = require('express');
const { rateLimit } = require('express-rate-limit');
function createMenuPhotoDraftRouter({ service, identity, authorize } = {}) {
  const router = express.Router();
  router.post(
    '/',
    identity || require('../middleware/auth'),
    rateLimit({ windowMs: 60000, limit: 6, standardHeaders: true, legacyHeaders: false }),
    async (req, res) => {
      res.set('Cache-Control', 'no-store');
      const rawStoreId = req.body?.store_id;
      const storeId = Number(rawStoreId);
      if (
        !Number.isSafeInteger(storeId) ||
        !['string', 'number'].includes(typeof rawStoreId) ||
        storeId < 1 ||
        storeId > 2147483647 ||
        req.query.store_id != null
      )
        return res.status(400).json({ success: false, error: '매장 ID를 확인해 주세요.' });
      try {
        if (authorize) await authorize(req.user, storeId);
        else {
          const { getStoreRole, rolePermissions } = require('../middleware/storeAuth');
          const role = await getStoreRole(req.user.id, storeId);
          if (role !== 'owner' && !rolePermissions[role]?.includes('items:manage'))
            throw Error('forbidden');
        }
      } catch {
        return res
          .status(403)
          .json({ success: false, error: '이 매장의 메뉴 편집 권한이 필요합니다.' });
      }
      try {
        const draftService =
          service || new (require('../services/MenuPhotoDraftService').MenuPhotoDraftService)();
        const suggestions = await draftService.analyze({ ...req.body, store_id: storeId });
        return res.json({ success: true, draft_only: true, suggestions });
      } catch (error) {
        const status = [400, 502, 503].includes(error.statusCode) ? error.statusCode : 502;
        return res.status(status).json({
          success: false,
          error:
            status === 502 ? '사진 분석에 실패했습니다. 수동 등록으로 이어가세요.' : error.message,
        });
      }
    }
  );
  return router;
}
module.exports = { createMenuPhotoDraftRouter };
