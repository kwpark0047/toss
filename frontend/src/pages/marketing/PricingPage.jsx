import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Store, Menu, X, Check, ArrowRight, ShieldCheck, HelpCircle, Sparkles, Award, Target
} from 'lucide-react';

export default function PricingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [annualBilling, setAnnualBilling] = useState(false);

  const navItems = [
    { label: '기능 소개', to: '/features' },
    { label: '요금제', to: '/pricing', active: true },
    { label: '푸드트럭', to: '/foodtruck/landing' },
    { label: '이용 가이드', to: '/guides' },
    { label: '문의하기', to: '/contact' }
  ];

  const plans = [
    {
      name: '무료 (Free)',
      price: 0,
      desc: '기본 매장 운영 및 QR 코드 생성을 지원하는 스타터 요금제',
      features: [
        '테이블별 무제한 QR 코드 생성',
        '기본 모바일 웹 메뉴판 렌더링',
        '실시간 조리 대기열 (기본 KDS)',
        '기본 일일 매출 통계 조회',
        '직원 권한 격리 (Staff 1명)',
      ],
      cta: '무료로 시작',
      color: 'border-slate-900 bg-slate-950/40',
      popular: false
    },
    {
      name: '프로 (Pro)',
      price: 20000,
      desc: '실시간 결제 대행 및 다채로운 부가 편의 장비 연동 요금제',
      features: [
        'Toss Payments 실제 라이브 결제창 연동',
        '실시간 매장 위치 공유 서비스',
        '고객 알림톡 발송 연동',
        '긴급 품절 처리 기능',
        '단골 고객 찜 목록 및 타임세일 푸시 마케팅',
        '직원/매니저 무제한 계정 생성 및 권한 격리',
      ],
      cta: '프로 시작하기',
      color: 'border-orange-500 bg-orange-500/[0.02]',
      popular: true
    },
    {
      name: '엔터프라이즈 (Enterprise)',
      price: 79000,
      desc: '지능형 AI 매출 동향 예측과 전용 독립 서버 호스팅 패키지',
      features: [
        '모든 Pro 요금제 기능 전사 보장',
        'AI 기반 요일/시간별 피크타임 매출 동향 예측',
        '주간/월간 Gemini 인공지능 매장 경영 분석 리포트',
        'ESC/POS 주방 무선 프린터 연동 및 인쇄 잡 대기열',
        '전용 1:1 슬랙/전화 고객 지원 엔지니어 배정',
        '99.9% 가동률 보증 보장 협약서(SLA) 체결',
      ],
      cta: '영업문의 및 컨설팅',
      color: 'border-slate-900 bg-slate-950/40',
      popular: false
    }
  ];

  const getPrice = (basePrice) => {
    if (annualBilling) {
      // 20% 연간 결제 할인 적용
      return Math.round((basePrice * 12 * 0.8) / 12);
    }
    return basePrice;
  };

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

      {/* 요금 헤더 배너 */}
      <section className="relative py-16 sm:py-20 lg:py-28 overflow-hidden text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(249,115,22,0.08),transparent_60%)] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 text-xs font-mono font-bold mb-6">
            <Sparkles className="size-3.5" />
            <span>PRICING PLANS</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-6">
            성공적인 스마트 점포 확장을 돕는<br />
            <span className="bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent">합리적인 SaaS 요금 정책</span>
          </h2>
          <p className="text-slate-500 text-sm max-w-xl mx-auto leading-relaxed mb-8">
            복잡한 하드웨어 설치 수수료 없이, 무약정 월 구독 방식으로 편안하게 이용하세요. 매장 성격에 맞춰 유연하게 변환할 수 있습니다.
          </p>

          {/* 연 결제 할인 토글 */}
          <div className="flex items-center justify-center gap-3">
            <span className={`text-xs font-bold transition-all ${!annualBilling ? 'text-slate-900' : 'text-slate-400'}`}>월 결제</span>
            <button 
              onClick={() => setAnnualBilling(!annualBilling)}
              className="w-12 h-6 rounded-full bg-slate-200 border border-slate-300 p-1 flex items-center relative transition-all"
            >
              <div className={`w-4 h-4 rounded-full bg-orange-500 transition-all ${annualBilling ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
            <span className={`text-xs font-bold flex items-center gap-1.5 transition-all ${annualBilling ? 'text-orange-600' : 'text-slate-400'}`}>
              연 결제
              <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full font-mono font-bold">20% SAVE</span>
            </span>
          </div>
        </div>
      </section>

      {/* 요금제 카드 그리드 */}
      <section className="pb-20 sm:pb-24 lg:pb-36 max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-stretch">
          {plans.map((plan, idx) => (
            <div 
              key={idx} 
              className={`rounded-3xl border p-6 sm:p-8 flex flex-col justify-between transition-all relative ${
                plan.popular 
                  ? 'bg-white border-orange-200 shadow-xl shadow-orange-500/5 ring-1 ring-orange-200' 
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded-full text-[10px] font-black tracking-widest uppercase">
                  POPULAR CHOICE
                </span>
              )}

              <div>
                <h3 className="text-xl font-black text-slate-900 mb-2">{plan.name}</h3>
                <p className="text-slate-500 text-xs leading-relaxed mb-6 h-12">{plan.desc}</p>
                <div className="flex items-baseline gap-1.5 border-b border-slate-200 pb-6 mb-6">
                  <span className="text-4xl font-black font-mono text-slate-900">
                    {plan.price === 0 ? '₩0' : `₩${getPrice(plan.price).toLocaleString('ko-KR')}`}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">/월</span>
                </div>

                <ul className="space-y-3.5 mb-8">
                  {plan.features.map((feat, fidx) => (
                    <li key={fidx} className="flex items-start gap-2.5 text-xs text-slate-600">
                      <Check className="size-4 text-orange-500 mt-0.5 flex-shrink-0" />
                      <span className="leading-normal">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link 
                to={plan.price === 79000 ? '/contact' : '/register'}
                className={`w-full py-3.5 rounded-2xl text-center text-xs font-black transition-all ${
                  plan.popular 
                    ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 active:scale-95' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                {plan.cta}
              </Link>
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
