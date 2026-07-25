import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  QrCode, Store, Bell, CreditCard, Clock, BarChart3,
  Users, Smartphone, Heart, Menu, X,
  Shield, CheckCircle, Zap, ShieldCheck, MapPin, Gift, Sparkles, CalendarCheck
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
      title: 'QR 코드 즉시 생성', 
      desc: '테이블마다 고유한 QR 코드를 자동 생성. 출력해서 테이블에 부착하면 바로 사용 가능합니다.',
      badge: '대표 기능'
    },
    { 
      icon: Store, 
      title: '매장 통합 관리', 
      desc: '매장 정보, 영업시간, 위치까지 한 곳에서 관리. 지역별 매장 분류도 지원합니다.',
      badge: '올인원'
    },
    { 
      icon: Shield, 
      title: '직원 권한 관리', 
      desc: '마스터 관리자부터 테이블 담당, 주방 직원까지 역할별 권한을 세밀하게 분리합니다.',
      badge: '보안'
    },
    { 
      icon: Smartphone, 
      title: '웹앱 기반 주문', 
      desc: '앱 설치 없이 브라우저에서 바로 주문. 고객의 진입 장벽을 최소화합니다.',
      badge: '고객 경험'
    },
    { 
      icon: Bell, 
      title: '실시간 알림', 
      desc: '주문이 들어오면 담당 직원과 주방에 즉시 알림. 주문 누락을 방지합니다.',
      badge: '실시간'
    },
    { 
      icon: CreditCard, 
      title: '다양한 결제 수단', 
      desc: '현금, 계좌이체는 물론 다양한 간편결제까지 지원합니다.',
      badge: '결제'
    },
    { 
      icon: CalendarCheck, 
      title: '대기·예약 관리', 
      desc: '대기 번호 자동 발급, 사전 예약 관리로 고객 경험을 향상시킵니다.',
      badge: '고객 서비스'
    },
    { 
      icon: BarChart3, 
      title: '매출 분석', 
      desc: '일별, 월별, 연도별 매출 통계와 결제 수단별 분석 리포트를 제공합니다.',
      badge: '인사이트'
    },
    { 
      icon: Heart, 
      title: '단골고객 관리', 
      desc: '방문 이력·포인트·VIP 등급 자동 추적. 개인화 쿠폰과 재방문 메시지로 단골을 키웁니다.',
      badge: 'CRM'
    },
    { 
      icon: MapPin, 
      title: '지역 커뮤니티', 
      desc: '주변 제휴 매장과 연결해 공동 이벤트, 포인트 공유, 지역 피드로 상권 전체를 활성화합니다.',
      badge: '상권'
    }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      {/* 프리미엄 내비게이션 바 */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tighter block bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent">WeMarket</span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 block leading-none">Smart SaaS</span>
            </div>
          </Link>

          {/* 데스크탑 메뉴 */}
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

          {/* 모바일 햄버거 토글 */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-slate-500 hover:text-slate-900 p-2">
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* 모바일 서브 레이어 */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-6 py-6 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-200">
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
            <hr className="border-slate-200 my-2" />
            <Link to="/auth" onClick={() => setMobileMenuOpen(false)} className="text-sm font-bold text-slate-500 py-2">
              로그인
            </Link>
            <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="w-full py-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-center rounded-xl text-sm font-black shadow-lg">
              무료 시작하기
            </Link>
          </div>
        )}
      </nav>

      {/* 히어로 서브 배너 */}
      <section className="relative py-16 sm:py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(249,115,22,0.08),transparent_60%)] pointer-events-none" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 text-xs font-mono font-bold mb-6">
            <Sparkles className="size-3.5" />
            <span>CORE CAPABILITIES</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-6">
            기능 소개<br />
            <span className="bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent">매장 운영에 필요한 모든 것</span>
          </h2>
          <p className="text-slate-500 text-base max-w-2xl mx-auto leading-relaxed">
            종이 메뉴판, 복잡한 POS, 예약 수첩… 이제 위마켓 하나로 통합하세요.
          </p>
        </div>
      </section>

      {/* 상세 기능 그리드 리스트 */}
      <section className="pb-20 sm:pb-24 lg:pb-36 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {coreFeatures.map((feat, idx) => (
            <div 
              key={idx} 
              className="bg-white border border-slate-200 hover:border-orange-200 rounded-3xl p-6 sm:p-8 transition-all hover:shadow-lg hover:shadow-orange-500/5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 text-orange-500 flex items-center justify-center">
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

      {/* 푸터 */}
      <footer className="border-t border-slate-200 bg-slate-50 py-12 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
              <Store className="w-4 h-4 text-slate-400" />
            </div>
            <span className="text-sm font-bold text-slate-500">WeMarket SaaS</span>
          </div>
          <p className="text-xs font-mono">&copy; 2026 WeMarket Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
