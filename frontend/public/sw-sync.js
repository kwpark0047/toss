/**
 * sw-sync.js — WeMarket PWA Offline Background Sync Service Worker Script
 * 
 * Workbox가 생성하는 sw.js 백그라운드 스레드 상에 importScripts로 동적 탑재됩니다.
 * 오프라인 상태에서 발생한 거래 내역(IndexedDB 버퍼)을 네트워크 복구 즉시
 * 청크 단위 배치 분할 전송(최대 5건) 및 지수 백오프(Exponential Backoff with Jitter)
 * 알고리즘을 활용하여 박대역폭/불안정 네트워크 환경에서도 유실 없이 재시도 동기화합니다.
 */

const MAX_SYNC_ATTEMPTS = 3;
const INITIAL_BACKOFF_DELAY_MS = 2000; // 초기 대기 2초
const BATCH_CHUNK_SIZE = 5; // 네트워크 폭주를 막기 위한 단일 전송 청크 한계치

self.addEventListener('sync', (event) => {
    if (event.tag === 'offline-order-sync' || event.tag === 'test-sync-event' || event.tag === 'offline-menu-sync' || event.tag === 'analytics-sync' || event.tag === 'pricing-opt-sync') {
        console.log('[K-SaaS PWA Sync] 백그라운드 동기화 이벤트 수신:', event.tag);
        event.waitUntil(syncOfflineOrdersWithBackoff());
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
 * 시간 지연 유틸 (Jitter 무작위 편차 결합)
 */
const sleepWithJitter = (ms) => {
    const jitter = Math.random() * 1000; // 1초 이내 무작위 편차 부여 (네트워크 충돌 방지)
    return new Promise(resolve => setTimeout(resolve, ms + jitter));
};

/**
 * 지수 백오프 기반 오프라인 거래 데이터 배치 전송 실행 엔진
 */
async function syncOfflineOrdersWithBackoff() {
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

    console.log(`[K-SaaS PWA Sync] 총 ${transactions.length}건의 오프라인 주문 동기화 개시... (청크 사이즈: ${BATCH_CHUNK_SIZE})`);

    // 매장 ID별로 트랜잭션 그룹화 (멀티테넌트 배치 전송 격리)
    const storeGroups = {};
    transactions.forEach(t => {
        const sid = t.store_id;
        if (!storeGroups[sid]) storeGroups[sid] = [];
        storeGroups[sid].push(t);
    });

    const successIds = [];

    // 매장 그룹별 순차적 동기화
    for (const [storeId, group] of Object.entries(storeGroups)) {
        // 네트워크 부담을 줄이기 위해 전송 목록을 BATCH_CHUNK_SIZE(5건) 크기로 청크 분할
        for (let i = 0; i < group.length; i += BATCH_CHUNK_SIZE) {
            const chunk = group.slice(i, i + BATCH_CHUNK_SIZE);
            let attempts = 0;
            let chunkSuccess = false;
            let backoffDelay = INITIAL_BACKOFF_DELAY_MS;

            while (attempts < MAX_SYNC_ATTEMPTS && !chunkSuccess) {
                try {
                    attempts++;
                    const response = await fetch(`/api/v1/foodtruck/stores/${storeId}/offline-sync`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-PWA-Sync': 'true',
                            'X-Sync-Attempt': String(attempts)
                        },
                        body: JSON.stringify({ offlineTransactions: chunk })
                    });

                    if (response.ok) {
                        const json = await response.json();
                        console.log(`[K-SaaS PWA Sync] 매장 #${storeId} 청크 동기화 성공 (시도 ${attempts}회):`, json.data || json);
                        chunk.forEach(t => successIds.push(t.id));
                        chunkSuccess = true;
                    } else {
                        throw new Error(`서버 응답 상태 이상: ${response.status}`);
                    }
                } catch (err) {
                    console.warn(`[K-SaaS PWA Sync] 매장 #${storeId} 청크 전송 실패 (시도 ${attempts}/${MAX_SYNC_ATTEMPTS}):`, err.message);
                    
                    if (attempts < MAX_SYNC_ATTEMPTS) {
                        console.log(`[K-SaaS PWA Sync] 지수 백오프 대기 가동: ${backoffDelay}ms 동안 대기 후 재시도...`);
                        await sleepWithJitter(backoffDelay);
                        backoffDelay *= 2; // 다음 시도는 대기 시간 2배 증가 (지수 백오프)
                    }
                }
            }
        }
    }

    // 성공한 내역들 로컬 IndexedDB 버퍼에서 영구 소거
    if (successIds.length > 0) {
        await clearSynchronizedTransactions(db, successIds);
        console.log(`[K-SaaS PWA Sync] 동기화 완료된 거래 ${successIds.length}건 로컬 버퍼 소거 완료 (중복 방지 완료)`);
    }
}
