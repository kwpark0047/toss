import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapPin, Megaphone, Share2, Heart, Eye, Plus, Trash2,
  Store, Clock, Phone, CheckCircle, XCircle, Send,
  Search, Building2, RefreshCw, Loader2, X, ChevronRight,
  Sparkles, TrendingUp, Users, Bell, Filter, Star,
  HandshakeIcon, MessageSquare, Globe, ArrowLeft, MoreHorizontal,
  ChevronDown, Flame, Calendar, Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { communityAPI } from '../../api/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import api from '../../api/index.js';
import EmptyState from '../common/EmptyState';

// ── 상수 ──────────────────────────────────────────────────────────────
const TYPE_OPTIONS = [
  { value: 'ALL',       label: '전체',   emoji: '📋', bar: 'bg-white/20',          badge: 'bg-white/10 text-white border-white/20' },
  { value: 'EVENT',     label: '이벤트', emoji: '🎉', bar: 'bg-purple-500',         badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { value: 'PROMOTION', label: '할인',   emoji: '🏷️', bar: 'bg-orange-500',         badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { value: 'NEWS',      label: '소식',   emoji: '📢', bar: 'bg-sky-500',            badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  { value: 'PRODUCT',   label: '신메뉴', emoji: '🍽️', bar: 'bg-emerald-500',        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
];
const TYPE_MAP = Object.fromEntries(TYPE_OPTIONS.map(t => [t.value, t]));

const STATUS_MAP = {
  pending:  { label: '대기중', color: 'text-amber-400',   bg: 'bg-amber-500/15  border-amber-500/30'  },
  accepted: { label: '수락됨', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
  rejected: { label: '거절됨', color: 'text-rose-400',    bg: 'bg-rose-500/15   border-rose-500/30'   },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

// ── 피드 카드 ─────────────────────────────────────────────────────────
function PostCard({ post, myStoreIds = [], onDelete, onLike }) {
  const isMine   = myStoreIds.includes(post.store_id);
  const typeInfo = TYPE_MAP[post.type] || TYPE_MAP.NEWS;
  const [liked, setLiked]   = useState(false);
  const [count, setCount]   = useState(post.like_count ?? 0);
  const [expanded, setExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLike = async () => {
    const optimistic = !liked;
    setLiked(optimistic);
    setCount(c => optimistic ? c + 1 : c - 1);
    try {
      const res = await onLike(post.id);
      if (res?.data?.liked !== undefined) {
        setLiked(res.data.liked);
        setCount(res.data.like_count ?? (optimistic ? count + 1 : count - 1));
      }
    } catch {
      setLiked(!optimistic);
      setCount(c => optimistic ? c - 1 : c + 1);
    }
  };

  const isExpired = post.expires_at && new Date(post.expires_at) < new Date();
  const isHot     = count >= 5;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden"
    >
      {/* 상단 컬러 바 */}
      <div className={`h-0.5 ${typeInfo.bar}`} />

      <div className="p-4">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={`shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded-full font-bold border ${typeInfo.badge}`}>
              <span>{typeInfo.emoji}</span> {typeInfo.label}
            </span>
            {isHot && (
              <span className="shrink-0 flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-bold">
                <Flame size={10} /> HOT
              </span>
            )}
            {isExpired && (
              <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-500 font-medium">종료됨</span>
            )}
          </div>

          <div className="relative shrink-0" ref={menuRef}>
            {isMine ? (
              <>
                <button
                  onClick={() => setShowMenu(v => !v)}
                  className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
                >
                  <MoreHorizontal size={15} />
                </button>
                <AnimatePresence>
                  {showMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="absolute right-0 top-8 z-20 bg-slate-800 border border-white/10 rounded-xl shadow-xl py-1 min-w-[100px]"
                    >
                      <button
                        onClick={() => { onDelete(post.id); setShowMenu(false); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-rose-400 hover:bg-white/5 transition-colors"
                      >
                        <Trash2 size={13} /> 삭제
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : null}
          </div>
        </div>

        {/* 매장 정보 */}
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
            <Store size={12} className="text-orange-400" />
          </div>
          <span className="text-xs text-slate-400 font-medium truncate">{post.stores?.name}</span>
          {post.stores?.business_type && (
            <span className="text-xs text-slate-600">· {post.stores.business_type}</span>
          )}
        </div>

        {/* 제목 + 내용 */}
        <h3 className="font-bold text-white text-base leading-snug mb-1.5 line-clamp-2">
          {post.title}
        </h3>
        <p className={`text-sm text-slate-400 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
          {post.content}
        </p>
        {post.content?.length > 80 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-sky-400 mt-1 hover:text-sky-300 transition-colors"
          >
            {expanded ? '접기' : '더 보기'}
          </button>
        )}

        {/* 유효기간 */}
        {post.expires_at && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${isExpired ? 'text-slate-600' : 'text-orange-400'}`}>
            <Calendar size={11} />
            {isExpired ? '종료: ' : '~'}{new Date(post.expires_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
          </div>
        )}

        {/* 하단 액션 */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center gap-3">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 text-sm font-bold transition-all active:scale-90 ${
                liked ? 'text-rose-400' : 'text-slate-500 hover:text-rose-400'
              }`}
            >
              <Heart size={15} fill={liked ? 'currentColor' : 'none'} className="transition-all" />
              {count > 0 && count}
            </button>
            <span className="flex items-center gap-1 text-xs text-slate-600">
              <Eye size={13} /> {post.view_count ?? 0}
            </span>
          </div>
          <span className="text-xs text-slate-600">{timeAgo(post.created_at)}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ── 피드 작성 모달 (바텀시트) ─────────────────────────────────────────
function PostModal({ myStores, onClose, onSuccess }) {
  const [form, setForm]   = useState({ store_id: myStores[0]?.id || '', type: 'NEWS', title: '', content: '', expires_at: '' });
  const [loading, setLoading] = useState(false);
  const [err, setErr]     = useState('');
  const charLimit = 300;

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) { setErr('제목과 내용을 입력해주세요.'); return; }
    if (form.content.length > charLimit)             { setErr(`내용은 ${charLimit}자 이내로 작성해주세요.`); return; }
    setLoading(true);
    try {
      await communityAPI.createPost({ store_id: form.store_id, type: form.type, title: form.title, content: form.content, expires_at: form.expires_at || null });
      onSuccess();
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.error || '게시 실패');
    } finally {
      setLoading(false);
    }
  };

  const selectedType = TYPE_MAP[form.type];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        className="w-full sm:max-w-lg bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl"
      >
        {/* 드래그 핸들 (모바일) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h2 className="font-black text-white text-lg">피드 작성</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 매장 선택 */}
          {myStores.length > 1 && (
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">매장 선택</label>
              <div className="flex gap-2 flex-wrap">
                {myStores.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setForm(f => ({ ...f, store_id: s.id }))}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border transition-all ${
                      form.store_id === s.id
                        ? 'bg-orange-500 border-orange-400 text-white'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <Store size={13} /> {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 유형 선택 */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">게시 유형</label>
            <div className="flex gap-2 flex-wrap">
              {TYPE_OPTIONS.filter(t => t.value !== 'ALL').map(t => (
                <button
                  key={t.value}
                  onClick={() => setForm(f => ({ ...f, type: t.value }))}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border transition-all ${
                    form.type === t.value
                      ? `${t.badge}`
                      : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10'
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">제목 *</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={`${selectedType?.emoji} 예: 여름 특가 이벤트 시작!`}
              maxLength={50}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-medium placeholder:text-slate-600 outline-none focus:border-orange-500/50 transition-colors"
            />
          </div>

          {/* 내용 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">내용 *</label>
              <span className={`text-xs font-medium ${form.content.length > charLimit * 0.9 ? 'text-orange-400' : 'text-slate-600'}`}>
                {form.content.length}/{charLimit}
              </span>
            </div>
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="이벤트 내용, 할인 정보, 신메뉴 소개 등 자유롭게 작성하세요..."
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 outline-none focus:border-orange-500/50 transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* 유효기간 */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">유효기간 (선택)</label>
            <input
              type="date"
              value={form.expires_at}
              onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-orange-500/50 transition-colors"
            />
          </div>

          {err && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <XCircle size={14} className="text-rose-400 shrink-0" />
              <p className="text-rose-400 text-sm">{err}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-white/8">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-bold bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 transition-colors">
            취소
          </button>
          <button
            onClick={submit}
            disabled={loading || !form.title.trim() || !form.content.trim()}
            className="flex-2 flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-black bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition-colors shadow-lg shadow-orange-500/20"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            게시하기
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── 제휴 신청 모달 ─────────────────────────────────────────────────────
function PartnershipModal({ targetStore, myStores, onClose, onSuccess }) {
  const [storeId, setStoreId] = useState(myStores[0]?.id || '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setLoading(true);
    try {
      await communityAPI.requestPartnership({ store_id: storeId, target_store_id: targetStore.id, message });
      onSuccess();
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.error || '신청 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        className="w-full sm:max-w-md bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl"
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h2 className="font-black text-white text-lg">제휴 신청</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* 대상 매장 */}
          <div className="flex items-center gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
              <Store size={18} className="text-orange-400" />
            </div>
            <div>
              <p className="font-black text-white">{targetStore.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {[targetStore.business_type, targetStore.address].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>

          {/* 내 매장 선택 */}
          {myStores.length > 1 && (
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">신청 매장</label>
              <div className="flex gap-2 flex-wrap">
                {myStores.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setStoreId(s.id)}
                    className={`px-3 py-2 rounded-xl text-sm font-bold border transition-all ${
                      storeId === s.id ? 'bg-orange-500 border-orange-400 text-white' : 'bg-white/5 border-white/10 text-slate-400'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 메시지 */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">제안 메시지 (선택)</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="상호 홍보, 공동 이벤트 등 제안 내용을 간단히..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 outline-none focus:border-orange-500/50 transition-colors resize-none"
            />
          </div>

          {err && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <XCircle size={14} className="text-rose-400 shrink-0" />
              <p className="text-rose-400 text-sm">{err}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-white/8">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-bold bg-white/5 border border-white/10 text-slate-400">취소</button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-2 flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-black bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 shadow-lg shadow-orange-500/20"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
            신청하기
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── 주변 매장 카드 ────────────────────────────────────────────────────
function NearbyStoreCard({ store, alreadySent, onApply }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* 아이콘 */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-sky-500/20 flex items-center justify-center shrink-0">
            <Store size={16} className="text-sky-400" />
          </div>

          {/* 정보 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-black text-white text-base leading-tight truncate">{store.name}</h3>
                {store.business_type && (
                  <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/20 font-medium mt-1">
                    {store.business_type}
                  </span>
                )}
              </div>
              <button
                onClick={() => onApply(store)}
                disabled={alreadySent}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${
                  alreadySent
                    ? 'bg-white/5 border border-white/10 text-slate-600 cursor-not-allowed'
                    : 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20 active:scale-95'
                }`}
              >
                {alreadySent ? (
                  <><CheckCircle size={12} /> 신청완료</>
                ) : (
                  <><Share2 size={12} /> 제휴신청</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 상세 정보 토글 */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 mt-3 text-xs text-slate-600 hover:text-slate-400 transition-colors"
        >
          <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          {expanded ? '접기' : '상세보기'}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
                {store.address && (
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    <MapPin size={12} className="text-slate-600 shrink-0" /> {store.address}
                  </p>
                )}
                {(store.open_time || store.close_time) && (
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock size={12} className="text-slate-600 shrink-0" />
                    {store.open_time || '--'} ~ {store.close_time || '--'}
                  </p>
                )}
                {store.phone && (
                  <a href={`tel:${store.phone}`} className="flex items-center gap-2 text-xs text-sky-400 hover:text-sky-300 transition-colors">
                    <Phone size={12} className="shrink-0" /> {store.phone}
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── 제휴 카드 ─────────────────────────────────────────────────────────
function PartnershipCard({ item, type, onRespond }) {
  const store = type === 'received' ? item.requester_store : item.target_store;
  const statusInfo = STATUS_MAP[item.status] || STATUS_MAP.pending;
  const isPending  = item.status === 'pending';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/8 rounded-2xl p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
          <Store size={16} className="text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <p className="font-black text-white truncate">{store?.name}</p>
              <p className="text-xs text-slate-500 truncate">
                {[store?.business_type, store?.address].filter(Boolean).join(' · ')}
              </p>
            </div>
            <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-bold border ${statusInfo.bg} ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>

          {item.message && (
            <div className="mt-2 px-3 py-2 bg-white/5 border border-white/8 rounded-xl">
              <p className="text-xs text-slate-400 italic leading-relaxed">"{item.message}"</p>
            </div>
          )}

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-slate-600">{timeAgo(item.created_at)}</span>
            {type === 'received' && isPending && (
              <div className="flex gap-2">
                <button
                  onClick={() => onRespond(item.id, 'reject')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                >
                  <XCircle size={12} /> 거절
                </button>
                <button
                  onClick={() => onRespond(item.id, 'accept')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
                >
                  <CheckCircle size={12} /> 수락
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────
export default function CommunityPage() {
  const { user } = useAuth();
  const [tab, setTab]           = useState('feed');
  const [myStores, setMyStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);

  // Feed state
  const [feedPosts, setFeedPosts]       = useState([]);
  const [feedType, setFeedType]         = useState('ALL');
  const [feedLoading, setFeedLoading]   = useState(false);
  const [feedDistrict, setFeedDistrict] = useState('');
  const [showPostModal, setShowPostModal] = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [showSearch, setShowSearch]     = useState(false);

  // Nearby state
  const [nearbyStores, setNearbyStores]   = useState([]);
  const [nearbyDistrict, setNearbyDistrict] = useState('');
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [partnerModal, setPartnerModal]   = useState(null);
  const [nearbySearch, setNearbySearch]   = useState('');
  const [sentIds, setSentIds]             = useState(new Set());

  // Partnership state
  const [partnerships, setPartnerships]   = useState({ sent: [], received: [] });
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [partnerTab, setPartnerTab]       = useState('received');

  useEffect(() => {
    api.get('/stores/my').then(res => {
      const list = Array.isArray(res?.data || res) ? (res?.data || res) : [];
      setMyStores(list);
      if (list.length > 0) setSelectedStore(list[0]);
    }).catch(() => {});
  }, []);

  const myStoreIds = myStores.map(s => s.id);

  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const params = { type: feedType };
      if (selectedStore?.id) params.store_id = selectedStore.id;
      const res = await communityAPI.getFeed(params);
      setFeedPosts(res?.data?.posts || []);
      setFeedDistrict(res?.data?.district || '');
    } catch { setFeedPosts([]); } finally { setFeedLoading(false); }
  }, [feedType, selectedStore]);

  const loadNearby = useCallback(async () => {
    if (!selectedStore?.id) return;
    setNearbyLoading(true);
    try {
      const res = await communityAPI.getNearby({ store_id: selectedStore.id });
      setNearbyStores(res?.data?.stores || []);
      setNearbyDistrict(res?.data?.district || '');
    } catch { setNearbyStores([]); } finally { setNearbyLoading(false); }
  }, [selectedStore]);

  const loadPartnerships = useCallback(async () => {
    if (!selectedStore?.id) return;
    setPartnerLoading(true);
    try {
      const res = await communityAPI.getPartnerships(selectedStore.id);
      const data = res?.data || { sent: [], received: [] };
      setPartnerships(data);
      setSentIds(new Set((data.sent || []).map(p => p.target_id)));
    } catch { setPartnerships({ sent: [], received: [] }); } finally { setPartnerLoading(false); }
  }, [selectedStore]);

  useEffect(() => { if (tab === 'feed')         loadFeed(); },         [tab, loadFeed]);
  useEffect(() => { if (tab === 'nearby')        loadNearby(); },       [tab, loadNearby]);
  useEffect(() => { if (tab === 'partnerships')  loadPartnerships(); }, [tab, loadPartnerships]);

  const handleDeletePost = async (id) => {
    if (!window.confirm('피드를 삭제할까요?')) return;
    try {
      await communityAPI.deletePost(id);
      setFeedPosts(p => p.filter(x => x.id !== id));
    } catch (e) { alert(e?.response?.data?.error || '삭제 실패'); }
  };

  const handleLikePost  = (id) => communityAPI.likePost(id);

  const handleRespondPartnership = async (id, action) => {
    try {
      await communityAPI.respondPartnership(id, action);
      loadPartnerships();
    } catch (e) { alert(e?.response?.data?.error || '처리 실패'); }
  };

  const pendingCount   = partnerships.received?.filter(p => p.status === 'pending').length || 0;
  const filteredNearby = nearbyStores.filter(s => !nearbySearch || s.name.includes(nearbySearch) || (s.business_type || '').includes(nearbySearch));
  const filteredPosts  = feedPosts.filter(p => !searchQuery || p.title.includes(searchQuery) || p.content.includes(searchQuery));
  const hotPosts       = feedPosts.filter(p => (p.like_count ?? 0) >= 5).length;

  const TABS = [
    { id: 'feed',         label: '지역 피드',  icon: Megaphone, badge: null },
    { id: 'nearby',       label: '주변 매장',  icon: MapPin,    badge: null },
    { id: 'partnerships', label: '제휴 관리',  icon: Share2,    badge: pendingCount },
  ];

  return (
    <div className="max-w-4xl mx-auto px-3 pb-24">

      {/* ── 헤더 ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between py-4 mb-2">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2 leading-tight">
            <Building2 size={22} className="text-sky-400" />
            지역 커뮤니티
          </h1>
          <p className="text-slate-500 text-xs font-medium mt-0.5">
            {feedDistrict ? `📍 ${feedDistrict}` : '주변 매장과 연결하고 소식을 공유하세요'}
          </p>
        </div>

        {/* 매장 선택 (단일 매장이면 표시) */}
        {myStores.length > 1 && (
          <div className="relative">
            <select aria-label="매장 선택"
              value={selectedStore?.id || ''}
              onChange={e => setSelectedStore(myStores.find(s => s.id === parseInt(e.target.value)))}
              className="pl-3 pr-8 py-2 bg-white/8 border border-white/10 rounded-xl text-white text-sm font-bold outline-none appearance-none cursor-pointer"
            >
              {myStores.map(s => <option key={s.id} value={s.id} className="bg-slate-800">{s.name}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        )}
      </div>

      {/* ── 통계 배너 (피드 탭) ──────────────────────────────────── */}
      {tab === 'feed' && feedPosts.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { icon: Megaphone, label: '전체 피드', value: feedPosts.length, color: 'text-sky-400' },
            { icon: Flame,     label: '인기 피드', value: hotPosts,         color: 'text-orange-400' },
            { icon: Users,     label: '주변 매장', value: nearbyStores.length || '?', color: 'text-emerald-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-white/5 border border-white/8 rounded-2xl p-3 text-center">
              <stat.icon size={16} className={`${stat.color} mx-auto mb-1`} />
              <p className="text-xl font-black text-white">{stat.value}</p>
              <p className="text-xs text-slate-600">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── 탭 ────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-4">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-sm font-bold transition-all border ${
                tab === t.id
                  ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                  : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'
              }`}
            >
              <Icon size={14} />
              <span className="hidden xs:inline">{t.label}</span>
              {t.badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 탭: 지역 피드                                              */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === 'feed' && (
        <div>
          {/* 필터 + 액션 바 */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1 scrollbar-hide">
              {TYPE_OPTIONS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setFeedType(t.value)}
                  className={`shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    feedType === t.value
                      ? t.value === 'ALL' ? 'bg-sky-500 border-sky-400 text-white' : `${t.badge}`
                      : 'bg-white/5 border-white/8 text-slate-500 hover:bg-white/10'
                  }`}
                >
                  <span>{t.emoji}</span> {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setShowSearch(v => !v)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors border ${
                  showSearch ? 'bg-sky-500/20 border-sky-500/40 text-sky-400' : 'bg-white/5 border-white/8 text-slate-500'
                }`}
              >
                <Search size={15} />
              </button>
              <button
                onClick={loadFeed}
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
              >
                <RefreshCw size={15} />
              </button>
              {myStores.length > 0 && (
                <button
                  onClick={() => setShowPostModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-black bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-colors active:scale-95"
                >
                  <Plus size={15} /> 작성
                </button>
              )}
            </div>
          </div>

          {/* 검색 */}
          <AnimatePresence>
            {showSearch && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-3"
              >
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="피드 제목, 내용 검색..."
                    className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-slate-600 outline-none focus:border-sky-500/50 transition-colors"
                    autoFocus
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 피드 목록 */}
          {feedLoading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-10 h-10 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mb-3" />
              <p className="text-slate-500 text-sm">피드 불러오는 중...</p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                tone="dark"
                icon={<Megaphone size={40} className="text-slate-600" aria-hidden="true" />}
                title={searchQuery ? '검색 결과 없음' : '피드 없음'}
                description={searchQuery
                  ? `"${searchQuery}"에 해당하는 피드가 없습니다`
                  : feedDistrict
                  ? `${feedDistrict} 지역의 피드가 없습니다`
                  : '매장 주소를 등록하면 지역 피드가 표시됩니다'}
                action={myStores.length > 0 && !searchQuery ? (
                  <button
                    onClick={() => setShowPostModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white text-sm font-black rounded-xl shadow-lg shadow-orange-500/20"
                  >
                    <Plus size={15} /> 첫 번째 피드 작성
                  </button>
                ) : null}
              />
            </motion.div>
          ) : (
            <motion.div layout className="grid sm:grid-cols-2 gap-3">
              <AnimatePresence>
                {filteredPosts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    myStoreIds={myStoreIds}
                    onDelete={handleDeletePost}
                    onLike={handleLikePost}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 탭: 주변 매장                                              */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === 'nearby' && (
        <div>
          {/* 검색 + 새로고침 */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={nearbySearch}
                onChange={e => setNearbySearch(e.target.value)}
                placeholder="매장명, 업종으로 검색..."
                className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-slate-600 outline-none focus:border-sky-500/50 transition-colors"
              />
              {nearbySearch && (
                <button onClick={() => setNearbySearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={loadNearby}
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-slate-500 hover:text-white transition-colors shrink-0"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          {/* 지역 정보 */}
          {nearbyDistrict && (
            <div className="flex items-center gap-2 mb-3 px-1">
              <MapPin size={13} className="text-sky-400" />
              <span className="text-sm font-bold text-sky-400">{nearbyDistrict}</span>
              <span className="text-slate-600 text-sm">· {filteredNearby.length}개 매장</span>
            </div>
          )}

          {nearbyLoading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-10 h-10 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mb-3" />
              <p className="text-slate-500 text-sm">주변 매장 탐색 중...</p>
            </div>
          ) : !selectedStore ? (
            <EmptyState tone="dark" icon={<Store size={40} className="text-slate-600" aria-hidden="true" />} title="매장을 먼저 등록해주세요" />
          ) : !selectedStore.address ? (
            <EmptyState tone="dark" icon={<MapPin size={40} className="text-slate-600" aria-hidden="true" />} title="매장 주소가 필요해요" description="매장 주소를 등록하면 주변 매장을 찾을 수 있어요." />
          ) : filteredNearby.length === 0 ? (
            <EmptyState
              tone="dark"
              icon={<Globe size={40} className="text-slate-600" aria-hidden="true" />}
              title={nearbySearch ? '검색 결과가 없습니다' : '주변 매장이 없습니다'}
              description={nearbySearch ? `"${nearbySearch}"에 해당하는 매장이 없어요.` : '같은 지역의 다른 매장이 없습니다.'}
            />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {filteredNearby.map(store => (
                <NearbyStoreCard
                  key={store.id}
                  store={store}
                  alreadySent={sentIds.has(store.id)}
                  onApply={setPartnerModal}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 탭: 제휴 관리                                              */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === 'partnerships' && (
        <div>
          {/* 서브탭 */}
          <div className="flex gap-2 mb-4">
            {[
              { id: 'received', label: '받은 신청', badge: pendingCount },
              { id: 'sent',     label: '보낸 신청', badge: 0 },
            ].map(st => (
              <button
                key={st.id}
                onClick={() => setPartnerTab(st.id)}
                className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold border transition-all ${
                  partnerTab === st.id
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-white/5 border-white/8 text-slate-500 hover:bg-white/10'
                }`}
              >
                {st.label}
                {st.badge > 0 && (
                  <span className="min-w-[20px] h-5 bg-rose-500 text-white text-xs font-black rounded-full flex items-center justify-center px-1.5">
                    {st.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {partnerLoading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-3" />
              <p className="text-slate-500 text-sm">제휴 현황 불러오는 중...</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {partnerTab === 'received' ? (
                <motion.div key="received" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                  {(partnerships.received || []).length === 0 ? (
                    <div className="text-center py-24">
                      <Bell size={32} className="text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-500 text-sm">받은 제휴 신청이 없습니다.</p>
                      <p className="text-slate-700 text-xs mt-1">주변 매장 탭에서 먼저 홍보해보세요</p>
                    </div>
                  ) : (
                    partnerships.received.map(p => (
                      <PartnershipCard key={p.id} item={p} type="received" onRespond={handleRespondPartnership} />
                    ))
                  )}
                </motion.div>
              ) : (
                <motion.div key="sent" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                  {(partnerships.sent || []).length === 0 ? (
                    <div className="text-center py-24">
                      <Share2 size={32} className="text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-500 text-sm">보낸 제휴 신청이 없습니다.</p>
                      <button
                        onClick={() => setTab('nearby')}
                        className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-sky-500/15 border border-sky-500/30 text-sky-400 text-sm font-bold rounded-xl mx-auto hover:bg-sky-500/25 transition-colors"
                      >
                        <MapPin size={14} /> 주변 매장 탐색하기 <ChevronRight size={14} />
                      </button>
                    </div>
                  ) : (
                    partnerships.sent.map(p => (
                      <PartnershipCard key={p.id} item={p} type="sent" onRespond={handleRespondPartnership} />
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* ── 모달 ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showPostModal && (
          <PostModal
            myStores={myStores}
            onClose={() => setShowPostModal(false)}
            onSuccess={loadFeed}
          />
        )}
        {partnerModal && (
          <PartnershipModal
            targetStore={partnerModal}
            myStores={myStores}
            onClose={() => setPartnerModal(null)}
            onSuccess={() => {
              setSentIds(s => new Set([...s, partnerModal.id]));
              loadPartnerships();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
