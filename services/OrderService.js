const prisma = require('../config/prisma');
const Order = require('../repositories/Order');
const Coupon = require('../repositories/Coupon');
const Table = require('../repositories/Table');
const Product = require('../repositories/Product');
const OrderPaceSettings = require('../repositories/OrderPaceSettings');
const notificationService = require('./notificationService');
const dashboardBroadcastService = require('./DashboardBroadcastService');
const webhookDispatcher = require('./webhookDispatcher');
const printService = require('./printService');
const logger = require('../utils/logger');
const { encryptPhone, decryptPhone, normalizePhone } = require('../utils/phoneEncryption');
const { AppError } = require('../utils/errorHandler');
const { isStoreOpenAt } = require('../utils/businessHours');
const { assertOrderStatusTransition } = require('../utils/orderStatus');
const auditLogService = require('./AuditLogService');
const orderEventService = require('./OrderEventService');
const { priceOrderItem, assertClientTotal } = require('../utils/orderPricing');
const OrderChannels = require('../repositories/OrderChannels');
const DeliveryService = require('./DeliveryService');
const { orderPlaceLabel } = require('../utils/orderLabel');

// 손님 셀프 취소를 허용하는 결제 상태 (결제 전이거나 결제 실패)
const SELF_CANCELLABLE_PAYMENT_STATUSES = ['pending', 'failed'];
// 결제 대기(READY)·완료·부분취소 결제가 있으면 셀프 취소하지 않는다
const PAYMENT_IN_PROGRESS_STATUSES = ['READY', 'DONE', 'PARTIAL_CANCELED'];
// 매장 카운터에서 결제하는 수단 (결제 대기 상태에서는 아직 돈이 오가지 않음)
const COUNTER_PAYMENT_METHODS = ['CASH', 'STORE_CARD'];

// Haversine formula for distance in km
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

class OrderService {
  constructor(io) {
    this.io = io;
  }

