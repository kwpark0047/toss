import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  QrCode, Store, Bell, CreditCard, Clock, BarChart3,
  Users, Smartphone, Heart, Building2, Menu, X, ArrowRight,
  Shield, CheckCircle, Zap, ShieldCheck, HelpCircle, PhoneCall, Gift, Sparkles, MapPin, Truck
} from 'lucide-react';

export default function FeaturesPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: '기능 소개', to: '/features', active: true },
    { label: '요금제', to: '/pricing' },
    { label: '푸드트럭', to: '/foodtruck/landing' },
    { label: '이용 가이드', to: '/guides' },
    { label: '문의하기', to: '/contact' }
  ];

  const coreFeatures = [
    { 
      icon: QrCode, 
      title: 'QR 코드 자율 생성 및 즉시 결제', 
      desc: '테이블별 고유 QR을 단 1초 만에 자동 생성. 고객은 번거로운 전용 앱 설치 과정 없이 모바일 브라우저에서 메뉴를 담고 즉시 결제까지 완료합니다.',
      badge: '대표 기능'
    },
    { 
      icon: Truck, 
      title: '이동식 푸드트럭 특화 솔루션', 
      desc: '이동이 잦은 점포의 특성에 최적화된 실시간 GPS 위치 싱크, 한글 역지오코딩 도로명 주소 매핑, 긴급 재료소진 일괄 킬스위치 제어를 제공합니다.',
      badge: '신규 업그레이드'
    },
    { 
      icon: BarChart3, 
      title: 'AI 기반 피크타임 매출 통계', 
      desc: '매출 데이터를 분/시간/요일별로 자동 분석하고, 인공지능이 다음 주 판매량 예측과 최적의 거점 및 시간 전술을 제안하는 똑똑한 점주 비서를 만나보세요.',
      badge: 'AI 인텔리전스'
    },
    { 
      icon: Bell, 
      title: '실시간 하이브리드 주문 알림', 
      desc: '고객 주문 즉시 KDS(주방 디스플레이)와 알림톡, 푸시 알림으로 전사 전파. 고객 소켓이 연결 해제되어도 5초 내 알림톡 예비 수단이 자동으로 가동됩니다.',
      badge: '신뢰도 100%'
    },
    { 
      icon: Users, 
      title: '역할 기반 주방/팀원 관리 (RBAC)', 
      desc: '총 점주(Owner), 지점 관리자(Manager), 아르바이트(Staff) 및 주방 조리원(Kitchen) 계정을 완벽하게 격리. 세밀한 권한 제어로 보안을 완성합니다.',
      badge: '엔터프라이즈급'
    },
    { 
      icon: Heart, 
      title: '단골 고객 맞춤형 밀착 케어', 
      desc: '고객 전화번호 기반 포인트 적립률 자동 계산, VIP 단골 등급 산정, 그리고 반경 내 단골에게 실시간 혜택을 전송하는 타임세일 알림 연동 기능이 탑재됩니다.',
      badge: 'CRM 특화'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* 프리미엄 내비게이션 바 */}
      <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tighter block uppercase bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-transparent">WeMarket</span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 block leading-none">Smart SaaS</span>
            </div>
          </Link>

          {/* 데스크탑 메뉴 */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map(item => (
              <Link 
                key={item.label} 
                to={item.to} 
                className={`text-sm font-bold tracking-tight transition-all ${
                  item.active ? 'text-orange-500' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth" className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 transition-all">
              로그인
            </Link>
            <Link to="/register" className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 transition-all active:scale-95">
              무료 시작하기
            </Link>
          </div>

          {/* 모바일 햄버거 토글 */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-slate-400 hover:text-slate-200 p-2">
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* 모바일 서브 레이어 */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-900 bg-slate-950 px-6 py-6 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-200">
            {navItems.map(item => (
              <Link 
                key={item.label} 
                to={item.to} 
                onClick={() => setMobileMenuOpen(false)}
                className={`text-sm font-bold py-2 ${item.active ? 'text-orange-500' : 'text-slate-400'}`}
              >
                {item.label}
              </Link>
            ))}
            <hr className="border-slate-900 my-2" />
            <Link to="/auth" onClick={() => setMobileMenuOpen(false)} className="text-sm font-bold text-slate-400 py-2">
              로그인
            </Link>
            <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="w-full py-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-center rounded-xl text-sm font-black shadow-lg">
              무료 시작하기
            </Link>
          </div>
        )}
      </nav>

      {/* 히어로 서브 배너 */}
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(249,115,22,0.12),transparent_60%)] pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-mono font-bold mb-6">
            <Sparkles className="size-3.5" />
            <span>CORE CAPABILITIES</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-6">
            매장과 이동형 트럭을 혁신하는<br />
            <span className="bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-transparent">WeMarket의 독보적인 스펙</span>
          </h2>
          <p className="text-slate-400 text-base max-w-2xl mx-auto leading-relaxed">
            단순히 QR 주문만 받는 서비스가 아닙니다. 알림톡, 실시간 GPS 역지오코딩, 지능형 매출 예측 리포트와 고밀도 KDS까지 비즈니스를 주도하는 스마트 기능을 올인원으로 장착하세요.
          </p>
        </div>
      </section>

      {/* 상세 기능 그리드 리스트 */}
      <section className="pb-24 lg:pb-36 max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {coreFeatures.map((feat, idx) => (
            <div 
              key={idx} 
              className="bg-slate-900/40 border border-slate-900 hover:border-slate-800 rounded-3xl p-8 transition-all hover:scale-[1.02] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center">
                    <feat.icon className="size-6" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20">
                    {feat.badge}
                  </span>
                </div>
                <h3 className="text-lg font-black tracking-tight text-slate-100 mb-3">{feat.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-slate-900 bg-slate-950 py-12 text-slate-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-800">
              <Store className="w-4 h-4 text-slate-400" />
            </div>
            <span className="text-sm font-bold text-slate-400">WeMarket SaaS</span>
          </div>
          <p className="text-xs font-mono">&copy; 2026 WeMarket Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
