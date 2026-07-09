import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

/**
 * KioskPage — 키오스크 전용 주문 페이지
 *
 * 실제 렌더는 MenuPage에 위임하고, kiosk=1 쿼리스트링을 추가하여
 * useKioskMode 훅(전체화면·터치최적화·우클릭차단)을 활성화한다.
 * URL 예: /kiosk/:storeId → /menu/:storeId?kiosk=1
 */
export default function KioskPage() {
  const { storeId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (storeId) {
      navigate(`/menu/${storeId}?kiosk=1`, { replace: true });
    }
  }, [storeId, navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
