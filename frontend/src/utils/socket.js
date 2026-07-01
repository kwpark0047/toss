import { io } from 'socket.io-client';

// 런타임 호스트네임 기반 소켓 URL (환경 변수 무시)
const getSocketUrl = () => {
  const hostname = window.location.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }

  return 'https://wemarket.onrender.com';
};


const SOCKET_URL = getSocketUrl();


const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

// 소켓 연결
export const connectSocket = (storeId, userId, role) => {
  if (!socket.connected) {
    socket.connect();
  }
  socket.emit('join-store', { storeId, userId, role });
};

// 소켓 연결 해제
export const disconnectSocket = () => {
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
  if (!socket.connected) {
    socket.connect();
  }
  socket.emit('join-kitchen', { storeId, userId });
};

export default socket;
