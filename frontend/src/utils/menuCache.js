/**
 * menuCache.js — 고객 메뉴판 오프라인 캐싱 (F2)
 *
 * API가 SW에서 NetworkOnly(콜드스타트 버그 회피)이므로, 메뉴 데이터는 앱
 * 레벨에서 IndexedDB에 캐싱한다. 네트워크 성공 시 저장하고, 실패(오프라인)
 * 시 캐시로 폴백해 메뉴 브라우징을 지속 가능하게 한다.
 *
 * 무의존 raw IndexedDB. store: 'menu', key: `${storeId}:${type}`.
 */
const DB_NAME = 'wemarket-menu-cache';
const STORE = 'menu';
const VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no-idb'));
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 캐시 저장 (실패해도 조용히 무시 — 캐싱은 부가 기능) */
export async function saveCache(storeId, type, data) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ data, cachedAt: Date.now() }, `${storeId}:${type}`);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* 캐싱 실패는 무시 */ }
}

/** 캐시 로드. 반환 { data, cachedAt } 또는 null */
export async function loadCache(storeId, type) {
  try {
    const db = await openDB();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(`${storeId}:${type}`);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch { return null; }
}

/**
 * 네트워크 우선 + 오프라인 폴백 래퍼 (타임아웃 레이스).
 *
 * 앱 axios 인터셉터는 네트워크 실패 시 wakeupServer + 재시도로 reject가 수십 초
 * 지연된다. 따라서 캐시가 있으면 네트워크를 timeoutMs까지만 기다리고, 응답이
 * 없으면 즉시 캐시로 폴백한다(오프라인·콜드스타트 모두 빠른 메뉴 브라우징).
 * 빠른 온라인 응답은 그대로 최신 데이터를 반환한다. 네트워크는 백그라운드로
 * 계속 진행해 캐시를 갱신한다.
 *
 * @param {string|number} storeId
 * @param {string} type   캐시 키 종류 (profile|categories|menu)
 * @param {Function} fetcher 네트워크 fetch 함수 (성공 시 데이터 반환)
 * @param {Function} [onFallback] 캐시 폴백 시 콜백(cachedAt)
 * @param {{timeoutMs?: number}} [opts]
 */
export async function withOfflineCache(storeId, type, fetcher, onFallback, { timeoutMs = 4000 } = {}) {
  const cached = await loadCache(storeId, type);
  const network = (async () => {
    const fresh = await fetcher();
    saveCache(storeId, type, fresh); // 성공 시 캐시 갱신 (백그라운드여도 실행)
    return fresh;
  })();

  // 캐시가 없으면 네트워크 결과에 그대로 의존 (성공/실패 전파)
  if (!cached) return network;

  // 캐시가 있으면 네트워크 vs 타임아웃 레이스
  return await new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    network
      .then((fresh) => done(fresh)) // 빠른 응답 → 최신 데이터
      .catch(() => { onFallback?.(cached.cachedAt); done(cached.data); }); // 실패 → 캐시
    setTimeout(() => {
      // 타임아웃: 캐시 표시. 오프라인일 때만 배너(느린 온라인은 배너 없이 캐시)
      if (!navigator.onLine) onFallback?.(cached.cachedAt);
      done(cached.data);
    }, timeoutMs);
  });
}
