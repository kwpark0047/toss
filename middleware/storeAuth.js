const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errorHandler');

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
      const storeId =
        req.params.storeId || req.query.store_id || (req.body && req.body.store_id) || req.storeId;

      if (!storeId) {
        return res.status(400).json({ error: '매장 ID가 필요합니다' });
      }
      if (!Number.isInteger(Number(storeId)) || Number(storeId) <= 0) {
        return res.status(400).json({ error: '유효하지 않은 매장 ID입니다.' });
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

/**
 * 객체 뮤테이션에 대한 테넌트 권한 검증 미들웨어.
 * 요청된 리소스의 store_id 를 DB에서 조회한 뒤 소유자/직원 권한을 확인한다.
 * - super_admin 은 항상 통과
 * - 검증된 주문/예약 capability 보유자는 통과 (req.orderCapability / req.capability)
 * - store_id 가 null 인 전역/시스템 대상은 통과 (알림 등)
 */
const checkStorePermissionForObject = (model) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '인증이 필요합니다' });
      }

      if (req.user.role === 'super_admin' || req.orderCapability || req.capability) {
        return next();
      }

      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return next(new AppError('유효하지 않은 ID입니다.', 400));
      }

      const object = await prisma[model].findUnique({
        where: { id },
        select: { store_id: true },
      });

      if (!object) {
        return next(new AppError('대상을 찾을 수 없습니다.', 404));
      }
      if (object.store_id == null) {
        return next();
      }

      const role = await getStoreRole(req.user.id, object.store_id);
      if (!role) {
        return res
          .status(403)
          .json({ error: '해당 매장에 대한 권한이 없거나 존재하지 않는 매장입니다' });
      }

      req.storeId = object.store_id;
      req.storeRole = role;
      next();
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: '권한 검증 중 서버 오류가 발생했습니다' });
    }
  };
};

/**
 * 객체 뮤테이션에 대한 테넌트 권한 검증 미들웨어 (배치 조회 버전).
 * 테이블처럼 단건 대상을 findMany 로 조회하는 리포지토리와 함께 사용한다.
 */
const checkStorePermissionForObjectBatch = (model) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '인증이 필요합니다' });
      }

      if (req.user.role === 'super_admin') {
        return next();
      }

      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return next(new AppError('유효하지 않은 ID입니다.', 400));
      }

      const rows = await prisma[model].findMany({
        where: { id: { in: [id] } },
        select: { id: true, store_id: true },
      });

      if (!rows.length) {
        return next(new AppError('대상을 찾을 수 없습니다.', 404));
      }

      const role = await getStoreRole(req.user.id, rows[0].store_id);
      if (!role) {
        return res
          .status(403)
          .json({ error: '해당 매장에 대한 권한이 없거나 존재하지 않는 매장입니다' });
      }

      req.storeId = rows[0].store_id;
      req.storeRole = role;
      next();
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: '권한 검증 중 서버 오류가 발생했습니다' });
    }
  };
};

/**
 * 일괄 뮤테이션 대상이 모두 동일한 매장에 속하는지 검증하고 권한을 확인한다.
 * (예: 카테고리 정렬 순서 일괄 수정)
 */
const checkUniformStoreMutation = (model) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '인증이 필요합니다' });
      }

      const items = req.body.orders || req.body.items || [];
      const ids = items
        .map((item) => Number(item && item.id))
        .filter((n) => Number.isInteger(n) && n > 0);

      if (!ids.length) {
        return next(new AppError('유효한 대상이 없습니다.', 400));
      }

      const rows = await prisma[model].findMany({
        where: { id: { in: ids } },
        select: { id: true, store_id: true },
      });

      const storeIds = [...new Set(rows.map((row) => row.store_id))];
      if (storeIds.length !== 1) {
        return res.status(400).json({ error: '모든 대상은 동일한 매장에 속해야 합니다.' });
      }

      if (req.user.role === 'super_admin') {
        req.storeId = storeIds[0];
        return next();
      }

      const role = await getStoreRole(req.user.id, storeIds[0]);
      if (!role) {
        return res
          .status(403)
          .json({ error: '해당 매장에 대한 권한이 없거나 존재하지 않는 매장입니다' });
      }

      req.storeId = storeIds[0];
      req.storeRole = role;
      next();
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: '권한 검증 중 서버 오류가 발생했습니다' });
    }
  };
};

/**
 * 리소스 소유권 체크 미들웨어 팩토리
 * 리소스의 store_id를 조회하여 사용자가 해당 매장에 권한이 있는지 확인한다.
 * @param {Object} prismaModel - Prisma 모델 (예: prisma.products)
 * @param {string} idParam - URL 파라미터 이름 (기본값: 'id')
 * @param {string} storeIdField - 리소스에서 store_id 필드명 (기본값: 'store_id')
 * @param {string} requiredPermission - 필요 권한 (기본값: 'items:manage')
 */
function checkResourcePermission(
  prismaModel,
  idParam = 'id',
  storeIdField = 'store_id',
  requiredPermission = 'items:manage'
) {
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

      const resourceId = parseInt(req.params[idParam]);
      if (!resourceId || isNaN(resourceId)) {
        return res.status(400).json({ error: '유효하지 않은 리소스 ID입니다.' });
      }

      // 리소스 조회하여 store_id 획득
      const resource = await prismaModel.findUnique({
        where: { id: resourceId },
        select: { [storeIdField]: true },
      });

      if (!resource) {
        return res.status(404).json({ error: '리소스를 찾을 수 없습니다.' });
      }

      const storeId = resource[storeIdField];
      if (!storeId) {
        return res.status(400).json({ error: '리소스에 매장 정보가 없습니다.' });
      }

      // 매장 권한 확인
      const role = await getStoreRole(req.user.id, storeId);

      if (!role) {
        return res.status(403).json({ error: '해당 매장에 대한 권한이 없습니다.' });
      }

      const permissions = rolePermissions[role] || [];

      if (role === 'owner' || permissions.includes(requiredPermission)) {
        req.storeId = storeId;
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
}

module.exports = {
  getStoreRole,
  checkStorePermission,
  checkStorePermissionForObject,
  checkStorePermissionForObjectBatch,
  checkUniformStoreMutation,
  checkResourcePermission,
  rolePermissions,
};
