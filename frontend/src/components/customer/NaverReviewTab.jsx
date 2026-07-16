import { useState, useEffect } from 'react';
import { ExternalLink, Store, MapPin, ChevronRight } from 'lucide-react';
import { naverPlaceAPI } from '../../api/naverPlace';
import Skeleton from '../common/Skeleton';
import EmptyState from '../common/EmptyState';

/**
 * 네이버 플레이스 리뷰 탭 — 해당 매장의 네이버 플레이스 정보를 보여주고
 * 네이버 리뷰 페이지로 연결한다.
 * 네이버 Open API는 리뷰 데이터를 제공하지 않으므로 플레이스 링크로 안내한다.
 */
const NaverReviewTab = ({ storeId }) => {
  const [placeInfo, setPlaceInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await naverPlaceAPI.getStoreInfo(storeId);
        const data = res?.data?.data || null;
        if (!cancelled) setPlaceInfo(data);
      } catch (err) {
        if (!cancelled) {
          const msg = err?.response?.data?.error || err?.message || '조회 중 오류가 발생했습니다.';
          // 503 = API 키 미설정
          if (err?.response?.status === 503) {
            setError('네이버 API 키가 서버에 설정되지 않았어요.');
          } else {
            setError(msg);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storeId]);

  if (loading) {
    return (
      <div className="py-6 space-y-3">
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6">
        <EmptyState
          icon={<AlertCircle size={40} className="text-slate-300" aria-hidden="true" />}
          title="네이버 리뷰를 불러올 수 없어요"
          description={error}
        />
      </div>
    );
  }

  if (!placeInfo) {
    return (
      <div className="py-6">
        <EmptyState
          icon={<Store size={40} className="text-slate-300" aria-hidden="true" />}
          title="네이버 플레이스에 등록되지 않은 매장이에요"
          description="해당 매장의 정보를 네이버에서 찾을 수 없습니다."
        />
      </div>
    );
  }

  return (
    <div className="py-6">
      {/* 네이버 플레이스 정보 카드 */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-emerald-600" fill="currentColor" aria-hidden="true">
              <path d="M4 4h7v16H4V4zm9 0h7v16h-7V4z"/>
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">네이버 플레이스</h3>
            <p className="text-[11px] text-slate-400">{placeInfo.title}</p>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          {placeInfo.category && (
            <div className="flex items-center gap-2 text-slate-500">
              <Store size={14} className="shrink-0" aria-hidden="true" />
              <span>{placeInfo.category}</span>
            </div>
          )}
          {placeInfo.address && (
            <div className="flex items-center gap-2 text-slate-500">
              <MapPin size={14} className="shrink-0" aria-hidden="true" />
              <span className="leading-tight">{placeInfo.address}</span>
            </div>
          )}
          {placeInfo.telephone && (
            <div className="flex items-center gap-2 text-slate-500">
              <Phone size={14} className="shrink-0" aria-hidden="true" />
              <span>{placeInfo.telephone}</span>
            </div>
          )}
        </div>

        {/* 네이버 리뷰 보기 버튼 */}
        {placeInfo.reviewUrl && (
          <a
            href={placeInfo.reviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 active:scale-[0.97] transition-all"
          >
            <ExternalLink size={15} aria-hidden="true" />
            네이버에서 리뷰 보기
            <ChevronRight size={15} aria-hidden="true" />
          </a>
        )}

        {/* 네이버 플레이스 전체 보기 */}
        {placeInfo.naverPlaceUrl && (
          <a
            href={placeInfo.naverPlaceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 w-full h-10 flex items-center justify-center gap-1.5 rounded-xl bg-slate-50 text-slate-600 font-semibold text-xs hover:bg-slate-100 active:scale-[0.97] transition-all"
          >
            네이버 플레이스 바로가기
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}

        <p className="mt-3 text-[11px] text-slate-400 text-center leading-snug">
          리뷰 작성은 네이버 플레이스 페이지에서 가능합니다.
        </p>
      </div>
    </div>
  );
};

export default NaverReviewTab;
