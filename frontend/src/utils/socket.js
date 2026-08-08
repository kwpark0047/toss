import { io } from 'socket.io-client';

const getSocketUrl = () => {
  const envUrl = import.meta.env.VITE_SOCKET_URL;
  if (envUrl) return envUrl;

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (isLocalhost) {
    return 'http://localhost:3000';
  }

  return `${window.location.origin}`;
};

const SOCKET_URL = getSocketUrl();

const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  auth: (callback) => callback({ token: localStorage.getItem('token') || undefined }),
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

// 재접속 시 자동으로 재구독할 파라미터 저장
let _storeJoinParams = null;
let _kitchenJoinParams = null;

// 소켓 (재)연결 때마다 룸 재구독 — 자동 재접속 후 룸 소실 방지
socket.on('connect', () => {
  if (_storeJoinParams) {
    socket.emit('join-store', _storeJoinParams);
  }
  if (_kitchenJoinParams) {
    socket.emit('join-kitchen', _kitchenJoinParams);
  }
});

/* ── 실시간 대시보드 (DashboardBroadcastService 연동) ──────────────── */
// 재접속 시 대시보드 룸 자동 재구독
let _dashboardJoinParams = null;

socket.on('connect', () => {
  if (_dashboardJoinParams) {
    socket.emit('join-dashboard', _dashboardJoinParams);
  }
});

// 대시보드 룸 구독 (store_${storeId}_dashboard)
export const joinDashboard = (storeId) => {
  _dashboardJoinParams = { storeId };
  if (!socket.connected) {
    socket.connect();
  } else {
    socket.emit('join-dashboard', { storeId });
  }
};

// 대시보드 구독 해제
export const leaveDashboard = () => {
  _dashboardJoinParams = null;
  if (socket.connected) {
    socket.emit('leave-dashboard');
  }
};

// 대시보드: 주문 상태 변경 실시간 수신 (DashboardBroadcastService.notifyOrderChange)
export const onDashboardOrderStatusChanged = (callback) => {
  socket.on('order_status_changed', callback);
  return () => socket.off('order_status_changed', callback);
};

// 대시보드: 수요 예측 업데이트 실시간 수신 (DashboardBroadcastService.notifyForecastUpdate)
export const onDashboardForecastUpdate = (callback) => {
  socket.on('forecast_updated', callback);
  return () => socket.off('forecast_updated', callback);
};

/** 소켓 연결이 끊어졌으면 재연결, 연결되어 있으면 직접 emit */
const ensureOrEmit = (eventName, params) => {
  if (!socket.connected) {
    socket.connect(); // connect 이벤트 핸들러가 _storeJoinParams / _kitchenJoinParams 기반으로 자동 재구독
  } else {
    socket.emit(eventName, params);
  }
};

// 소켓 연결 + 스토어 룸 구독
export const connectSocket = (storeId, userId, role) => {
  _storeJoinParams = { storeId, userId, role };
  ensureOrEmit('join-store', { storeId, userId, role });
};

// 소켓 연결 해제
export const disconnectSocket = () => {
  _storeJoinParams = null;
  _kitchenJoinParams = null;
  socket.disconnect();
};

// 알림 이벤트 리스너 등록
// 서버 handlers.js가 실시간 알림을 `manager-notification`으로만 emit하므로,
// 과거 `notification` 이벤트명을 사용하던 구독을 실제 이벤트명으로 맞춘다.
export const onNotification = (callback) => {
  socket.on('manager-notification', callback);
  return () => socket.off('manager-notification', callback);
};

// 새 주문 이벤트 리스너 등록 (어드민 실시간 주문 갱신용)
export const onNewOrder = (callback) => {
  socket.on('new-order', callback);
  return () => socket.off('new-order', callback);
};

// 주문 상태 변경 이벤트 리스너 (어드민·주방·고객 공통)
export const onOrderUpdated = (callback) => {
  socket.on('order-updated', callback);
  return () => socket.off('order-updated', callback);
};

// 특정 주문 룸 구독 (고객 OrderStatusModal — join-order)
export const joinOrderRoom = (orderId) => {
  if (!socket.connected) socket.connect();
  socket.emit('join-order', orderId);
};

// 전화번호 기반 고객 알림 채널 구독
export const joinCustomerOrders = (phone) => {
  if (!socket.connected) socket.connect();
  const normalized = String(phone).replace(/[^0-9]/g, '');
  socket.emit('join-customer-orders', { phone: normalized });
};

// 연결 상태 이벤트
export const onConnect = (callback) => {
  socket.on('connect', callback);
  return () => socket.off('connect', callback);
};

export const onDisconnect = (callback) => {
  socket.on('disconnect', callback);
  return () => socket.off('disconnect', callback);
};

// 연결 상태 확인
export const isConnected = () => socket.connected;

// 소켓 인스턴스 반환
export const getSocket = () => socket;

// 주방 소켓 연결
export const connectKitchen = (storeId, userId) => {
  _kitchenJoinParams = { storeId, userId };
  ensureOrEmit('join-kitchen', { storeId, userId });
};

export default socket;
