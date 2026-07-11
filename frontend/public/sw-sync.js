/**
 * sw-sync.js — WeMarket PWA Offline Background Sync Service Worker Script
 * 
 * Workbox가 생성하는 sw.js 백그라운드 스레드 상에 importScripts로 동적 탑재됩니다.
 * 오프라인 상태에서 발생한 거래 내역(IndexedDB 버퍼)을 네트워크 복구 즉시
 * 원자적 배치 싱크(/api/v1/foodtruck/stores/:storeId/offline-sync)로 전송합니다.
 */

self.addEventListener('sync', (event) => {
    if (event.tag === 'offline-order-sync' || event.tag === 'test-sync-event') {
        console.log('[K-SaaS PWA Sync] 백그라운드 동기화 이벤트 수신:', event.tag);
        event.waitUntil(syncOfflineOrders());
    }
});

/**
 * IndexedDB 데이터베이스 로드 프로미스
 */
function openOfflineDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('wemarket-offline-db', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('transactions')) {
                db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

/**
 * 버퍼에 저장된 모든 오프라인 거래 내역 로드
 */
function getBufferedTransactions(db) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('transactions', 'readonly');
        const store = tx.objectStore('transactions');
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

/**
 * 동기화 완료된 거래 목록 IndexedDB에서 삭제 (멱등 가드)
 */
function clearSynchronizedTransactions(db, ids) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('transactions', 'readwrite');
        const store = tx.objectStore('transactions');
        ids.forEach(id => {
            store.delete(id);
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * 오프라인 거래 내역을 백엔드로 원자적 일괄 전송
 */
async function syncOfflineOrders() {
    let db;
    try {
        db = await openOfflineDb();
    } catch (err) {
        console.error('[K-SaaS PWA Sync] IndexedDB 연결 실패:', err);
        return;
    }

    const transactions = await getBufferedTransactions(db);
    if (transactions.length === 0) {
        console.log('[K-SaaS PWA Sync] 동기화할 오프라인 임시 버퍼 주문이 없습니다.');
        return;
    }

    console.log(`[K-SaaS PWA Sync] 총 ${transactions.length}건의 오프라인 주문 동기화 개시...`);

    // 매장 ID별로 트랜잭션 그룹화 (멀티테넌트 배치 전송 격리)
    const storeGroups = {};
    transactions.forEach(t => {
        const sid = t.store_id;
        if (!storeGroups[sid]) storeGroups[sid] = [];
        storeGroups[sid].push(t);
    });

    const successIds = [];

    for (const [storeId, group] of Object.entries(storeGroups)) {
        try {
            // 원자적 오프라인 동기화 배치 API 전송
            const response = await fetch(`/api/v1/foodtruck/stores/${storeId}/offline-sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-PWA-Sync': 'true'
                },
                body: JSON.stringify({ offlineTransactions: group })
            });

            if (response.ok) {
                const json = await response.json();
                console.log(`[K-SaaS PWA Sync] 매장 #${storeId} 배치 동기화 완료:`, json.data || json);
                // 성공한 거래 ID들 수집
                group.forEach(t => successIds.push(t.id));
            } else {
                console.warn(`[K-SaaS PWA Sync] 매장 #${storeId} 배치 동기화 거부 (네트워크 재시도 예정): Status ${response.status}`);
            }
        } catch (err) {
            console.error(`[K-SaaS PWA Sync] 매장 #${storeId} 동기화 통신 장애:`, err.message);
        }
    }

    // 성공한 내역들 로컬 IndexedDB 버퍼에서 영구 소거
    if (successIds.length > 0) {
        await clearSynchronizedTransactions(db, successIds);
        console.log(`[K-SaaS PWA Sync] 동기화 완료된 거래 ${successIds.length}건 로컬 버퍼 소거 완료 (중복 방지 완료)`);
    }
}
