import { WifiOff, Wifi } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/usePWA';
import { useState, useEffect } from 'react';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [showRestored, setShowRestored] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      // 오프라인이었다가 복구됨 — "연결 복구" 메시지 잠깐 표시
      setShowRestored(true);
      const t = setTimeout(() => {
        setShowRestored(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [isOnline, wasOffline]);

  if (isOnline && !showRestored) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9998] flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium transition-all duration-300 ${
        isOnline
          ? 'bg-green-600 text-white'
          : 'bg-red-600 text-white'
      }`}
    >
      {isOnline ? (
        <>
          <Wifi size={15} />
          인터넷 연결이 복구되었습니다
        </>
      ) : (
        <>
          <WifiOff size={15} />
          오프라인 상태입니다 — 일부 기능이 제한될 수 있어요
        </>
      )}
    </div>
  );
}
