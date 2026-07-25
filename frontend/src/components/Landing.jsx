import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, QrCode, Smartphone, ArrowRight, Zap, ShieldCheck, Star, Sparkles, TrendingUp } from 'lucide-react';

const Landing = () => {
  const [_mobileMenuOpen, _setMobileMenuOpen] = useState(false);

  const stats = [
    { label: '활성 매장', value: '1,200+', icon: Store },
    { label: '처리 주문', value: '540k', icon: Zap },
    { label: '평균 평점', value: '4.9/5', icon: Star },
  ];

  return (
    <div className="min-h-screen bg-[#0A0C10] text-slate-300 font-sans selection:bg-orange-500/30 selection:text-orange-200 overflow-hidden">
      {/* Decorative Glows */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[150px] rounded-full"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#0A0C10]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-600/20 group-hover:scale-110 transition-transform">
              <Store className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black text-white tracking-tighter uppercase">WeMarket</span>
          </div>

          <div className="hidden lg:flex items-center gap-10">
            {['Services', 'Platform', 'Pricing', 'Demo'].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-bold text-slate-400 hover:text-white transition-colors tracking-wide">
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Link to="/login" className="hidden sm:block text-sm font-bold text-white hover:text-orange-500 transition-colors">
              Login
            </Link>
            <Link to="/register" className="px-6 py-2.5 bg-white text-black rounded-xl font-black text-xs hover:bg-orange-500 hover:text-white transition-all shadow-xl shadow-white/5 active:scale-95">
              GET STARTED
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 z-10 overflow-hidden">
        {/* Real Dynamic Background Image */}
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
          <img
            src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=2000&auto=format&fit=crop"
            className="w-full h-full object-cover scale-110 animate-pulse-slow"
            alt="cafe background"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0C10] via-transparent to-[#0A0C10]"></div>
        </div>

        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-black text-orange-500 tracking-widest uppercase mb-8 animate-fade-in shadow-2xl">
            <Sparkles size={14} className="animate-pulse" /> NEXT-GEN QR ECOSYSTEM
          </div>

          <h1 className="text-6xl md:text-8xl font-black text-white leading-[0.9] tracking-tighter mb-8 drop-shadow-2xl">
            REDEFINE YOUR<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-rose-500 to-indigo-600">
              STORE EXPERIENCE
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-slate-400 text-lg md:text-xl font-medium leading-relaxed mb-12">
            단순한 주문 시스템을 넘어, 매장의 디지털 자산과 성장을 관리하는<br className="hidden md:block" />
            가장 진보된 하이엔드 솔루션입니다.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link to="/register" className="group px-10 py-5 bg-orange-600 text-white rounded-2xl font-black text-sm shadow-2xl shadow-orange-600/40 hover:bg-orange-500 transition-all flex items-center gap-3">
              PLATFORM START <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/menu/demo" className="px-10 py-5 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-sm backdrop-blur-sm hover:bg-white/10 transition-all">
              EXPLORE DEMO
            </Link>
          </div>
        </div>

        {/* Floating Stats with Real Background Texture */}
        <div className="max-w-5xl mx-auto mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          {stats.map((s, i) => (
            <div key={i} className="glass-panel-dark p-8 flex items-center gap-6 border-white/5 bg-white/[0.02] relative overflow-hidden group">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity">
                <img src={`https://images.unsplash.com/photo-1511920170033-f8396924c348?q=80&w=400&auto=format&fit=crop`} className="w-full h-full object-cover" alt="dec" />
              </div>
              <div className="w-14 h-14 rounded-2xl bg-orange-600/10 flex items-center justify-center text-orange-500 relative z-10 border border-orange-500/20">
                <s.icon size={28} />
              </div>
              <div className="relative z-10">
                <div className="text-3xl font-black text-white leading-tight">{s.value}</div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Grid (Bento Style) */}
      <section id="services" className="py-20 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8 glass-panel-dark p-10 bg-gradient-to-br from-indigo-600/20 to-transparent border-white/5 min-h-[400px] flex flex-col justify-end group">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500 flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/20 group-hover:rotate-12 transition-transform">
              <QrCode size={32} className="text-white" />
            </div>
            <h3 className="text-3xl font-black text-white mb-4">Precision QR Engine</h3>
            <p className="text-slate-400 font-medium leading-relaxed">
              매장의 모든 테이블을 디지털화합니다. 0.1초 미만의 빠른 스캔 인식 속도와
              실시간 동기화로 고객에게 스트레스 없는 주문 경험을 제공합니다.
            </p>
          </div>

          <div className="md:col-span-4 glass-panel-dark p-10 bg-white/[0.03] border-white/5 flex flex-col items-center justify-center text-center">
            <ShieldCheck className="text-orange-500 mb-6" size={64} />
            <h3 className="text-xl font-black text-white mb-2">Enterprise Security</h3>
            <p className="text-sm text-slate-500 font-medium italic">결제 데이터의 철저한 암호화와 무중단 시스템 운영 보장</p>
          </div>

          <div className="md:col-span-4 glass-panel-dark p-10 bg-white/[0.03] border-white/5">
            <Smartphone className="text-white mb-6" size={40} />
            <h3 className="text-xl font-black text-white mb-2">Perfect Interface</h3>
            <p className="text-sm text-slate-500 leading-relaxed font-medium">어떤 모바일 브라우저에서도 최적의 성능을 발휘하는 퍼포먼스 중심의 앱 아키텍처.</p>
          </div>

          <div className="md:col-span-8 glass-panel-dark p-10 bg-slate-800/20 border-white/5 flex flex-col md:flex-row items-center justify-between gap-10 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-rose-600/10 blur-[100px] rounded-full"></div>
            <div className="flex-1 z-10">
              <h3 className="text-3xl font-black text-white mb-4">Master Backend</h3>
              <p className="text-slate-400 font-medium">
                관리자를 위한 완벽한 통제력. 매출 통계, 재고 관리, 직원 권한 설정까지
                정교하게 설계된 대시보드 시스템을 제공합니다.
              </p>
            </div>
            <div className="w-48 h-48 bg-slate-900 rounded-3xl border border-white/10 shadow-3xl p-6 flex flex-col justify-between">
              <TrendingUp className="text-rose-500" size={32} />
              <div className="font-black text-sm text-white">GROWTH REVENUE<br /><span className="text-rose-500">+18.5%</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* Final Action */}
      <section className="py-40 px-6 relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-10 leading-none">
            READY TO JOIN THE<br />
            <span className="text-orange-600">SMART RETAIL REVOLUTION?</span>
          </h2>
          <Link to="/register" className="inline-flex items-center gap-3 px-10 py-6 bg-white text-black rounded-3xl font-black text-lg hover:bg-orange-600 hover:text-white transition-all shadow-2xl active:scale-95">
            LAUNCH YOUR STORE <ArrowRight size={24} />
          </Link>
        </div>

        {/* Animated Background Text */}
        <div className="absolute bottom-0 left-0 w-full opacity-10 pointer-events-none select-none">
          <div className="text-[200px] font-black text-white/5 whitespace-nowrap tracking-tighter leading-none -mb-20">
            WEMARKET PLATFORM NEXT REVOLUTION
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center"><Store className="w-4 h-4 text-black" /></div>
            <span className="font-black text-white uppercase tracking-tighter">WEMARKET</span>
          </div>
          <div className="flex gap-12 text-xs font-bold text-slate-500 uppercase tracking-widest leading-loose">
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
            <a href="#" className="hover:text-white transition-colors">Network Status</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
          </div>
          <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">
            © 2026 WeMarket Systems. Globally Designed.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
