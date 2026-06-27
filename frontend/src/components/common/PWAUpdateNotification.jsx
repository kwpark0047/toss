import { RefreshCw } from 'lucide-react';
import { usePWAUpdate } from '@/hooks/usePWA';

export default function PWAUpdateNotification() {
  const { needRefresh, updateServiceWorker } = usePWAUpdate();

  if (!needRefresh) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-gray-900 border border-orange-500/40 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3">
        <RefreshCw size={18} className="text-orange-400 shrink-0 animate-spin" style={{ animationDuration: '3s' }} />
        <span className="text-white text-sm flex-1">새 버전이 있어요!</span>
        <button
          onClick={() => updateServiceWorker(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
        >
          업데이트
        </button>
      </div>
    </div>
  );
}
