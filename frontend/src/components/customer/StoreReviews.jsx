import { useState, useEffect } from 'react';
import { Star, ImageOff, MessageSquareText } from 'lucide-react';
import { reviewsAPI } from '../../api';

// 리뷰 첨부 사진: 로드 실패 시 깨진 아이콘 대신 폴백
const ReviewPhoto = ({ src }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-full aspect-video rounded-xl bg-slate-100 flex items-center justify-center text-slate-300">
        <ImageOff size={28} aria-hidden="true" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt="리뷰 첨부 사진"
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-full aspect-video object-cover rounded-xl"
    />
  );
};

const fmtDate = (s) => {
  if (!s) return '';
  const d = new Date(s);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

// 매장 리뷰 목록 (메뉴판 하단 섹션)
const StoreReviews = ({ storeId }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await reviewsAPI.getStoreReviews(storeId);
        const list = res?.data || res || [];
        if (!cancelled) setReviews(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setReviews([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storeId]);

  if (loading) {
    return (
      <div className="px-4 py-6 space-y-3">
        {[1, 2].map(i => <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : null;

  return (
    <section className="px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
          <MessageSquareText size={18} className="text-orange-500" aria-hidden="true" />
          고객 리뷰
        </h2>
        {avg && (
          <div className="flex items-center gap-1 text-sm font-bold text-slate-700">
            <Star size={15} className="text-orange-400" fill="currentColor" aria-hidden="true" />
            {avg} <span className="text-slate-400 font-medium">({reviews.length})</span>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <div className="py-10 text-center text-slate-400">
          <MessageSquareText size={32} className="mx-auto mb-2 text-slate-300" aria-hidden="true" />
          <p className="text-sm font-bold">아직 등록된 리뷰가 없어요</p>
          <p className="text-xs mt-1">첫 리뷰의 주인공이 되어보세요!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => (
            <article key={r.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800 text-sm">{r.customer_name || '익명 고객'}</span>
                <span className="text-[11px] text-slate-400">{fmtDate(r.created_at)}</span>
              </div>
              <div className="flex items-center gap-0.5 mb-2" aria-label={`별점 ${r.rating}점`}>
                {[1, 2, 3, 4, 5].map(n => (
                  <Star key={n} size={13} className={n <= r.rating ? 'text-orange-400' : 'text-slate-200'} fill="currentColor" aria-hidden="true" />
                ))}
                {r.is_best && (
                  <span className="ml-2 text-[10px] font-black text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">BEST</span>
                )}
              </div>
              {r.content && <p className="text-sm text-slate-600 leading-relaxed mb-2 break-words">{r.content}</p>}
              {r.image_url && <ReviewPhoto src={r.image_url} />}
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default StoreReviews;
