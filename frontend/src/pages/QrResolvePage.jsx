import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tablesAPI } from '@/api';
import { Loader2, QrCode, AlertCircle } from 'lucide-react';

export default function QrResolvePage() {
  const { qrCode } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!qrCode) { setError('유효하지 않은 QR 코드입니다.'); return; }

    tablesAPI.getByQrCode(qrCode)
      .then(res => {
        const table = res?.data || res;
        if (!table?.store_id) throw new Error('매장 정보를 찾을 수 없습니다.');
        const tableNum = encodeURIComponent(table.table_number || table.name || '');
        navigate(`/menu/${table.store_id}?table=${tableNum}`, { replace: true });
      })
      .catch(() => setError('유효하지 않은 QR 코드입니다. 매장 직원에게 문의해주세요.'));
  }, [qrCode, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
            <AlertCircle size={28} className="text-rose-400" />
          </div>
          <h2 className="text-white font-black text-lg">QR 코드 오류</h2>
          <p className="text-slate-400 text-sm leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto">
          <QrCode size={28} className="text-orange-400" />
        </div>
        <Loader2 size={24} className="animate-spin text-orange-500 mx-auto" />
        <p className="text-slate-400 text-sm font-medium">메뉴판 불러오는 중...</p>
      </div>
    </div>
  );
}
