const express = require('express');
const router = express.Router();
const Table = require('../repositories/Table');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission, getStoreRole } = require('../middleware/storeAuth');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const crypto = require('crypto');
const prisma = require('../config/prisma');

// 대상 테이블의 저장된 매장으로 권한을 확인한다 (body/URL의 store_id를 신뢰하지 않음)
const checkTablePermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const tableId = parseInt(req.params.id);
      const rows = await prisma.tables.findMany({
        where: { id: { in: [tableId] } },
        select: { id: true, store_id: true },
      });
      if (!rows.length) return res.status(404).json({ error: '테이블을 찾을 수 없습니다.' });
      const tableStoreId = rows[0].store_id;

      // super_admin은 모든 매장에 대해 무조건 통과
      if (req.user.role === 'super_admin') {
        req.storeId = tableStoreId;
        return next();
      }

      const role = await getStoreRole(req.user.id, tableStoreId);
      if (!role) {
        return res.status(403).json({ error: '해당 매장에 대한 권한이 없습니다.' });
      }
      const permissions = require('../middleware/storeAuth').rolePermissions[role] || [];
      if (role === 'owner' || permissions.includes(requiredPermission)) {
        req.storeId = tableStoreId;
        return next();
      }
      return res.status(403).json({ error: `권한이 부족합니다 (${requiredPermission})` });
    } catch (error) {
      logger.error(error);
      return res.status(500).json({ error: '권한 검증 중 서버 오류가 발생했습니다' });
    }
  };
};

/**
 * @swagger
 * tags:
 *   name: Tables
 *   description: 테이블/좌석 관리 및 QR 코드 API
 */

/**
 * @swagger
 * /api/tables/store/{storeId}:
 *   get:
 *     tags: [Tables]
 *     summary: 매장 테이블 목록 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 테이블 목록
 */
router.get(
  '/store/:storeId',
  authMiddleware,
  checkStorePermission('order:read'),
  catchAsync(async (req, res) => {
    const tables = await Table.findByStoreId(req.params.storeId);
    res.success(tables);
  })
);

/**
 * @swagger
 * /api/tables/store/{storeId}/layout:
 *   put:
 *     tags: [Tables]
 *     summary: 테이블 배치도 저장
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               layout:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: 배치도 저장 완료
 */
router.put(
  '/store/:storeId/layout',
  authMiddleware,
  checkStorePermission('store:update'),
  catchAsync(async (req, res) => {
    const { layout } = req.body;
    if (!layout || !Array.isArray(layout)) {
      return res.status(400).json({ success: false, error: 'layout 배열이 필요합니다.' });
    }
    const storeId = parseInt(req.params.storeId);

    // 요청한 모든 테이블이 URL 매장 소속인지 확인
    const ids = layout.map((t) => parseInt(t.id));
    const rows = await prisma.tables.findMany({
      where: { id: { in: ids } },
      select: { id: true, store_id: true },
    });
    const allBelong = rows.length === ids.length && rows.every((r) => r.store_id === storeId);
    if (!allBelong) {
      return res.status(400).json({ error: '모든 테이블은 요청한 매장에 속해야 합니다.' });
    }

    const tables = await Table.updateLayout(req.params.storeId, layout);

    const io = req.app.get('io');
    if (io) {
      io.emit('table-layout-updated', { store_id: req.params.storeId, tables });
    }

    res.success(tables, '테이블 배치도가 저장되었습니다.');
  })
);

/**
 * @swagger
 * /api/tables/qr/{qrCode}:
 *   get:
 *     tags: [Tables]
 *     summary: QR 코드로 테이블 조회 (인증 불필요 - 고객 QR 스캔용)
 *     parameters:
 *       - in: path
 *         name: qrCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 테이블 정보
 *       404:
 *         description: 유효하지 않은 QR 코드
 */
router.get(
  '/qr/:qrCode',
  catchAsync(async (req, res) => {
    const table = await Table.findByQrCode(req.params.qrCode);
    if (!table) return res.status(404).json({ error: '?�효?��? ?��? QR 코드?�니??' });
    res.success(table);
  })
);

/**
 * @swagger
 * /api/tables:
 *   post:
 *     tags: [Tables]
 *     summary: 테이블 생성
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: 테이블 생성 완료
 */
router.post(
  '/',
  authMiddleware,
  checkStorePermission('store:update'),
  catchAsync(async (req, res) => {
    const table = await Table.create(req.body);
    res.success(table, '테이블이 생성되었습니다.', 201);
  })
);

/**
 * @swagger
 * /api/tables/{id}:
 *   put:
 *     tags: [Tables]
 *     summary: 테이블 수정
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: 테이블 수정 완료
 */
router.put(
  '/:id',
  authMiddleware,
  checkTablePermission('store:update'),
  catchAsync(async (req, res) => {
    const table = await Table.update(req.params.id, req.body);

    const io = req.app.get('io');
    if (io && table) {
      io.emit('table-updated', { store_id: table.store_id, table_id: table.id });
    }

    res.success(table, '테이블 정보가 수정되었습니다.');
  })
);

/**
 * @swagger
 * /api/tables/{id}/regenerate-qr:
 *   post:
 *     tags: [Tables]
 *     summary: QR 코드 재생성
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: QR 코드 재생성 완료
 */
router.post(
  '/:id/regenerate-qr',
  authMiddleware,
  catchAsync(async (req, res) => {
    const existing = await Table.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: '?�이블을 찾을 ???�습?�다.' });

    if (req.user.role !== 'super_admin') {
      const role = await getStoreRole(req.user.id, existing.store_id);
      if (!role) return res.status(403).json({ error: '?�당 매장???�??권한???�습?�다.' });
    }

    const newQrCode = `qr_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
    const table = await Table.regenerateQr(req.params.id, newQrCode);
    const io = req.app.get('io');
    if (io) {
      io.emit('table-updated', { store_id: table.store_id, table_id: table.id });
    }
    res.success(table, 'QR 코드가 ?�생?�되?�습?�다.');
  })
);

/**
 * @swagger
 * /api/tables/{id}:
 *   delete:
 *     tags: [Tables]
 *     summary: 테이블 삭제
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 테이블 삭제 완료
 */
router.delete(
  '/:id',
  authMiddleware,
  checkTablePermission('store:delete'),
  catchAsync(async (req, res) => {
    const table = await Table.findById(req.params.id);
    if (table) {
      await Table.delete(req.params.id);
      const io = req.app.get('io');
      if (io) {
        io.emit('table-updated', { store_id: table.store_id, table_id: req.params.id });
      }
    }
    res.success(null, '테이블이 삭제되었습니다.');
  })
);

module.exports = router;