  async createOrder(data) {
    const {
      user_coupon_id,
      store_id,
      table_id,
      table_number,
      items,
      total_amount,
      phone,
      customer_phone,
      payment_method,
      method,
      latitude,
      longitude,
    } = data;
    if (
      data.is_split_payment &&
      (data.split_type !== 'EQUAL' ||
        !Number.isInteger(Number(data.split_people_count)) ||
        Number(data.split_people_count) < 2 ||
        Number(data.split_people_count) > 10)
    ) {
      throw new AppError('분할 인원은 2명 이상 10명 이하로 설정해 주세요.', 400);
    }
    let discount_amount = 0;
    let serverSubtotal = 0;
    const pricedItems = [];
    let userCoupon = null;

    const Store = require('../repositories/Store');
    const store = await Store.findById(store_id);
    if (!store) {
      throw new AppError('매장을 찾을 수 없습니다.', 404);
    }
    if (!items || items.length === 0) {
      throw new AppError('주문 상품이 없습니다.', 400);
    }

    // 화면에서만 막던 영업시간을 서버에서도 확인한다 (휴무일·영업시간 외 API 직접 주문 차단)
    if (
      !isStoreOpenAt({
        businessHours: store.business_hours,
        openTime: store.open_time,
        closeTime: store.close_time,
      })
    ) {
      throw new AppError('지금은 영업시간이 아니라 주문할 수 없습니다.', 409);
    }
    // 사장님이 바쁨 모드로 주문을 잠시 멈춘 경우 (조회 실패 시에는 막지 않는다)
    const orderPace = await OrderPaceSettings.findByStoreIdSafe(store_id);
    if (orderPace.orders_paused) {
      throw new AppError('주문이 몰려 잠시 주문을 받지 않고 있어요. 잠시 후 다시 시도해 주세요.', 409);
    }
    const rawPhone = phone || customer_phone;
    if (user_coupon_id) {
      if (!rawPhone) {
        throw new AppError('쿠폰 사용에는 고객 전화번호가 필요합니다.', 400);
      }
      userCoupon = await Coupon.findUserCoupon(user_coupon_id);
      if (!userCoupon || userCoupon.status !== 'UNUSED') {
        throw new AppError('유효하지 않은 쿠폰입니다.', 400);
      }
      if (normalizePhone(userCoupon.customer_phone) !== normalizePhone(rawPhone)) {
        throw new AppError('본인에게 발급된 쿠폰만 사용할 수 있습니다.', 403);
      }
    }

    // 주문 유형(매장 식사/포장/배달)을 매장 스위치와 대조한다.
    const channels = await OrderChannels.findByStoreId(store_id);
    const hasTable = Boolean(table_id || table_number);
    let orderType = data.order_type;
    if (!orderType) {
      // 유형을 보내지 않는 기존 클라이언트: 테이블이 있거나 매장 식사를 받는 매장이면 매장 식사로 본다.
      if (hasTable || channels.dine_in_enabled) orderType = 'dine_in';
      else if (channels.takeout_enabled) orderType = 'takeout';
      else throw new AppError('포장 또는 배달 중 주문 방식을 선택해 주세요.', 400);
    }
    if (!OrderChannels.enabledTypes(channels).includes(orderType)) {
      const label =
        { dine_in: '매장 식사', takeout: '포장', delivery: '배달' }[orderType] || orderType;
      throw new AppError(`이 매장은 지금 ${label} 주문을 받지 않습니다.`, 409);
    }
    if (orderType !== 'dine_in' && hasTable) {
      throw new AppError('포장·배달 주문에는 테이블을 지정할 수 없습니다.', 400);
    }
    if (orderType !== 'dine_in' && data.is_split_payment) {
      throw new AppError('분할 결제는 매장 식사 주문에서만 사용할 수 있습니다.', 400);
    }
    const payMethod = method || payment_method;
    // 매장에서 직접 결제할 자리가 없는 주문(배달, 온라인 전용 매장의 포장)은 온라인 선결제만 받는다.
    const prepayOnly =
      orderType === 'delivery' || (orderType === 'takeout' && OrderChannels.isOnlineOnly(channels));
    if (prepayOnly && ['cash', 'transfer', 'store_card'].includes(payMethod)) {
      throw new AppError('포장·배달 주문은 온라인 결제로만 주문할 수 있습니다.', 400);
    }
    const rawContactPhone = phone || customer_phone;
    if (orderType === 'delivery' && !rawContactPhone) {
      throw new AppError('배달 주문에는 연락받을 전화번호가 필요합니다.', 400);
    }

    // 테이블 주문(table_id 또는 QR의 table_number)은 위치가 오면 매장 반경을 확인한다.
    // 위치 정확도만큼은 여유를 둬 실내 GPS 오차로 매장 안 손님이 막히지 않게 한다(최대 1km).
    if ((table_id || table_number) && latitude && longitude && store.latitude && store.longitude) {
      const distanceKm = getDistanceFromLatLonInKm(
        latitude,
        longitude,
        store.latitude,
        store.longitude
      );
      const slackKm = Math.min(Number(data.location_accuracy) || 0, 1000) / 1000;
      if (distanceKm - slackKm > 0.5) {
        throw new AppError('매장 반경 500m 밖에서는 주문할 수 없습니다.', 403);
      }
    }

    // 1. 테이블 식별
    const storeIdNum = parseInt(store_id);
    let resolvedTableId = null;
    let resolvedTableName = null;
    const lookupStr =
      table_number || (table_id && isNaN(parseInt(table_id)) ? String(table_id) : null);

    if (lookupStr) {
      const table = await Table.findByStoreAndTable(storeIdNum, lookupStr);
      if (!table) throw new AppError('유효한 테이블을 찾을 수 없습니다.', 400);
      resolvedTableId = table?.id || null;
      resolvedTableName = table?.table_number || lookupStr;
    } else if (table_id && !isNaN(parseInt(table_id))) {
      resolvedTableId = parseInt(table_id);
      const table = await Table.findById(resolvedTableId);
      if (!table || (table.store_id != null && Number(table.store_id) !== storeIdNum)) {
        throw new AppError('해당 매장의 테이블이 아닙니다.', 403);
      }
      resolvedTableName = table?.table_number || null;
    }

    // 2. 서버 가격, 재고 및 품절 검증
    if (items && items.length > 0) {
      const insufficient = [];
      const products = Product.findByIds
        ? await Product.findByIds(
            items.map((item) => item.product_id),
            storeIdNum
          )
        : [];
      const productsById = new Map(products.map((product) => [product.id, product]));
      for (const item of items) {
        if (!item.product_id) throw new AppError('상품 ID가 필요합니다.', 400);
        const product =
          productsById.get(Number(item.product_id)) || (await Product.findById(item.product_id));
        const pricedItem = priceOrderItem(product, item, storeIdNum);
        pricedItems.push(pricedItem);
        serverSubtotal += pricedItem.subtotal;
        if (product.stock_quantity !== null && product.stock_quantity < pricedItem.quantity) {
          insufficient.push(`'${product.name}' 재고 부족 (재고 ${product.stock_quantity}개)`);
        }
      }
      if (insufficient.length > 0) {
        throw new AppError(insufficient.join(', '), 409);
      }
    }

    assertClientTotal(total_amount, serverSubtotal);

    // 쿠폰 계산은 클라이언트 합계가 아닌 서버 상품 합계를 기준으로 한다.
    if (user_coupon_id) {
      const coupon = userCoupon.coupons;
      if (serverSubtotal < coupon.min_order_amount) {
        throw new AppError(
          `최소 ${coupon.min_order_amount.toLocaleString()}원 이상 주문 시 사용 가능합니다.`,
          400
        );
      }
      discount_amount =
        coupon.type === 'FIXED'
          ? coupon.amount
          : Math.floor(serverSubtotal * (coupon.amount / 100));
    }

    // 배달 권역·최소 주문 금액은 서버 상품 합계로 판정하고, 배달비는 서버 설정값을 쓴다.
    let deliveryFee = 0;
    if (orderType === 'delivery') {
      const quote = await DeliveryService.quote({
        store,
        channels,
        address: data.delivery_address,
        subtotal: serverSubtotal,
        clientCoords: { latitude: data.delivery_latitude, longitude: data.delivery_longitude },
      });
      if (!quote.deliverable) throw new AppError(quote.reason, 400);
      deliveryFee = quote.fee;
    }

    // 3. 주문 생성 데이터 준비
    const final_amount = Math.max(0, serverSubtotal - discount_amount) + deliveryFee;
    const orderData = { ...data };
    orderData.order_type = orderType;
    orderData.is_takeout = orderType !== 'dine_in';
    orderData.delivery_fee = orderType === 'delivery' ? deliveryFee : null;
    orderData.delivery_address =
      orderType === 'delivery' ? String(data.delivery_address).trim() : null;
    orderData.delivery_memo =
      orderType === 'delivery' && data.delivery_memo ? String(data.delivery_memo).trim() : null;
    orderData.items = pricedItems;
    orderData.method = method || payment_method;
    if (rawPhone) {
      orderData.customer_phone = encryptPhone(rawPhone);
    }

    // 4. 주문 생성
    const order = await Order.create({
      ...orderData,
      table_id: resolvedTableId,
      total_amount: final_amount,
      discount_amount,
    });

    // 5. 후처리 (쿠폰 사용, 테이블 상태, 재고 차감, 알림)
    if (order.table_id) {
      if (this.io)
        this.io.emit('table-updated', { store_id: order.store_id, table_id: order.table_id });
    }

    // 재고 차감 및 알림 발송
    this._notifyNewOrder(order, resolvedTableName);

    return order;
  }

