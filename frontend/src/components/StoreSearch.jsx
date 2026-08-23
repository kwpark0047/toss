import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import WaitingSection from './customer/WaitingSection';
import ChatDrawer from './customer/ChatDrawer';
import { storesAPI, waitingAPI, reviewsAPI } from '../api';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './common/LanguageSwitcher';

import StoreFilterBar from './StoreFilterBar';
import StoreCard from './StoreCard';
import StoreMapSection from './StoreMapSection';
import StoreSearchSkeleton from './StoreSearchSkeleton';
import { Store, Search, X, MessageCircle, AlertTriangle, RefreshCw, Server } from 'lucide-react';
import Icon from './ui/Icon';

/** 지역 ID → 백엔드 district 문자열 매핑 */
function regionToDistrict(regionId) {
  const map = {
    seoul: '서울', gyeonggi: '경기', incheon: '인천',
    busan: '부산', daegu: '대구', daejeon: '대전',
    gwangju: '광주', jeju: '제주',
  };
  return map[regionId] || undefined;
}

const PAGE_SIZE = 30;

/**
 * 프리미엄 다크 글래스모피즘 디자인이 적용된 매장 검색 페이지
 * 서버사이드 필터링/페이지네이션 + Leaflet 지도 + 영업시간 표시
 */
function classifyError(error) {
  if (!error.response) return 'network';
  if (error.response.status === 503 || error.response.status === 502) return 'server_sleeping';
  return 'api';
}

