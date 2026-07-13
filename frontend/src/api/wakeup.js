import { API_URL } from './client';

/**
 * Render 콜드스타트 웨이크업: 서버가 슬립 상태일 때 깨울 때까지 폴링.
 * 최대 60초, 3초 간격으로 /api/health를 호출하여 서버가 준비되면 resolve.
 */
let _wakeupPromise = null;
export const wakeupServer = () => {
  if (_wakeupPromise) return _wakeupPromise;
  const baseUrl = API_URL.replace('/api', '');
  const MAX_WAIT_MS = 60_000;
  const POLL_MS = 3_000;
  const startedAt = Date.now();

  _wakeupPromise = (async () => {
    while (Date.now() - startedAt < MAX_WAIT_MS) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 5_000);
        const resp = await fetch(`${baseUrl}/api/health`, { method: 'GET', mode: 'cors', signal: ctrl.signal });
        clearTimeout(tid);
        if (resp.ok) return;
      } catch {
        // 서버 응답 없음 — 슬립 상태 유지
      }
      await new Promise(r => setTimeout(r, POLL_MS));
    }
    throw new Error('서버 웨이크업 시간 초과 (60s)');
  })().finally(() => { _wakeupPromise = null; });

  return _wakeupPromise;
};

// 프로덕션에서 모듈 로드 즉시 서버 웨이크업 시작 (트리 쉐이킹 가능하도록 분리)
if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  wakeupServer().catch(() => {});
}
