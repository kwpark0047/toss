import { useState, useEffect, useCallback } from 'react';
import {
  MapPin, Megaphone, Share2, Heart, Eye, Plus, Trash2,
  Store, Clock, Phone, CheckCircle, XCircle, Send,
  ChevronDown, Search, Building2, RefreshCw, Loader2, X
} from 'lucide-react';
import { communityAPI } from '../../api/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import api from '../../api/index.js';

const TYPE_OPTIONS = [
  { value: 'ALL',       label: '전체',   color: 'bg-gray-100 text-gray-700'   },
  { value: 'EVENT',     label: '이벤트', color: 'bg-purple-100 text-purple-700' },
  { value: 'PROMOTION', label: '할인',   color: 'bg-orange-100 text-orange-700' },
  { value: 'NEWS',      label: '소식',   color: 'bg-sky-100 text-sky-700'      },
  { value: 'PRODUCT',   label: '신메뉴', color: 'bg-emerald-100 text-emerald-700' },
];

const TYPE_MAP = Object.fromEntries(TYPE_OPTIONS.map(t => [t.value, t]));

const STATUS_MAP = {
  pending:  { label: '대기중',  color: 'bg-yellow-100 text-yellow-700' },
  accepted: { label: '수락됨',  color: 'bg-green-100 text-green-700'  },
  rejected: { label: '거절됨',  color: 'bg-red-100 text-red-700'      },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

// ── 피드 카드 ──────────────────────────────────────────────────────
function PostCard({ post, myStoreIds = [], onDelete, onLike }) {
  const isMine = myStoreIds.includes(post.store_id);
  const typeInfo = TYPE_MAP[post.type] || TYPE_MAP.NEWS;
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(post.like_count);

  const handleLike = async () => {
    try {
      const res = await onLike(post.id);
      if (res?.data?.liked !== undefined) {
        setLiked(res.data.liked);
        setCount(c => res.data.liked ? c + 1 : c - 1);
      }
    } catch {}
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>
            {typeInfo.label}
          </span>
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Store size={11} /> {post.stores?.name}
          </span>
          {post.stores?.business_type && (
            <span className="text-xs text-gray-400">· {post.stores.business_type}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isMine && (
            <button
              onClick={() => onDelete(post.id)}
              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      <h3 className="font-semibold text-gray-800 mb-1 line-clamp-1">{post.title}</h3>
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{post.content}</p>
      {post.expires_at && (
        <p className="text-xs text-orange-500 mb-2 flex items-center gap-1">
          <Clock size={11} /> {new Date(post.expires_at).toLocaleDateString()} 까지
        </p>
      )}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 transition-colors ${liked ? 'text-red-500' : 'hover:text-red-400'}`}
          >
            <Heart size={13} fill={liked ? 'currentColor' : 'none'} /> {count}
          </button>
          <span className="flex items-center gap-1"><Eye size={13} /> {post.view_count}</span>
        </div>
        <span>{timeAgo(post.created_at)}</span>
      </div>
    </div>
  );
}

// ── 피드 작성 모달 ─────────────────────────────────────────────────
function PostModal({ myStores, onClose, onSuccess }) {
  const [form, setForm] = useState({ store_id: myStores[0]?.id || '', type: 'NEWS', title: '', content: '', expires_at: '' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setErr('제목과 내용을 입력해주세요.'); return;
    }
    setLoading(true);
    try {
      await communityAPI.createPost({
        store_id: form.store_id,
        type: form.type,
        title: form.title,
        content: form.content,
        expires_at: form.expires_at || null,
      });
      onSuccess();
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.error || '게시 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg">피드 작성</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* 매장 선택 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">매장 선택</label>
            <select
              value={form.store_id}
              onChange={e => setForm(f => ({ ...f, store_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {myStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {/* 타입 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">게시 유형</label>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.filter(t => t.value !== 'ALL').map(t => (
                <button
                  key={t.value}
                  onClick={() => setForm(f => ({ ...f, type: t.value }))}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    form.type === t.value ? `${t.color} border-current` : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {/* 제목 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">제목 *</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="예: 5월 스페셜 할인 이벤트!"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400 outline-none"
            />
          </div>
          {/* 내용 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">내용 *</label>
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="이벤트 내용, 할인 정보, 신메뉴 소개 등..."
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400 outline-none resize-none"
            />
          </div>
          {/* 유효기간 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">유효기간 (선택)</label>
            <input
              type="date"
              value={form.expires_at}
              onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {err && <p className="text-red-500 text-sm">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">취소</button>
          <button
            onClick={submit}
            disabled={loading}
            className="px-5 py-2 rounded-lg text-sm bg-sky-500 text-white font-medium hover:bg-sky-600 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            게시하기
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 제휴 신청 모달 ─────────────────────────────────────────────────
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg">제휴 신청</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-sky-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-sky-800">{targetStore.name}</p>
            <p className="text-sky-600 text-xs mt-0.5">{targetStore.business_type} · {targetStore.address}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">내 매장 선택</label>
            <select
              value={storeId}
              onChange={e => setStoreId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {myStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">메시지 (선택)</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="제휴 제안 내용을 간단히 작성해주세요."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400 outline-none resize-none"
            />
          </div>
          {err && <p className="text-red-500 text-sm">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">취소</button>
          <button
            onClick={submit}
            disabled={loading}
            className="px-5 py-2 rounded-lg text-sm bg-sky-500 text-white font-medium hover:bg-sky-600 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
            신청하기
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────────────────
export default function CommunityPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('feed');
  const [myStores, setMyStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);

  // Feed state
  const [feedPosts, setFeedPosts] = useState([]);
  const [feedType, setFeedType] = useState('ALL');
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedDistrict, setFeedDistrict] = useState('');
  const [showPostModal, setShowPostModal] = useState(false);

  // Nearby state
  const [nearbyStores, setNearbyStores] = useState([]);
  const [nearbyDistrict, setNearbyDistrict] = useState('');
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [partnerModal, setPartnerModal] = useState(null);
  const [nearbySearch, setNearbySearch] = useState('');
  const [sentIds, setSentIds] = useState(new Set());

  // Partnership state
  const [partnerships, setPartnerships] = useState({ sent: [], received: [] });
  const [partnerLoading, setPartnerLoading] = useState(false);

  // 내 매장 목록 로드
  useEffect(() => {
    api.get('/stores/my').then(res => {
      const stores = res?.data || res || [];
      const list = Array.isArray(stores) ? stores : [];
      setMyStores(list);
      if (list.length > 0) setSelectedStore(list[0]);
    }).catch(() => {});
  }, []);

  const myStoreIds = myStores.map(s => s.id);

  // ── 피드 로드 ──
  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const params = { type: feedType };
      if (selectedStore?.id) params.store_id = selectedStore.id;
      const res = await communityAPI.getFeed(params);
      setFeedPosts(res?.data?.posts || []);
      setFeedDistrict(res?.data?.district || '');
    } catch {
      setFeedPosts([]);
    } finally {
      setFeedLoading(false);
    }
  }, [feedType, selectedStore]);

  // ── 주변 매장 로드 ──
  const loadNearby = useCallback(async () => {
    if (!selectedStore?.id) return;
    setNearbyLoading(true);
    try {
      const res = await communityAPI.getNearby({ store_id: selectedStore.id });
      setNearbyStores(res?.data?.stores || []);
      setNearbyDistrict(res?.data?.district || '');
    } catch {
      setNearbyStores([]);
    } finally {
      setNearbyLoading(false);
    }
  }, [selectedStore]);

  // ── 제휴 현황 로드 ──
  const loadPartnerships = useCallback(async () => {
    if (!selectedStore?.id) return;
    setPartnerLoading(true);
    try {
      const res = await communityAPI.getPartnerships(selectedStore.id);
      const data = res?.data || { sent: [], received: [] };
      setPartnerships(data);
      setSentIds(new Set((data.sent || []).map(p => p.target_id)));
    } catch {
      setPartnerships({ sent: [], received: [] });
    } finally {
      setPartnerLoading(false);
    }
  }, [selectedStore]);

  useEffect(() => { if (tab === 'feed')         loadFeed(); },         [tab, loadFeed]);
  useEffect(() => { if (tab === 'nearby')        loadNearby(); },       [tab, loadNearby]);
  useEffect(() => { if (tab === 'partnerships')  loadPartnerships(); }, [tab, loadPartnerships]);

  const handleDeletePost = async (id) => {
    if (!window.confirm('피드를 삭제할까요?')) return;
    try {
      await communityAPI.deletePost(id);
      setFeedPosts(p => p.filter(x => x.id !== id));
    } catch (e) {
      alert(e?.response?.data?.error || '삭제 실패');
    }
  };

  const handleLikePost = (id) => communityAPI.likePost(id);

  const handleRespondPartnership = async (id, action) => {
    try {
      await communityAPI.respondPartnership(id, action);
      loadPartnerships();
    } catch (e) {
      alert(e?.response?.data?.error || '처리 실패');
    }
  };

  const filteredNearby = nearbyStores.filter(s =>
    !nearbySearch || s.name.includes(nearbySearch) || (s.business_type || '').includes(nearbySearch)
  );

  const tabs = [
    { id: 'feed',         label: '지역 피드',  icon: Megaphone },
    { id: 'nearby',       label: '주변 매장',  icon: MapPin    },
    { id: 'partnerships', label: '제휴 관리',  icon: Share2    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Building2 className="text-sky-500" size={26} />
          지역 커뮤니티
        </h1>
        <p className="text-sm text-gray-500 mt-1">주변 매장과 연결하고 지역 피드를 공유하세요</p>
      </div>

      {/* 매장 선택 */}
      {myStores.length > 1 && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-gray-600">기준 매장:</span>
          <div className="relative">
            <select
              value={selectedStore?.id || ''}
              onChange={e => setSelectedStore(myStores.find(s => s.id === parseInt(e.target.value)))}
              className="pl-3 pr-8 py-1.5 border border-gray-300 rounded-lg text-sm appearance-none bg-white"
            >
              {myStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          {feedDistrict && tab === 'feed' && (
            <span className="text-xs text-sky-600 flex items-center gap-1">
              <MapPin size={12} /> {feedDistrict}
            </span>
          )}
        </div>
      )}

      {/* 탭 */}
      <div className="flex border-b border-gray-200 mb-5 gap-1">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={15} />
              {t.label}
              {t.id === 'partnerships' && (partnerships.received?.filter(p => p.status === 'pending').length > 0) && (
                <span className="ml-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {partnerships.received.filter(p => p.status === 'pending').length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── 탭: 지역 피드 ── */}
      {tab === 'feed' && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex gap-2 flex-wrap">
              {TYPE_OPTIONS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setFeedType(t.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    feedType === t.value ? `${t.color} ring-1 ring-current` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadFeed}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                title="새로고침"
              >
                <RefreshCw size={15} />
              </button>
              {myStores.length > 0 && (
                <button
                  onClick={() => setShowPostModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-sky-500 text-white text-sm font-medium rounded-lg hover:bg-sky-600"
                >
                  <Plus size={15} /> 피드 작성
                </button>
              )}
            </div>
          </div>

          {feedLoading ? (
            <div className="flex justify-center py-16 text-gray-400">
              <Loader2 size={28} className="animate-spin" />
            </div>
          ) : feedPosts.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Megaphone size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {feedDistrict ? `${feedDistrict} 지역의 피드가 없습니다.` : '매장 주소를 등록하면 지역 피드가 표시됩니다.'}
              </p>
              {myStores.length > 0 && (
                <button
                  onClick={() => setShowPostModal(true)}
                  className="mt-4 px-4 py-2 bg-sky-500 text-white text-sm rounded-lg hover:bg-sky-600"
                >
                  첫 번째 피드 작성하기
                </button>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {feedPosts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  myStoreIds={myStoreIds}
                  onDelete={handleDeletePost}
                  onLike={handleLikePost}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 탭: 주변 매장 ── */}
      {tab === 'nearby' && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {nearbyDistrict && (
                <span className="text-sm text-sky-600 flex items-center gap-1 font-medium">
                  <MapPin size={14} /> {nearbyDistrict} 매장 {filteredNearby.length}개
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={nearbySearch}
                  onChange={e => setNearbySearch(e.target.value)}
                  placeholder="매장명, 업종 검색"
                  className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm w-44"
                />
              </div>
              <button onClick={loadNearby} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {nearbyLoading ? (
            <div className="flex justify-center py-16 text-gray-400">
              <Loader2 size={28} className="animate-spin" />
            </div>
          ) : !selectedStore ? (
            <div className="text-center py-16 text-gray-400">
              <Store size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">매장을 먼저 등록해주세요.</p>
            </div>
          ) : !selectedStore.address ? (
            <div className="text-center py-16 text-gray-400">
              <MapPin size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">매장 주소를 등록하면 주변 매장을 찾을 수 있어요.</p>
            </div>
          ) : filteredNearby.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Store size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">같은 지역의 다른 매장이 없습니다.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {filteredNearby.map(store => {
                const alreadySent = sentIds.has(store.id);
                return (
                  <div key={store.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-800">{store.name}</h3>
                        {store.business_type && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{store.business_type}</span>
                        )}
                      </div>
                      <button
                        onClick={() => setPartnerModal(store)}
                        disabled={alreadySent}
                        className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          alreadySent
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-sky-50 text-sky-600 hover:bg-sky-100 border border-sky-200'
                        }`}
                      >
                        <Share2 size={12} />
                        {alreadySent ? '신청완료' : '제휴신청'}
                      </button>
                    </div>
                    <div className="space-y-1 text-xs text-gray-500">
                      {store.address && (
                        <p className="flex items-center gap-1"><MapPin size={11} /> {store.address}</p>
                      )}
                      {(store.open_time || store.close_time) && (
                        <p className="flex items-center gap-1">
                          <Clock size={11} /> {store.open_time || '--'} ~ {store.close_time || '--'}
                        </p>
                      )}
                      {store.phone && (
                        <p className="flex items-center gap-1"><Phone size={11} /> {store.phone}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 탭: 제휴 관리 ── */}
      {tab === 'partnerships' && (
        <div className="space-y-6">
          {partnerLoading ? (
            <div className="flex justify-center py-16 text-gray-400">
              <Loader2 size={28} className="animate-spin" />
            </div>
          ) : (
            <>
              {/* 받은 제휴 신청 */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-500" />
                  받은 제휴 신청
                  {partnerships.received?.filter(p => p.status === 'pending').length > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                      {partnerships.received.filter(p => p.status === 'pending').length}건 대기
                    </span>
                  )}
                </h3>
                {(!partnerships.received || partnerships.received.length === 0) ? (
                  <div className="bg-gray-50 rounded-xl p-6 text-center text-sm text-gray-400">
                    받은 제휴 신청이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {partnerships.received.map(p => {
                      const s = p.requester_store;
                      const statusInfo = STATUS_MAP[p.status] || STATUS_MAP.pending;
                      return (
                        <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <p className="font-medium text-gray-800">{s?.name}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {s?.business_type} · {s?.address}
                              </p>
                              {p.message && (
                                <p className="text-xs text-gray-600 mt-1.5 bg-gray-50 rounded p-2 italic">"{p.message}"</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                                {statusInfo.label}
                              </span>
                              {p.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleRespondPartnership(p.id, 'accept')}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 border border-green-200"
                                  >
                                    <CheckCircle size={12} /> 수락
                                  </button>
                                  <button
                                    onClick={() => handleRespondPartnership(p.id, 'reject')}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 border border-red-200"
                                  >
                                    <XCircle size={12} /> 거절
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 mt-2">{timeAgo(p.created_at)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 보낸 제휴 신청 */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Send size={16} className="text-sky-500" />
                  보낸 제휴 신청
                </h3>
                {(!partnerships.sent || partnerships.sent.length === 0) ? (
                  <div className="bg-gray-50 rounded-xl p-6 text-center text-sm text-gray-400">
                    보낸 제휴 신청이 없습니다.
                    <br />
                    <button
                      onClick={() => setTab('nearby')}
                      className="mt-2 text-sky-500 hover:underline text-xs"
                    >
                      주변 매장 탭에서 제휴를 신청해보세요
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {partnerships.sent.map(p => {
                      const s = p.target_store;
                      const statusInfo = STATUS_MAP[p.status] || STATUS_MAP.pending;
                      return (
                        <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <p className="font-medium text-gray-800">{s?.name}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {s?.business_type} · {s?.address}
                              </p>
                              {p.message && (
                                <p className="text-xs text-gray-600 mt-1.5 bg-gray-50 rounded p-2 italic">"{p.message}"</p>
                              )}
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-2">{timeAgo(p.created_at)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* 모달들 */}
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
    </div>
  );
}
