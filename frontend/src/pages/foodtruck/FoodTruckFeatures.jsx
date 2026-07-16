import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, Navigation, Truck, Bell, ShieldCheck, Clock,
  Smartphone, Zap, Menu, X, Sparkles, Signal, Fuel, AlertTriangle
} from 'lucide-react';

export default function FoodTruckFeatures() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: '매장찾기', to: '/foodtruck/landing' },
    { label: '기능소개', to: '/foodtruck/landing', active: true },
    { label: '요금제', to: '/foodtruck/landing' },
    { label: '이용가이드', to: '/foodtruck/landing' },
    { label: '문의하기', to: '/foodtruck/landing' }
  ];

  const features = [
    {
      icon: Navigation,
      title: '실시간 GPS 위치 싱크',
      desc: '이동 중인 푸드트럭의 GPS 좌표를 초 단위로 서버에 전송하고, 고객에게는 한글 도로명 주소로 변환된 실시간 위치를 제공합니다.',
      badge: '핵심 기능'
    },
    {
      icon: AlertTriangle,
      title: '긴급 킬스위치 (재료소진)',
      desc: '재료가 소진되면 원터치로 전 메뉴를 일괄 품절 처리하고, 대기 중인 고객에게 자동으로 품절 알림톡을 발송합니다.',
      badge: '안전장치'
    },
    {
      icon: Smartphone,
      title: '모바일 우선 주문',
      desc: '별도 앱 설치 없이 모바일 브라우저에서 메뉴 확인 → 주문 → 결제까지 완료. 고객 유입 경로를 최소화합니다.',
      badge: '고객 경험'
    },
    {
      icon: Signal,
      title: '하트비트 연결 유지',
      desc: '불안정한 현장 네트워크 환경에서도 고객 연결 상태를 모니터링하고, 끊김 시 자동으로 알림톡 예비 경로를 가동합니다.',
      badge: '신뢰성'
    },
    {
      icon: MapPin,
      title: '스마트 거점 배치',
      desc: 'AI가 과거 판매 데이터와 시간대별 유동인구를 분석하여 최적의 영업 거점과 이동 동선을 제안합니다.',
      badge: 'AI 추천'
    },
    {
      icon: Fuel,
      title: '이동 동선 최적화',
      desc: '연료 효율과 예상 매출을 동시에 고려한 최적 이동 경로를 실시간으로 계산하여 보여줍니다.',
      badge: '경로 최적화'
    }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <Link to="/foodtruck/landing" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tighter block uppercase bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent">WeMarket</span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 block leading-none">Food Truck</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navItems.map(item => (
              <Link
                key={item.label}
                to={item.to}
                className={`text-sm font-bold tracking-tight transition-all ${
                  item.active ? 'text-orange-500' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth" className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900 transition-all">
              로그인
            </Link>
            <Link to="/register" className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 transition-all active:scale-95">
              무료 시작하기
            </Link>
          </div>

          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-slate-500 hover:text-slate-900 p-2">
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-6 py-6 flex flex-col gap-4">
            {navItems.map(item => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`text-sm font-bold py-2 ${item.active ? 'text-orange-500' : 'text-slate-500'}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(249,115,22,0.05),transparent_60%)] pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 text-xs font-mono font-bold mb-6">
            <Sparkles className="size-3.5" />
            <span>FOOD TRUCK FEATURES</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-6">
            이동식 푸드트럭을 위한<br />
            <span className="bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-transparent">모바일 우선 솔루션</span>
          </h2>
          <p className="text-slate-500 text-base max-w-2xl mx-auto leading-relaxed">
            고정 매장이 없는 푸드트럭의 특성에 맞춰 GPS 실시간 동기화, 긴급 품절 제어, 불안정 네트워크 대응까지 이동형 비즈니스에 최적화된 기능을 제공합니다.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="pb-24 lg:pb-36 max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => (
            <div
              key={idx}
              className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-3xl p-8 transition-all hover:scale-[1.02] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center">
                    <feat.icon className="size-6" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">
                    {feat.badge}
                  </span>
                </div>
                <h3 className="text-lg font-black tracking-tight text-slate-900 mb-3">{feat.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-12 text-slate-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-slate-200">
              <Truck className="w-4 h-4 text-slate-400" />
            </div>
            <span className="text-sm font-bold text-slate-500">WeMarket Food Truck</span>
          </div>
          <p className="text-xs font-mono text-slate-400">&copy; 2026 WeMarket Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