  /**
   * 직접 배달 진행 기록. start = 배달 출발(준비 완료로 맞춘 뒤 delivering), complete = 배달 완료(주문 완료).
   * 배달 진행은 주문 상태와 별도로 delivery_status에 둔다.
   */
  async updateDelivery(id, action, staff_id, actor = null) {
    const orderId = parseInt(id);
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('주문을 찾을 수 없습니다.', 404);
    if (order.order_type !== 'delivery') throw new AppError('배달 주문이 아닙니다.', 400);
    if (order.status === 'cancelled') throw new AppError('취소된 주문입니다.', 409);

    if (action === 'start') {
      if (order.delivery_status) throw new AppError('이미 배달을 출발한 주문입니다.', 409);
      if (order.status === 'completed') throw new AppError('이미 완료된 주문입니다.', 409);
      if (order.status !== 'ready') await this.updateStatus(orderId, 'ready', staff_id, actor);
      const claimed = await prisma.orders.updateMany({
        where: { id: orderId, delivery_status: null, status: 'ready' },
        data: {
          delivery_status: 'delivering',
          delivery_started_at: new Date(),
          updated_at: new Date(),
        },
      });
      if (claimed.count !== 1)
        throw new AppError('배달 출발 처리 중 주문 상태가 바뀌었습니다.', 409);
    } else if (action === 'complete') {
      const claimed = await prisma.orders.updateMany({
        where: { id: orderId, delivery_status: 'delivering' },
        data: { delivery_status: 'delivered', delivered_at: new Date(), updated_at: new Date() },
      });
      if (claimed.count !== 1)
        throw new AppError('배달 출발 전이거나 이미 완료된 주문입니다.', 409);
      await this.updateStatus(orderId, 'completed', staff_id, actor);
    } else {
      throw new AppError('알 수 없는 배달 처리입니다.', 400);
    }

    const updated = await Order.findById(orderId);
    if (this.io) {
      const payload = {
        order_id: updated.id,
        order_number: updated.order_number,
        store_id: updated.store_id,
        status: updated.status,
        delivery_status: updated.delivery_status,
        status_label: updated.delivery_status === 'delivering' ? '배달 중' : '배달 완료',
        updated_at: new Date().toISOString(),
      };
      this.io.to(`store - ${updated.store_id}`).emit('order-updated', payload);
      this.io.to(`order - ${updated.id}`).emit('order-updated', payload);
    }
    return updated;
  }

