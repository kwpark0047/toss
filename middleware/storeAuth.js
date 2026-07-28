const prisma = require('../config/prisma');
const logger = require('../utils/logger');

const rolePermissions = {
  owner: [
    'store:update',
    'store:delete',
    'items:manage',
    'orders:manage',
    'staff:manage',
    'stats:read',
    'order:read',
  ],
  manager: [
    'store:update',
    'items:manage',
    'orders:manage',
    'staff:manage',
    'stats:read',
    'order:read',
  ],
  staff: ['orders:manage', 'order:read'],
  kitchen: ['orders:manage', 'order:read'],
};

/**
 * 사용자의 매장 내 역할을 확인 (Prisma 기반)
 */
const getStoreRole = async (userId, storeId) => {
  const sid = parseInt(storeId);
  const uid = parseInt(userId);

  if (isNaN(sid) || isNaN(uid)) return null;

  // 1. 소유자 확인
  const store = await prisma.stores.findUnique({
    where: { id: sid },
    select: { user_id: true },
  });
  if (store && store.user_id === uid) return 'owner';

  // 2. 직원 확인
  const staffMember = await prisma.staff.findFirst({
    where: { store_id: sid, user_id: uid, is_active: 1 },
  });
  if (staffMember) return staffMember.role;

  return null;
};

/**
 * 매장 권한 체크 미들웨어
 */
const checkStorePermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '인증이 필요합니다' });
      }

      // super_admin은 모든 매장에 대해 무조건 통과
      if (req.user.role === 'super_admin') {
        req.storeRole = 'super_admin';
        return next();
      }

      // 권한 체크 대상 storeId 추출
      const storeId = req.params.storeId || req.query.store_id || req.body.store_id || req.storeId;

      if (!storeId) {
        return res.status(400).json({ error: '매장 ID가 필요합니다' });
      }

      // 비동기로 역할 조회 (여기서 getStoreRole은 async)
      const role = await getStoreRole(req.user.id, storeId);

      if (!role) {
        return res
          .status(403)
          .json({ error: '해당 매장에 대한 권한이 없거나 존재하지 않는 매장입니다' });
      }

      const permissions = rolePermissions[role] || [];

      // 소유자(owner)이거나 명시적 권한이 포함된 경우 통과
      if (role === 'owner' || permissions.includes(requiredPermission)) {
        req.storeId = parseInt(storeId);
        req.storeRole = role;
        next();
      } else {
        return res.status(403).json({ error: `권한이 부족합니다 (${requiredPermission})` });
      }
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: '권한 검증 중 서버 오류가 발생했습니다' });
    }
  };
};

module.exports = {
  getStoreRole,
  checkStorePermission,
};
