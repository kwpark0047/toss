import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  MapPin, Search, Navigation, Truck, ArrowRight,
  Clock, Sparkles, AlertCircle, ShoppingBag, ShieldAlert, Home, Store,
  CreditCard, BookOpen, Mail, Smartphone, Signal, Fuel, AlertTriangle, Zap, CalendarCheck
} from 'lucide-react';

/* ─── Lazy-load foodtruck-specific marketing pages ─── */
const FeaturesPage = lazy(() => import('./foodtruck/FoodTruckFeatures'));
const PricingPage = lazy(() => import('./foodtruck/FoodTruckPricing'));
const GuidesPage = lazy(() => import('./foodtruck/FoodTruckGuides'));
const ContactPage = lazy(() => import('./foodtruck/FoodTruckContact'));

/* ─── Leaflet CDN helpers (copied from StoreMapLeaflet — no import dependency) ─── */
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

function injectCss(href) {
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    let script = document.querySelector(`script[src="${src}"]`);
    if (script) {
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => reject(), { once: true });
      return;
    }
    script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(), { once: true });
    document.head.appendChild(script);
  });
}

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    injectCss(LEAFLET_CSS);
    loadScript(LEAFLET_JS).then(() => resolve(window.L)).catch(reject);
  });
}

/* ─── Truck icon for Leaflet markers ─── */
function buildTruckIcon(L) {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:34px;height:42px;filter:drop-shadow(0 3px 4px rgba(0,0,0,.3))">`
      + `<div style="width:34px;height:34px;background:#fff;border:2.5px solid #f97316;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;">`
      + `<span style="transform:rotate(45deg);font-size:16px;line-height:1;">🚚</span></div></div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
    popupAnchor: [0, -38],
  });
}

function buildUserIcon(L) {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,.3)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/* ─── Category filter chips ─── */
const CATEGORIES = [
  { id: 'all', label: '전체' },
  { id: '한식', label: '한식' },
  { id: '커피숍', label: '커피' },
  { id: '분식', label: '분식' },
  { id: '패스트푸드', label: '패스트푸드' },
  { id: '기타', label: '기타' },
];

/* ─── Component ─── */
export default function FoodTruckLanding() {
  const navigate = useNavigate();
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [userCoords, setUserCoords] = useState(null);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [activeTab, setActiveTab] = useState('finder');

  // Leaflet map refs
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  /* ─── Fetch active trucks ─── */
  const fetchActiveTrucks = async () => {
    try {
      if (!trucks.length) setLoading(true);
      const res = await fetch('/api/v1/foodtruck/active');
      if (!res.ok) throw new Error('푸드트럭 정보를 불러오는데 실패했습니다.');
      const json = await res.json();
      const data = json.data || json;
      setTrucks(Array.isArray(data) ? data : []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error(err);
      if (!trucks.length) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveTrucks();
    const interval = setInterval(fetchActiveTrucks, 30000);
    return () => clearInterval(interval);
  }, []);

  /* ─── Geolocation ─── */
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('이 브라우저는 위치 서비스를 지원하지 않습니다.');
      return;
    }
    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocatingUser(false);
      },
      () => {
        alert('위치 권한을 획득하지 못했습니다. 기본 정렬이 적용됩니다.');
        setLocatingUser(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  /* ─── Haversine distance ─── */
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371e3;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const formatDistance = (meters) => {
    if (meters == null) return '';
    return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
  };

  /* ─── Processed + filtered trucks ─── */
  const processedTrucks = useMemo(() => {
    return trucks
      .map(truck => ({
        ...truck,
        distance: userCoords
          ? calculateDistance(userCoords.latitude, userCoords.longitude, truck.latitude, truck.longitude)
          : null,
      }))
      .filter(truck => {
        const matchesSearch =
          truck.store?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          truck.geocoded_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          truck.store?.category?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory =
          categoryFilter === 'all' || truck.store?.category === categoryFilter;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (a.is_active_session && !b.is_active_session) return -1;
        if (!a.is_active_session && b.is_active_session) return 1;
        if (a.distance != null && b.distance != null) return a.distance - b.distance;
        return 0;
      });
  }, [trucks, searchTerm, categoryFilter, userCoords]);

  /* ─── Leaflet map initialization ─── */
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !mapContainerRef.current || mapRef.current) return;
      const map = L.map(mapContainerRef.current, { scrollWheelZoom: false }).setView([37.5665, 126.978], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      markersLayerRef.current = L.layerGroup().addTo(map);
      if (!cancelled) setMapReady(true);
    }).catch(() => {});
    return () => {
      cancelled = true;
      setMapReady(false);
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  /* ─── Update markers when trucks or selection change ─── */
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();

    const pts = [];
    const truckIcon = buildTruckIcon(L);
    const userIcon = buildUserIcon(L);

    processedTrucks.forEach((truck) => {
      if (truck.latitude == null || truck.longitude == null) return;
      const m = L.marker([truck.latitude, truck.longitude], { icon: truckIcon, title: truck.store?.name });
      const popup = document.createElement('div');
      popup.style.cssText = 'font-family:sans-serif;min-width:150px';
      const name = document.createElement('div');
      name.style.cssText = 'font-weight:900;font-size:13px;color:#0f172a';
      name.textContent = truck.store?.name || '푸드트럭';
      popup.appendChild(name);
      if (truck.geocoded_address) {
        const addr = document.createElement('div');
        addr.style.cssText = 'font-size:11px;color:#64748b;margin-top:2px';
        addr.textContent = truck.geocoded_address;
        popup.appendChild(addr);
      }
      if (truck.is_active_session) {
        const status = document.createElement('div');
        status.style.cssText = 'font-size:10px;color:#10b981;font-weight:700;margin-top:3px';
        status.textContent = '● 영업중';
        popup.appendChild(status);
      }
      const link = document.createElement('a');
      link.href = `/menu/${truck.store_id}`;
      link.style.cssText = 'display:inline-block;margin-top:6px;background:#f97316;color:#fff;font-weight:800;font-size:11px;padding:4px 10px;border-radius:6px;text-decoration:none';
      link.textContent = '메뉴 보기 →';
      popup.appendChild(link);
      m.bindPopup(popup);
      m.on('click', () => setSelectedTruck(truck));
      layer.addLayer(m);
      pts.push([truck.latitude, truck.longitude]);
    });

    if (userCoords) {
      const um = L.marker([userCoords.latitude, userCoords.longitude], { icon: userIcon, title: '내 위치' });
      layer.addLayer(um);
      pts.push([userCoords.latitude, userCoords.longitude]);
    }

    if (pts.length === 1) map.setView(pts[0], 15);
    else if (pts.length > 1) map.fitBounds(pts, { padding: [50, 50], maxZoom: 15 });
  }, [processedTrucks, userCoords]);

  /* ─── Center map on selected truck ─── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedTruck || selectedTruck.latitude == null) return;
    map.setView([selectedTruck.latitude, selectedTruck.longitude], 15);
  }, [selectedTruck]);

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
      {/* Decorative gradient overlay */}
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.05),transparent_70%)] pointer-events-none" />

      {/* ─── Header ─── */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors">
              <Home size={16} />
              <span className="text-xs font-bold hidden sm:inline">홈으로</span>
            </Link>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Truck size={16} className="text-white" />
              </div>
              <span className="text-lg font-black tracking-tighter uppercase bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent">
                WeMarket <span className="text-slate-900 font-bold text-sm lowercase tracking-normal">food truck</span>
              </span>
            </div>
            {/* Live indicator */}
            {lastRefresh && (
              <span className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-black">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="text-xs font-bold text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 bg-white transition-all"
            >
              점주 센터
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Tab Navigation ─── */}
      <div className="sticky top-16 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide py-2 -mx-1">
            {[
              { id: 'finder', label: '매장찾기', icon: Truck },
              { id: 'features', label: '기능소개', icon: Sparkles },
              { id: 'pricing', label: '요금제', icon: CreditCard },
              { id: 'guides', label: '이용가이드', icon: BookOpen },
              { id: 'contact', label: '문의하기', icon: Mail },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                    : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-slate-200'
                }`}
              >
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Foodtruck Features Banner (_finder tab only) ─── */}
      {activeTab === 'finder' && (
      <section className="border-b border-slate-200 bg-white py-12 px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 text-xs font-mono font-bold mb-4">
              <Sparkles className="size-3.5" />
              <span>FOOD TRUCK FEATURES</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">
              이동식 푸드트럭을 위한<br />
              <span className="bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-transparent">모바일 우선 솔루션</span>
            </h2>
            <p className="text-slate-500 text-sm max-w-xl mx-auto">
              GPS 실시간 동기화, 긴급 품절 제어, 불안정 네트워크 대응까지 이동형 비즈니스에 최적화된 기능을 제공합니다.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { icon: Navigation, title: 'GPS 위치 싱크', desc: '실시간 이동 위치 추적' },
              { icon: AlertTriangle, title: '킬스위치', desc: '원터치 전 메뉴 품절' },
              { icon: Smartphone, title: '모바일 주문', desc: '앱 설치 없이 주문' },
              { icon: Signal, title: '하트비트', desc: '네트워크 끊김 자동 대응' },
              { icon: Zap, title: '스마트 거점', desc: 'AI 최적 영업 위치 추천' },
              { icon: Fuel, title: '동선 최적화', desc: '연료·매출 동시 계산' },
            ].map((feat, i) => (
              <div key={i} className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-2xl p-4 text-center transition-all hover:scale-[1.02]">
                <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center">
                  <feat.icon className="size-5" />
                </div>
                <h3 className="text-xs font-black text-slate-900 mb-1">{feat.title}</h3>
                <p className="text-[10px] text-slate-500 leading-tight">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ─── Hero ─── */}
      {activeTab === 'finder' && (<>
      <section className="max-w-6xl mx-auto w-full px-4 pt-10 pb-6 text-center md:text-left md:flex md:items-center md:justify-between gap-8 relative z-10">
        <div className="max-w-lg mb-6 md:mb-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-bold mb-4">
            <Sparkles size={12} /> 실시간 푸드트럭 추적기
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-3">
            지금 가장 핫한 푸드트럭,<br />
            <span className="bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-transparent">실시간 위치</span>를 찾아보세요!
          </h1>
          <p className="text-slate-500 text-sm font-medium leading-relaxed">
            GPS 연동 주소와 비상 품절 여부를 실시간으로 반영하여 어딘지 헤매지 않고 최고의 로컬 미식을 스마트하게 즐길 수 있습니다.
          </p>
        </div>
        <div className="flex justify-center md:justify-end">
          <button
            onClick={handleGetLocation}
            disabled={locatingUser}
            className="flex items-center gap-2.5 px-6 py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white font-bold text-sm shadow-xl shadow-orange-500/15 hover:shadow-orange-500/25 active:scale-95 disabled:opacity-50 transition-all"
          >
            <Navigation size={15} className={locatingUser ? 'animate-pulse' : ''} />
            {locatingUser ? '위치 파악 중...' : '내 주변 푸드트럭 찾기'}
          </button>
        </div>
      </section>

      {/* ─── Search + Filters ─── */}
      <section className="max-w-6xl mx-auto w-full px-4 mb-6 space-y-4 relative z-10">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="푸드트럭 명칭, 요리, 상권(홍대, 강남역 등) 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-bold focus:outline-none focus:border-orange-500/50 transition-all focus:ring-4 focus:ring-orange-500/5"
          />
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                categoryFilter === cat.id
                  ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/15'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* ─── Main: List + Map ─── */}
      <section className="max-w-6xl mx-auto w-full px-4 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10 pb-12">

        {/* Left: truck list */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-1 mb-2">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              푸드트럭 목록 ({processedTrucks.length}개)
            </h2>
            {userCoords && (
              <span className="text-xs text-orange-500 font-bold">📍 내 위치 연결</span>
            )}
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-16 h-16 rounded-xl bg-slate-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-1/3" />
                      <div className="h-3 bg-slate-200 rounded w-1/2" />
                      <div className="h-3 bg-slate-200 rounded w-1/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
              <AlertCircle size={32} className="text-rose-500 mx-auto mb-3" />
              <p className="font-bold text-sm mb-2">{error}</p>
              <p className="text-xs text-slate-400">백엔드 서버 연결 상태를 확인해 주세요.</p>
            </div>
          ) : processedTrucks.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 text-slate-500">
              <Truck size={40} className="text-slate-400 mx-auto mb-3" />
              <p className="font-bold text-sm mb-1">매칭되는 푸드트럭이 없습니다.</p>
              <p className="text-xs text-slate-500">다른 검색어나 카테고리를 시도해 보세요.</p>
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
                      ? 'bg-orange-50 border-orange-500 ring-2 ring-orange-500/10'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {/* Status badges */}
                  <div className="absolute top-4 right-4 flex gap-1.5">
                    {isEmergency && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/25 text-rose-500 text-[10px] font-bold flex items-center gap-1 animate-pulse">
                        <ShieldAlert size={10} /> 품절
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                      isActive
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                        : 'bg-slate-100 border border-slate-200 text-slate-500'
                    }`}>
                      {isActive ? '● 영업중' : '준비중'}
                    </span>
                  </div>

                  {/* Truck icon */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0 border border-slate-200 group-hover:scale-105 transition-all">
                    <Truck className={`w-8 h-8 ${isActive ? 'text-orange-500' : 'text-slate-500'}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-slate-900 truncate">{truck.store?.name || '푸드트럭'}</h3>
                      {truck.store?.category && (
                        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-md">
                          {truck.store.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <MapPin size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate font-semibold">{truck.geocoded_address || '주소 정보 없음'}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold pt-1">
                      {isActive && (
                        <div className="flex items-center gap-1 text-emerald-600">
                          <Clock size={12} />
                          <span>영업중</span>
                        </div>
                      )}
                      {truck.distance != null && (
                        <div className="flex items-center gap-1 text-orange-500">
                          <Navigation size={12} />
                          <span>{formatDistance(truck.distance)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order button */}
                  <div className="flex sm:flex-col justify-end pt-3 sm:pt-0 sm:border-l sm:border-slate-200 sm:pl-5 gap-2 shrink-0">
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
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      }`}
                    >
                      <ShoppingBag size={12} />
                      주문
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Leaflet map */}
        <div className="lg:col-span-5 h-[400px] lg:h-[calc(100vh-12rem)] lg:sticky lg:top-28 rounded-3xl overflow-hidden border border-slate-200 bg-slate-50 relative">
          <div ref={mapContainerRef} className="w-full h-full" />
          {/* Map loading overlay */}
          {!mapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <p className="text-sm text-slate-500 font-bold">지도를 불러오는 중…</p>
            </div>
          )}
          {/* Selected truck detail panel */}
          {selectedTruck && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 z-[500] space-y-2">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <h4 className="text-sm font-black text-slate-900 truncate">{selectedTruck.store?.name}</h4>
                  <p className="text-xs text-slate-500 font-semibold truncate">{selectedTruck.geocoded_address}</p>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 ml-2 ${
                  selectedTruck.is_active_session
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}>
                  {selectedTruck.is_active_session ? '영업중' : '준비중'}
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
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                }`}
              >
                실시간 주문하러 가기 <ArrowRight size={12} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="border-t border-slate-200 bg-white py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-black text-slate-900 mb-2">이용 방법</h2>
            <p className="text-slate-500 text-sm">단 3단계로 푸드트럭을 주문하세요</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { num: '①', title: '내 위치 연결', desc: 'GPS로 현재 위치를 파악하고 가장 가까운 푸드트럭을 찾습니다.' },
              { num: '②', title: '푸드트럭 선택', desc: '실시간 영업 상태와 거리를 확인하고 마음에 드는 트럭을 고릅니다.' },
              { num: '③', title: '메뉴 주문', desc: '메뉴판에서 원하는 음식을 선택하고 바로 주문합니다.' },
            ].map((step, i) => (
              <div key={i} className="text-center p-6 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-orange-500/20">
                  {step.num}
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-2">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      </>)}

      {activeTab === 'features' && (
        <div className="relative z-10 flex-1">
          <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>}>
            <FeaturesPage />
          </Suspense>
        </div>
      )}

      {activeTab === 'pricing' && (
        <div className="relative z-10 flex-1">
          <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>}>
            <PricingPage />
          </Suspense>
        </div>
      )}

      {activeTab === 'guides' && (
        <div className="relative z-10 flex-1">
          <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>}>
            <GuidesPage />
          </Suspense>
        </div>
      )}

      {activeTab === 'contact' && (
        <div className="relative z-10 flex-1">
          <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>}>
            <ContactPage />
          </Suspense>
        </div>
      )}

      {/* ─── Footer ─── */}
      <footer className="border-t border-slate-200 bg-slate-50 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Truck size={14} className="text-orange-500" />
            <span className="text-xs font-bold text-slate-500">© 2026 WeMarket Food Truck</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <Link to="/" className="hover:text-slate-900 transition-colors">홈</Link>
            <Link to="/admin" className="hover:text-slate-900 transition-colors">점주 센터</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
