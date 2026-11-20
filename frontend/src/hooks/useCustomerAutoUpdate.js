import { useCallback, useEffect, useRef } from 'react';
import { isCustomerMenu, prepareCustomerUpdate } from '@/lib/customerUpdate';

export default function useCustomerAutoUpdate({ needRefresh, updateServiceWorker, registration, pathname, entryKey = pathname }) {
  const pendingReload = useRef(false);
  const activating = useRef(false);
  const finished = useRef(false);
  const manual = useRef(false);
  const engaged = useRef(false);
  const retryAfter = useRef(0);
  const customer = isCustomerMenu(pathname);
  const attempt = useCallback(() => {
    if (!customer || engaged.current || finished.current || navigator.onLine === false || !prepareCustomerUpdate()) return;
    if (pendingReload.current) {
      finished.current = true;
      window.location.reload();
    } else if (needRefresh && !activating.current && Date.now() >= retryAfter.current) {
      activating.current = true;
      if (registration?.waiting) registration.waiting.postMessage({ type: 'WM_SAFE_SKIP_WAITING' });
      else if (!registration) Promise.resolve(updateServiceWorker(true)).catch(() => { activating.current = false; });
      else activating.current = false;
    }
  }, [customer, needRefresh, updateServiceWorker, registration]);

  useEffect(() => {
    engaged.current = false;
    finished.current = false;
    activating.current = false;
    const freeze = () => { engaged.current = true; };
    for (const name of ['pointerdown', 'keydown', 'input', 'submit']) window.addEventListener(name, freeze, true);
    return () => {
      for (const name of ['pointerdown', 'keydown', 'input', 'submit']) window.removeEventListener(name, freeze, true);
    };
  }, [entryKey]);

  useEffect(() => {
    const receive = (event) => {
      if (event.data?.type === 'WM_MENU_CHECKPOINT') {
        event.ports[0]?.postMessage({ ready: customer && prepareCustomerUpdate() });
      } else if (event.data?.type === 'WM_MENU_UPDATE_DEFERRED') {
        activating.current = false;
        retryAfter.current = Date.now() + 15000;
      }
    };
    navigator.serviceWorker?.addEventListener('message', receive);
    return () => navigator.serviceWorker?.removeEventListener('message', receive);
  }, [customer]);

  useEffect(() => {
    if (!customer) return;
    // Let the cart mount and settle before activating. A busy checkout retries.
    const timer = setInterval(attempt, 2000);
    return () => clearInterval(timer);
  }, [customer, attempt]);

  useEffect(() => {
    if (!registration) return;
    const check = () => {
      if (customer && navigator.onLine !== false && document.visibilityState !== 'hidden') {
        void registration.update().catch(() => {});
      }
    };
    check();
    const timer = setInterval(check, customer ? 60000 : 3600000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('online', check);
    };
  }, [registration, customer]);

  const onNeedReload = useCallback(() => {
    // Another customer's tab may activate the shared root worker. Never force
    // an admin tab or an in-flight customer payment to reload with it.
    if (!customer) {
      if (manual.current) window.location.reload();
      return;
    }
    pendingReload.current = true;
    attempt();
  }, [customer, attempt]);
  const requestUpdate = useCallback((reloadPage = true) => {
    manual.current = true;
    if (!customer && registration && !registration.waiting && reloadPage) {
      window.location.reload();
      return Promise.resolve();
    }
    return updateServiceWorker(reloadPage);
  }, [customer, registration, updateServiceWorker]);
  return { autoUpdate: customer, onNeedReload, requestUpdate };
}
