import { useState, useEffect, useCallback, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const LS_LAST_ONLINE = 'wm_last_online';
const PING_URL        = '/api/health';
const PING_INTERVAL   = 15_000; // 15 s when degraded
const PING_TIMEOUT    = 4_000;

/* ─── PWA Install prompt ─── */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstall, setCanInstall]         = useState(false);
  const [isInstalled, setIsInstalled]       = useState(() => typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); setCanInstall(true); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true); setCanInstall(false); setDeferredPrompt(null);
    });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null); setCanInstall(false);
    return outcome === 'accepted';
  }, [deferredPrompt]);

  return { canInstall, isInstalled, install };
}

/* ─── SW update detection ─── */
export function usePWAUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) setInterval(() => r.update(), 60 * 60 * 1000);
    },
    onRegisterError(error) {
      console.warn('[PWA] SW 등록 실패:', error);
    },
  });
  return { needRefresh, updateServiceWorker };
}

/* ─── Real connectivity check ─── */
async function pingServer() {
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), PING_TIMEOUT);
    await fetch(PING_URL, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
    clearTimeout(tid);
    return true;
  } catch (_) {
    return false;
  }
}

/* ─── Online status (navigator.onLine + real API ping) ─── */
export function useOnlineStatus() {
  const [isOnline,   setIsOnline]   = useState(navigator.onLine);
  // isVerified: API actually responded (not just navigator.onLine)
  const [isVerified, setIsVerified] = useState(false);
  const pingRef = useRef(null);

  const startPing = useCallback(() => {
    if (pingRef.current) return;
    pingRef.current = setInterval(async () => {
      const ok = await pingServer();
      setIsVerified(ok);
      if (ok) {
        setIsOnline(true);
        localStorage.setItem(LS_LAST_ONLINE, String(Date.now()));
      }
    }, PING_INTERVAL);
  }, []);

  const stopPing = useCallback(() => {
    clearInterval(pingRef.current);
    pingRef.current = null;
  }, []);

  useEffect(() => {
    const onOnline = async () => {
      setIsOnline(true);
      // Verify immediately, not just trust the browser event
      const ok = await pingServer();
      setIsVerified(ok);
      if (ok) {
        localStorage.setItem(LS_LAST_ONLINE, String(Date.now()));
        stopPing();
      } else {
        // Browser says online but API unreachable — keep pinging
        startPing();
      }
    };

    const onOffline = () => {
      setIsOnline(false);
      setIsVerified(false);
      startPing(); // begin polling for recovery
    };

    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);

    // Initial check
    if (!navigator.onLine) {
      Promise.resolve().then(() => setIsVerified(false));
      startPing();
    } else {
      pingServer().then(ok => {
        setIsVerified(ok);
        if (ok) localStorage.setItem(LS_LAST_ONLINE, String(Date.now()));
        else startPing(); // connected to network but API is down
      });
    }

    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
      stopPing();
    };
  }, [startPing, stopPing]);

  return { isOnline, isVerified };
}

/* ─── Network Information API ─── */
export function useConnectionInfo() {
  const getInfo = () => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return { type: null, effectiveType: null, downlink: null, rtt: null };
    return {
      type:          conn.type          ?? null,
      effectiveType: conn.effectiveType ?? null,
      downlink:      conn.downlink      ?? null,
      rtt:           conn.rtt           ?? null,
    };
  };

  const [info, setInfo] = useState(getInfo);

  useEffect(() => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return;
    const handler = () => setInfo(getInfo());
    conn.addEventListener('change', handler);
    return () => conn.removeEventListener('change', handler);
  }, []);

  return info;
}
