const crypto = require('node:crypto');
const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');

const asPositiveInt = (value, label) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0)
    throw new AppError(`${label} 값이 올바르지 않습니다.`, 400);
  return number;
};

const asNonNegativeInt = (value, label) => {
  const number = Number(value ?? 0);
  if (!Number.isSafeInteger(number) || number < 0)
    throw new AppError(`${label} 값이 올바르지 않습니다.`, 400);
  return number;
};

const createOrderNumber = (storeId) =>
  `PO-${storeId}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

const service = {
  async list(storeId, status) {
    const id = asPositiveInt(storeId, '매장 ID');
    const where = { store_id: id };
    if (status) {
      if (!['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'].includes(status)) {
        throw new AppError('발주 상태가 올바르지 않습니다.', 400);
      }
      where.status = status;
    }
    return prisma.purchase_orders.findMany({
      where,
      include: {
        suppliers: true,
        items: { include: { products: { select: { id: true, stock_quantity: true } } } },
        receipts: { include: { items: true }, orderBy: { received_at: 'desc' } },
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
  },

  async createDraft(storeId, input, userId) {
    const id = asPositiveInt(storeId, '매장 ID');
    if (!Array.isArray(input?.items) || input.items.length === 0 || input.items.length > 100) {
      throw new AppError('발주 품목을 1~100개 입력해 주세요.', 400);
    }
    const normalized = input.items.map((row) => ({
      product_id: row.product_id == null ? null : asPositiveInt(row.product_id, '상품 ID'),
      product_name:
        typeof row.product_name === 'string' ? row.product_name.trim().slice(0, 160) : '',
      unit: typeof row.unit === 'string' && row.unit.trim() ? row.unit.trim().slice(0, 24) : '개',
      ordered_quantity: asPositiveInt(row.ordered_quantity, '발주 수량'),
      unit_cost: asNonNegativeInt(row.unit_cost, '매입 단가'),
    }));
    if (normalized.some((row) => !row.product_id && !row.product_name)) {
      throw new AppError('연결 상품 또는 품목명을 입력해 주세요.', 400);
    }
    const productIds = [...new Set(normalized.map((row) => row.product_id).filter(Boolean))];
    const products = productIds.length
      ? await prisma.products.findMany({
          where: { store_id: id, id: { in: productIds } },
          select: { id: true, name: true },
        })
      : [];
    if (products.length !== productIds.length)
      throw new AppError('다른 매장의 상품은 발주에 연결할 수 없습니다.', 404);
    const productNames = new Map(products.map((product) => [product.id, product.name]));
    for (const row of normalized)
      if (row.product_id) row.product_name = productNames.get(row.product_id);

    let supplierId =
      input.supplier_id == null ? null : asPositiveInt(input.supplier_id, '공급처 ID');
    if (supplierId) {
      const supplier = await prisma.suppliers.findFirst({
        where: { id: supplierId, store_id: id, is_active: true },
        select: { id: true },
      });
      if (!supplier) throw new AppError('이 매장에 등록된 사용 가능한 공급처가 아닙니다.', 404);
    } else if (typeof input.supplier_name === 'string' && input.supplier_name.trim()) {
      const supplier = await prisma.suppliers.upsert({
        where: { store_id_name: { store_id: id, name: input.supplier_name.trim().slice(0, 120) } },
        create: {
          store_id: id,
          name: input.supplier_name.trim().slice(0, 120),
          contact_name: input.contact_name?.trim()?.slice(0, 80) || null,
          phone: input.phone?.trim()?.slice(0, 40) || null,
        },
        update: { is_active: true },
      });
      supplierId = supplier.id;
    }

    const total = normalized.reduce((sum, row) => sum + row.ordered_quantity * row.unit_cost, 0);
    if (!Number.isSafeInteger(total))
      throw new AppError('발주 총액이 허용 범위를 초과했습니다.', 400);
    const expectedAt = input.expected_at ? new Date(input.expected_at) : null;
    if (expectedAt && Number.isNaN(expectedAt.getTime()))
      throw new AppError('입고 예정일이 올바르지 않습니다.', 400);
    return prisma.purchase_orders.create({
      data: {
        store_id: id,
        supplier_id: supplierId,
        order_number: createOrderNumber(id),
        status: 'DRAFT',
        total_amount: total,
        expected_at: expectedAt,
        notes: typeof input.notes === 'string' ? input.notes.slice(0, 2000) : null,
        created_by: Number.isSafeInteger(Number(userId)) ? Number(userId) : null,
        items: { create: normalized },
      },
      include: { suppliers: true, items: true },
    });
  },

  async markOrdered(storeId, orderId) {
    const sid = asPositiveInt(storeId, '매장 ID');
    const oid = asPositiveInt(orderId, '발주 ID');
    const order = await prisma.purchase_orders.findFirst({ where: { id: oid, store_id: sid } });
    if (!order) throw new AppError('발주를 찾을 수 없습니다.', 404);
    if (order.status !== 'DRAFT')
      throw new AppError('초안 상태의 발주만 발주 처리할 수 있습니다.', 409);
    const updated = await prisma.purchase_orders.updateMany({
      where: { id: oid, store_id: sid, status: 'DRAFT' },
      data: { status: 'ORDERED', ordered_at: new Date() },
    });
    if (updated.count !== 1)
      throw new AppError('발주 상태가 변경되었습니다. 새로고침 후 다시 확인해 주세요.', 409);
    return prisma.purchase_orders.findFirst({
      where: { id: oid, store_id: sid },
      include: { suppliers: true, items: true },
    });
  },

  async receive(storeId, orderId, input, userId, idempotencyKey) {
    const sid = asPositiveInt(storeId, '매장 ID');
    const oid = asPositiveInt(orderId, '발주 ID');
    if (
      typeof idempotencyKey !== 'string' ||
      idempotencyKey.length < 8 ||
      idempotencyKey.length > 200
    ) {
      throw new AppError('입고 작업 키가 필요합니다.', 400);
    }
    if (!Array.isArray(input?.items) || input.items.length === 0 || input.items.length > 100) {
      throw new AppError('입고 품목을 입력해 주세요.', 400);
    }
    const lines = input.items.map((row) => ({
      purchase_order_item_id: asPositiveInt(row.purchase_order_item_id, '발주 품목 ID'),
      quantity_received: asPositiveInt(row.quantity_received, '입고 수량'),
      unit_cost: asNonNegativeInt(row.unit_cost, '매입 단가'),
    }));
    if (new Set(lines.map((line) => line.purchase_order_item_id)).size !== lines.length) {
      throw new AppError('한 번의 입고 요청에 동일 품목을 중복 입력할 수 없습니다.', 400);
    }

    const existing = await prisma.purchase_receipts.findUnique({
      where: { idempotency_key: idempotencyKey },
      include: { items: true },
    });
    if (existing) {
      if (existing.purchase_order_id !== oid)
        throw new AppError('입고 작업 키가 다른 발주에서 사용되었습니다.', 409);
      return existing;
    }

    try {
      return await prisma.$transaction(async (tx) => {
        const duplicate = await tx.purchase_receipts.findUnique({
          where: { idempotency_key: idempotencyKey },
          include: { items: true },
        });
        if (duplicate) {
          if (duplicate.purchase_order_id !== oid)
            throw new AppError('입고 작업 키가 다른 발주에서 사용되었습니다.', 409);
          return duplicate;
        }
        const order = await tx.purchase_orders.findFirst({
          where: { id: oid, store_id: sid },
          include: { items: true },
        });
        if (!order) throw new AppError('발주를 찾을 수 없습니다.', 404);
        if (!['ORDERED', 'PARTIALLY_RECEIVED'].includes(order.status))
          throw new AppError('발주 처리 후에 입고를 등록할 수 있습니다.', 409);

        const receipt = await tx.purchase_receipts.create({
          data: {
            purchase_order_id: oid,
            idempotency_key: idempotencyKey,
            received_by: Number.isSafeInteger(Number(userId)) ? Number(userId) : null,
            notes: typeof input.notes === 'string' ? input.notes.slice(0, 2000) : null,
          },
        });
        for (const line of lines) {
          const orderedLine = order.items.find(
            (candidate) => candidate.id === line.purchase_order_item_id
          );
          if (!orderedLine) throw new AppError('다른 발주의 품목은 입고할 수 없습니다.', 404);
          if (
            line.quantity_received >
            orderedLine.ordered_quantity - orderedLine.received_quantity
          ) {
            throw new AppError(`${orderedLine.product_name}의 남은 발주 수량을 초과했습니다.`, 409);
          }
          const receiptLine = await tx.purchase_receipt_items.create({
            data: {
              receipt_id: receipt.id,
              purchase_order_item_id: line.purchase_order_item_id,
              quantity_received: line.quantity_received,
              unit_cost: line.unit_cost || orderedLine.unit_cost,
            },
          });
          const changed = await tx.purchase_order_items.updateMany({
            where: {
              id: orderedLine.id,
              purchase_order_id: oid,
              received_quantity: orderedLine.received_quantity,
              ordered_quantity: { gte: orderedLine.received_quantity + line.quantity_received },
            },
            data: { received_quantity: { increment: line.quantity_received } },
          });
          if (changed.count !== 1)
            throw new AppError(
              `${orderedLine.product_name} 입고 수량이 동시에 변경되었습니다. 새로고침 후 확인해 주세요.`,
              409
            );

          if (orderedLine.product_id) {
            const product = await tx.products.findFirst({
              where: { id: orderedLine.product_id, store_id: sid },
            });
            if (!product)
              throw new AppError('연결된 상품이 다른 매장에 있거나 삭제되었습니다.', 409);
            const previous = product.stock_quantity ?? 0;
            const next = previous + line.quantity_received;
            if (!Number.isSafeInteger(next))
              throw new AppError('재고 수량이 허용 범위를 초과했습니다.', 409);
            await tx.products.update({
              where: { id: product.id },
              data: { stock_quantity: next, is_sold_out: next === 0, updated_at: new Date() },
            });
            await tx.stock_history.create({
              data: {
                product_id: product.id,
                store_id: sid,
                change: line.quantity_received,
                qty_after: next,
                reason: 'PURCHASE_RECEIPT',
                note: `발주 ${order.order_number} 입고`,
                compensation_key: `purchase-receipt:${receiptLine.id}`,
                created_by: Number.isSafeInteger(Number(userId)) ? Number(userId) : null,
              },
            });
          }
        }
        const updatedItems = await tx.purchase_order_items.findMany({
          where: { purchase_order_id: oid },
          select: { ordered_quantity: true, received_quantity: true },
        });
        const complete = updatedItems.every(
          (item) => item.received_quantity >= item.ordered_quantity
        );
        const anyReceived = updatedItems.some((item) => item.received_quantity > 0);
        await tx.purchase_orders.update({
          where: { id: oid },
          data: {
            status: complete ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : 'ORDERED',
            ...(complete ? { received_at: new Date() } : {}),
          },
        });
        return tx.purchase_receipts.findUnique({
          where: { id: receipt.id },
          include: { items: true },
        });
      });
    } catch (error) {
      if (error?.code === 'P2002') {
        const duplicate = await prisma.purchase_receipts.findUnique({
          where: { idempotency_key: idempotencyKey },
          include: { items: true },
        });
        if (duplicate?.purchase_order_id === oid) return duplicate;
      }
      throw error;
    }
  },
};

module.exports = service;
