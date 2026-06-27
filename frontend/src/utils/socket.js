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
