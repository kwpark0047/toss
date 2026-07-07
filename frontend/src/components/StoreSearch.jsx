import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import KakaoMap from './KakaoMap';
import { motion, AnimatePresence } from 'framer-motion';
import WaitingSection from './customer/WaitingSection';
import { storesAPI, waitingAPI, reviewsAPI } from '../api';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './common/LanguageSwitcher';
import { bizLabel } from '../utils/businessType';
import { Store, Coffee, Utensils, Cake, Pizza, ShoppingBag, MapPin, Star, BellRing, Search, X, ChevronDown, Grid3X3, List, Map as MapIcon, RefreshCw, Heart, Navigation, MessageCircle, Sparkles, SlidersHorizontal } from 'lucide-react';

const regions = [
  { id: 'all', name: '전체 지역' },
  { id: 'seoul', name: '서울' },
  { id: 'gyeonggi', name: '경기' },
  { id: 'incheon', name: '인천' },
  { id: 'busan', name: '부산' },
  { id: 'daegu', name: '대구' },
  { id: 'daejeon', name: '대전' },
  { id: 'gwangju', name: '광주' },
  { id: 'jeju', name: '제주' }
];

const businessTypes = [
  { id: 'all', name: '전체 업종', icon: Store },
  { id: 'cafe', name: '카페', icon: Coffee },
  { id: 'restaurant', name: '음식점', icon: Utensils },
  { id: 'bakery', name: '베이커리', icon: Cake },
  { id: 'fastfood', name: '패스트푸드', icon: Pizza },
  { id: 'bar', name: '주점', icon: ShoppingBag }
];

// 모듈 레벨 정적 스켈레톤: 부모 렌더마다 재생성 방지 (react-best-practices: rerender-no-inline-components)
const StoreSearchSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
      <div key={i} className="bg-white/5 rounded-[3rem] border border-white/5 overflow-hidden h-[420px] animate-pulse">
        <div className="h-48 bg-white/5" />
        <div className="p-8 space-y-4">
          <div className="flex justify-between items-center">
            <div className="w-1/2 h-6 bg-white/5 rounded-lg" />
            <div className="w-12 h-6 bg-white/5 rounded-lg" />
          </div>
          <div className="w-full h-4 bg-white/5 rounded-lg" />
          <div className="w-3/4 h-4 bg-white/5 rounded-lg" />
          <div className="pt-8 flex justify-between items-center">
            <div className="w-20 h-4 bg-white/5 rounded-lg" />
            <div className="w-28 h-12 bg-white/10 rounded-2xl" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

/**
 * 프리미엄 다크 글래스모피즘 디자인이 적용된 매장 검색 페이지
 * 하이엔드 애니메이션과 세련된 UI를 제공합니다.
 */
