import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Store, Menu, X, HelpCircle, ChevronDown, ChevronUp, Search,
  BookOpen, Play, CheckCircle, ArrowRight, Printer, QrCode, Smartphone
} from 'lucide-react';

export default function GuidesPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState({});

  const navItems = [
    { label: '기능 소개', to: '/features' },
    { label: '요금제', to: '/pricing' },
    { label: '푸드트럭', to: '/foodtruck/landing' },
    { label: '이용 가이드', to: '/guides', active: true },
    { label: '문의하기', to: '/contact' }
  ];

  const onboardingSteps = [
    {
      step: '01',
      title: '매장 회원가입 & 점포 등록',
      desc: '간단한 이메일 가입 후 "매장 생성" 양식에 맞춰 상호명, 업종, 주소 정보를 등록합니다.',
      icon: Store
    },
    {
      step: '02',
      title: '메뉴 등록 및 카테고리 구성',
      desc: '점주 모바일 대시보드의 "메뉴 관리" 탭에서 대표 이미지, 가격, 상세 옵션을 정렬 등록합니다.',
      icon: Smartphone
    },
    {
      step: '03',
      title: 'QR 코드 도안 인쇄 및 테이블 부착',
      desc: '자동 생성된 테이블 전용 고해상도 QR 인쇄 도안을 출력해 테이블 또는 주문 가판대에 부착합니다.',
      icon: QrCode
    },
    {
      step: '04',
      title: 'KDS(주방 모니터) 연결 & 조리 개시',
      desc: 'KDS 화면을 주방 태블릿에 켜두면 손님의 모바일 결제 주문서가 실시간 동기화 전송됩니다.',
      icon: BookOpen
    }
  ];

  const faqs = [
    {
      q: 'QR 코드 스캔 시 별도의 전용 앱을 설치해야 하나요?',
      a: '아니요, 위마켓은 순수 웹 표준(Web SaaS) 기반으로 설계되었습니다. 손님은 기본 모바일 브라우저(Safari, Chrome 등)에서 즉시 주문창으로 라우팅되어 테이블 위에서 앱 다운로드 스트레스 없이 직관적으로 주문할 수 있습니다.'
    },
    {
      q: '푸드트럭의 실시간 GPS 위치 동기화는 어떻게 작동하나요?',
      a: '푸드트럭 점주 전용 모바일 대시보드에서 "실시간 GPS 위치 동기화" 스위치를 켜면, HTML5 Geolocation API가 점주의 모바일 기기 좌표를 30초 주기로 전송합니다. 전송된 정보는 실시간으로 한글 행정동 주소로 역지오코딩 변환되어 메인 지도에 반영됩니다.'
    },
    {
      q: '매장 내부 인터넷 연결이 갑자기 끊어지면 주문이 날아가나요?',
      a: '아니요, 위마켓은 PWA(Progressive Web App) 오프라인 모드를 정교하게 내장하고 있습니다. 손님의 단말기 및 주방 화면은 브라우저 내 IndexedDB 보안 버퍼 메모리에 거래 내역을 암호화 보존해 둡니다. 네트워크가 복구되는 즉시 일괄 동기화(Batch Sync)되어 DB 원장에 정상 반영됩니다.'
    },
    {
      q: '토스페이먼츠 라이브 가맹점 키 발급 및 승인 절차는 어떻게 되나요?',
      a: '위마켓 사업자 설정 탭에서 사업자 정보를 입력한 뒤, 토스페이먼츠 온라인 계약을 신청하시면 2~3일 이내에 상용 결제 클라이언트 키와 시크릿 키가 발급됩니다. 발급된 키를 관리자 콘솔에 등록하는 즉시 실결제창이 활성화됩니다.'
    }
  ];

  const toggleFaq = (idx) => {
    setExpandedFaq(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const filteredFaqs = faqs.filter(
    faq => faq.q.includes(searchQuery) || faq.a.includes(searchQuery)
  );

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

      {/* 이용가이드 헤더 */}
      <section className="relative py-16 sm:py-20 lg:py-24 overflow-hidden text-center bg-gradient-to-b from-orange-50/50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(249,115,22,0.06),transparent_60%)] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-6">
            WeMarket 플랫폼<br />
            <span className="bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent">이용 가이드 & FAQ</span>
          </h2>
          <p className="text-slate-500 text-sm max-w-lg mx-auto leading-relaxed mb-8">
            처음 매장을 생성하고 QR 오더를 개시하기까지의 온보딩 매뉴얼과 가장 자주 묻는 질문들을 쉽고 상세하게 안내해 드립니다.
          </p>
        </div>
      </section>

      {/* 단계별 온보딩 */}
      <section className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12 sm:mb-16">
          <h3 className="text-xl sm:text-2xl font-black tracking-tight mb-2 text-slate-900">4단계 초고속 오픈 가이드</h3>
          <p className="text-slate-500 text-xs">처음 시작하는 점주님도 15분 만에 테이블 주문판 구성을 끝낼 수 있습니다.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {onboardingSteps.map((step, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-3xl p-6 relative hover:border-orange-200 hover:shadow-lg hover:shadow-orange-500/5 transition-all">
              <div className="absolute -top-4 left-6 text-3xl font-mono font-black text-slate-200 tracking-wider">
                {step.step}
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-orange-500 flex items-center justify-center mb-6 mt-2">
                <step.icon className="size-5" />
              </div>
              <h4 className="text-sm font-black text-slate-900 mb-2">{step.title}</h4>
              <p className="text-slate-500 text-xs leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 자주 묻는 질문 (FAQ) 아코디언 */}
      <section className="pb-20 sm:pb-24 lg:pb-36 max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h3 className="text-xl sm:text-2xl font-black tracking-tight mb-3 text-slate-900">자주 묻는 질문 (FAQ)</h3>
          <div className="relative mt-6 max-w-md mx-auto">
            <input 
              type="text" 
              placeholder="궁금한 내용을 입력해 보세요..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-10 py-3 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all placeholder-slate-400"
            />
            <Search className="size-4 text-slate-400 absolute left-3.5 top-3.5" />
          </div>
        </div>

        <div className="space-y-4">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              검색어와 부합하는 도움말을 찾지 못했습니다. 다른 단어로 검색해 보세요.
            </div>
          ) : (
            filteredFaqs.map((faq, idx) => {
              const isExpanded = expandedFaq[idx];
              return (
                <div key={idx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all hover:border-slate-300">
                  <button 
                    onClick={() => toggleFaq(idx)}
                    className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 font-bold text-sm text-slate-900 hover:text-orange-600 transition-colors"
                  >
                    <span>{faq.q}</span>
                    {isExpanded ? <ChevronUp className="size-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="size-4 text-slate-400 flex-shrink-0" />}
                  </button>
                  {isExpanded && (
                    <div className="px-5 sm:px-6 pb-5 sm:pb-6 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4 bg-slate-50/50">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })
          )}
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
