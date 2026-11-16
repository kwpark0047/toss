const prisma = require('../../config/prisma');
const logger = require('../../utils/logger');
const { AppError } = require('../../utils/errorHandler');
const OrderChannels = require('../../repositories/OrderChannels');
const notificationService = require('../notificationService');
const credentials = require('../ProviderCredentialService');
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
    request_state: d.request_state,
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

    if (!adapter.ready) throw new AppError('대행사 연동은 준비 중입니다.', 501);
    const store = await this.db.stores.findUnique({
      where: { id: order.store_id },
      select: { id: true, name: true, address: true, phone: true, latitude: true, longitude: true },
    });
    const callbackUrl = `${process.env.BACKEND_URL || ''}/api/orders/delivery-webhooks/${adapter.key}/${order.store_id}`;
    const claim = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM public.orders WHERE id = ${order.id} FOR UPDATE`;
      const current = await tx.orders.findUnique({ where: { id: order.id } });
      if (
        ['completed', 'cancelled'].includes(current.status) ||
        ['delivering', 'delivered'].includes(current.delivery_status)
      )
        throw new AppError('이미 끝났거나 배달 중인 주문입니다.', 409);
      const active = await tx.delivery_dispatches.findFirst({
        where: { order_id: order.id, status: { in: ACTIVE } },
      });
      if (active)
        throw new AppError(
          '이미 배차를 요청한 주문입니다. 미확정 결과는 대행사 확인이 필요합니다.',
          409
        );
      return tx.delivery_dispatches.create({
        data: {
          order_id: order.id,
          store_id: order.store_id,
          provider: adapter.key,
          status: 'requested',
          request_state: 'unknown',
        },
      });
    });

    // Commit the claim BEFORE I/O. Timeouts/crashes/persistence errors must never cause a resend.
    // Real adapters must forward this stable key and implement reconciliation of unknown results.
    let dispatch;
    try {
      const result = await adapter.requestDispatch({
        credentials: creds,
        order,
        store,
        callbackUrl,
        idempotencyKey: `delivery-dispatch:${claim.id}`,
      });
      if (!STATUSES.includes(result?.status) || !result?.externalId)
        throw new AppError('대행사 응답을 해석하지 못했습니다.', 502);
      dispatch = await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM public.orders WHERE id = ${order.id} FOR UPDATE`;
        const saved = await tx.delivery_dispatches.update({
          where: { id: claim.id },
          data: {
            external_id: String(result.externalId),
            status: result.status,
            request_state: 'confirmed',
            fee: Number.isInteger(result.fee) ? result.fee : null,
            tracking_url: result.trackingUrl || null,
          },
        });
        await this._applyToOrder(order.id, result.status, tx);
        if (['picked_up', 'delivered', 'canceled', 'failed'].includes(result.status)) {
          await tx.delivery_webhook_events.create({
            data: {
              provider: adapter.key,
              event_id: `dispatch-response:${claim.id}`,
              store_id: order.store_id,
              order_id: order.id,
              effect_status: result.status,
            },
          });
        }
        return saved;
      });
    } catch (_error) {
      logger.warn(`[DeliveryDispatch] Unknown provider result for claim ${claim.id}`);
      throw new AppError(
        `배차 결과 미확정입니다. 자동 재요청하지 말고 대행사에 확인해 주세요. (${claim.id})`,
        502
      );
    }
    if (['picked_up', 'delivered', 'canceled', 'failed'].includes(dispatch.status)) {
      const OrderService = require('../OrderService');
      await this._drainEffects(order.id, new OrderService(this.io));
    }
    this._emit(order, dispatch);
    return toPublic(dispatch);
  }

  // 진행 중인 배차 취소 (픽업 전까지만)
  async cancel(orderId, reason = '매장 요청') {
    const dispatch = await this.latestForOrder(orderId);
    if (
      !dispatch ||
      dispatch.request_state === 'unknown' ||
      !['requested', 'assigned'].includes(dispatch.status)
    )
      throw new AppError(
        '취소할 수 있는 배차가 없습니다. 기사가 픽업한 뒤에는 대행사에 직접 문의해 주세요.',
        409
      );
    const adapter = getAdapter(dispatch.provider);
    const creds = await credentials.resolve(dispatch.provider, dispatch.store_id);
    if (!adapter || !creds) throw new AppError('대행사 연결 정보를 확인할 수 없습니다.', 400);
    await adapter.cancelDispatch({ credentials: creds, dispatch, reason });
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM public.orders WHERE id = ${dispatch.order_id} FOR UPDATE`;
      await tx.delivery_dispatches.updateMany({
        where: { id: dispatch.id, status: { in: ['requested', 'assigned'] } },
        data: {
          status: 'canceled',
          canceled_at: new Date(),
          failure_reason: reason,
          updated_at: new Date(),
        },
      });
    });
    const order = await this.db.orders.findUnique({ where: { id: dispatch.order_id } });
    const updated = await this.latestForOrder(orderId);
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

    const found = await this.db.delivery_dispatches.findFirst({
      where: { provider, external_id: event.externalId, store_id: Number(storeId) },
    });
    if (!found) throw new AppError('배차를 찾을 수 없습니다.', 404);
    const outcome = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM public.orders WHERE id = ${found.order_id} FOR UPDATE`;
      const dispatch = await tx.delivery_dispatches.findUnique({ where: { id: found.id } });
      const duplicate = await tx.delivery_webhook_events.findUnique({
        where: { provider_event_id: { provider, event_id: event.eventId } },
      });
      if (duplicate) return { handled: false, duplicate: true };
      await tx.delivery_webhook_events.create({
        data: { provider, event_id: event.eventId, store_id: Number(storeId) },
      });
      const latest = await tx.delivery_dispatches.findFirst({
        where: { order_id: dispatch.order_id },
        orderBy: { id: 'desc' },
      });
      if (latest.id !== dispatch.id) return { handled: true };
      if (
        ['delivered', 'canceled', 'failed'].includes(dispatch.status) ||
        RANK[event.status] < RANK[dispatch.status] ||
        dispatch.status === event.status
      ) {
        // 이미 지난 단계 — 기사 정보만 보강
        if (event.riderName || event.trackingUrl) {
          await tx.delivery_dispatches.update({
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
      const updated = await tx.delivery_dispatches.update({
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

      await this._applyToOrder(dispatch.order_id, event.status, tx);
      await tx.delivery_webhook_events.update({
        where: { provider_event_id: { provider, event_id: event.eventId } },
        data: {
          order_id: ['picked_up', 'delivered', 'canceled', 'failed'].includes(event.status)
            ? dispatch.order_id
            : null,
          effect_status: event.status,
          effect_reason: event.reason || null,
        },
      });
      const order = await tx.orders.findUnique({ where: { id: dispatch.order_id } });
      return { handled: true, order, updated };
    });
    // Retry unfinished post-commit effects even when the inbox event is already present.
    await this._drainEffects(found.order_id, orderService);
    if (outcome.updated) this._emit(outcome.order, outcome.updated);
    return outcome.duplicate ? { handled: false, duplicate: true } : { handled: true };
  }

  async recoverPendingEffects(orderService, limit = 50) {
    // Advance across batches even when old orders keep failing. Always starting
    // at id 0 would let the first 50 failures starve every newer order forever.
    const batchAfter = (id) => this.db.delivery_webhook_events.findMany({
      where: { id: { gt: id }, order_id: { not: null }, effect_completed_at: null,
        OR: [{ effect_lease_until: null }, { effect_lease_until: { lt: new Date() } }] },
      orderBy: { id: 'asc' }, take: limit, select: { id: true, order_id: true },
    });
    let events = await batchAfter(this.recoveryAfterId || 0);
    if (!events.length && this.recoveryAfterId) {
      this.recoveryAfterId = 0;
      events = await batchAfter(0);
    }
    if (events.length) this.recoveryAfterId = events[events.length - 1].id;
    const orders = [...new Set(events.map((event) => event.order_id))];
    let failed = 0;
    for (const orderId of orders) {
      try { await this._drainEffects(orderId, orderService); }
      catch { failed++; logger.warn('[DeliveryDispatch] Pending effects will retry'); }
    }
    return { attempted: orders.length, failed };
  }

  // Durable, at-least-once post-commit effects. A crash releases the lease after 60s.
  // Notification/loyalty providers must be idempotent too; DB state is exactly-once.
  async _drainEffects(orderId, orderService) {
    const pending = await this.db.delivery_webhook_events.findMany({
      where: {
        order_id: orderId,
        effect_completed_at: null,
      },
      orderBy: { id: 'asc' },
    });
    for (const event of pending) {
      const lease = new Date(Date.now() + 60000);
      const claimed = await this.db.delivery_webhook_events.updateMany({
        where: {
          id: event.id,
          effect_completed_at: null,
          OR: [{ effect_lease_until: null }, { effect_lease_until: { lt: new Date() } }],
        },
        data: { effect_lease_until: lease },
      });
      if (!claimed.count) {
        const current = await this.db.delivery_webhook_events.findUnique({
          where: { id: event.id },
        });
        if (current?.effect_completed_at) continue;
        throw new AppError('배차 이벤트 후속 처리 중입니다. 다시 전송해 주세요.', 503);
      }
      try {
        const order = await this.db.orders.findUnique({ where: { id: orderId } });
        // Never replay an old ready transition over a completed/cancelled order.
        if (
          orderService &&
          ((event.effect_status === 'delivered' && order.status === 'completed') ||
            (event.effect_status === 'picked_up' && order.status === 'ready'))
        ) {
          await orderService.applyCommittedDeliveryEffects(orderId, order.status);
        }
        if (['canceled', 'failed'].includes(event.effect_status)) {
          await notificationService.createNotification({
            store_id: order.store_id,
            type: 'SYSTEM',
            title: '배달대행 배차가 취소되었어요',
            priority: 'high',
            message: `주문 #${order.order_number} 배차가 취소 또는 실패했어요${event.effect_reason ? ' (' + event.effect_reason + ')' : ''}. 다시 요청하거나 직접 배달해 주세요.`,
            link: `/admin/stores/${order.store_id}/orders`,
          });
        }
        await this.db.delivery_webhook_events.updateMany({
          where: { id: event.id, effect_lease_until: lease },
          data: {
            effect_completed_at: new Date(),
            effect_lease_until: null,
          },
        });
      } catch (error) {
        await this.db.delivery_webhook_events.update({
          where: { id: event.id },
          data: { effect_lease_until: null },
        });
        throw error;
      }
    }
  }

  // Order state and event acknowledgement must commit together. OrderService uses a
  // separate connection and sends external effects, so it cannot run inside this lock.
  async _applyToOrder(orderId, status, tx) {
    const order = await tx.orders.findUnique({ where: { id: orderId } });
    if (
      !order ||
      ['cancelled', 'completed'].includes(order.status) ||
      order.delivery_status === 'delivered'
    )
      return;
    const now = new Date();
    if (status === 'picked_up' && !order.delivery_status) {
      await tx.orders.update({
        where: { id: orderId },
        data: {
          status: 'ready',
          ready_at: order.ready_at || now,
          delivery_status: 'delivering',
          delivery_started_at: now,
          updated_at: now,
        },
      });
    } else if (status === 'delivered') {
      await tx.orders.update({
        where: { id: orderId },
        data: {
          status: 'completed',
          completed_at: now,
          delivery_status: 'delivered',
          delivered_at: now,
          updated_at: now,
        },
      });
    } else if (['canceled', 'failed'].includes(status)) {
      await tx.orders.update({
        where: { id: orderId },
        data: {
          delivery_status: null,
          delivery_started_at: null,
          updated_at: now,
        },
      });
    }
  }
}
module.exports = DeliveryDispatchService;
module.exports.toPublic = toPublic;
