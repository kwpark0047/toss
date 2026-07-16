import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck, Menu, X, _MapPin, Smartphone, QrCode, Navigation,
  ChevronDown, ChevronUp, Sparkles, _CheckCircle, Fuel, AlertTriangle
} from 'lucide-react';

export default function FoodTruckGuides() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const navItems = [
    { label: '매장찾기', to: '/foodtruck/landing' },
    { label: '기능소개', to: '/foodtruck/landing' },
    { label: '요금제', to: '/foodtruck/landing' },
    { label: '이용가이드', to: '/foodtruck/landing', active: true },
    { label: '문의하기', to: '/foodtruck/landing' }
  ];

  const steps = [
    {
      icon: Truck,
      step: '01',
      title: '트럭 정보 등록',
      desc: '사업자 등록증, 차량 정보, 영업 가능 지역을 등록합니다. 이동형 매장의 특성에 맞는 추가 정보도 함께 입력할 수 있습니다.'
    },
    {
      icon: Smartphone,
      step: '02',
      title: '메뉴 & GPS 설정',
      desc: '메뉴를 등록하고 GPS 위치 동기화 간격을 설정합니다. 자동 위치 업데이트와 수동 모드 중 선택 가능합니다.'
    },
    {
      icon: QrCode,
      step: '03',
      title: 'QR 코드 발급',
      desc: '고객이 스캔할 QR 코드를 발급받습니다. 트럭 외부, 테이블, 배달 패키지 등 다양한 위치에 부착하세요.'
    },
    {
      icon: Navigation,
      step: '04',
      title: '영업 시작',
      desc: '_GPS 위치가 자동으로 서버에 반영되고, 고객은 WeMarket에서 실시간으로 트럭 위치를 확인하고 주문할 수 있습니다.'
    },
    {
      icon: AlertTriangle,
      step: '05',
      title: '긴급 품절 처리',
      desc: '재료가 소진되면 원터치로 전 메뉴를 일괄 품절 처리합니다. 고객에게 자동으로 알림톡이 발송됩니다.'
    },
    {
      icon: Fuel,
      step: '06',
      title: '동선 최적화',
      desc: 'AI가 과거 판매 데이터를 분석하여 최적의 이동 경로와 영업 거점을 제안합니다.'
    }
  ];

  const faqs = [
    {
      q: 'GPS가 잘 안 되는 지역에서도 사용할 수 있나요?',
      a: '네. 네트워크 불안정 환경을 고려하여 GPS 캐싱과 오프라인 모드를 지원합니다. 네트워크가 복구되면 자동으로 위치가 동기화됩니다.'
    },
    {
      q: '킬스위치(일괄 품절) 기능은 어떻게 사용하나요?',
      a: '대시보드 상단의 빨간색 "긴급 품절" 버튼을 누르면 전 메뉴가 즉시 품절 처리됩니다. 대기 중인 고객에게는 자동으로 알림톡이 발송됩니다.'
    },
    {
      q: '여러 대의 트럭을 동시에 운영할 수 있나요?',
      a: '프로 이상 요금제에서 다중 트럭 관리가 가능합니다. 각 트럭의 위치와 주문을 하나의 대시보드에서 통합 관리할 수 있습니다.'
    },
    {
      q: '고객은 트럭 위치를 어떻게 확인하나요?',
      a: '고객은 WeMarket 웹사이트에서 실시간으로 트럭의 GPS 위치를 지도 위에서 확인할 수 있습니다. 한글 도로명 주소로 변환되어 표시됩니다.'
    },
    {
      q: '알림톡은 어떻게 설정하나요?',
      a: '카카오 알림톡 채널 연동이 필요합니다. 설정 > 알림 설정에서 채널 ID를 입력하면 자동으로 연동됩니다.'
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
            <span>FOOD TRUCK GUIDE</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-6">
            푸드트럭 영업 시작을 위한<br />
            <span className="bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-transparent">단계별 가이드</span>
          </h2>
          <p className="text-slate-500 text-base max-w-2xl mx-auto leading-relaxed">
            회원가입부터 첫 주문 받기까지, 이동식 푸드트럭 운영에 필요한 모든 과정을 안내합니다.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="pb-24 max-w-5xl mx-auto px-6">
        <div className="space-y-6">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-2xl p-6 md:p-8 flex items-start gap-6 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center flex-shrink-0">
                <step.icon className="size-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200 mb-2 inline-block">
                  STEP {step.step}
                </span>
                <h3 className="text-lg font-black tracking-tight text-slate-900 mb-2">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-24 max-w-3xl mx-auto px-6">
        <h3 className="text-2xl font-black tracking-tight text-center mb-10">
          자주 묻는 <span className="bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-transparent">질문</span>
        </h3>
        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full px-6 py-4 flex items-center justify-between text-left"
              >
                <span className="text-sm font-bold text-slate-900 pr-4">{faq.q}</span>
                {openFaq === idx ? <ChevronUp className="size-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="size-4 text-slate-400 flex-shrink-0" />}
              </button>
              {openFaq === idx && (
                <div className="px-6 pb-4">
                  <p className="text-slate-500 text-sm leading-relaxed">{faq.a}</p>
                </div>
              )}
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
