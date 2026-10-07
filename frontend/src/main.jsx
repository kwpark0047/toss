import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './i18n';
import { wakeupServer } from './api/wakeup.js';
import { initWebVitals } from './utils/webVitals';
import { initSentry } from './lib/sentry.js';
import { recoverChunkLoad } from './lib/chunkRecovery.js';

window.addEventListener('vite:preloadError', () => {
  // Keep the error boundary available if recovery is offline or already attempted.
  void recoverChunkLoad();
});

const purgeServiceWorkerAndReload = async (reason) => {
  const flag = `wm-sw-purge:${reason}`;
  try {
    if (sessionStorage.getItem(flag) === '1') return;
    sessionStorage.setItem(flag, '1');
  } catch {
    // sessionStorage may be unavailable in privacy mode; still attempt recovery.
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }
  } catch (error) {
    console.warn('[SW] stale cache purge failed', error);
  } finally {
    const url = new URL(window.location.href);
    url.searchParams.set('_wm_cache_bust', String(Date.now()));
    window.location.replace(url.toString());
  }
};

const isRouterContextError = (error) => {
  const message = String(error?.message || error?.reason?.message || error || '');
  return message.includes('useLocation() may be used only') && message.includes('Router');
};

window.addEventListener('error', (event) => {
  if (isRouterContextError(event.error || event.message)) {
    event.preventDefault();
    purgeServiceWorkerAndReload('router-context');
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (isRouterContextError(event.reason)) {
    event.preventDefault();
    purgeServiceWorkerAndReload('router-context');
  }
});

// Sentry 에러 추적 (운영 환경에서만 지연 로드 — main chunk에서 제외)
initSentry();

// Render 콜드스타트 대비: 앱 로드 즉시 서버 웨이크업 (논블로킹)
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  void wakeupServer().catch(() => {});
}

// Web Vitals 모니터링 초기화 (개발 환경에서만 콘솔 출력, 운영환경은 비콘 전송 가능)
initWebVitals({
  onMetric: (metric) => {
    if (import.meta.env.DEV) {
      console.log(`[Web Vitals] ${metric.name}:`, metric.value, metric.rating);
    }
  }
});

// Service worker registration and user-approved updates are owned by usePWAUpdate.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
