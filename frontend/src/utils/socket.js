import { io } from 'socket.io-client';

const getSocketUrl = () => {
  const envUrl = import.meta.env.VITE_SOCKET_URL;
  if (envUrl) return envUrl;

  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'https://wemarket-toss.onrender.com';
  }

  return `${window.location.origin}`;
};


const SOCKET_URL = getSocketUrl();


const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
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
export const onNotification = (callback) => {
  socket.on('notification', callback);
  return () => socket.off('notification', callback);
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
