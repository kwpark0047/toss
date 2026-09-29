/* global __BUILD_TIMESTAMP__ */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './i18n';
import { wakeupServer } from './api/wakeup.js';
import { initWebVitals } from './utils/webVitals';
import { initSentry } from './lib/sentry.js';

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

// Service Worker 강제 업데이트 + 스테일 캐시 감지
// 배포 후 구버전 청크가 로드되어 useLocation 등 라우터 훅 에러 발생 방지
if ('serviceWorker' in navigator) {
  let _swReloading = false;

  // 1) 새 SW가 컨트롤러가 되면 즉시 새로고침
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!_swReloading) {
      _swReloading = true;
      window.location.reload();
    }
  });

  // 2) 등록된 SW가 있으면 즉시 업데이트 체크 + skipWaiting
  navigator.serviceWorker.ready
    .then(registration => {
      registration.update();
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // 3) 주기적 업데이트 체크 (30초마다)
      setInterval(() => registration.update(), 30_000);

      // 4) 업데이트 발견 시 즉시 skipWaiting + 리로드
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
              window.location.reload();
            }
          });
        }
      });
    })
    .catch(() => {});

  // 5) 배포 버전 변경 감지: HTML의 build-timestamp와 비교해 스테일 캐시면 강제 리로드
  const BUILD_TIME = __BUILD_TIMESTAMP__; // vite define으로 빌드 시 주입
  fetch(window.location.href, { cache: 'no-store', headers: { 'Accept': 'text/html' } })
    .then(res => res.text())
    .then(html => {
      const match = html.match(/build-timestamp["\s:]+(\d+)/);
      if (match && match[1] !== BUILD_TIME) {
        console.log('[SW] Build timestamp mismatch — forcing reload');
        purgeServiceWorkerAndReload('build-timestamp');
      }
    })
    .catch(() => {});
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
