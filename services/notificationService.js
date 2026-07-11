const admin = require('firebase-admin');
const path = require('path');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const { resolveTemplate } = require('../utils/notificationTemplate');

/**
 * [NotificationService]
 * 시스템 전반의 알림(Socket.io, FCM, 알림톡)을 통합 관리하는 서비스 클래스입니다.
 * 싱글톤 패턴으로 구현되어 전역에서 동일한 인스턴스를 사용합니다.
 */
class NotificationService {
  constructor() {
    this.messaging = null;
    this.io = null;
    this.isInitialized = false;
  }

  /**
   * Firebase SDK 및 관리 도구 초기화
   */
  init(ioInstance) {
    if (this.isInitialized) return;

    this.io = ioInstance;

    try {
      if (admin.apps.length === 0) {
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
        if (serviceAccountPath) {
          admin.initializeApp({
            credential: admin.credential.cert(require(path.resolve(serviceAccountPath)))
          });
          logger.info('[Notification] Firebase Admin SDK 초기화 완료');
        }
      }
      this.messaging = admin.messaging();
    } catch (error) {
      logger.warn('[Notification] Firebase 로드 실패 (푸시 발송 제한):', error.message);
    }

    this.isInitialized = true;
  }

  /**
   * FCM 푸시 알림 발송 (Low-level)
   */
  async sendPush(token, { title, body, data = {} }) {
    if (!this.messaging || !token) return false;
    try {
      const message = {
        notification: { title, body },
        data: Object.entries(data).reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {}),
        token
      };
      await this.messaging.send(message);
      return true;
    } catch (error) {
      logger.error('[FCM] 발송 실패:', error.message);
      return false;
    }
  }

  /**
   * 실시간 소켓 알림 발송 (Low-level)
   */
  sendSocket(room, event, payload) {
    if (!this.io) return false;
    this.io.to(room).emit(event, payload);
    return true;
  }

  /**
   * 주문 상태 변경 통합 알림
   * 상황에 따라 소켓과 푸시를 동시에 처리합니다.
   */
  async notifyOrderStatus(order, newStatus, customerToken = null) {
    let title = '주문 상태 업데이트 🔔';
    let body = `주문 #${order.order_number || order.id}번이 "${this._getStatusLabel(newStatus)}" 상태로 변경되었습니다.`;

    // 조리 취소/반려 상황 시 20대 타겟의 직관적이고 친절한 한국어 문구 커스텀화
    if (newStatus === 'cancelled' || newStatus === 'cancelled_by_kds') {
      title = '주문 취소/반려 안내 ❌';
      body = `정말 죄송합니다. 매장 사정으로 주문 #${order.order_number || order.id}번이 취소되었습니다. 결제 수단으로 즉시 환불 처리됩니다.`;
    }

    const payload = {
      type: 'ORDER_STATUS',
      orderId: order.id,
      status: newStatus,
      message: body,
      timestamp: new Date().toISOString()
    };

    // 1. 소켓 발송
    this.sendSocket(`order - ${order.id}`, 'notification', { ...payload, target: 'customer' });

    // 2. 푸시 발송 (기존의 토큰 파라미터가 비어 있으면 데이터베이스 내 고객 fcm_token으로 백그라운드 자동 폴백 연동)
    const token = customerToken || order.customer_fcm_token;
    if (token && ['confirmed', 'ready', 'cancelled'].includes(newStatus)) {
      await this.sendPush(token, { title, body, data: payload });
    }

    // 3. 주방/매장 실시간 알림
    this.sendSocket(`store - ${order.store_id}`, 'notification', { ...payload, target: 'manager' });
  }

  /**
   * 새 주문 발생 알림
   */
  async notifyNewOrder(order, managerTokens = []) {
    const title = '🚀 새 주문 접수!';
    const body = `${order.table_name || '포장'}에서 새 주문이 들어왔습니다.`;

    const payload = {
      type: 'NEW_ORDER',
      orderId: order.id,
      storeId: order.store_id,
      message: body,
      timestamp: new Date().toISOString()
    };

    // 매장/주방 실시간 공유
    this.sendSocket(`store - ${order.store_id}`, 'notification', { ...payload, target: 'store' });
    this.sendSocket(`kitchen - ${order.store_id}`, 'notification', { ...payload, target: 'kitchen' });

    // 관리자 푸시
    if (managerTokens.length > 0) {
      for (const token of managerTokens) {
        this.sendPush(token, { title, body, data: payload });
      }
    }
  }

  /**
   * DB에 알림 레코드 저장 + Socket.IO 실시간 전송
   * 모든 알림 생성은 이 메서드를 통해 일원화
   */
  async createNotification({ store_id, type, title, message, data = null, priority = 'normal', link = null }) {
    try {
      const record = await prisma.notifications.create({
        data: {
          store_id: Number(store_id),
          type,
          title,
          message,
          data: data ? JSON.stringify(data) : null,
          priority,
          link
        }
      });
      // 매장 소켓 룸으로 실시간 전송
      this.sendSocket(`store - ${store_id}`, 'notification', {
        ...record,
        data: data,
        receivedAt: record.created_at.toISOString()
      });
      return record;
    } catch (err) {
      logger.error('[Notification] DB 저장 실패:', err.message);
      return null;
    }
  }

  /** 주문 생성 시 NEW_ORDER 알림 (관리자 커스텀 템플릿 우선 적용) */
  async notifyNewOrderDB(order) {
    const tableName = order.table_name || '테이블';
    const orderNumber = order.order_number || order.id;
    const tpl = await resolveTemplate(order.store_id, 'NEW_ORDER', {
      tableName, orderNumber, storeId: order.store_id,
    });
    return this.createNotification({
      store_id: order.store_id,
      type: 'NEW_ORDER',
      title: tpl?.title || '🛎️ 새 주문 접수',
      message: tpl?.message || `${tableName}에서 주문이 들어왔습니다. (주문번호: ${orderNumber})`,
      data: { orderId: order.id, orderNumber: order.order_number, tableId: order.table_id },
      priority: 'high',
      link: `/admin/stores/${order.store_id}/orders`
    });
  }

  /** 주문 상태 변경 시 알림 (관리자 커스텀 템플릿 우선 적용) */
  async notifyOrderStatusDB(order, newStatus) {
    const labels = { confirmed: '주문 확인', preparing: '조리 시작', ready: '준비 완료', completed: '완료', cancelled: '취소됨' };
    const icons = { confirmed: '✅', preparing: '👨‍🍳', ready: '🔔', completed: '🎉', cancelled: '❌' };
    const priorities = { ready: 'high', cancelled: 'high', confirmed: 'normal', preparing: 'normal', completed: 'low' };
    const statusLabel = labels[newStatus] || newStatus;
    const orderNumber = order.order_number || order.id;
    const tpl = await resolveTemplate(order.store_id, 'ORDER_STATUS', {
      orderNumber, status: statusLabel, tableName: order.table_name || '테이블',
    });
    return this.createNotification({
      store_id: order.store_id,
      type: 'ORDER_STATUS',
      title: tpl?.title || `${icons[newStatus] || '📦'} 주문 ${statusLabel}`,
      message: tpl?.message || `주문 #${orderNumber} 상태가 "${statusLabel}"(으)로 변경되었습니다.`,
      data: { orderId: order.id, newStatus },
      priority: priorities[newStatus] || 'normal',
      link: `/admin/stores/${order.store_id}/orders`
    });
  }

  /** 재고 부족 알림 (DB + 소켓 + 사장님 FCM 푸시) */
  async notifyLowStockDB(product) {
    const record = await this.createNotification({
      store_id: product.store_id,
      type: 'LOW_STOCK',
      title: '⚠️ 재고 부족 경고',
      message: `"${product.name}" 재고가 ${product.stock_quantity}개 남았습니다. 재고를 보충해주세요.`,
      data: { productId: product.id, stock: product.stock_quantity, threshold: product.low_stock_threshold },
      priority: 'urgent',
      link: `/admin/stores/${product.store_id}/menu`
    });

    // 매장 소유주에게 FCM 푸시 (앱 미접속 상태에서도 즉시 인지)
    try {
      const store = await prisma.stores.findUnique({
        where: { id: Number(product.store_id) },
        select: { user_id: true, name: true },
      });
      if (store?.user_id) {
        const owner = await prisma.users.findUnique({
          where: { id: store.user_id },
          select: { fcm_token: true },
        });
        if (owner?.fcm_token) {
          await this.sendPush(owner.fcm_token, {
            title: `⚠️ [${store.name}] 재고 부족`,
            body: `"${product.name}" 재고 ${product.stock_quantity}개 남음`,
            data: { type: 'LOW_STOCK', store_id: product.store_id, product_id: product.id },
          });
        }
      }
    } catch (err) {
      logger.warn(`[LOW_STOCK 푸시] store ${product.store_id} 발송 실패: ${err.message}`);
    }

    return record;
  }

  /** 새 예약 알림 */
  async notifyNewReservationDB(reservation) {
    return this.createNotification({
      store_id: reservation.store_id,
      type: 'NEW_RESERVATION',
      title: '📅 새 예약 신청',
      message: `${reservation.customer_name}(${reservation.party_size}명) — ${new Date(reservation.reservation_time).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 예약`,
      data: { reservationId: reservation.id },
      priority: 'normal',
      link: `/admin/stores/${reservation.store_id}/reservations`
    });
  }

  /** 새 리뷰 알림 */
  async notifyNewReviewDB(review) {
    const stars = '⭐'.repeat(review.rating || 0);
    return this.createNotification({
      store_id: review.store_id,
      type: 'NEW_REVIEW',
      title: '💬 새 리뷰 등록',
      message: `${stars} ${review.rating}점 — "${(review.content || '').slice(0, 40)}${review.content?.length > 40 ? '…' : ''}"`,
      data: { reviewId: review.id, rating: review.rating },
      priority: 'low',
      link: `/admin/stores/${review.store_id}/reviews`
    });
  }

  /** 매니저 호출 알림 */
  async notifyManagerCallDB(storeId, tableName, callType) {
    return this.createNotification({
      store_id: storeId,
      type: 'MANAGER_CALL',
      title: '🙋 매니저 호출',
      message: `${tableName || '고객'}님이 ${callType === 'help' ? '도움' : callType === 'bill' ? '계산' : '매니저'}을 요청했습니다.`,
      data: { tableName, callType },
      priority: 'urgent',
      link: null
    });
  }

  /** 정산 생성 알림 */
  async notifySettlementDB(settlement) {
    return this.createNotification({
      store_id: settlement.store_id,
      type: 'SETTLEMENT',
      title: '💰 정산 보고서 생성',
      message: `정산 완료 — 순수익 ₩${Number(settlement.net_amount || 0).toLocaleString('ko-KR')}`,
      data: { settlementId: settlement.id },
      priority: 'normal',
      link: `/admin/stores/${settlement.store_id}/settlements`
    });
  }

  _getStatusLabel(status) {
    const labels = {
      pending: '대기중',
      confirmed: '주문확인',
      preparing: '조리중',
      ready: '준비완료',
      completed: '완료',
      cancelled: '취소'
    };
    return labels[status] || status;
  }
}

module.exports = new NotificationService();
