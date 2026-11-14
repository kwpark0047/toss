const prisma = require('../../config/prisma');
const logger = require('../../utils/logger');
const { AppError } = require('../../utils/errorHandler');
const OrderChannels = require('../../repositories/OrderChannels');
const credentials = require('../ProviderCredentialService');
const notificationService = require('../notificationService');
const { getAdapter, STATUSES } = require('./adapters');

/**
 * 배달대행 배차 요청·취소와 대행사 상태 웹훅 처리.
 * 대행사 상태를 주문에 반영한다: 픽업 → 배달 중(delivering), 배달 완료 → 주문 완료,
 * 취소·실패 → 배달 진행을 되돌리고 사장님께 알림(직접 배달로 넘기거나 다시 요청).
 */

const ACTIVE = ['requested', 'assigned', 'picked_up'];
// 대행사 상태는 앞으로만 간다 (늦게 온 이전 단계 이벤트는 무시)
const RANK = { requested: 0, assigned: 1, picked_up: 2, delivered: 3, canceled: 3, failed: 3 };

const toPublic = (d) =>
  d && {
    id: d.id,
    provider: d.provider,
    status: d.status,
    fee: d.fee,
    rider_name: d.rider_name,
    rider_phone: d.rider_phone,
    tracking_url: d.tracking_url,
    failure_reason: d.failure_reason,
    requested_at: d.requested_at,
    updated_at: d.updated_at,
  };

class DeliveryDispatchService {
  constructor(io = null, db = prisma) {
    this.io = io;
    this.db = db;
  }

  _emit(order, dispatch) {
    if (!this.io) return;
    const payload = {
      order_id: order.id,
      store_id: order.store_id,
      delivery_status: order.delivery_status,
      dispatch: toPublic(dispatch),
      updated_at: new Date().toISOString(),
    };
    this.io.to(`store - ${order.store_id}`).emit('delivery-dispatch-updated', payload);
    this.io.to(`order - ${order.id}`).emit('delivery-dispatch-updated', {
      ...payload,
      // 고객 화면에는 기사 연락처 대신 이름·추적 링크만 보낸다.
      dispatch: dispatch && {
        status: dispatch.status,
        rider_name: dispatch.rider_name,
        tracking_url: dispatch.tracking_url,
      },
    });
  }

  async latestForOrder(orderId) {
    return this.db.delivery_dispatches.findFirst({
      where: { order_id: Number(orderId) },
      orderBy: { id: 'desc' },
    });
  }

  async getForOrder(orderId) {
    return toPublic(await this.latestForOrder(orderId));
  }

  /**
   * 배차 요청. 배달 주문이고, 매장이 배달대행을 골랐고, 진행 중인 배차가 없을 때만.
   */
  async request(orderId) {
    const order = await this.db.orders.findUnique({ where: { id: Number(orderId) } });
    if (!order) throw new AppError('주문을 찾을 수 없습니다.', 404);
    if (order.order_type !== 'delivery') throw new AppError('배달 주문이 아닙니다.', 400);
    if (['cancelled', 'completed'].includes(order.status) || order.delivery_status === 'delivered')
      throw new AppError('이미 끝난 주문입니다.', 409);
    if (order.delivery_status === 'delivering')
      throw new AppError('이미 배달 중인 주문입니다.', 409);

    const channels = await OrderChannels.findByStoreId(order.store_id, this.db);
    if (channels.delivery_fulfillment !== 'agency' || !channels.agency_provider)
      throw new AppError('배달대행을 쓰도록 설정된 매장이 아닙니다.', 400);
    const adapter = getAdapter(channels.agency_provider);
    if (!adapter) throw new AppError('지원하지 않는 배달대행사입니다.', 400);
    const creds = await credentials.resolve(channels.agency_provider, order.store_id);
    if (!creds) throw new AppError(`${adapter.label} 계정을 먼저 연결해 주세요.`, 400);

    const active = await this.db.delivery_dispatches.findFirst({
      where: { order_id: order.id, status: { in: ACTIVE } },
    });
    if (active) throw new AppError('이미 배차를 요청한 주문입니다.', 409);

    const store = await this.db.stores.findUnique({
      where: { id: order.store_id },
      select: { id: true, name: true, address: true, phone: true, latitude: true, longitude: true },
    });
    const callbackUrl = `${process.env.BACKEND_URL || ''}/api/orders/delivery-webhooks/${adapter.key}/${order.store_id}`;
    const result = await adapter.requestDispatch({ credentials: creds, order, store, callbackUrl });
    if (!STATUSES.includes(result?.status))
      throw new AppError('대행사 응답을 해석하지 못했습니다.', 502);

    const dispatch = await this.db.delivery_dispatches.create({
      data: {
        order_id: order.id,
        store_id: order.store_id,
        provider: adapter.key,
        external_id: result.externalId ? String(result.externalId) : null,
        status: result.status,
        fee: Number.isInteger(result.fee) ? result.fee : null,
        tracking_url: result.trackingUrl || null,
      },
    });
    this._emit(order, dispatch);
    return toPublic(dispatch);
  }

  // 진행 중인 배차 취소 (픽업 전까지만)
  async cancel(orderId, reason = '매장 요청') {
    const dispatch = await this.latestForOrder(orderId);
    if (!dispatch || !['requested', 'assigned'].includes(dispatch.status))
      throw new AppError(
        '취소할 수 있는 배차가 없습니다. 기사가 픽업한 뒤에는 대행사에 직접 문의해 주세요.',
        409
      );
    const adapter = getAdapter(dispatch.provider);
    const creds = await credentials.resolve(dispatch.provider, dispatch.store_id);
    if (!adapter || !creds) throw new AppError('대행사 연결 정보를 확인할 수 없습니다.', 400);
    await adapter.cancelDispatch({ credentials: creds, dispatch, reason });
    const updated = await this.db.delivery_dispatches.update({
      where: { id: dispatch.id },
      data: {
        status: 'canceled',
        canceled_at: new Date(),
        failure_reason: reason,
        updated_at: new Date(),
      },
    });
    const order = await this.db.orders.findUnique({ where: { id: dispatch.order_id } });
    this._emit(order, updated);
    return toPublic(updated);
  }

