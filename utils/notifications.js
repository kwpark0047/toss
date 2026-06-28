const path = require('path');
const logger = require('../utils/logger');

/**
 * [알림 통합 유틸리티]
 * Firebase Cloud Messaging (FCM)을 통한 푸시 알림과 
 * Socket.IO를 통한 실시간 앱 내 알림을 결합하여 전송합니다.
 */

let messaging = null;
try {
  const admin = require('firebase-admin');
  if (admin.apps.length === 0) {
    // 환경 변수에 설정된 서비스 계정 키 경로를 사용하여 초기화합니다.
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (serviceAccountPath) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert(require(path.resolve(serviceAccountPath)))
        });
        console.log('[Notification] Firebase Admin SDK 초기화 완료');
      } catch (e) {
        logger.error('[Notification] Firebase 초기화 실패:', e.message || e);
      }
    }
  }
  messaging = admin.messaging();
} catch {
  logger.warn('[Notification] Firebase Admin SDK를 로드할 수 없습니다. 푸시 알림이 제한됩니다.');
}

/**
 * 1. FCM 푸시 알림 단일 전송 (공통 유틸)
 * @param {string} token - 대상 기기의 FCM 토큰
 * @param {Object} payload - 알림 내용 (title, body, data 등)
 */
async function sendFCMNotification(token, payload) {
  if (!messaging || !token) return;

  try {
    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      token: token
    };

    const response = await messaging.send(message);
    console.log('[FCM] 알림 발송 성공:', response);
  } catch (error) {
    logger.error(error);
  }
}

/**
 * 2. 주문 준비 완료 알림 발송
 * 고객에게는 푸시(FCM)를, 주방/매니저에게는 앱 내 실시간(Socket.IO) 알림을 보냅니다.
 * @param {Object} io - Socket.io 서버 인스턴스
 * @param {Object} order - 주문 정보 (ID, 주문번호 등)
 * @param {Object} tableAssignment - 테이블 점유/배정 정보
 * @param {string} customerToken - 고객의 FCM 토큰 (있는 경우 푸시 발송)
 */
async function sendOrderReadyNotification(io, order, tableAssignment, customerToken = null) {
  const title = '주문 준비 완료! 🍽️';
  const body = `주문하신 메뉴가 준비되었습니다. #${order.order_number || order.id}번 주문을 픽업해 주세요!`;

  const notification = {
    type: 'ORDER_READY',
    orderId: order.id,
    orderNumber: order.order_number,
    tableId: order.table_id,
    storeId: order.store_id,
    message: body,
    timestamp: new Date().toISOString()
  };

  // [실시간] 특정 주문 룸과 해당 매장 룸에 각각 알림 발송
  io.to(`order-${order.id}`).emit('notification', { ...notification, target: 'customer' });
  io.to(`store-${order.store_id}`).emit('notification', { ...notification, target: 'manager' });

  // [푸시] 고객의 FCM 토큰이 있다면 백그라운드 푸시 전송
  if (customerToken) {
    await sendFCMNotification(customerToken, { title, body, data: { orderId: String(order.id) } });
  }
}

/**
 * 3. 새 주문 접수 알림 발송
 * 매장 관리자와 주방 담당자에게 실시간 알림과 푸시를 보냅니다.
 * @param {Object} io - Socket.io 서버 인스턴스
 * @param {Object} order - 신규 주문 정보
 * @param {string[]} managerTokens - 매니저들의 FCM 토큰 배열
 */
async function sendNewOrderNotification(io, order, managerTokens = []) {
  const title = '🔔 새 주문 접수!';
  const body = `[${order.table_name || '포장'}] 새 주문이 들어왔습니다. (${(order.total_amount || 0).toLocaleString()}원)`;

  const notification = {
    type: 'NEW_ORDER',
    orderId: order.id,
    orderNumber: order.order_number,
    tableId: order.table_id,
    tableName: order.table_name,
    storeId: order.store_id,
    totalAmount: order.total_amount,
    message: body,
    timestamp: new Date().toISOString()
  };

  // [실시간] 매장 룸과 주방 룸에 주문 발생 사실 전파
  io.to(`store-${order.store_id}`).emit('notification', { ...notification, target: 'store' });
  io.to(`kitchen-${order.store_id}`).emit('notification', { ...notification, target: 'kitchen' });

  // [푸시] 등록된 모든 매니저 기기에 푸시 알림 전송 (병렬 처리로 성능 최적화)
  if (managerTokens && managerTokens.length > 0) {
    await Promise.all(managerTokens.map(token =>
      sendFCMNotification(token, { title, body, data: { orderId: String(order.id) } })
    ));
  }
}