  async _autoDispatch(order) {
    const channels = await OrderChannels.findByStoreId(order.store_id);
    if (channels.delivery_fulfillment !== 'agency' || !channels.agency_auto_dispatch) return;
    const DeliveryDispatchService = require('./delivery/DeliveryDispatchService');
    try {
      await new DeliveryDispatchService(this.io).request(order.id);
    } catch (error) {
      notificationService
        .createNotification({
          store_id: order.store_id,
          type: 'SYSTEM',
          title: '배달대행 자동 배차에 실패했어요',
          message: `주문 #${order.order_number}: ${error.message} 주문 관리에서 다시 요청하거나 직접 배달해 주세요.`,
          priority: 'high',
          link: `/admin/stores/${order.store_id}/orders`,
        })
        .catch(() => {});
      throw error;
    }
  }

  async updateStatus(id, status, staff_id, actor = null) {
    const orderId = parseInt(id);
    const oldOrder = await Order.findById(orderId);
    if (!oldOrder) throw new AppError('주문을 찾을 수 없습니다.', 404);

    if (
      oldOrder.status === status &&
      !['confirmed', 'preparing', 'ready', 'completed'].includes(status)
    ) {
      return oldOrder;
    }
    assertOrderStatusTransition(oldOrder.status, status);

    const inventoryTransition =
      oldOrder.status === 'pending' &&
      ['confirmed', 'preparing', 'ready', 'completed'].includes(status);

    let updatedOrder;
    if (inventoryTransition) {
      // 여러 KDS/관리자 요청이 동시에 들어와도 pending 상태를 선점한
      // 요청 하나만 후속 재고 처리를 시작하도록 원자적으로 전환한다.
      const data = { status, updated_at: new Date() };
      if (staff_id) data.handled_by_staff_id = parseInt(staff_id);
      if (status === 'preparing') data.preparing_at = new Date();
      if (status === 'ready') data.ready_at = new Date();
      if (status === 'completed') data.completed_at = new Date();

      const claimed = await prisma.orders.updateMany({
        where: { id: orderId, status: 'pending' },
        data,
      });
      if (claimed.count !== 1) return Order.findById(orderId);
      updatedOrder = await Order.findById(orderId);
    } else {
      updatedOrder = await Order.updateStatus(orderId, status, staff_id);
    }

    // KDS 수락 시 재고 차감 및 품절 처리
    if (updatedOrder && ['confirmed', 'preparing', 'ready', 'completed'].includes(status)) {
      await this._processInventory(updatedOrder);
    }

    if (['completed', 'ready'].includes(status) && updatedOrder.table_id) {
      await Table.update(updatedOrder.table_id, { status: 'dirty' });
      if (this.io)
        this.io.emit('table-updated', {
          store_id: updatedOrder.store_id,
          table_id: updatedOrder.table_id,
        });
    }

    try {
      const sseController = require('../controllers/sseController');
      sseController.notifyOrderStatusChange(orderId, status);
    } catch (sseErr) {
      const logger = require('../utils/logger');
      logger.error(`[SSE Error] ${sseErr.message}`);
    }

    // 알림 처리
    let customerToken = updatedOrder.customer_fcm_token;
    if (updatedOrder.customer_phone) {
      const storeCustomer = await prisma.store_customers.findFirst({
        where: { store_id: updatedOrder.store_id, customer_phone: updatedOrder.customer_phone },
      });
      if (storeCustomer?.fcm_token) customerToken = storeCustomer.fcm_token;
    }

    notificationService.notifyOrderStatus(updatedOrder, status, customerToken);
    notificationService.notifyOrderStatusDB(updatedOrder, status).catch(() => {});

    if (['confirmed', 'ready', 'cancelled'].includes(status)) {
      let tName = orderPlaceLabel(updatedOrder, null) || '포장';
      if (updatedOrder.table_id) {
        const table = await prisma.tables.findUnique({
          where: { id: updatedOrder.table_id },
          select: { table_number: true },
        });
        if (table) tName = table.table_number;
      }
      this._sendOrderAlimtalk(updatedOrder, status, { tableName: tName }).catch((e) =>
        logger.error(e)
      );
    }

    // 웹훅 및 소켓 전송
    webhookDispatcher.emitEvent(updatedOrder.store_id, 'order.updated', {
      order_id: updatedOrder.id,
      order_number: updatedOrder.order_number,
      status,
    });
    if (status === 'completed') {
      webhookDispatcher.emitEvent(updatedOrder.store_id, 'order.completed', {
        order_id: updatedOrder.id,
        order_number: updatedOrder.order_number,
        total_amount: updatedOrder.total_amount,
      });
    }

    if (status === 'completed') {
      this._processLoyaltyPoints(updatedOrder).catch((e) =>
        logger.error('[Loyalty Error] ' + e.message)
      );
    }

    this._emitOrderUpdate(updatedOrder, status);
    // 배달대행 자동 배차: 매장이 켜 둔 경우 주문을 확인하면 바로 배차를 요청한다(실패해도 주문 흐름은 그대로).
    if (
      status === 'confirmed' &&
      updatedOrder.order_type === 'delivery' &&
      oldOrder.status !== 'confirmed'
    ) {
      this._autoDispatch(updatedOrder).catch((e) => logger.warn(`[AutoDispatch] ${e.message}`));
    }
    void auditLogService.record({
      actorUserId: actor?.userId || null,
      actorRole: actor?.role || null,
      action: 'ORDER_STATUS_UPDATED',
      resourceType: 'order',
      resourceId: updatedOrder.id,
      storeId: updatedOrder.store_id,
      before: { status: oldOrder.status },
      after: { status: updatedOrder.status },
      metadata: { staff_id: staff_id || null },
    });
    void orderEventService.record({
      orderId: updatedOrder.id,
      storeId: updatedOrder.store_id,
      eventType: 'STATUS_CHANGED',
      fromStatus: oldOrder.status,
      toStatus: updatedOrder.status,
      actorUserId: actor?.userId || null,
      actorRole: actor?.role || null,
      metadata: { staff_id: staff_id || null },
    });
    return updatedOrder;
  }

