const crypto = require('node:crypto');
const { AppError } = require('../utils/errorHandler');
module.exports = async function adjustPoints(db, { storeId, phone, delta, reason = '', key }) {
  if (
    !Number.isSafeInteger(storeId) ||
    storeId <= 0 ||
    !/^\d{10,11}$/.test(phone || '') ||
    !Number.isSafeInteger(delta) ||
    delta === 0 ||
    Math.abs(delta) > 2147483647 ||
    typeof key !== 'string' ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(key)
  )
    throw new AppError('유효한 매장, 전화번호, 정수 포인트와 작업 키가 필요합니다.', 400);
  const reference =
    'admin-adjust:' + crypto.createHash('sha256').update(`${storeId}:${key}`).digest('hex');
  return db.$transaction(async (tx) => {
    // Serialize both operation replay and all adjustments to this shared wallet.
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${reference}, 0))) AS lock_result`;
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${`admin-wallet:${phone}`}, 0))) AS lock_result`;
    const previous = await tx.point_transactions.findFirst({
      where: { reference_id: reference },
      include: { user_points: { select: { phone: true } } },
    });
    if (previous) {
      if (
        previous.user_points.phone !== phone ||
        previous.amount !== Math.abs(delta) ||
        previous.type !== (delta > 0 ? 'earn' : 'use') ||
        previous.description !== (reason || (delta > 0 ? '관리자 지급' : '관리자 차감'))
      )
        throw new AppError('동일 작업 키에 다른 요청을 사용할 수 없습니다.', 422);
      return { balance: previous.balance_after, replayed: true };
    }
    if (!(await tx.stores.findUnique({ where: { id: storeId }, select: { id: true } })))
      throw new AppError('매장을 찾을 수 없습니다.', 404);
    let point = await tx.user_points.findFirst({ where: { phone } });
    if (!point && delta < 0) throw new AppError('포인트 잔액이 부족합니다.', 409);
    if (point) {
      // Row lock also serializes with payment paths using this wallet.
      await tx.$queryRaw`SELECT id FROM public.user_points WHERE id = ${point.id} FOR UPDATE`;
      const changed = await tx.user_points.updateMany({
        where: { id: point.id, ...(delta < 0 ? { total_points: { gte: -delta } } : {}) },
        data: {
          total_points: { increment: delta },
          ...(delta > 0 ? { lifetime_earned: { increment: delta } } : {}),
        },
      });
      if (changed.count !== 1) throw new AppError('포인트 잔액이 부족합니다.', 409);
      point = await tx.user_points.findUnique({ where: { id: point.id } });
    } else
      point = await tx.user_points.create({
        data: { phone, total_points: delta, lifetime_earned: delta },
      });
    await tx.point_transactions.create({
      data: {
        user_point_id: point.id,
        store_id: storeId,
        amount: Math.abs(delta),
        balance_after: point.total_points,
        type: delta > 0 ? 'earn' : 'use',
        description: reason || (delta > 0 ? '관리자 지급' : '관리자 차감'),
        reference_id: reference,
      },
    });
    return { balance: point.total_points, replayed: false };
  });
};
