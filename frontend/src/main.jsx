import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './i18n';
import { wakeupServer } from './api/wakeup.js';
import { initWebVitals } from './utils/webVitals';

// Render 콜드스타트 대비: 앱 로드 즉시 서버 웨이크업 (논블로킹)
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  wakeupServer();
}

// Web Vitals 모니터링 초기화 (개발 환경에서만 콘솔 출력, 운영환경은 비콘 전송 가능)
initWebVitals({
  onMetric: (metric) => {
    if (import.meta.env.DEV) {
      console.log(`[Web Vitals] ${metric.name}:`, metric.value, metric.rating);
    }
  }
});

// Service Worker 강제 업데이트
// iOS/Android PWA는 SW를 자동으로 갱신하지 않아 구 버전(navigateFallback: offline.html)이
// 계속 동작하며 어드민 경로를 offline.html로 서빙하는 버그 발생.
// 페이지 로드마다 update()를 호출해 최신 SW를 즉시 적용한다.
if ('serviceWorker' in navigator) {
  // 새 SW가 컨트롤러가 되면 즉시 새로고침
  let _swReloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!_swReloading) {
      _swReloading = true;
      window.location.reload();
    }
  });

  // 준비된 SW 등록 후 최신 버전 확인 요청
  navigator.serviceWorker.ready
    .then(registration => {
      registration.update();
      // waiting 상태인 새 SW가 있으면 즉시 활성화
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    })
    .catch(() => {});
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
