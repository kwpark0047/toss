import { useState, useEffect } from 'react';
import { MessageSquareText, Heart, Globe } from 'lucide-react';
import { reviewsAPI } from '../../api';
import Skeleton from '../common/Skeleton';
import EmptyState from '../common/EmptyState';
import NaverReviewTab from './NaverReviewTab';
import LazyImage from '../common/LazyImage';
import { vibrateClick } from '../../utils/notificationSound';

// 브라우저별 익명 좋아요 식별자 (로그인 없는 고객용, localStorage에 고정)
const getLikerId = () => {
  let id = localStorage.getItem('review_liker_id');
  if (!id) {
    id = 'anon-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('review_liker_id', id);
  }
  return id;
};

// 리뷰 첨부 사진: LazyImage 활용
const ReviewPhoto = ({ src }) => {
  if (!src) return null;
  return (
    <div className="mt-2">
      <LazyImage 
        src={src} 
        alt="리뷰 첨부 사진" 
        ratio="aspect-video" 
        className="rounded-xl"
      />
    </div>
  );
};

const fmtDate = (s) => {
  if (!s) return '';
  const d = new Date(s);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

const TABS = [
  { key: 'local', label: '자체 리뷰', icon: MessageSquareText },
  { key: 'naver', label: '네이버 리뷰', icon: Globe },
];

// 매장 리뷰 목록 (메뉴판 하단 섹션)
const StoreReviews = ({ storeId }) => {
  const [activeTab, setActiveTab] = useState('local');
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeTab !== 'local') return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await reviewsAPI.getStoreReviews(storeId);
        const list = res?.data || res || [];
        // _count.likes → likeCount 정규화, liked 초기값 false
        const normalized = (Array.isArray(list) ? list : []).map(r => ({
          ...r,
          likeCount: r._count?.likes ?? r.like_count ?? 0,
          liked: false,
        }));
        if (!cancelled) setReviews(normalized);
      } catch {
        if (!cancelled) setReviews([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storeId, activeTab]);

  const handleLike = async (reviewId) => {
    // optimistic 토글
    setReviews(prev => prev.map(r => r.id === reviewId
      ? { ...r, liked: !r.liked, likeCount: r.likeCount + (r.liked ? -1 : 1) }
      : r));
    try {
      const res = await reviewsAPI.toggleLike(reviewId, getLikerId());
      const data = res?.data || res;
      // 서버 정확값으로 보정
      if (data && typeof data.like_count === 'number') {
        setReviews(prev => prev.map(r => r.id === reviewId
          ? { ...r, liked: data.liked, likeCount: data.like_count }
          : r));
      }
    } catch {
      // 실패 시 롤백
      setReviews(prev => prev.map(r => r.id === reviewId
        ? { ...r, liked: !r.liked, likeCount: r.likeCount + (r.liked ? -1 : 1) }
        : r));
    }
  };

  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : null;

  return (
    <section className="px-4 py-6">
      {/* 헤더 + 탭 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-black cust-text-main flex items-center gap-2">
          <MessageSquareText size={18} className="text-orange-500" aria-hidden="true" />
          고객 리뷰
        </h2>
        {avg && activeTab === 'local' && (
          <div className="flex items-center gap-1 text-sm font-bold cust-text-main">
            <Star size={15} className="text-orange-400" fill="currentColor" aria-hidden="true" />
            {avg} <span className="text-slate-400 font-medium">({reviews.length})</span>
          </div>
        )}
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 mb-4 bg-slate-50 dark:bg-white/5 rounded-xl p-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => { vibrateClick(); setActiveTab(tab.key); }}
              className={`flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition-all ${
                isActive
                  ? 'bg-white dark:bg-slate-800 cust-text-main shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <Icon size={14} aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 자체 리뷰 탭 */}
      {activeTab === 'local' && (
        loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState icon="📋" title="아직 등록된 리뷰가 없어요" description="첫 리뷰의 주인공이 되어보세요!" />
        ) : (
          <div className="space-y-4">
            {reviews.map(r => (
              <article key={r.id} className="cust-bg-card border cust-border rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold cust-text-main text-sm">{r.customer_name || '익명 고객'}</span>
                  <span className="text-[11px] text-slate-400">{fmtDate(r.created_at)}</span>
                </div>
                <div className="flex items-center gap-0.5 mb-2" aria-label={`별점 ${r.rating}점`}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star key={n} size={13} className={n <= r.rating ? 'text-orange-400' : 'text-slate-200 dark:text-slate-700'} fill="currentColor" aria-hidden="true" />
                  ))}
                  {r.is_best && (
                    <span className="ml-2 text-[10px] font-black text-orange-500 bg-orange-50 dark:bg-orange-500/10 px-1.5 py-0.5 rounded">BEST</span>
                  )}
                </div>
                {r.content && <p className="text-sm cust-text-sub leading-relaxed mb-2 break-words">{r.content}</p>}
                {r.image_url && <ReviewPhoto src={r.image_url} />}
                {r.reply && (
                  <div className="mt-3 p-3 bg-orange-50/60 dark:bg-orange-500/5 border-l-2 border-orange-300 rounded-r-xl">
                    <p className="text-[11px] font-black text-orange-600 mb-1 flex items-center gap-1">
                      <MessageSquareText size={11} aria-hidden="true" /> 사장님 답글
                    </p>
                    <p className="text-sm cust-text-sub leading-relaxed break-words">{r.reply}</p>
                  </div>
                )}
                <div className="flex items-center mt-3 pt-3 border-t cust-border">
                  <button
                    onClick={() => { vibrateClick(); handleLike(r.id); }}
                    aria-label={r.liked ? '좋아요 취소' : '좋아요'}
                    aria-pressed={r.liked}
                    className={`flex items-center gap-1.5 text-sm font-bold transition-colors ${r.liked ? 'text-rose-500' : 'text-slate-400 hover:text-rose-400'}`}
                  >
                    <Heart size={16} fill={r.liked ? 'currentColor' : 'none'} aria-hidden="true" />
                    <span>{r.likeCount > 0 ? r.likeCount : '좋아요'}</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      )}

      {/* 네이버 리뷰 탭 */}
      {activeTab === 'naver' && <NaverReviewTab storeId={storeId} />}
    </section>
  );
};

export default StoreReviews;
