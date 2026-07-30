import { useState, useEffect, useCallback } from 'react';
import { enqueueOperation, getPendingOperations, markAsSynced, markAsFailed, getSyncStats } from '@/lib/offlineQueue';
import { useOnlineStatus } from './usePWA';

export function useOfflineSync(storeId) {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState('idle');

  useEffect(() => {
    const checkPending = async () => {
      const stats = await getSyncStats();
      setPendingCount(stats.pending);
    };
    checkPending();
    const interval = setInterval(checkPending, 10000);
    return () => clearInterval(interval);
  }, []);

  const queueOperation = useCallback(async (operation) => {
    const entry = await enqueueOperation({
      ...operation,
      storeId,
    });
    setPendingCount(prev => prev + 1);
    return entry;
  }, [storeId]);

  const processQueue = useCallback(async () => {
    if (!isOnline || !storeId) return;

    setSyncStatus('syncing');
    const pending = await getPendingOperations(storeId);

    if (pending.length === 0) {
      setSyncStatus('idle');
      return;
    }

    const successIds = [];
    const failedIds = [];

    for (const entry of pending) {
      try {
        const response = await fetch('/api/offline-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });

        if (response.ok || response.status === 202) {
          successIds.push(entry.id);
        } else {
          failedIds.push(entry.id);
        }
      } catch {
        failedIds.push(entry.id);
      }
    }

    if (successIds.length > 0) {
      await markAsSynced(successIds);
      setPendingCount(prev => Math.max(0, prev - successIds.length));
    }

    if (failedIds.length > 0) {
      await markAsFailed(failedIds);
    }

    setSyncStatus('idle');
  }, [isOnline, storeId]);

  return {
    queueOperation,
    processQueue,
    pendingCount,
    syncStatus,
    isOnline,
  };
}

export default useOfflineSync;