import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Search, Navigation, Store, ChevronRight, Loader2, Utensils } from 'lucide-react';
import { storesAPI } from '../api/stores';

/**
 * StoreLocator — 랜딩 "매장 위치" 섹션.
 * 고객 위치(지오로케이션) 기준 거리순 + 지역(구/동)·업종·키워드 검색.
 */
export default function StoreLocator() {
  const [district, setDistrict] = useState('');
  const [businessType, setBusinessType] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [coords, setCoords] = useState(null); // { lat, lng }
  const [stores, setStores] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [geoMsg, setGeoMsg] = useState('');

  const search = useCallback(async (over = {}) => {
    setLoading(true);
    try {
      const params = {
        district: (over.district ?? district) || undefined,
        business_type: (over.businessType ?? businessType) !== 'all' ? (over.businessType ?? businessType) : undefined,
        q: (over.keyword ?? keyword) || undefined,
        lat: (over.coords ?? coords)?.lat,
        lng: (over.coords ?? coords)?.lng,
        limit: 12,
      };
      const res = await storesAPI.searchPublic(params);
      const data = res?.data || res;
      setStores(data.stores || []);
      if (data.facets?.businessTypes?.length) setTypes(data.facets.businessTypes);
    } catch {
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, [district, businessType, keyword, coords]);

  useEffect(() => { search(); /* 최초 로드 */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const useMyLocation = () => {
    if (!navigator.geolocation) { setGeoMsg('브라우저가 위치를 지원하지 않습니다.'); return; }
    setLocating(true); setGeoMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c); setLocating(false); setGeoMsg('내 위치 기준으로 가까운 순 정렬했어요.');
        search({ coords: c });
      },
      () => { setLocating(false); setGeoMsg('위치 권한이 거부되었습니다. 지역명으로 검색해 주세요.'); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <section id="locations" className="py-24 px-6 bg-white relative">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-1.5 bg-orange-100 text-orange-600 rounded-full text-sm font-bold mb-4">매장 위치</span>
          <h2 className="text-4xl font-black text-gray-900 mb-4">내 주변 위마켓 매장 찾기</h2>
          <p className="text-lg text-gray-500">현재 위치 기준으로 가까운 매장을, 지역·업종으로 골라보세요.</p>
        </div>

        {/* 검색 바 */}
        <div className="bg-gray-50 border border-gray-100 rounded-3xl p-4 sm:p-5 mb-8 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* 지역 */}
            <div className="md:col-span-3 relative">
              <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={district} onChange={e => setDistrict(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
                placeholder="지역 (예: 강남구)" aria-label="지역"
                className="w-full h-12 pl-10 pr-3 rounded-xl border border-gray-200 bg-white text-sm font-medium outline-none focus:border-orange-400" />
            </div>
            {/* 업종 */}
            <div className="md:col-span-3 relative">
              <Utensils size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select value={businessType} onChange={e => { setBusinessType(e.target.value); search({ businessType: e.target.value }); }}
                aria-label="업종"
                className="w-full h-12 pl-10 pr-3 rounded-xl border border-gray-200 bg-white text-sm font-medium outline-none focus:border-orange-400 appearance-none">
                <option value="all">전체 업종</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {/* 키워드 */}
            <div className="md:col-span-3 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
                placeholder="매장명 검색" aria-label="매장명"
                className="w-full h-12 pl-10 pr-3 rounded-xl border border-gray-200 bg-white text-sm font-medium outline-none focus:border-orange-400" />
            </div>
            {/* 액션 */}
            <div className="md:col-span-3 flex gap-2">
              <button onClick={useMyLocation} disabled={locating}
                className="flex-1 h-12 flex items-center justify-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 text-orange-600 text-sm font-black hover:bg-orange-100 transition-colors disabled:opacity-50">
                {locating ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />} 내 주변
              </button>
              <button onClick={() => search()}
                className="flex-1 h-12 flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 text-white text-sm font-black hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200">
                <Search size={16} /> 검색
              </button>
            </div>
          </div>
          {geoMsg && <p className="text-xs text-gray-500 mt-2 pl-1">{geoMsg}</p>}
        </div>

        {/* 결과 */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
          </div>
        ) : stores.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-gray-500 font-bold">조건에 맞는 매장이 없어요</p>
            <p className="text-sm text-gray-400 mt-1">지역·업종을 바꾸거나 전체로 검색해 보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stores.map((s, i) => (
              <motion.div key={s.id}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3) }}>
                <Link to={`/menu/${s.id}`}
                  className="block bg-white border border-gray-100 rounded-2xl p-5 hover:border-orange-200 hover:shadow-lg transition-all group">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shrink-0 shadow-md">
                      <Store size={22} className="text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-black text-gray-900 truncate">{s.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {s.business_type && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-500">{s.business_type}</span>
                        )}
                        {s.distance_km != null && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-500 flex items-center gap-0.5">
                            <Navigation size={9} /> {s.distance_km}km
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {s.address && (
                    <p className="text-sm text-gray-500 mt-3 flex items-start gap-1.5">
                      <MapPin size={14} className="mt-0.5 shrink-0 text-gray-400" /> <span className="line-clamp-1">{s.address}</span>
                    </p>
                  )}
                  <div className="flex items-center justify-end mt-3 text-orange-500 text-sm font-black gap-1 group-hover:gap-2 transition-all">
                    메뉴 보기 <ChevronRight size={16} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
