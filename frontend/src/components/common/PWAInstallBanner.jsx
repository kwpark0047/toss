import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWA';

export default function PWAInstallBanner() {
  const { canInstall, install } = usePWAInstall();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('pwa-banner-dismissed') === '1'
  );

  // 테이블 QR 스캔 주문 고객 및 푸드트럭 탐색 지도 손님에게 불필요한 설치 유도를 방지하여 이탈율 최소화 (0-Friction)
  const isCustomerPage = 
    location.pathname.startsWith('/menu/') || 
    location.pathname.startsWith('/foodtruck/') || 
    location.pathname.startsWith('/kiosk/') ||
    location.pathname.startsWith('/legal/');

  if (!canInstall || dismissed || isCustomerPage) return null;

  const handleInstall = async () => {
    const accepted = await install();
    if (!accepted) setDismissed(true);
  };

  const handleDismiss = () => {
    sessionStorage.setItem('pwa-banner-dismissed', '1');
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-6 md:w-96">
      <div className="bg-gray-900 border border-orange-500/30 rounded-2xl p-4 shadow-2xl shadow-black/50 flex items-start gap-3">
        <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
          <Smartphone size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">위마켓 앱 설치</p>
          <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">
            홈 화면에 추가하면 더 빠르게 접속하고 오프라인에서도 사용할 수 있어요.
          </p>
          <button
            onClick={handleInstall}
            className="mt-3 flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Download size={13} />
            앱으로 설치
          </button>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-500 hover:text-gray-300 transition-colors shrink-0 mt-0.5"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