const StoreSearch = () => {
  const { t } = useTranslation();
  const [stores, setStores] = useState([]);
  const [filteredStores, setFilteredStores] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedStore, setSelectedStore] = useState(null);
  const [loading, setLoading] = useState(true);

  // 웨이팅 및 리뷰 상태
  const [showWaiting, setShowWaiting] = useState(false);
  const [selectedStoreForWaiting, setSelectedStoreForWaiting] = useState(null);
  const [waitingCounts, setWaitingCounts] = useState({});
  const [storeRatings, setStoreRatings] = useState({});

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const res = await storesAPI.getAll();
      setStores(res.data);
      setFilteredStores(res.data);
      res.data.forEach(s => {
        fetchWaitingCount(s.id);
        fetchStoreReviews(s.id);
      });
    } catch (error) {
      console.error("매장 로드 실패:", error);
    } finally {
      setTimeout(() => setLoading(false), 800);
    }
  };

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

  const filterStores = useCallback(() => {
    let result = [...stores];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(store =>
        store.name.toLowerCase().includes(term) ||
        (store.address || '').toLowerCase().includes(term) ||
        (store.description || '').toLowerCase().includes(term)
      );
    }
    if (selectedRegion !== 'all') {
      result = result.filter(store => store.region === selectedRegion || (store.address && store.address.includes(selectedRegion)));
    }
    if (selectedType !== 'all') {
      result = result.filter(store => store.business_type === selectedType);
    }
    setFilteredStores(result);
  }, [searchTerm, selectedRegion, selectedType, stores]);

  useEffect(() => {
    filterStores();
  }, [filterStores]);

  const getTypeIcon = (type) => {
    const found = businessTypes.find(t => t.id === type);
    return found ? found.icon : Store;
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedRegion('all');
    setSelectedType('all');
  };

  const hasActiveFilters = searchTerm || selectedRegion !== 'all' || selectedType !== 'all';

  const navigate = (path) => window.location.href = path;

  const renderStoreCard = (store, viewType = 'grid') => {
    const TypeIcon = getTypeIcon(store.business_type);
    const rating = storeRatings[store.id]?.rating || '5.0';
    const reviewCount = storeRatings[store.id]?.count || 0;
    const waitingCount = waitingCounts[store.id] || 0;

    if (viewType === 'list') {
      return (
        <motion.div
          layout
          key={store.id}
          onClick={() => navigate("/menu?store=" + store.id)}
          className="group relative bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6 flex flex-col sm:flex-row gap-8 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer overflow-hidden"
        >
           <div className={`absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity`} />
          
          <div className="w-full sm:w-40 h-40 sm:h-auto rounded-[2rem] bg-slate-900 border border-white/5 flex items-center justify-center flex-shrink-0 relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
            <TypeIcon className="w-16 h-16 text-slate-700 group-hover:text-orange-500/50 transition-colors" />
            {waitingCount > 0 && (
              <div className="absolute top-4 left-4 bg-orange-500 text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-xl shadow-orange-500/20 animate-pulse">
                대기 {waitingCount}팀
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-between py-2">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-black text-2xl text-white group-hover:text-orange-400 transition-colors truncate">{store.name}</h3>
                    <span className="px-3 py-1 bg-white/5 text-slate-400 text-[10px] font-black rounded-full uppercase tracking-widest">{bizLabel(store.business_type)}</span>
                  </div>
                  <p className="text-slate-400 font-medium flex items-center gap-2 mb-4 leading-relaxed">
                    <MapPin className="w-4 h-4 text-orange-500" />
                    {store.address || '주소 정보가 없습니다'}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="flex items-center gap-2 bg-amber-500/10 px-4 py-2 rounded-2xl border border-amber-500/20">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className="font-black text-white text-base">{rating}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-500">리뷰 {reviewCount}건</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-orange-500" />
                </div>
                <span className="text-sm font-black text-slate-300">매장 상세 정보 및 주문</span>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedStoreForWaiting(store);
                    setShowWaiting(true);
                  }}
                  className="px-6 py-3 bg-white/5 text-white text-xs font-black rounded-2xl hover:bg-white/10 border border-white/10 transition-all active:scale-95"
                >
                  대기 등록
                </button>
                <button className="px-8 py-3 bg-gradient-to-r from-orange-500 to-rose-600 text-white text-xs font-black rounded-2xl shadow-xl shadow-orange-500/20 hover:scale-105 transition-all active:scale-95">
                  메뉴 확인
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        layout
        key={store.id}
        onClick={() => navigate("/menu?store=" + store.id)}
        className="group relative bg-white/5 backdrop-blur-xl rounded-[3rem] border border-white/5 hover:border-white/15 transition-all cursor-pointer flex flex-col h-full overflow-hidden"
      >
        <div className="h-52 bg-slate-900 flex items-center justify-center relative overflow-hidden">
          <TypeIcon className="w-20 h-20 text-slate-800 group-hover:text-orange-500/30 group-hover:scale-110 transition-all duration-700 ease-out" />
          
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
          
          <div className="absolute inset-0 p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="px-4 py-1.5 bg-slate-950/80 backdrop-blur-xl border border-white/10 text-[10px] font-black text-orange-500 rounded-xl uppercase tracking-widest">
                {bizLabel(store.business_type)}
              </span>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-10 h-10 bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center text-rose-500 shadow-2xl"
              >
                <Heart size={20} />
              </motion.button>
            </div>
            
            <div className="flex items-center gap-3">
              {waitingCount > 0 && (
                <span className="px-4 py-2 bg-orange-600 text-[10px] font-black text-white rounded-xl shadow-2xl shadow-orange-500/30 flex items-center gap-2 animate-pulse">
                  <BellRing size={12} /> 실시간 대기 {waitingCount}팀
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-8 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h3 className="font-black text-xl text-white group-hover:text-orange-400 transition-colors truncate leading-tight">{store.name}</h3>
            <div className="flex items-center gap-2 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 flex-shrink-0">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="font-black text-white text-xs">{rating}</span>
            </div>
          </div>

          <p className="text-sm text-slate-400 font-medium line-clamp-2 mb-8 leading-relaxed flex-1">
            {store.description || store.address || '매장 정보가 아직 등록되지 않았습니다.'}
          </p>

          <div className="flex items-center justify-between pt-6 border-t border-white/5">
            <div className="flex items-center gap-2 text-slate-500">
              <MessageCircle size={16} />
              <span className="text-xs font-black uppercase tracking-widest">리뷰 {reviewCount}건</span>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedStoreForWaiting(store);
                setShowWaiting(true);
              }}
              className="bg-white/5 text-white px-6 py-3 rounded-2xl text-[11px] font-black border border-white/10 hover:bg-orange-600 hover:border-orange-500 transition-all hover:scale-105 active:scale-95"
            >
              대기 신청
            </button>
          </div>
        </div>
      </motion.div>
    );
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
                    className="flex-1 bg-transparent border-0 py-5 px-5 text-white placeholder:text-slate-600 placeholder:font-black focus:ring-0 outline-none text-sm font-black"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="p-2 hover:bg-white/10 rounded-full transition-all">
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

      {/* 필터 섹션 */}
      <section className="bg-slate-950/50 backdrop-blur-xl border-b border-white/5 sticky top-[101px] z-40">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 py-5">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/5 mr-2">
                <SlidersHorizontal size={18} className="text-orange-500" />
                <span className="text-xs font-black text-white uppercase tracking-widest">Filters</span>
              </div>
              
              <div className="relative h-12">
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="h-full pl-6 pr-12 bg-white/5 border border-white/5 rounded-2xl text-xs font-black text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 cursor-pointer appearance-none transition-all hover:bg-white/10"
                >
                  {regions.map(region => (
                    <option key={region.id} value={region.id} className="bg-slate-900">{region.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>

              <div className="relative h-12">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="h-full pl-6 pr-12 bg-white/5 border border-white/5 rounded-2xl text-xs font-black text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 cursor-pointer appearance-none transition-all hover:bg-white/10"
                >
                  {businessTypes.map(type => (
                    <option key={type.id} value={type.id} className="bg-slate-900">{type.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="h-12 px-6 text-xs font-black text-orange-500 hover:bg-orange-500/10 rounded-2xl transition-all flex items-center gap-2 border border-orange-500/20"
                >
                  <RefreshCw size={14} className="animate-spin-slow" /> 필터 초기화
                </button>
              )}
            </div>

            <div className="flex items-center gap-5">
              <div className="flex bg-white/5 p-2 rounded-[22px] border border-white/5 shadow-inner">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-[16px] text-[11px] font-black transition-all ${viewMode === 'grid' ? 'bg-white text-slate-950 shadow-2xl' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <Grid3X3 size={16} /> <span className="hidden sm:block uppercase tracking-[0.2em]">Grid</span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-[16px] text-[11px] font-black transition-all ${viewMode === 'list' ? 'bg-white text-slate-950 shadow-2xl' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <List size={16} /> <span className="hidden sm:block uppercase tracking-[0.2em]">List</span>
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-[16px] text-[11px] font-black transition-all ${viewMode === 'map' ? 'bg-white text-slate-950 shadow-2xl' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <MapIcon size={16} /> <span className="hidden sm:block uppercase tracking-[0.2em]">Map</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

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
          ) : filteredStores.length === 0 ? (
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
            <motion.div
              key="map-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col lg:flex-row"
            >
              <div className="flex-1 relative order-2 lg:order-1 bg-slate-900">
                <KakaoMap
                  stores={filteredStores}
                  onStoreSelect={setSelectedStore}
                  selectedStore={selectedStore}
                />
              </div>

              <div className="w-full lg:w-[450px] bg-slate-950 border-l border-white/5 flex flex-col order-1 lg:order-2 overflow-hidden">
                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <Sparkles className="text-orange-500" size={20} />
                    <h3 className="text-xl font-black text-white">추천 플레이스</h3>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 bg-white/5 px-3 py-1.5 rounded-xl uppercase tracking-widest">{filteredStores.length} Stores</span>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {filteredStores.map((store, i) => (
                    <motion.div
                      key={store.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setSelectedStore(store)}
                      whileHover={{ x: -4 }}
                      className={`p-6 rounded-[2.5rem] border transition-all cursor-pointer group ${selectedStore?.id === store.id ? 'bg-orange-500/10 border-orange-500/50 shadow-2xl shadow-orange-500/10' : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.08] hover:border-white/10'}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-black text-white group-hover:text-orange-400 transition-colors truncate max-w-[220px]">{store.name}</h4>
                        <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1 rounded-xl border border-white/5">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          <span className="text-[11px] font-black text-white">{storeRatings[store.id]?.rating || '5.0'}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium truncate mb-4">{store.address}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">{bizLabel(store.business_type)}</span>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 group-hover:text-white transition-colors">
                          상세보기 <ChevronDown size={14} className="-rotate-90" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              layout
              key={viewMode}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={viewMode === 'list' ? "max-w-5xl mx-auto space-y-8" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10"}
            >
              {filteredStores.map((store, idx) => (
                <motion.div
                  layout
                  key={store.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                >
                  {renderStoreCard(store, viewMode)}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
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
      <button className="fixed bottom-10 right-10 w-20 h-20 bg-white text-slate-950 rounded-[28px] shadow-2xl shadow-white/5 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 group">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-rose-600 rounded-[28px] scale-0 group-hover:scale-100 transition-transform duration-500" />
        <MessageCircle className="relative z-10 w-8 h-8 group-hover:text-white transition-colors" />
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-4 border-slate-950 group-hover:border-transparent transition-all">1</div>
      </button>

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
