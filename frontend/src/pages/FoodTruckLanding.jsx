import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  MapPin, Search, Navigation, Truck, ArrowRight, 
  Clock, Sparkles, AlertCircle, ShoppingBag, ShieldAlert
} from 'lucide-react';

export default function FoodTruckLanding() {
  const navigate = useNavigate();
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userCoords, setUserCoords] = useState(null);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [locatingUser, setLocatingUser] = useState(false);

  // 백엔드 API로부터 활성 푸드트럭 목록 조회
  useEffect(() => {
    async function fetchActiveTrucks() {
      try {
        setLoading(true);
        // Vite의 프록시 또는 절대경로 자동 바인딩 활용
        const res = await fetch('/api/v1/foodtruck/active');
        if (!res.ok) throw new Error('푸드트럭 정보를 불러오는데 실패했습니다.');
        
        const json = await res.json();
        const data = json.data || json;
        setTrucks(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchActiveTrucks();
  }, []);

  // 사용자 위치 획득 (거리 계산용)
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('이 브라우저는 위치 서비스를 지원하지 않습니다.');
      return;
    }
    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });
        setLocatingUser(false);
      },
      (err) => {
        console.error(err);
        alert('위치 권한을 획득하지 못했습니다. 기본 정렬이 적용됩니다.');
        setLocatingUser(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // 두 위경도 사이의 직선거리(m) 계산 (Haversine 공식)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371e3; // 지구 반경 (m)
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // 미터 단위 거리
  };

  // 트럭 데이터 가공 (거리 계산 및 필터링, 정렬)
  const processedTrucks = useMemo(() => {
    return trucks
      .map(truck => {
        const dist = userCoords
          ? calculateDistance(
              userCoords.latitude,
              userCoords.longitude,
              truck.latitude,
              truck.longitude
            )
          : null;
        return { ...truck, distance: dist };
      })
      .filter(truck => {
        const matchesSearch = 
          truck.store?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          truck.geocoded_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          truck.store?.category?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
      })
      .sort((a, b) => {
        // 1순위: 영업중 세션인 곳 먼저
        if (a.is_active_session && !b.is_active_session) return -1;
        if (!a.is_active_session && b.is_active_session) return 1;
        
        // 2순위: 내 위치 기준 가까운 순
        if (a.distance !== null && b.distance !== null) {
          return a.distance - b.distance;
        }
        return 0;
      });
  }, [trucks, searchTerm, userCoords]);

  // 거리 포맷터 유틸리티
  const formatDistance = (meters) => {
    if (meters === null || meters === undefined) return '';
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-12">
      {/* 장식용 그래디언트 백그라운드 오버레이 */}
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.12),transparent_70%)] pointer-events-none" />

      {/* 헤더 */}
      <header className="border-b border-slate-900 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Truck size={16} className="text-white" />
            </div>
            <span className="text-lg font-black tracking-tighter uppercase bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent">
              WeMarket <span className="text-white font-bold text-sm lowercase tracking-normal">food truck</span>
            </span>
          </div>
          <Link
            to="/admin"
            className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950/40 transition-all"
          >
            점주 센터 이동
          </Link>
        </div>
      </header>

      {/* 메인 히어로 */}
      <section className="max-w-6xl mx-auto w-full px-4 pt-10 pb-6 text-center md:text-left md:flex md:items-center md:justify-between gap-8 relative z-10">
        <div className="max-w-lg mb-6 md:mb-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-bold mb-4">
            <Sparkles size={12} /> 실시간 푸드트럭 추적기
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-3">
            지금 가장 핫한 푸드트럭,<br />
            <span className="bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-transparent">실시간 위치</span>를 찾아보세요!
          </h1>
          <p className="text-slate-400 text-sm font-medium leading-relaxed">
            GPS 연동 주소와 비상 품절 여부를 실시간으로 반영하여 어딘지 헤매지 않고 최고의 로컬 미식을 스마트하게 즐길 수 있습니다.
          </p>
        </div>

        {/* 내 위치 권한 버튼 */}
        <div className="flex justify-center md:justify-end">
          <button
            onClick={handleGetLocation}
            disabled={locatingUser}
            className="flex items-center gap-2.5 px-6 py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white font-bold text-sm shadow-xl shadow-orange-500/15 hover:shadow-orange-500/25 active:scale-95 disabled:opacity-50 transition-all"
          >
            <Navigation size={15} className={locatingUser ? 'animate-pulse' : ''} />
            {locatingUser ? '사용자 위치 파악 중...' : '내 주변 푸드트럭 찾기'}
          </button>
        </div>
      </section>

      {/* 검색 바 */}
      <section className="max-w-6xl mx-auto w-full px-4 mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="푸드트럭 명칭, 파는 요리, 상권(홍대, 강남역 등) 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm font-bold focus:outline-none focus:border-orange-500/50 transition-all focus:ring-4 focus:ring-orange-500/5"
          />
        </div>
      </section>

      {/* 메인 레이아웃: 좌 리스트 / 우 지도 미리보기 */}
      <section className="max-w-6xl mx-auto w-full px-4 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* 왼쪽: 리스트 (7/12) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-1 mb-2">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              푸드트럭 목록 ({processedTrucks.length}개)
            </h2>
            {userCoords && (
              <span className="text-xs text-orange-500 font-bold">
                📍 내 위치 좌표 연결 완료
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-16 h-16 rounded-xl bg-slate-800" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-800 rounded w-1/3" />
                      <div className="h-3 bg-slate-800 rounded w-1/2" />
                      <div className="h-3 bg-slate-800 rounded w-1/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center rounded-2xl border border-slate-900 bg-slate-900/20 text-slate-400">
              <AlertCircle size={32} className="text-rose-500 mx-auto mb-3" />
              <p className="font-bold text-sm mb-2">{error}</p>
              <p className="text-xs text-slate-500">백엔드 서버 API 구동 여부와 연결망 상태를 확인해 주세요.</p>
            </div>
          ) : processedTrucks.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-dashed border-slate-850 bg-slate-900/10 text-slate-400">
              <Truck size={40} className="text-slate-650 mx-auto mb-3" />
              <p className="font-bold text-sm mb-1">매칭되는 푸드트럭이 없습니다.</p>
              <p className="text-xs text-slate-500">다른 명칭으로 검색하거나 주변 위치 검색을 다시 요청해 주세요.</p>
            </div>
          ) : (
            processedTrucks.map((truck) => {
              const isActive = truck.is_active_session;
              const isEmergency = truck.is_sold_out_emergency;
              const isSelected = selectedTruck?.store_id === truck.store_id;

              return (
                <div
                  key={truck.store_id}
                  onClick={() => setSelectedTruck(truck)}
                  className={`border transition-all rounded-3xl p-5 cursor-pointer flex flex-col sm:flex-row gap-5 relative overflow-hidden group ${
                    isSelected
                      ? 'bg-slate-900/80 border-orange-500 ring-2 ring-orange-500/10'
                      : 'bg-slate-900/30 border-slate-900 hover:border-slate-800 hover:bg-slate-900/40'
                  }`}
                >
                  {/* 카테고리 배지 */}
                  <div className="absolute top-4 right-4 flex gap-1.5">
                    {isEmergency && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/25 text-rose-500 text-[10px] font-bold flex items-center gap-1 animate-pulse">
                        <ShieldAlert size={10} /> 전체 품절
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                      isActive 
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                        : 'bg-slate-800 border border-slate-700 text-slate-400'
                    }`}>
                      {isActive ? '● 영업중' : '준비중'}
                    </span>
                  </div>

                  {/* 트럭 대표 아이콘 */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-850 to-slate-900 flex items-center justify-center flex-shrink-0 border border-slate-800 group-hover:scale-105 transition-all">
                    <Truck className={`w-8 h-8 ${isActive ? 'text-orange-500' : 'text-slate-500'}`} />
                  </div>

                  {/* 트럭 상세 내용 */}
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-white truncate">{truck.store?.name || '푸드트럭'}</h3>
                      {truck.store?.category && (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-800/40 px-1.5 py-0.5 rounded-md">
                          {truck.store.category}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <MapPin size={13} className="text-slate-500" />
                      <span className="truncate font-semibold">{truck.geocoded_address || '주소 정보 없음'}</span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-bold pt-1">
                      {isActive && (
                        <div className="flex items-center gap-1 text-slate-400">
                          <Clock size={12} className="text-slate-500" />
                          <span>실시간 영업중</span>
                        </div>
                      )}
                      {truck.distance !== null && (
                        <div className="flex items-center gap-1 text-orange-500">
                          <Navigation size={12} />
                          <span>{formatDistance(truck.distance)} 거리</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 주문 바로가기 영역 */}
                  <div className="flex sm:flex-col justify-end pt-3 sm:pt-0 sm:border-l sm:border-slate-850 sm:pl-5 gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isEmergency) {
                          alert('현재 재료 소진 긴급 마감 상태로, 주문이 불가능합니다.');
                          return;
                        }
                        navigate(`/menu/${truck.store_id}`);
                      }}
                      disabled={!isActive || isEmergency}
                      className={`w-full sm:w-28 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 ${
                        isActive && !isEmergency
                          ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/10'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      }`}
                    >
                      <ShoppingBag size={12} />
                      메뉴판 바로가기
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 오른쪽: 위치 지도 미리보기 (5/12) */}
        <div className="lg:col-span-5 h-[350px] lg:h-[calc(100vh-12rem)] lg:sticky lg:top-28 rounded-3xl overflow-hidden border border-slate-900 bg-slate-900/20 flex flex-col relative">
          
          {selectedTruck ? (
            <>
              {/* 지도 가상 렌더링 캔버스 */}
              <div className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center group">
                {/* 그리드 모눈 배경 오버레이 */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(249,115,22,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(249,115,22,0.02)_1px,transparent_1px)] bg-[size:24px_24px]" />
                <div className="absolute w-[200%] h-[200%] bg-[radial-gradient(circle_at_50%_50%,rgba(249,115,22,0.03),transparent_60%)] animate-pulse" />

                {/* 가상 구역 레이블 */}
                <div className="absolute top-6 left-6 text-[10px] font-black tracking-widest text-slate-600 uppercase">
                  Radar Floor Canvas
                </div>

                {/* 선택한 트럭 레이더 링 파장 효과 */}
                <div className="absolute w-32 h-32 rounded-full border border-orange-500/20 bg-orange-500/5 animate-ping" />
                <div className="absolute w-16 h-16 rounded-full border border-orange-500/40 bg-orange-500/10" />

                {/* 핀 드롭 */}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-xl shadow-orange-500/30 border-2 border-white animate-bounce">
                    <Truck size={20} className="text-white" />
                  </div>
                  <span className="mt-3 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-black text-white shadow-xl max-w-[200px] truncate text-center">
                    {selectedTruck.store?.name}
                  </span>
                </div>

                {/* 좌표 메타 정보 표시 */}
                <div className="absolute bottom-6 left-6 text-left">
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">GPS COORDS</p>
                  <code className="text-xs text-orange-500/80 font-mono tracking-tighter">
                    {selectedTruck.latitude.toFixed(6)}, {selectedTruck.longitude.toFixed(6)}
                  </code>
                </div>
              </div>

              {/* 하단 상세 주소 요약 패널 */}
              <div className="p-5 border-t border-slate-900 bg-slate-900/60 backdrop-blur-md space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-white">{selectedTruck.store?.name}</h4>
                    <p className="text-xs text-slate-400 font-semibold mt-1">{selectedTruck.geocoded_address}</p>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                    selectedTruck.is_active_session 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {selectedTruck.is_active_session ? '영업 세션 ON' : '준비중'}
                  </span>
                </div>

                <button
                  onClick={() => {
                    if (selectedTruck.is_sold_out_emergency) {
                      alert('현재 재료 소진으로 주문이 정지되었습니다.');
                      return;
                    }
                    navigate(`/menu/${selectedTruck.store_id}`);
                  }}
                  disabled={!selectedTruck.is_active_session || selectedTruck.is_sold_out_emergency}
                  className={`w-full py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                    selectedTruck.is_active_session && !selectedTruck.is_sold_out_emergency
                      ? 'bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white shadow-xl shadow-orange-500/10'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
                  }`}
                >
                  실시간 주문하러 가기 <ArrowRight size={12} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950/30">
              <MapPin size={32} className="text-slate-700 mb-3" />
              <p className="font-bold text-sm text-slate-400">지도가 여기에 표시됩니다</p>
              <p className="text-xs text-slate-500 mt-1 max-w-[240px] leading-relaxed">
                좌측 푸드트럭 카드 중 하나를 선택하면 실시간 위치 매핑 및 정방향 핀 드롭 좌표가 활성화됩니다.
              </p>
            </div>
          )}

        </div>

      </section>
    </div>
  );
}
