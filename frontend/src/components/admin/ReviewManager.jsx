import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { reviewsAPI, storesAPI } from '../../api';
import { ArrowLeft, RefreshCw, Star, MessageSquareText, Send, Sparkles, Loader2, ImageOff, Heart } from 'lucide-react';
import { toast } from 'react-toastify';
import Skeleton from '../common/Skeleton';
import EmptyState from '../common/EmptyState';
import Icon from '../ui/Icon';

// 리뷰 첨부 사진 (로드 실패 폴백)
const ReviewPhoto = ({ src }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="w-20 h-20 rounded-xl bg-white/5 flex items-center justify-center text-slate-600 shrink-0"><ImageOff size={22} /></div>;
  }
  return <img src={src} alt="리뷰 첨부 사진" loading="lazy" onError={() => setFailed(true)} className="w-20 h-20 rounded-xl object-cover shrink-0" />;
};

const fmtDate = (s) => {
  if (!s) return '';
  const d = new Date(s);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

// 개별 리뷰 카드 + 답글 편집
function ReviewCard({ review, onReplySaved, onReplyDeleted }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review.reply || '');
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const save = async () => {
    if (!draft.trim()) { toast.warn('답글 내용을 입력해주세요.'); return; }
    setSaving(true);
    try {
      await reviewsAPI.saveReply(review.id, draft.trim());
      onReplySaved(review.id, draft.trim());
      setEditing(false);
      toast.success('답글이 등록되었습니다.');
    } catch (e) {
      toast.error(e?.response?.data?.error || '답글 저장 실패');
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!window.confirm('답글을 삭제할까요?')) return;
    try {
      await reviewsAPI.deleteReply(review.id);
      onReplyDeleted(review.id);
      setDraft('');
      setEditing(false);
      toast.success('답글이 삭제되었습니다.');
    } catch (e) {
      toast.error(e?.response?.data?.error || '답글 삭제 실패');
    }
  };

  const genAi = async () => {
    setAiLoading(true);
    try {
      const res = await reviewsAPI.generateAiReply(review.id);
      const d = res?.data || res;
      if (d?.draft) { setDraft(d.draft); setEditing(true); }
      else toast.warn('AI 답글 생성에 실패했습니다.');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'AI 답글 생성 실패 (API 키 확인)');
    } finally { setAiLoading(false); }
  };

  return (
    <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-black text-white text-sm">{review.customer_name || '익명 고객'}</span>
            {review.is_best && <span className="text-[10px] font-black text-orange-400 bg-orange-500/15 px-1.5 py-0.5 rounded">BEST</span>}
          </div>
          <div className="flex items-center gap-1 mt-1" aria-label={`별점 ${review.rating}점`}>
            {[1, 2, 3, 4, 5].map(n => (
              <Icon icon="Star" />
            ))}
            <span className="ml-1 text-[11px] text-slate-500 flex items-center gap-0.5">
              <Heart size={10} className="text-rose-400" fill="currentColor" aria-hidden="true" /> {review._count?.likes ?? 0}
            </span>
          </div>
        </div>
        <span className="text-[11px] text-slate-500 shrink-0">{fmtDate(review.created_at)}</span>
      </div>

      <div className="flex gap-3">
        {review.image_url && <ReviewPhoto src={review.image_url} />}
        {review.content && <p className="text-sm text-slate-300 leading-relaxed break-words flex-1">{review.content}</p>}
      </div>

      {/* 답글 영역 */}
      <div className="mt-3 pt-3 border-t border-white/8">
        {review.reply && !editing ? (
          <div className="bg-orange-500/8 border-l-2 border-orange-400 rounded-r-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-black text-orange-400 flex items-center gap-1">
                <MessageSquareText size={11} /> 사장님 답글
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => { setDraft(review.reply); setEditing(true); }} className="text-[11px] font-bold text-slate-400 hover:text-white">수정</button>
                <button onClick={remove} className="text-[11px] font-bold text-rose-400 hover:text-rose-300">삭제</button>
              </div>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed break-words">{review.reply}</p>
          </div>
        ) : editing ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="답글 내용"
              placeholder="고객에게 정중한 답글을 남겨보세요…"
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-orange-500/50 resize-none"
            />
            <div className="flex items-center gap-2">
              <button onClick={genAi} disabled={aiLoading} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 disabled:opacity-40">
                {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} AI 초안
              </button>
              <div className="flex-1" />
              <button onClick={() => { setEditing(false); setDraft(review.reply || ''); }} className="px-3 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-slate-400">취소</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-orange-500 text-white hover:bg-orange-400 disabled:opacity-40">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} 등록
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-orange-400 transition-colors">
            <MessageSquareText size={14} /> 답글 작성
          </button>
        )}
      </div>
    </div>
  );
}

export default function ReviewManager() {
  const { storeId } = useParams();
  const [store, setStore] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, rRes] = await Promise.all([
        storesAPI.getById(storeId),
        reviewsAPI.getStoreReviews(storeId),
      ]);
      setStore(sRes?.data || sRes);
      const list = rRes?.data || rRes || [];
      setReviews(Array.isArray(list) ? list : []);
    } catch {
      setReviews([]);
    } finally { setLoading(false); }
  }, [storeId]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const onReplySaved = (id, reply) => setReviews(prev => prev.map(r => r.id === id ? { ...r, reply, replied_at: new Date().toISOString() } : r));
  const onReplyDeleted = (id) => setReviews(prev => prev.map(r => r.id === id ? { ...r, reply: null, replied_at: null } : r));

  const total = reviews.length;
  const avg = total ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / total).toFixed(1) : '0.0';
  const replied = reviews.filter(r => r.reply).length;
  const pending = total - replied;

  return (
    <div className="min-h-screen pb-20">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white">리뷰 관리</h1>
            <p className="text-slate-400 text-sm">{store?.name}</p>
          </div>
        </div>
        <button onClick={fetchReviews} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white transition-all">
          <RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} />
          <span className="font-medium hidden sm:inline">새로고침</span>
        </button>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: '전체 리뷰', value: total, color: 'text-sky-400', icon: MessageSquareText },
          { label: '평균 별점', value: `⭐ ${avg}`, color: 'text-orange-400', icon: Star },
          { label: '답글 대기', value: pending, color: 'text-rose-400', icon: Send },
        ].map((c) => (
          <div key={c.label} className="bg-white/5 border border-white/8 rounded-2xl p-4">
            <p className={`text-xl font-black ${c.color}`}>{c.value}</p>
            <p className="text-[11px] text-slate-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* 리뷰 목록 */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} dark className="h-32 rounded-2xl" />)}</div>
      ) : reviews.length === 0 ? (
        <EmptyState
          tone="dark"
          icon={<MessageSquareText size={40} className="text-slate-600" aria-hidden="true" />}
          title="아직 등록된 리뷰가 없습니다"
          description="고객이 리뷰를 남기면 여기에 표시됩니다."
        />
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <ReviewCard key={r.id} review={r} onReplySaved={onReplySaved} onReplyDeleted={onReplyDeleted} />
          ))}
        </div>
      )}
    </div>
  );
}