const StoreSearch = () => {
  const { _t } = useTranslation();
  const [stores, setStores] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [selectedStore, setSelectedStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const retryTimerRef = useRef(null);

  // 페이지네이션 상태
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // 웨이팅 및 리뷰 상태
  const [showWaiting, setShowWaiting] = useState(false);
  const [selectedStoreForWaiting, setSelectedStoreForWaiting] = useState(null);
  const [waitingCounts, setWaitingCounts] = useState({});
  const [storeRatings, setStoreRatings] = useState({});
  const [showChatDrawer, setShowChatDrawer] = useState(false);

  const [favorites, setFavorites] = useState(new Set());
  const customerPhone = (() => { try { return localStorage.getItem('wm_customer_phone'); } catch { return null; } })();

  useEffect(() => {
    return () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); };
  }, []);

  // ── 매장 검색 (서버사이드) ──
  const fetchStores = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = {
        district: regionToDistrict(selectedRegion),
        business_type: selectedType !== 'all' ? selectedType : undefined,
        q: searchTerm || undefined,
        page: pageNum,
        limit: PAGE_SIZE,
      };
      const res = await storesAPI.searchPublic(params);
      const data = res?.data || res;
      const newStores = data.stores || [];
      const pag = data.pagination || {};

      if (append) {
        setStores(prev => [...prev, ...newStores]);
      } else {
        setStores(newStores);
      }

      setHasMore(pag.hasMore || false);
      setTotal(pag.total || 0);
      setError(null);

      // N+1 쿼리: 웨이팅 수 + 리뷰 조회 (현재 페이지만)
      newStores.forEach(s => {
        fetchWaitingCount(s.id);
        fetchStoreReviews(s.id);
      });
    } catch (err) {
      console.error("매장 로드 실패:", err);
      setError(classifyError(err));
      if (!append) setStores([]);
    } finally {
      setTimeout(() => {
        setLoading(false);
        setLoadingMore(false);
      }, 800);
    }
  }, [selectedRegion, selectedType, searchTerm]);

  // ── 서버 웨이크업 + 자동 재시도 ──
  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      const { wakeupServer } = await import('../api/wakeup');
      await wakeupServer();
      setPage(1);
      await fetchStores(1, false);
    } catch {
      retryTimerRef.current = setTimeout(() => setRetrying(false), 5000);
    } finally {
      setRetrying(false);
    }
  }, [fetchStores]);

  // 최초 로드
  useEffect(() => {
    setPage(1);
    fetchStores(1, false);
  }, [fetchStores]);

  // 필터 변경 시 첫 페이지로 리셋
  const handleRegionChange = (val) => setSelectedRegion(val);
  const handleTypeChange = (val) => setSelectedType(val);

  // ── 더보기 (페이지네이션) ──
  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchStores(nextPage, true);
  };

  // ── 찜 ──
  useEffect(() => {
    if (!customerPhone) return;
    storesAPI.getFavorites(customerPhone).then(res => {
      const list = Array.isArray(res) ? res : (res?.data || []);
      setFavorites(new Set(list.map(s => s.id)));
    }).catch(() => {});
  }, [customerPhone]);

  const toggleFavorite = useCallback(async (storeId, e) => {
    e?.stopPropagation();
    if (!customerPhone) return;
    const wasFav = favorites.has(storeId);
    setFavorites(prev => { const n = new Set(prev); wasFav ? n.delete(storeId) : n.add(storeId); return n; });
    try {
      if (wasFav) await storesAPI.removeFavorite(customerPhone, storeId);
      else await storesAPI.addFavorite(customerPhone, storeId);
    } catch {
      setFavorites(prev => { const n = new Set(prev); wasFav ? n.add(storeId) : n.delete(storeId); return n; });
    }
  }, [customerPhone, favorites]);

  // ── 웨이팅 수 조회 ──
  const fetchWaitingCount = async (storeId) => {
    try {
      const res = await waitingAPI.getStatus(storeId);
      if (res.success) {
        setWaitingCounts(prev => ({ ...prev, [storeId]: res.waiting_teams }));
      }
    } catch (err) {
      console.error('대기 수 조회 실패:', err);
    }
  };

  // ── 리뷰 조회 ──
  const fetchStoreReviews = async (storeId) => {
    try {
      const res = await reviewsAPI.getStoreReviews(storeId);
      if (res.success && res.data.length > 0) {
        const avg = res.data.reduce((acc, curr) => acc + curr.rating, 0) / res.data.length;
        setStoreRatings(prev => ({
          ...prev,
          [storeId]: { rating: avg.toFixed(1), count: res.data.length }
        }));
      }
    } catch (err) {
      console.error('리뷰 정보 조회 실패:', err);
    }
  };

  // ── 필터 초기화 ──
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedRegion('all');
    setSelectedType('all');
    setShowFavoritesOnly(false);
  };

  // ── 찜한 매장 필터 (클라이언트사이드 — 서버에서 이미 로드된 매장 중 필터링) ──
  const displayStores = showFavoritesOnly && customerPhone
    ? stores.filter(s => favorites.has(s.id))
    : stores;

  const hasActiveFilters = searchTerm || selectedRegion !== 'all' || selectedType !== 'all' || showFavoritesOnly;

  const handleWaitClick = (store) => {
    setSelectedStoreForWaiting(store);
    setShowWaiting(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-300 selection:bg-orange-500 selection:text-white">
      {/* 고정 헤더 */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 py-6">
          <div className="flex items-center justify-between gap-10">
            <div className="flex items-center gap-5">
              <Link to="/" className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-2xl shadow-orange-500/20 group relative overflow-hidden">
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Store className="w-7 h-7 text-white relative z-10" />
              </Link>
              <div className="hidden lg:block">
                <h1 className="text-2xl font-black text-white tracking-tighter">위마켓</h1>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Smart Store Search</p>
              </div>
            </div>

            <div className="flex-1 max-w-3xl hidden md:block">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-rose-600 rounded-[24px] blur opacity-10 group-focus-within:opacity-30 transition duration-1000" />
                <div className="relative flex items-center bg-white/5 hover:bg-white/10 transition-all rounded-[20px] px-7 border border-white/5 focus-within:border-orange-500/50">
                  <Search className="w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="찾으시는 매장이나 메뉴를 입력하세요"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchStores(1, false); } }}
                    className="flex-1 bg-transparent border-0 py-5 px-5 text-white placeholder:text-slate-600 placeholder:font-black focus:ring-0 outline-none text-sm font-black"
                  />
                  {searchTerm && (
                    <button onClick={() => { setSearchTerm(''); setPage(1); }} className="p-2 hover:bg-white/10 rounded-full transition-all">
                      <X className="w-4 h-4 text-slate-400" />
                    </button>
                  )}
                  <div className="h-8 w-[1px] bg-white/10 mx-4" />
                  <LanguageSwitcher />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Link to="/login" className="px-6 py-3 rounded-2xl font-black text-sm text-slate-400 hover:text-white transition-colors">로그인</Link>
              <Link to="/register" className="px-8 py-4 bg-white text-slate-950 rounded-[18px] font-black text-sm shadow-2xl hover:bg-orange-500 hover:text-white transition-all active:scale-95"> 시작하기 </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 필터 바 */}
      <StoreFilterBar
        selectedRegion={selectedRegion}
        onRegionChange={handleRegionChange}
        selectedType={selectedType}
        onTypeChange={handleTypeChange}
        showFavoritesOnly={showFavoritesOnly}
        onFavoritesToggle={() => setShowFavoritesOnly(p => !p)}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        customerPhone={customerPhone}
      />

      {/* 메인 콘텐츠 */}
      <main className={`relative overflow-x-hidden ${viewMode === 'map' ? 'h-[calc(100vh-190px)]' : 'max-w-[1600px] mx-auto px-6 sm:px-10 py-16 min-h-screen'}`}>
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <StoreSearchSkeleton />
            </motion.div>
          ) : error && stores.length === 0 ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mt-32 flex flex-col items-center justify-center text-center px-6"
            >
              <div className={`w-40 h-40 rounded-[48px] flex items-center justify-center mb-10 relative border overflow-hidden ${
                error === 'server_sleeping'
                  ? 'bg-amber-500/5 border-amber-500/10'
                  : 'bg-red-500/5 border-red-500/10'
              }`}>
                <div className={`absolute inset-0 blur-2xl ${
                  error === 'server_sleeping'
                    ? 'bg-gradient-to-br from-amber-500/10 to-orange-600/10'
                    : 'bg-gradient-to-br from-red-500/10 to-rose-600/10'
                }`} />
                {error === 'server_sleeping' ? (
                  <Server className="w-16 h-16 text-amber-600/40 relative z-10" />
                ) : (
                  <Icon icon="AlertTriangle" />
                )}
              </div>

              {error === 'server_sleeping' ? (
                <>
                  <h2 className="text-4xl font-black text-white mb-6 tracking-tighter">서버가 시작 중입니다</h2>
                  <p className="text-slate-500 font-medium max-w-md mx-auto leading-relaxed mb-12">
                    Render 서버가 절전 모드에서 깨어나는 중입니다.<br/>
                    자동으로 재시도되거나 아래 버튼을 눌러주세요.
                  </p>
                </>
              ) : error === 'network' ? (
                <>
                  <h2 className="text-4xl font-black text-white mb-6 tracking-tighter">서버에 연결할 수 없습니다</h2>
                  <p className="text-slate-500 font-medium max-w-md mx-auto leading-relaxed mb-12">
                    네트워크 연결을 확인해 주세요.<br/>
                    서버가 일시적으로 사용 불가할 수 있습니다.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-4xl font-black text-white mb-6 tracking-tighter">데이터를 불러올 수 없습니다</h2>
                  <p className="text-slate-500 font-medium max-w-md mx-auto leading-relaxed mb-12">
                    서버에서 오류가 발생했습니다.<br/>
                    잠시 후 다시 시도해 주세요.
                  </p>
                </>
              )}

              <div className="flex gap-4">
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className="px-12 py-5 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-[24px] font-black text-md shadow-2xl shadow-orange-500/20 hover:scale-105 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                >
                  <RefreshCw className={`w-5 h-5 ${retrying ? 'animate-spin' : ''}`} />
                  {retrying ? '서버 연결 중...' : '다시 시도'}
                </button>
                <button
                  onClick={clearFilters}
                  className="px-8 py-5 bg-white/5 border border-white/10 text-white rounded-[24px] font-black text-md hover:bg-white/10 transition-all active:scale-95"
                >
                  검색 조건 초기화
                </button>
              </div>
            </motion.div>
          ) : displayStores.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mt-32 flex flex-col items-center justify-center text-center px-6"
            >
              <div className="w-40 h-40 bg-white/5 rounded-[48px] flex items-center justify-center mb-10 relative border border-white/5 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-rose-600/10 blur-2xl" />
                <Search className="w-16 h-16 text-slate-700 relative z-10" />
              </div>
              <h2 className="text-4xl font-black text-white mb-6 tracking-tighter">찾으시는 매장이 없습니다</h2>
              <p className="text-slate-500 font-medium max-w-md mx-auto leading-relaxed mb-12">
                다른 키워드로 검색하시거나<br/>지역 및 업종 필터를 조정해 보세요.
              </p>
              <button
                onClick={clearFilters}
                className="px-12 py-5 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-[24px] font-black text-md shadow-2xl shadow-orange-500/20 hover:scale-105 transition-all active:scale-95"
              >
                검색 조건 초기화
              </button>
            </motion.div>
          ) : viewMode === 'map' ? (
            <StoreMapSection
              stores={displayStores}
              selectedStore={selectedStore}
              onStoreSelect={setSelectedStore}
              ratings={storeRatings}
            />
          ) : (
            <motion.div
              layout
              key={viewMode}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={viewMode === 'list' ? "max-w-5xl mx-auto space-y-8" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10"}
            >
              {displayStores.map((store, idx) => (
                <motion.div
                  layout
                  key={store.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                >
                  <StoreCard
                    store={store}
                    viewType={viewMode}
                    rating={storeRatings[store.id]?.rating || '5.0'}
                    reviewCount={storeRatings[store.id]?.count || 0}
                    waitingCount={waitingCounts[store.id] || 0}
                    isFavorite={favorites.has(store.id)}
                    onToggleFavorite={toggleFavorite}
                    onWaitClick={handleWaitClick}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 더보기 버튼 */}
        {!loading && hasMore && !showFavoritesOnly && (
          <div className="flex justify-center mt-12 mb-8">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-12 py-4 bg-white/5 border border-white/10 text-white text-sm font-black rounded-[20px] hover:bg-white/10 hover:border-white/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  불러오는 중...
                </span>
              ) : (
                `더보기 (${stores.length} / ${total})`
              )}
            </button>
          </div>
        )}
      </main>

      {/* 웨이팅 모달 */}
      <AnimatePresence>
        {showWaiting && selectedStoreForWaiting && (
          <WaitingSection
            store={selectedStoreForWaiting}
            onClose={() => setShowWaiting(false)}
          />
        )}
      </AnimatePresence>

      {/* 챗봇 버튼 */}
      <button
        onClick={() => {
          const targetStore = selectedStore || stores[0];
          if (!targetStore) return;
          setShowChatDrawer(true);
        }}
        className="fixed bottom-10 right-10 w-20 h-20 bg-white text-slate-950 rounded-[28px] shadow-2xl shadow-white/5 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 group"
        aria-label="고객지원 채팅">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-rose-600 rounded-[28px] scale-0 group-hover:scale-100 transition-transform duration-500" />
        <MessageCircle className="relative z-10 w-8 h-8 group-hover:text-white transition-colors" />
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-4 border-slate-950 group-hover:border-transparent transition-all">1</div>
      </button>

      {/* 고객지원 채팅 드로어 */}
      <ChatDrawer
        isOpen={showChatDrawer}
        onClose={() => setShowChatDrawer(false)}
        store={selectedStore || stores[0] || {}}
        customerInfo={{ phone: customerPhone }}
      />

      <style dangerouslySetInnerHTML={{
        __html: `
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}} />
    </div>
  );
};

export default StoreSearch;