/**
 * 4. 카카오 알림톡 발송 (Placeholder/Mock)
 * 실제 서비스 시 알림톡 API(예: 비즈톡, 솔라피 등) 연동이 필요합니다.
 */
async function sendAlimTalk(phone, templateCode, _data) {
  if (!phone) return;

  console.log(`[AlimTalk] 발송 준비 - 대상: ${phone}, 템플릿: ${templateCode}`);
  // 실제 API 호출 로직이 들어갈 자리
  // const res = await bizmAPI.send({ phone, templateCode, data });
  console.log(`[AlimTalk] 발송 가상 성공: ${templateCode} 메시지가 ${phone}번으로 전송되었습니다.`);
  return true;
}

/**
 * 5. 정산 완료 알림
 * 점주에게 정산이 완료되었음을 푸시와 알림톡으로 알립니다.
 */
async function sendSettlementNotification(io, store, settlement, managerTokens = []) {
  const title = '💰 정산 완료 안내';
  const body = `${store.name}의 ${settlement.period_start}~${settlement.period_end} 정산이 완료되었습니다.`;

  // [실시간]
  if (io) {
    io.to(`store-${store.id}`).emit('notification', {
      type: 'SETTLEMENT_COMPLETED',
      storeId: store.id,
      amount: settlement.net_amount,
      message: body,
      timestamp: new Date().toISOString()
    });
  }

  // [푸시]
  if (managerTokens && managerTokens.length > 0) {
    for (const token of managerTokens) {
      await sendFCMNotification(token, { title, body, data: { type: 'SETTLEMENT' } });
    }
  }

  // [알림톡] 점주 연락처가 있는 경우
  if (store.owner_phone) {
    await sendAlimTalk(store.owner_phone, 'SETTLEMENT_INFO', {
      storeName: store.name,
      amount: settlement.net_amount,
      period: `${settlement.period_start}~${settlement.period_end}`
    });
  }
}

/**
 * 6. 주문 상세 상태 변경 알림 (확장)
 * (예: 대기중 -> 확인됨 -> 조리중 -> 취소됨 등)
 */
async function sendOrderStatusNotification(io, order, oldStatus, newStatus, customerToken = null) {
  const statusLabels = {
    pending: '대기중',
    confirmed: '주문확인',
    preparing: '조리중',
    ready: '준비완료',
    completed: '완료',
    cancelled: '취소'
  };

  const label = statusLabels[newStatus] || newStatus;
  const message = `고객님의 주문이 "${label}" 상태로 변경되었습니다.`;

  const notification = {
    type: 'ORDER_STATUS_CHANGED',
    orderId: order.id,
    orderNumber: order.order_number,
    newStatus,
    message,
    timestamp: new Date().toISOString()
  };

  // [실시간] 특정 주문 조회 중인 고객에게 전송
  if (io) {
    io.to(`order-${order.id}`).emit('notification', { ...notification, target: 'customer' });
  }

  // [푸시] 중요 상태 변화일 경우 고객에게 푸시 알림 전송
  if (customerToken && ['confirmed', 'preparing', 'cancelled'].includes(newStatus)) {
    await sendFCMNotification(customerToken, {
      title: '주문 상태 업데이트',
      body: message,
      data: { orderId: String(order.id), status: newStatus }
    });
  }

  // [알림톡] 주문 취소 등 중요한 경우 알림톡 발송
  if (order.customer_phone && newStatus === 'cancelled') {
    await sendAlimTalk(order.customer_phone, 'ORDER_CANCELLED', {
      orderNumber: order.order_number,
      reason: '매장 사정 또는 재고 소진'
    });
  }
}

/**
 * 7. 예약 상태 변경 알림
 * 관리자가 소규모 승인/거절, 혹은 노쇼 처리 시 고객에게 전송
 */
async function sendReservationNotification(reservation, newStatus) {
  if (!reservation.customer_phone) return;

  const statusToTemplate = {
    CONFIRMED: 'RESERVATION_CONFIRMED',
    REJECTED: 'RESERVATION_REJECTED',
    NOSHOW: 'RESERVATION_NOSHOW',
    CANCELED: 'RESERVATION_CANCELED'
  };

  const templateCode = statusToTemplate[newStatus];
  if (!templateCode) return;

  const dateStr = new Date(reservation.reservation_time).toLocaleString('ko-KR', {
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  await sendAlimTalk(reservation.customer_phone, templateCode, {
    customerName: reservation.customer_name,
    partySize: reservation.party_size,
    reservationTime: dateStr
  });
}

module.exports = {
  sendOrderReadyNotification,
  sendNewOrderNotification,
  sendOrderStatusNotification,
  sendSettlementNotification,
  sendAlimTalk,
  sendReservationNotification
};
