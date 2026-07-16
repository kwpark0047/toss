import { useState} from 'react';
import { Link } from 'react-router-dom';
import { 
  Truck, _Layout, Sparkles, MapPin, _Eye, _Compass, Flame, Coffee, 
  Settings, _ShoppingCart, _Info, _Check, Search, _Filter, _Play, Award, 
  _Map, _Moon, _Sun, _AlertTriangle, _MessageSquare, Terminal, ChevronRight
} from 'lucide-react';

export default function FoodTruckDesignShowcase() {
  const [activeTab, setActiveTab] = useState('concept1');
  const [isDemoActive, setIsDemoActive] = useState(true);
  const [isDemoSoldOut, setIsDemoSoldOut] = useState(false);
  const [demoCoords, setDemoCoords] = useState({ lat: 37.5562, lng: 126.9223 }); // 홍대입구역 9번출구
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpot, setSelectedSpot] = useState('홍대 걷고싶은거리');

  // 모형 데이터
  const trucksData = [
    { id: 1, name: '타코 타코스 (Taco Tacos)', category: '멕시칸 타코', distance: '120m', rating: '4.9', reviews: 142, tag: '인기', spot: '홍대 걷고싶은거리', active: true, soldOut: false, price: '8,500원~' },
    { id: 2, name: '커피 앤 모어 (Coffee & More)', category: '커피 & 논알콜 칵테일', distance: '340m', rating: '4.8', reviews: 98, tag: '감성', spot: '연트럴파크', active: true, soldOut: false, price: '4,500원~' },
    { id: 3, name: '더 불닭 트럭 (The Buldak Truck)', category: '직화 불고기 컵밥', distance: '520m', rating: '4.7', reviews: 211, tag: '핫플레이스', spot: '신촌 창천공원', active: false, soldOut: false, price: '7,900원~' },
    { id: 4, name: '크레페 하우스 (Crepe House)', category: '프랑스식 크레페', distance: '80m', rating: '5.0', reviews: 64, tag: '디저트', spot: '홍대 걷고싶은거리', active: true, soldOut: true, price: '5,000원~' }
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans antialiased">
      {/* 글로벌 헤더 */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
            <Truck size={20} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              WeMarket <span className="text-orange-400 font-mono text-xs px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20">Design Lab</span>
            </h1>
            <p className="text-xs text-slate-400">이동식 푸드트럭 전용 프리미엄 UI/UX 5개 디자인 쇼케이스</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link 
            to="/foodtruck/landing" 
            className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition"
          >
            기본 랜딩페이지 바로가기
          </Link>
          <Link 
            to="/admin/stores/1/foodtruck" 
            className="px-4 py-2 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-400 shadow-lg shadow-orange-500/20 transition"
          >
            점주 대시보드 바로가기
          </Link>
        </div>
      </header>

      {/* 쇼케이스 대시보드 */}
      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* 컨트롤 패널 (좌측) */}
        <section className="lg:col-span-1 bg-slate-950 rounded-2xl border border-slate-800 p-6 flex flex-col gap-6 h-fit">
          <div>
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">콘셉트 테마 선택</h2>
            <div className="flex flex-col gap-2">
              {[
                { id: 'concept1', name: '1. 스트리트 프리미엄', icon: Flame, desc: '힙스터 오렌지 & 볼드 흑백', color: 'text-orange-400 border-orange-500/30' },
                { id: 'concept2', name: '2. 코지 웜 감성', icon: Coffee, desc: '베이지 & 포레스트 그린', color: 'text-emerald-400 border-emerald-500/30' },
                { id: 'concept3', name: '3. 현장 오퍼레이터', icon: Terminal, desc: '블룸버그식 고밀도 미니멀', color: 'text-cyan-400 border-cyan-500/30' },
                { id: 'concept4', name: '4. 네온 사이버펑크', icon: Sparkles, desc: '버블검 핑크 & 사이버 퍼플', color: 'text-pink-400 border-pink-500/30' },
                { id: 'concept5', name: '5. 클래식 에디토리얼', icon: Award, desc: '미니멀 세리프 & 하이라인', color: 'text-amber-400 border-amber-500/30' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex flex-col gap-1 ${
                    activeTab === tab.id 
                      ? 'bg-slate-900 border-slate-700 text-white ring-1 ring-slate-700' 
                      : 'bg-transparent border-slate-900 text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <tab.icon size={15} className={activeTab === tab.id ? tab.color.split(' ')[0] : 'text-slate-500'} />
                    <span>{tab.name}</span>
                  </div>
                  <span className="text-xs text-slate-500 pl-6">{tab.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* 시뮬레이터 인터랙션 */}
          <div>
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Settings size={14} />
              <span>실시간 하드웨어 시뮬레이터</span>
            </h2>
            <div className="flex flex-col gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800/60">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">영업 세션 온오프</span>
                <button 
                  onClick={() => setIsDemoActive(!isDemoActive)}
                  className={`w-12 h-6 rounded-full p-1 transition-all ${isDemoActive ? 'bg-emerald-500' : 'bg-slate-700'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-all ${isDemoActive ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">긴급 전품목 품절</span>
                <button 
                  onClick={() => setIsDemoSoldOut(!isDemoSoldOut)}
                  className={`w-12 h-6 rounded-full p-1 transition-all ${isDemoSoldOut ? 'bg-rose-500' : 'bg-slate-700'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-all ${isDemoSoldOut ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-400">트럭 위치 선택</span>
                <select 
                  value={selectedSpot}
                  onChange={(e) => {
                    setSelectedSpot(e.target.value);
                    if (e.target.value === '홍대 걷고싶은거리') setDemoCoords({ lat: 37.5562, lng: 126.9223 });
                    if (e.target.value === '연트럴파크') setDemoCoords({ lat: 37.5615, lng: 126.9248 });
                    if (e.target.value === '신촌 창천공원') setDemoCoords({ lat: 37.5574, lng: 126.9369 });
                  }}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-300 focus:outline-none focus:border-slate-700"
                >
                  <option value="홍대 걷고싶은거리">홍대 걷고싶은거리</option>
                  <option value="연트럴파크">연남동 경의선 숲길</option>
                  <option value="신촌 창천공원">신촌 연세대 창천공원</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 font-mono text-[10px] text-slate-500">
                <div className="flex justify-between">
                  <span>LATITUDE</span>
                  <span>{demoCoords.lat}</span>
                </div>
                <div className="flex justify-between">
                  <span>LONGITUDE</span>
                  <span>{demoCoords.lng}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 렌더링 캔버스 (우측 3칸) */}
        <section className="lg:col-span-3 flex flex-col gap-6">
          
          {/* 상태 요약 바 */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping" />
              <span className="text-xs text-slate-400">
                현재 <strong className="text-white">"{activeTab.replace('concept', 'Concept ')}"</strong> 렌더링 완료. 시뮬레이터 조작이 화면에 즉시 피드백됩니다.
              </span>
            </div>
            <div className="flex gap-2">
              <span className="px-2.5 py-1 text-[10px] font-mono rounded bg-slate-800 text-slate-400">PWA SW: Active</span>
              <span className="px-2.5 py-1 text-[10px] font-mono rounded bg-slate-800 text-slate-400">Sock: Connected</span>
            </div>
          </div>

          {/* 디자인 모형 프레임 */}
          <div className="w-full bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden min-h-[680px]">
            
            {/* 1. STREET PREMIUM CONCEPT */}
            {activeTab === 'concept1' && (
              <div className="bg-slate-950 text-white w-full min-h-[680px] flex flex-col font-sans">
                {/* 트렌디 네비게이션 */}
                <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame size={18} className="text-orange-500" />
                    <span className="font-bold tracking-tight text-lg">STREET RADAR V2</span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                    <input 
                      type="text" 
                      placeholder="메뉴, 위치, 해시태그 검색..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded-full pl-9 pr-4 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-orange-500/50 w-52"
                    />
                  </div>
                </div>

                {/* 대형 비주얼 배너 */}
                <div className="relative h-44 bg-gradient-to-r from-orange-600 to-amber-600 flex items-center px-8 overflow-hidden">
                  <div className="absolute right-0 bottom-0 top-0 opacity-10 flex items-center pointer-events-none">
                    <Truck size={240} />
                  </div>
                  <div className="relative z-10 max-w-lg flex flex-col gap-1">
                    <span className="px-2 py-0.5 bg-black/30 border border-white/10 text-[10px] uppercase font-bold tracking-widest rounded-full w-fit">FLASH SALE INSIDE</span>
                    <h3 className="text-2xl font-extrabold tracking-tight">스트리트 타코트럭 대규모 타임세일</h3>
                    <p className="text-xs text-white/80">내 반경 200m 이내 신선한 타코, 단 1시간 동안만 최대 30% 선착순 마감!</p>
                  </div>
                </div>

                {/* 메인 리스트 레이아웃 */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {trucksData
                    .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.category.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(truck => {
                      // 실시간 시뮬레이터 연동
                      const isActive = truck.id === 1 ? isDemoActive : truck.active;
                      const isSoldOut = truck.id === 1 ? isDemoSoldOut : truck.soldOut;
                      const currentSpot = truck.id === 1 ? selectedSpot : truck.spot;

                      return (
                        <div key={truck.id} className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex flex-col justify-between hover:border-orange-500/30 transition-all duration-300 group">
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-300 group-hover:bg-orange-500 group-hover:text-black transition-colors">
                                {truck.category}
                              </span>
                              <div className="flex items-center gap-1">
                                {isActive ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    영업 중
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-800 border border-slate-700 text-slate-500">
                                    마감
                                  </span>
                                )}
                                {isSoldOut && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-rose-500/10 border border-rose-500/20 text-rose-400">
                                    품절
                                  </span>
                                )}
                              </div>
                            </div>
                            <h4 className="text-base font-bold text-white group-hover:text-orange-400 transition-colors mb-1">{truck.name}</h4>
                            <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                              <MapPin size={12} className="text-orange-500" />
                              <span>{currentSpot}</span>
                              <span className="text-slate-600">|</span>
                              <span>반경 {truck.distance}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                            <div>
                              <span className="text-[10px] text-slate-500 block uppercase font-mono">STARTING FROM</span>
                              <span className="text-sm font-extrabold text-white">{truck.price}</span>
                            </div>
                            <Link 
                              to={`/menu/${truck.id}`}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition ${
                                isSoldOut 
                                  ? 'bg-slate-800 text-slate-500 pointer-events-none'
                                  : 'bg-orange-500 text-white hover:bg-orange-400 shadow-md shadow-orange-500/10'
                              }`}
                            >
                              <span>주문하기</span>
                              <ChevronRight size={12} />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* 2. COZY WARMTH CONCEPT */}
            {activeTab === 'concept2' && (
              <div className="bg-[#FAF8F5] text-[#2C3E2B] w-full min-h-[680px] flex flex-col font-sans">
                {/* 소프트 코지 네비게이션 */}
                <div className="px-6 py-5 border-b border-[#E8E3D9] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coffee size={18} className="text-[#4E6E4C]" />
                    <span className="font-serif font-bold text-lg tracking-tight text-[#2C3E2B]">Cozy Spot Tracker</span>
                  </div>
                  <div className="text-xs text-[#6E7B6C] font-medium flex items-center gap-1 bg-[#ECE7DE] px-3 py-1 rounded-full">
                    <MapPin size={12} />
                    <span>오늘의 평화로운 거점 탐색</span>
                  </div>
                </div>

                {/* 파스텔 포근한 안내 영역 */}
                <div className="px-8 py-6 bg-[#ECE7DE] border-b border-[#E8E3D9] flex flex-col gap-1.5">
                  <span className="px-2.5 py-0.5 bg-[#4E6E4C] text-white text-[10px] rounded-full w-fit font-medium">따뜻한 감성 푸드스팟</span>
                  <h3 className="text-xl font-serif font-bold text-[#2C3E2B]">우리 동네 공원 근처, 아기자기한 그린 키친</h3>
                  <p className="text-xs text-[#5A6858] leading-relaxed">자연과 어우러지는 수제 샌드위치와 따뜻한 브루잉 드립커피 트럭을 만나보세요.</p>
                </div>

                {/* 메인 리스트 레이아웃 */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                  {trucksData
                    .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.category.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(truck => {
                      const isActive = truck.id === 1 ? isDemoActive : truck.active;
                      const isSoldOut = truck.id === 1 ? isDemoSoldOut : truck.soldOut;
                      const currentSpot = truck.id === 1 ? selectedSpot : truck.spot;

                      return (
                        <div key={truck.id} className="bg-white rounded-2xl border border-[#E8E3D9] p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition">
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-xs font-semibold text-[#4E6E4C]">
                                {truck.category}
                              </span>
                              <div className="flex items-center gap-1">
                                {isActive ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#E8F0E8] border border-[#D0E0D0] text-[#4E6E4C] flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#4E6E4C]" />
                                    영업 중
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#F0EFEA] text-[#9A9992]">
                                    마감
                                  </span>
                                )}
                                {isSoldOut && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#FDF0EE] text-[#D84A38]">
                                    품절
                                  </span>
                                )}
                              </div>
                            </div>
                            <h4 className="text-base font-serif font-bold text-[#2C3E2B] mb-1">{truck.name}</h4>
                            <div className="flex items-center gap-2 text-xs text-[#6E7B6C] mb-3">
                              <MapPin size={12} className="text-[#4E6E4C]" />
                              <span>{currentSpot}</span>
                              <span className="text-[#ECE7DE]">|</span>
                              <span>{truck.distance} 거리</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-3 border-t border-[#F2EDE4]">
                            <div>
                              <span className="text-[10px] text-[#9A9992] block">대표 메뉴 가격</span>
                              <span className="text-sm font-bold text-[#2C3E2B]">{truck.price}</span>
                            </div>
                            <Link 
                              to={`/menu/${truck.id}`}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition ${
                                isSoldOut 
                                  ? 'bg-[#F2EDE4] text-[#9A9992] pointer-events-none'
                                  : 'bg-[#4E6E4C] text-white hover:bg-[#3D563C] shadow-sm'
                              }`}
                            >
                              <span>포장 주문</span>
                              <ChevronRight size={12} />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* 3. OPERATOR HIGH-DENSITY */}
            {activeTab === 'concept3' && (
              <div className="bg-black text-[#00FF66] w-full min-h-[680px] flex flex-col font-mono text-xs">
                {/* 시스템 헤더 */}
                <div className="px-4 py-3 border-b border-[#00FF66]/20 flex items-center justify-between bg-[#0A0A0A]">
                  <div className="flex items-center gap-2">
                    <Terminal size={14} className="animate-pulse" />
                    <span className="font-bold uppercase tracking-wider">WE_MARKET::GEOLOCATION_OPERATOR_v3.5</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    LATENCY: <span className="text-[#00FF66]">1.2ms</span> | INDEX: <span className="text-[#00FF66]">OK</span>
                  </div>
                </div>

                {/* 데이터 마크다운 배너 */}
                <div className="px-6 py-4 bg-[#050505] border-b border-[#00FF66]/10 flex flex-col gap-1">
                  <div>[SYS_NOTICE] REAL-TIME ACTIVE TRANSPORT SESSION LOGGING DETECTED.</div>
                  <div className="text-slate-500 text-[10px]">COORDINATE POINTER INDEXING MAP FILTERED FOR HIGH-DENSITY OPERATOR LOGS.</div>
                </div>

                {/* 그리드 고밀도 데이터 표 */}
                <div className="p-4 flex flex-col gap-4">
                  <div className="border border-[#00FF66]/20 rounded overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#0A0A0A] border-b border-[#00FF66]/20 text-[#00FF66] uppercase text-[10px]">
                          <th className="p-3 border-r border-[#00FF66]/10">ID</th>
                          <th className="p-3 border-r border-[#00FF66]/10">TRUCK_NAME</th>
                          <th className="p-3 border-r border-[#00FF66]/10">POSITION_SPOT</th>
                          <th className="p-3 border-r border-[#00FF66]/10">STATUS</th>
                          <th className="p-3 text-right">ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trucksData.map(truck => {
                          const isActive = truck.id === 1 ? isDemoActive : truck.active;
                          const isSoldOut = truck.id === 1 ? isDemoSoldOut : truck.soldOut;
                          const currentSpot = truck.id === 1 ? selectedSpot : truck.spot;

                          return (
                            <tr key={truck.id} className="border-b border-[#00FF66]/10 hover:bg-[#00FF66]/5 transition">
                              <td className="p-3 border-r border-[#00FF66]/10 font-mono text-[10px] text-slate-500">#{truck.id.toString().padStart(4, '0')}</td>
                              <td className="p-3 border-r border-[#00FF66]/10 font-bold text-white">
                                {truck.name}
                                <span className="block text-[9px] font-normal text-slate-400 uppercase mt-0.5">{truck.category}</span>
                              </td>
                              <td className="p-3 border-r border-[#00FF66]/10 text-slate-300">
                                {currentSpot}
                                <span className="block text-[9px] text-slate-500 font-mono mt-0.5">RANGE: {truck.distance}</span>
                              </td>
                              <td className="p-3 border-r border-[#00FF66]/10">
                                <div className="flex flex-col gap-1">
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase w-fit ${
                                    isActive ? 'bg-[#00FF66]/10 text-[#00FF66] border border-[#00FF66]/20' : 'bg-slate-900 text-slate-500 border border-slate-800'
                                  }`}>
                                    {isActive ? 'ACTIVE' : 'OFFLINE'}
                                  </span>
                                  {isSoldOut && (
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-rose-500/10 text-rose-500 border border-rose-500/20 w-fit">
                                      EMERGENCY_SOLD_OUT
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <Link 
                                  to={`/menu/${truck.id}`}
                                  className={`px-3 py-1.5 border rounded text-[10px] font-bold uppercase inline-block transition ${
                                    isSoldOut
                                      ? 'border-slate-800 text-slate-600 pointer-events-none bg-transparent'
                                      : 'border-[#00FF66] text-[#00FF66] hover:bg-[#00FF66] hover:text-black shadow-md shadow-[#00FF66]/5'
                                  }`}
                                >
                                  RUN_POS_SHELL
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 세부 정보 셸 출력부 */}
                  <div className="bg-[#050505] border border-[#00FF66]/10 p-4 rounded font-mono text-[10px] text-slate-400">
                    <span className="text-[#00FF66] font-bold block mb-1">SYSTEM_TELEMETRY_LOGS</span>
                    <p>&gt; IP_BOUND: 121.254.120.1 | WEBSOCKET_PING: 8ms</p>
                    <p>&gt; REDIS_LOCAL_GEOCACHE: HIT | MEMORY_STORE: 104KB</p>
                    <p>&gt; PUSH_BROADCAST_GEOFENCE: BROADCASTING_SUCCESSFUL</p>
                  </div>
                </div>
              </div>
            )}

            {/* 4. NEON CYBERPUNK CONCEPT */}
            {activeTab === 'concept4' && (
              <div className="bg-[#0D0118] text-pink-300 w-full min-h-[680px] flex flex-col font-sans">
                {/* 네온 사이버네틱 헤더 */}
                <div className="px-6 py-5 border-b border-pink-500/10 flex items-center justify-between bg-[#150226]">
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-pink-500 animate-spin" style={{ animationDuration: '4s' }} />
                    <span className="font-extrabold tracking-widest text-lg bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 bg-clip-text text-transparent">NEON RIDER</span>
                  </div>
                  <div className="text-xs bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 px-3 py-1 rounded-full font-mono uppercase tracking-widest">
                    CYBER SPOTLIGHT ACTIVE
                  </div>
                </div>

                {/* 화려한 네온 무드 */}
                <div className="px-8 py-6 bg-gradient-to-r from-[#1E043B] to-[#0A0113] border-b border-pink-500/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-44 h-44 rounded-full bg-pink-500/10 blur-3xl" />
                  <div className="relative z-10 flex flex-col gap-1.5">
                    <span className="px-2.5 py-0.5 bg-pink-500 text-black text-[10px] font-black uppercase tracking-widest rounded w-fit">MIDNIGHT FLASH SALES</span>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">지하철역 근처 심야 간식 대모험</h3>
                    <p className="text-xs text-slate-400">네온 핑크 불빛 아래, 연기가 자욱하게 피어나는 크레페와 수제 꼬치 맛집을 실시간 사냥하세요.</p>
                  </div>
                </div>

                {/* 메인 리스트 레이아웃 */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                  {trucksData
                    .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.category.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(truck => {
                      const isActive = truck.id === 1 ? isDemoActive : truck.active;
                      const isSoldOut = truck.id === 1 ? isDemoSoldOut : truck.soldOut;
                      const currentSpot = truck.id === 1 ? selectedSpot : truck.spot;

                      return (
                        <div key={truck.id} className="bg-[#120224] rounded-2xl border border-pink-500/10 p-5 flex flex-col justify-between hover:border-pink-500/30 hover:shadow-[0_0_15px_rgba(236,72,153,0.1)] transition-all duration-300">
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                                {truck.category}
                              </span>
                              <div className="flex items-center gap-1">
                                {isActive ? (
                                  <span className="px-2 py-0.5 rounded bg-pink-500/10 border border-pink-500/30 text-pink-400 text-[9px] font-extrabold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-ping" />
                                    LIVE NOW
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-600 text-[9px]">
                                    SHUT DOWN
                                  </span>
                                )}
                                {isSoldOut && (
                                  <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[9px]">
                                    SOLD OUT
                                  </span>
                                )}
                              </div>
                            </div>
                            <h4 className="text-base font-black text-white mb-1 tracking-tight">{truck.name}</h4>
                            <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                              <MapPin size={12} className="text-pink-500" />
                              <span>{currentSpot}</span>
                              <span className="text-[#1E043B]">|</span>
                              <span className="font-mono">{truck.distance}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-3 border-t border-pink-500/5">
                            <div>
                              <span className="text-[10px] text-slate-500 block uppercase font-mono">NEON PRICE</span>
                              <span className="text-sm font-extrabold text-white font-mono">{truck.price}</span>
                            </div>
                            <Link 
                              to={`/menu/${truck.id}`}
                              className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1.5 transition ${
                                isSoldOut 
                                  ? 'bg-[#1E043B] text-slate-600 pointer-events-none'
                                  : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:opacity-90 shadow-md shadow-pink-500/20'
                              }`}
                            >
                              <span>주문 빔 발사</span>
                              <ChevronRight size={12} />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* 5. CLASSIC EDITORIAL */}
            {activeTab === 'concept5' && (
              <div className="bg-white text-stone-900 w-full min-h-[680px] flex flex-col font-sans">
                {/* 미니멀 헤더 */}
                <div className="px-8 py-6 border-b border-stone-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award size={18} className="text-stone-900" />
                    <span className="font-serif font-black tracking-tight text-xl">THE POP-UP TRUCK LIST</span>
                  </div>
                  <div className="text-xs text-stone-500 font-serif italic">
                    Issue 01 // Curated Dining Spots
                  </div>
                </div>

                {/* 에디토리얼 단 한줄 슬로건 */}
                <div className="px-10 py-8 border-b border-stone-100 flex flex-col gap-2 bg-stone-50">
                  <span className="text-[10px] font-extrabold tracking-widest uppercase text-stone-500">POP-UP GOURMET IN THE CITY</span>
                  <h3 className="text-2xl font-serif font-bold text-stone-900 max-w-xl leading-tight">길거리에서 만나는 가볍고 격조 높은 팝업 다이닝 라이프스타일</h3>
                  <div className="w-12 h-[1px] bg-stone-900 mt-2" />
                </div>

                {/* 메인 리스트 레이아웃 */}
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {trucksData
                    .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.category.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(truck => {
                      const isActive = truck.id === 1 ? isDemoActive : truck.active;
                      const isSoldOut = truck.id === 1 ? isDemoSoldOut : truck.soldOut;
                      const currentSpot = truck.id === 1 ? selectedSpot : truck.spot;

                      return (
                        <div key={truck.id} className="bg-white rounded-none border border-stone-200 p-6 flex flex-col justify-between hover:border-stone-900 transition-colors">
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 border-b border-stone-200 pb-0.5">
                                {truck.category}
                              </span>
                              <div className="flex items-center gap-1">
                                {isActive ? (
                                  <span className="px-2 py-0.5 text-[9px] font-bold border border-stone-900 text-stone-900 uppercase">
                                    OPEN
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 text-[9px] font-bold bg-stone-100 text-stone-400 uppercase">
                                    CLOSED
                                  </span>
                                )}
                                {isSoldOut && (
                                  <span className="px-2 py-0.5 text-[9px] font-bold bg-stone-100 text-stone-500 uppercase italic">
                                    SOLD OUT
                                  </span>
                                )}
                              </div>
                            </div>
                            <h4 className="text-lg font-serif font-bold text-stone-900 mb-1">{truck.name}</h4>
                            <div className="flex items-center gap-2 text-xs text-stone-500 mb-4 italic">
                              <MapPin size={12} className="text-stone-900" />
                              <span>{currentSpot}</span>
                              <span className="text-stone-300">/</span>
                              <span>{truck.distance} DISTANCE</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                            <div>
                              <span className="text-[9px] text-stone-400 block uppercase font-mono">REPRESENTATIVE PRICE</span>
                              <span className="text-sm font-bold text-[#2C3E2B]">{truck.price}</span>
                            </div>
                            <Link 
                              to={`/menu/${truck.id}`}
                              className={`px-4 py-2 text-xs font-extrabold uppercase transition tracking-wider ${
                                isSoldOut 
                                  ? 'bg-stone-100 text-stone-400 pointer-events-none'
                                  : 'bg-stone-900 text-white hover:bg-stone-800'
                              }`}
                            >
                              CHOOSE MENU
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

          </div>

        </section>

      </main>
    </div>
  );
}