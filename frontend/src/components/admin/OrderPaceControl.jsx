import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminAPI } from '../../api';
import { handleApiError } from '../../utils/apiError';

const EXTRA_WAIT_OPTIONS = [0, 10, 20, 30];
const PAUSE_OPTIONS = [15, 30, 60];

const formatClock = (iso) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

/**
 * OrderPaceControl — 주문현황 화면의 바쁨 모드
 * - 손님 예상 시간에 추가 대기 분을 더한다
 * - 일정 시간 QR 주문을 멈추고, 시간이 지나면 자동으로 다시 받는다
 * 조회에 실패하면(예: 마이그레이션 전) 컨트롤을 숨겨 주문현황 화면에 영향을 주지 않는다.
 */
const OrderPaceControl = ({ storeId }) => {
  const [pace, setPace] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminAPI.getOrderPace(storeId);
      setPace(res?.data || res);
    } catch {
      setPace(null);
    }
  }, [storeId]);

  useEffect(() => {
    load();
    // 일시정지 자동 해제를 화면에 반영하기 위해 1분마다 다시 읽는다.
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [load]);

  const save = async (data, message) => {
    setSaving(true);
    try {
      const res = await adminAPI.updateOrderPace(storeId, data);
      setPace(res?.data || res);
      toast.success(message);
    } catch (err) {
      handleApiError(err, '바쁨 모드를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!pace) return null;

  return (
    <section aria-label="바쁨 모드" className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-black text-slate-300">손님 예상 시간 +</span>
        {EXTRA_WAIT_OPTIONS.map((minutes) => {
          const active = pace.extra_wait_minutes === minutes;
          return (
            <button
              key={minutes}
              type="button"
              disabled={saving}
              aria-pressed={active}
              onClick={() =>
                save(
                  { extra_wait_minutes: minutes },
                  minutes ? `손님 예상 시간에 ${minutes}분을 더합니다.` : '추가 대기 시간을 껐습니다.'
                )
              }
              className={`min-h-9 rounded-lg px-3 text-xs font-black transition-colors disabled:opacity-50 ${
                active ? 'bg-orange-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/15'
              }`}
            >
              {minutes ? `${minutes}분` : '없음'}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {pace.orders_paused ? (
          <>
            <span role="status" className="text-xs font-black text-amber-300">
              {formatClock(pace.orders_paused_until)}까지 QR 주문을 받지 않는 중
            </span>
            <button
              type="button"
              disabled={saving}
              onClick={() => save({ pause_minutes: 0 }, 'QR 주문을 다시 받습니다.')}
              className="min-h-9 rounded-lg bg-emerald-500 px-3 text-xs font-black text-white disabled:opacity-50"
            >
              지금 다시 받기
            </button>
          </>
        ) : (
          <>
            <span className="text-xs font-black text-slate-300">QR 주문 잠시 멈추기</span>
            {PAUSE_OPTIONS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                disabled={saving}
                onClick={() => save({ pause_minutes: minutes }, `${minutes}분 동안 QR 주문을 멈춥니다.`)}
                aria-label={`${minutes}분 동안 주문 멈추기`}
                className="min-h-9 rounded-lg bg-white/10 px-3 text-xs font-black text-slate-300 hover:bg-white/15 disabled:opacity-50"
              >
                {minutes}분
              </button>
            ))}
          </>
        )}
      </div>
    </section>
  );
};

export default OrderPaceControl;