  async cancelOrder(id, userId, userRole) {
    const orderId = parseInt(id);
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('주문을 찾을 수 없습니다', 404);

    if (userRole !== 'super_admin') {
      const { getStoreRole } = require('../middleware/storeAuth');
      const role = await getStoreRole(userId, order.store_id);
      // 주방 계정은 주방 화면(KDS) 취소를 쓴다 — 그 경로가 환불·환불 필요 알림까지 처리한다.
      const allowed = ['owner', 'manager', 'staff'];
      if (!role || !allowed.includes(role))
        throw new AppError('해당 매장에 대한 권한이 없습니다.', 403);
    }

    if (order.status === 'cancelled') return { success: true, message: '이미 취소된 주문입니다.' };
    if (order.status === 'completed') throw new AppError('완료된 주문은 취소할 수 없습니다.', 400);

    await Order.updateStatus(orderId, 'cancelled');
    // KDS 수락 이후 취소된 경우에만 재고 복구
    if (order.status !== 'pending') {
      await this._restoreInventory(orderId);
    }
    // 주문 단위 포인트 회수 (PaymentService 결제취소 경로를 거치지 않은 적립/사용분 포함)
    await this._revertPointsOnCancel(orderId).catch((e) =>
      logger.error('[Point Revert Error] ' + e.message)
    );
    this._sendOrderAlimtalk(order, 'cancelled').catch((e) => logger.error(e));

    if (this.io) {
      this.io.to(`store - ${order.store_id}`).emit('order-updated', {
        order_id: orderId,
        status: 'cancelled',
        store_id: order.store_id,
      });
    }
    return { success: true, message: '주문이 취소되었습니다' };
  }

