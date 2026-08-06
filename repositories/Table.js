const prisma = require('../config/prisma');
const crypto = require('crypto');

/**
 * 테이블 모델 (Prisma 기반)
 * 매장별 테이블 레이아웃, QR 코드 정보 및 상태를 관리합니다.
 */
const Table = {
  // [테이블 생성]
  create: async (data) => {
    const {
      store_id,
      table_number,
      capacity = 2,
      qr_code,
      x = 0,
      y = 0,
      status = 'available',
    } = data;

    // 예측 가능한 QR 코드 대신 UUID 기반으로 보안 강화
    const finalQrCode = qr_code || `qr_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;

    return await prisma.tables.create({
      data: {
        store_id: parseInt(store_id),
        table_number,
        capacity: parseInt(capacity),
        qr_code: finalQrCode,
        x: parseInt(x),
        y: parseInt(y),
        status,
        is_active: true,
      },
    });
  },

  // [ID로 테이블 상세 조회]
  findById: async (id) => {
    return await prisma.tables.findUnique({
      where: { id: parseInt(id) },
    });
  },

  // [매장별 활성 테이블 목록 조회]
  findByStoreId: async (storeId) => {
    return await prisma.tables.findMany({
      where: {
        store_id: parseInt(storeId),
        is_active: true,
      },
    });
  },

  // [매장 ID + 테이블 번호로 테이블 조회]
  findByStoreAndTable: async (storeId, tableNumber) => {
    return await prisma.tables.findFirst({
      where: { store_id: parseInt(storeId), table_number: tableNumber },
    });
  },

  // [QR 코드로 테이블 및 매장 정보 조회]
  findByQrCode: async (qrCode) => {
    return await prisma.tables.findFirst({
      where: {
        qr_code: qrCode,
        is_active: true,
      },
      include: {
        stores: {
          select: { name: true },
        },
      },
    });
  },

  // [테이블 정보 업데이트]
  update: async (id, data) => {
    const { table_number, capacity, is_active, x, y, status } = data;
    const updateData = {};

    if (table_number !== undefined) updateData.table_number = table_number;
    if (capacity !== undefined) updateData.capacity = parseInt(capacity);
    if (is_active !== undefined) updateData.is_active = is_active;
    if (x !== undefined) updateData.x = parseInt(x);
    if (y !== undefined) updateData.y = parseInt(y);
    if (status !== undefined) updateData.status = status;

    if (Object.keys(updateData).length === 0) return await Table.findById(id);

    return await prisma.tables.update({
      where: { id: parseInt(id) },
      data: {
        ...updateData,
        updated_at: new Date(),
      },
    });
  },

  // [테이블 논리 삭제]
  delete: async (id) => {
    await prisma.tables.update({
      where: { id: parseInt(id) },
      data: { is_active: false },
    });
    return true;
  },

  // [QR 코드 갱신]
  regenerateQr: async (id, newQrCode) => {
    return await prisma.tables.update({
      where: { id: parseInt(id) },
      data: { qr_code: newQrCode, updated_at: new Date() },
    });
  },

  updateLayout: async (storeId, layoutArray) => {
    const sid = parseInt(storeId);
    const requestedIds = layoutArray.map((item) => parseInt(item.id));

    return await prisma.$transaction(async (tx) => {
      // 요청한 모든 테이블이 해당 매장 소유인지 먼저 검증
      const owned = await tx.tables.findMany({
        where: { id: { in: requestedIds }, store_id: sid },
        select: { id: true },
      });
      if (owned.length !== requestedIds.length) {
        const err = new Error('요청한 테이블이 매장에 속하지 않습니다.');
        err.statusCode = 400;
        err.code = 'INVALID_TABLE_STORE';
        throw err;
      }

      // 각 테이블 좌표 갱신
      for (const item of layoutArray) {
        await tx.tables.update({
          where: { id: parseInt(item.id) },
          data: {
            x: parseInt(item.x),
            y: parseInt(item.y),
            updated_at: new Date(),
          },
        });
      }

      return await tx.tables.findMany({
        where: { store_id: sid, is_active: true },
      });
    });
  },

  // [매장 소유 활성 테이블만 조건부 점유] (트랜잭션/점유 경쟁 안전)
  occupyActiveForStore: async (tableId, storeId, tx = prisma) => {
    const result = await tx.tables.updateMany({
      where: { id: parseInt(tableId), store_id: parseInt(storeId), is_active: true },
      data: { status: 'occupied', updated_at: new Date() },
    });
    return result.count > 0;
  },
};

module.exports = Table;
