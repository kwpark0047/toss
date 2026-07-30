const DB_NAME = 'wemarket-offline-queue';
const DB_VERSION = 2;
const STORE_NAME = 'operations';
const SYNC_STORE = 'sync_status';

let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('storeId', 'storeId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('operation', 'operation', { unique: false });
      }
      if (!db.objectStoreNames.contains(SYNC_STORE)) {
        db.createObjectStore(SYNC_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function enqueueOperation(operation) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const entry = {
      ...operation,
      createdAt: Date.now(),
      synced: false,
      attempts: 0,
      maxAttempts: 5,
    };

    const request = store.add(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingOperations(storeId = null) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    let request;
    if (storeId) {
      const index = store.index('storeId');
      request = index.getAll(storeId);
    } else {
      request = store.getAll();
    }

    request.onsuccess = () => {
      const all = request.result || [];
      const pending = all.filter(item => !item.synced && item.attempts < item.maxAttempts);
      resolve(pending);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function markAsSynced(ids) {
  if (!ids.length) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    ids.forEach(id => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (item) {
          item.synced = true;
          item.syncedAt = Date.now();
          store.put(item);
        }
      };
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function markAsFailed(ids) {
  if (!ids.length) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    ids.forEach(id => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (item) {
          item.attempts = (item.attempts || 0) + 1;
          item.lastFailedAt = Date.now();
          store.put(item);
        }
      };
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSyncStats() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result || [];
      resolve({
        total: all.length,
        pending: all.filter(i => !i.synced).length,
        synced: all.filter(i => i.synced).length,
        failed: all.filter(i => i.attempts >= i.maxAttempts).length,
      });
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearSynced() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearFailed() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('synced');

    const request = index.openCursor(IDBKeyRange.only(false));
    const deleteIds = [];

    request.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const item = cursor.value;
        if (item.attempts >= item.maxAttempts) {
          deleteIds.push(cursor.primaryKey);
        }
        cursor.continue();
      } else {
        // Delete all failed entries
        const tx2 = db.transaction(STORE_NAME, 'readwrite');
        const store2 = tx2.objectStore(STORE_NAME);
        Promise.all(deleteIds.map(id => store2.delete(id)))
          .then(() => resolve())
          .catch(() => reject());
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// 온라인/오프라인 감지 훅
let onlineStatus = typeof navigator !== 'undefined' ? navigator.onLine : true;

export function getOnlineStatus() {
  return onlineStatus;
}

export function listenOnlineStatus(callback) {
  const goOnline = () => { onlineStatus = true; callback(true); };
  const goOffline = () => { onlineStatus = false; callback(false); };

  window.addEventListener('online', goOnline);
  window.addEventListener('offline', goOffline);

  return () => {
    window.removeEventListener('online', goOnline);
    window.removeEventListener('offline', goOffline);
  };
}

export const PENDING_OPERATIONS_KEY = 'pended_sync_ids';
export const LAST_SYNC_KEY = 'last_pwa_sync_at';

export async function setLastSyncTime(storeId, timestamp) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE, 'readwrite');
    const store = tx.objectStore(SYNC_STORE);
    store.put({ key: `last_sync_${storeId}`, value: timestamp });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLastSyncTime(storeId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE, 'readonly');
    const store = tx.objectStore(SYNC_STORE);
    const request = store.get(`last_sync_${storeId}`);
    request.onsuccess = () => resolve(request.result?.value || null);
    request.onerror = () => reject(request.error);
  });
}