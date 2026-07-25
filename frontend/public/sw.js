/**
 * [Service Worker - 기본 설정]
 * 현재는 등록 시 404 에러 방지 및 기본 설치/활성화 로직만 포함되어 있습니다.
 * 추후 FCM 푸시 알림 수신 로직이 여기에 추가될 예정입니다.
 */

// 1. 서비스 워커 설치 이벤트 (새 버전 즉시 적용)
self.addEventListener('install', () => {
    self.skipWaiting();
});

// 2. 서비스 워커 활성화 이벤트 (제어권 즉시 획득)
self.addEventListener('activate', () => {
    return self.clients.claim();
});