  /**
   * 손님 셀프 취소 (QR 주문 capability 보유자)
   * 주방이 접수하기 전(pending)이고 결제가 끝나지 않은 일반 주문만 취소한다.
   * 결제된 주문은 환불이 필요하므로 직원 취소 경로로 안내한다.
   */
  async customerCancelOrder(id) {
    const orderId = parseInt(id);
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('주문을 찾을 수 없습니다', 404);
    if (order.status === 'cancelled') return { success: true, message: '이미 취소된 주문입니다.' };
    if (order.status !== 'pending') {
      throw new AppError('주방에서 이미 주문을 확인했어요. 취소는 직원에게 요청해 주세요.', 409);
    }
    if (order.is_split_payment) {
      throw new AppError('분할 결제 주문은 직원에게 취소를 요청해 주세요.', 409);
    }
    if (!SELF_CANCELLABLE_PAYMENT_STATUSES.includes(order.payment_status ?? 'pending')) {
      throw new AppError('결제가 완료된 주문은 환불이 필요해 직원에게 취소를 요청해 주세요.', 409);
    }

    // 주문 행을 잠근 채로 결제 진행 여부를 확인하고 취소한다 (현금 수납 확인도 같은 행을 잠근다).
    // 카드·간편결제(PG)·계좌이체가 진행 중이거나 끝난 주문은 승인·입금과 엇갈릴 수 있어 직원 취소로 넘긴다.
    // 매장에서 낼 현금·매장 카드 결제 대기(READY)는 돈이 오가기 전이므로 함께 취소한다.
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
      const activePayments = await tx.payments.findMany({
        where: { order_id: orderId, status: { in: PAYMENT_IN_PROGRESS_STATUSES } },
        select: { id: true, status: true, method: true, payment_key: true },
      });
      const isCounterPaymentPending = (p) =>
        p.status === 'READY' &&
        !p.payment_key &&
        COUNTER_PAYMENT_METHODS.includes(String(p.method || '').toUpperCase());
      if (activePayments.some((p) => !isCounterPaymentPending(p))) {
        throw new AppError('결제가 진행 중이거나 완료된 주문은 직원에게 취소를 요청해 주세요.', 409);
      }
      if (activePayments.length > 0) {
        await tx.payments.updateMany({
          where: { id: { in: activePayments.map((p) => p.id) }, status: 'READY' },
          data: { status: 'CANCELED', updated_at: new Date() },
        });
      }
      // 주방 접수와 동시에 눌린 경우를 막기 위해 상태 조건부로 갱신한다.
      const { count } = await tx.orders.updateMany({
        where: { id: orderId, status: 'pending', payment_status: { in: SELF_CANCELLABLE_PAYMENT_STATUSES } },
        data: { status: 'cancelled', updated_at: new Date() },
      });
      if (count !== 1) {
        throw new AppError('주방에서 이미 주문을 확인했어요. 취소는 직원에게 요청해 주세요.', 409);
      }
    });

    // pending 단계는 재고를 차감하지 않으므로 재고 복구는 하지 않는다.
    await this._revertPointsOnCancel(orderId).catch((e) =>
      logger.error('[Point Revert Error] ' + e.message)
    );
    logger.info({ orderId, storeId: order.store_id }, 'order cancelled by customer before kitchen accept');

    if (this.io) {
      const payload = { order_id: orderId, status: 'cancelled', store_id: order.store_id, cancelled_by: 'customer' };
      this.io.to(`store - ${order.store_id}`).emit('order-updated', payload);
      this.io.to(`kitchen - ${order.store_id}`).emit('order-updated', payload);
      this.io.to(`order - ${orderId}`).emit('order-updated', payload);
    }
    return { success: true, message: '주문이 취소되었습니다' };
  }

  // ── 프라이빗 헬퍼 ──────────────────────────────────────────

  async _processInventory(order) {
    const items = await prisma.order_items.findMany({
      where: { order_id: order.id },
      select: { product_id: true, quantity: true },
    });
    for (const item of items) {
      if (!item.product_id) continue;
      const result = await prisma.$transaction(async (tx) => {
        // Row-level lock (FOR UPDATE) to prevent race conditions & deadlocks during concurrency/flash sales
        const lockedRows = await tx.$queryRaw`
          SELECT id, name, store_id, stock_quantity, low_stock_threshold 
          FROM products 
          WHERE id = ${item.product_id} 
          FOR UPDATE
        `;
        const product = lockedRows && lockedRows[0] ? lockedRows[0] : null;

        if (!product || product.stock_quantity === null) return null;

        // 상태 재시도/동시 요청에서 동일 주문의 재고를 두 번 차감하지 않는다.
        const existingStockHistory = await tx.stock_history.findFirst({
          where: { order_id: order.id, product_id: item.product_id, reason: 'ORDER' },
          select: { id: true },
        });
        if (existingStockHistory) return { alreadyProcessed: true };

        if (product.stock_quantity < item.quantity) {
          await tx.products.update({ where: { id: item.product_id }, data: { is_sold_out: true } });
          return {
            is_sold_out: true,
            name: product.name,
            store_id: product.store_id,
            productId: product.id,
            newQty: 0,
            threshold: product.low_stock_threshold,
          };
        }
        const newQty = product.stock_quantity - item.quantity;
        const is_sold_out = newQty === 0;
        await tx.products.update({
          where: { id: item.product_id },
          data: { stock_quantity: newQty, is_sold_out },
        });
        await tx.stock_history.create({
          data: {
            product_id: item.product_id,
            store_id: product.store_id,
            change: -item.quantity,
            qty_after: newQty,
            reason: 'ORDER',
            order_id: order.id,
          },
        });
        return {
          is_sold_out,
          name: product.name,
          store_id: product.store_id,
          productId: product.id,
          newQty,
          threshold: product.low_stock_threshold,
        };
      });
      if (result) {
        if (result.alreadyProcessed) continue;
        if (result.newQty <= result.threshold) {
          notificationService
            .notifyLowStockDB({
              id: result.productId,
              name: result.name,
              store_id: result.store_id,
              stock_quantity: result.newQty,
              low_stock_threshold: result.threshold,
            })
            .catch(() => {});
        }
        if (this.io && result.is_sold_out) {
          this.io.to('store - ' + result.store_id).emit('product-updated', {
            productId: result.productId,
            is_sold_out: true,
            name: result.name,
          });
        }
      }
    }
  }

  async _restoreInventory(orderId) {
    const items = await prisma.order_items.findMany({
      where: { order_id: orderId },
      select: { product_id: true, quantity: true },
    });
    const validItems = items.filter((it) => it.product_id);
    if (validItems.length === 0) return;

    // N+1 방지: 대상 상품을 한 번에 조회
    const productIds = validItems.map((it) => it.product_id);
    const products = await prisma.products.findMany({
      where: { id: { in: productIds } },
      select: { id: true, store_id: true, stock_quantity: true },
    });
    const productByStore = new Map(products.map((p) => [String(p.id), p.store_id]));

    await prisma.$transaction(async (tx) => {
      for (const item of validItems) {
        const store_id = productByStore.get(String(item.product_id));
        if (store_id === undefined) continue;
        // 원자적 증가로 오버라이트 경쟁/유실 업데이트 방지 (update가 갱신된 행을 반환)
        const updated = await tx.products.update({
          where: { id: item.product_id },
          data: { stock_quantity: { increment: item.quantity }, is_sold_out: false },
        });
        await tx.stock_history.create({
          data: {
            product_id: item.product_id,
            store_id,
            change: item.quantity,
            qty_after: updated.stock_quantity,
            reason: 'CANCEL',
            order_id: orderId,
          },
        });
      }
    });
  }

  async _revertPointsOnCancel(orderId) {
    const existingTx = await prisma.point_transactions.findFirst({
      where: { order_id: orderId },
      select: { id: true },
    });
    if (!existingTx) return;

    const PointsService = require('./PointsService');
    await prisma.$transaction(async (tx) => {
      await PointsService.revertOnOrderCancel(orderId, tx);
    });
  }

  async _processLoyaltyPoints(order) {
    if (!order.customer_phone) return;

    const phoneStr = decryptPhone(order.customer_phone);
    if (!phoneStr) return;

    // 중복 적립 방지: 이미 이 주문에 대한 포인트 트랜잭션이 있으면 skip
    const existingTx = await prisma.point_transactions.findFirst({
      where: { order_id: order.id },
    });
    if (existingTx) return;

    // StoreCustomer upsert (tier 계산 + 캠페인 트리거 포함)
    const StoreCustomer = require('../repositories/StoreCustomer');
    await StoreCustomer.upsertCustomer({
      store_id: order.store_id,
      customer_phone: phoneStr,
      amount: order.total_amount,
    }).catch((err) => {
      logger.error('[StoreCustomer Upsert Error]:', err);
    });

    // Tier-aware 적립 포인트 계산 (설정 비활성/최소 금액 미달 시 0 반환)
    const PointsService = require('./PointsService');
    const earnedPoints = await PointsService.calculateEarnPoints(
      order.total_amount,
      order.store_id,
      { phone: phoneStr }
    );
    if (earnedPoints <= 0) return;

    // PointsService.earn 재사용 — balance_after 이중계산 방지 + 표준 type('earn')/만료일(기본 365d) 통일
    await prisma.$transaction(async (tx) => {
      await PointsService.earn(
        order.id,
        null,
        order.store_id,
        order.order_number,
        phoneStr,
        earnedPoints,
        tx
      );
    });
  }

  _notifyNewOrder(order, resolvedTableName) {
    if (
      order.is_split_payment &&
      (order.payment_status !== 'paid' || order.split_status !== 'COMPLETED')
    )
      return;
    if (!this.io) return;
    // 포장·배달 주문은 테이블 대신 '포장' / '배달 · 동네'로 표시한다.
    resolvedTableName = orderPlaceLabel(order, resolvedTableName);
    const payload = {
      orderId: order.id,
      orderNumber: order.order_number,
      storeId: order.store_id,
      tableId: order.table_id,
      tableName: resolvedTableName,
      orderType: order.order_type || 'dine_in',
      totalAmount: order.total_amount,
      status: order.status,
      itemCount: order.order_items?.length || 0,
      createdAt: order.created_at,
    };
    this.io.to(`store - ${order.store_id}`).emit('new-order', payload);
    this.io.to(`kitchen - ${order.store_id}`).emit('new-order', payload);

    notificationService
      .notifyNewOrderDB({ ...order, table_name: resolvedTableName })
      .catch(() => {});
    webhookDispatcher.emitEvent(order.store_id, 'order.created', {
      order_id: order.id,
      order_number: order.order_number,
      total_amount: order.total_amount,
      table_id: order.table_id,
      source: 'qr',
    });
    printService.createKitchenJob(order, { tableName: resolvedTableName }).catch(() => {});
  }

  async publishPaidSplitOrder(orderId) {
    const order = await prisma.orders.findUnique({
      where: { id: Number(orderId) },
      include: { order_items: true, tables: { select: { table_number: true } } },
    });
    if (
      !order ||
      !order.is_split_payment ||
      order.payment_status !== 'paid' ||
      order.split_status !== 'COMPLETED'
    )
      return false;
    this._notifyNewOrder(order, order.tables?.table_number || null);
    return true;
  }

  _emitOrderUpdate(order, status) {
    if (!this.io) return;
    const labels = {
      confirmed: '주문 확인',
      preparing: '조리 중',
      ready: '준비 완료',
      completed: '수령 완료',
      cancelled: '주문 취소',
    };
    const payload = {
      order_id: order.id,
      order_number: order.order_number,
      status,
      status_label: labels[status] || status,
      store_id: order.store_id,
      table_id: order.table_id,
      updated_at: new Date().toISOString(),
    };
    this.io.to(`store - ${order.store_id}`).emit('order-updated', payload);
    this.io.to(`kitchen - ${order.store_id}`).emit('order-updated', payload);
    this.io.to(`order - ${order.id}`).emit('order-updated', payload);
    this.io
      .to(`customer-order - ${order.id}`)
      .emit('customer-order-changed', { order_id: order.id });

    // 실시간 대시보드 (store_${storeId}_dashboard 룸) 알림 — DashboardBroadcastService 전담 채널
    dashboardBroadcastService.notifyOrderChange(order.store_id, payload);
  }

  async _sendOrderAlimtalk(order, status, extraData = {}) {
    try {
      if (!order.customer_phone) return;
      const phone = decryptPhone(order.customer_phone);
      if (!phone) return;

      const store = await prisma.stores.findUnique({
        where: { id: order.store_id },
        select: { name: true },
      });
      const storeName = store?.name || 'WeMarket QR 매장';
      const orderNumber = order.order_number || order.id;

      const alimtalkService = require('./AlimtalkService');

      if (status === 'confirmed') {
        await alimtalkService.sendOrderConfirmed(
          phone,
          storeName,
          orderNumber,
          order.queue_number || order.id,
          order.total_amount
        );
      } else if (status === 'ready') {
        await alimtalkService.sendFoodReady(
          phone,
          storeName,
          orderNumber,
          extraData.tableName || '테이블'
        );
      } else if (status === 'cancelled') {
        await alimtalkService.sendOrderCancelled(
          phone,
          storeName,
          orderNumber,
          extraData.reason || '매장 사정 또는 재고 소진'
        );
      }
    } catch (error) {
      logger.error(error);
    }
  }
}

module.exports = OrderService;