  /**
   * 대행사 상태 웹훅. 서명 검증 → 같은 이벤트 중복 무시 → 배차·주문 반영.
   * @returns {{ handled: boolean, duplicate?: boolean }}
   */
  async handleWebhook({ provider, storeId, rawBody, headers, body, orderService }) {
    const adapter = getAdapter(provider);
    if (!adapter || !adapter.ready) throw new AppError('지원하지 않는 배달대행사입니다.', 404);
    const creds = await credentials.resolve(provider, storeId);
    if (!creds || !adapter.verifyWebhook({ credentials: creds, rawBody, headers }))
      throw new AppError('서명을 확인할 수 없습니다.', 401);

    const event = adapter.parseWebhook({ body });
    if (!event?.eventId || !event.externalId || !STATUSES.includes(event.status))
      throw new AppError('대행사 이벤트 형식이 올바르지 않습니다.', 400);

    const dispatch = await this.db.delivery_dispatches.findFirst({
      where: { provider, external_id: event.externalId, store_id: Number(storeId) },
    });
    if (!dispatch) throw new AppError('배차를 찾을 수 없습니다.', 404);

    try {
      await this.db.delivery_webhook_events.create({
        data: { provider, event_id: event.eventId, store_id: Number(storeId) },
      });
    } catch (error) {
      if (error.code === 'P2002') return { handled: false, duplicate: true };
      throw error;
    }

    if (RANK[event.status] < RANK[dispatch.status] || dispatch.status === event.status) {
      // 이미 지난 단계 — 기사 정보만 보강
      if (event.riderName || event.trackingUrl) {
        await this.db.delivery_dispatches.update({
          where: { id: dispatch.id },
          data: {
            rider_name: event.riderName || dispatch.rider_name,
            rider_phone: event.riderPhone || dispatch.rider_phone,
            tracking_url: event.trackingUrl || dispatch.tracking_url,
            updated_at: new Date(),
          },
        });
      }
      return { handled: true };
    }

    const now = new Date();
    const stamp = {
      assigned: 'assigned_at',
      picked_up: 'picked_up_at',
      delivered: 'delivered_at',
      canceled: 'canceled_at',
      failed: 'canceled_at',
    }[event.status];
    const updated = await this.db.delivery_dispatches.update({
      where: { id: dispatch.id },
      data: {
        status: event.status,
        ...(stamp ? { [stamp]: now } : {}),
        rider_name: event.riderName || dispatch.rider_name,
        rider_phone: event.riderPhone || dispatch.rider_phone,
        tracking_url: event.trackingUrl || dispatch.tracking_url,
        fee: Number.isInteger(event.fee) ? event.fee : dispatch.fee,
        failure_reason: event.reason || dispatch.failure_reason,
        updated_at: now,
      },
    });

    await this._applyToOrder(dispatch.order_id, event.status, orderService, event.reason);
    const order = await this.db.orders.findUnique({ where: { id: dispatch.order_id } });
    this._emit(order, updated);
    return { handled: true };
  }

  async _applyToOrder(orderId, status, orderService, reason) {
    const order = await this.db.orders.findUnique({ where: { id: orderId } });
    if (!order || order.status === 'cancelled') return;
    if (status === 'picked_up' && !order.delivery_status) {
      if (order.status !== 'ready' && orderService) {
        await orderService
          .updateStatus(order.id, 'ready', null, { role: 'system' })
          .catch((e) => logger.warn(`[DeliveryDispatch] 준비 완료 전환 실패: ${e.message}`));
      }
      await this.db.orders.updateMany({
        where: { id: order.id, delivery_status: null },
        data: {
          delivery_status: 'delivering',
          delivery_started_at: new Date(),
          updated_at: new Date(),
        },
      });
    } else if (status === 'delivered' && order.delivery_status !== 'delivered') {
      await this.db.orders.update({
        where: { id: order.id },
        data: { delivery_status: 'delivered', delivered_at: new Date(), updated_at: new Date() },
      });
      if (orderService && order.status !== 'completed') {
        if (order.status !== 'ready')
          await orderService
            .updateStatus(order.id, 'ready', null, { role: 'system' })
            .catch(() => {});
        await orderService
          .updateStatus(order.id, 'completed', null, { role: 'system' })
          .catch((e) => logger.warn(`[DeliveryDispatch] 주문 완료 전환 실패: ${e.message}`));
      }
    } else if (['canceled', 'failed'].includes(status)) {
      await this.db.orders.update({
        where: { id: order.id },
        data: { delivery_status: null, delivery_started_at: null, updated_at: new Date() },
      });
      notificationService
        .createNotification({
          store_id: order.store_id,
          type: 'SYSTEM',
          title: '배달대행 배차가 취소되었어요',
          message: `주문 #${order.order_number} 배차가 ${status === 'failed' ? '실패' : '취소'}했어요${reason ? ` (${reason})` : ''}. 다시 요청하거나 직접 배달해 주세요.`,
          priority: 'high',
          link: `/admin/stores/${order.store_id}/orders`,
        })
        .catch(() => {});
    }
  }
}

module.exports = DeliveryDispatchService;
module.exports.toPublic = toPublic;
