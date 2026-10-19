import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, Menu, X, ChevronDown, ChevronUp, Search, BookOpen, QrCode, Smartphone, CreditCard, Monitor, Gift, BarChart3, RefreshCw } from 'lucide-react';
export default function GuidesPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState({});
  const navItems = [{
    label: '기능 소개',
    to: '/features'
  }, {
    label: '요금제',
    to: '/pricing'
  }, {
    label: '푸드트럭',
    to: '/foodtruck/landing'
  }, {
    label: '이용 가이드',
    to: '/guides',
    active: true
  }, {
    label: '문의하기',
    to: '/contact'
  }];
  const onboardingSteps = [{
    step: '01',
    title: '매장 회원가입 & 점포 등록',
    desc: '휴대전화번호·이메일·비밀번호로 가입한 뒤 "매장 생성"에서 상호명, 업종, 주소 정보를 등록합니다. 가입 즉시 Free 1개월 체험이 시작됩니다.',
    icon: Store
  }, {
    step: '02',
    title: '메뉴 등록 및 카테고리 구성',
    desc: '점주 모바일 대시보드의 "메뉴 관리" 탭에서 대표 이미지, 가격, 상세 옵션을 정렬 등록합니다.',
    icon: Smartphone
  }, {
    step: '03',
    title: 'QR 코드 도안 인쇄 및 테이블 부착',
    desc: '자동 생성된 테이블 전용 고해상도 QR 인쇄 도안을 출력해 테이블 또는 주문 가판대에 부착합니다.',
    icon: QrCode
  }, {
    step: '04',
    title: 'KDS(주방 모니터) 연결 & 조리 개시',
    desc: 'KDS 화면을 주방 태블릿에 켜두면 손님의 모바일 결제 주문서가 실시간 동기화 전송됩니다.',
    icon: BookOpen
  }];
  const faqs = [{
    q: 'QR 코드 스캔 시 별도의 전용 앱을 설치해야 하나요?',
    a: '아니요, 위마켓은 순수 웹 표준(Web SaaS) 기반으로 설계되었습니다. 손님은 기본 모바일 브라우저(Safari, Chrome 등)에서 즉시 주문창으로 라우팅되어 테이블 위에서 앱 다운로드 스트레스 없이 직관적으로 주문할 수 있습니다.'
  }, {
    q: '푸드트럭의 실시간 GPS 위치 동기화는 어떻게 작동하나요?',
    a: '푸드트럭 점주 전용 모바일 대시보드에서 "실시간 GPS 위치 동기화" 스위치를 켜면, HTML5 Geolocation API가 점주의 모바일 기기 좌표를 30초 주기로 전송합니다. 전송된 정보는 실시간으로 한글 행정동 주소로 역지오코딩 변환되어 메인 지도에 반영됩니다.'
  }, {
    q: '매장 내부 인터넷 연결이 갑자기 끊어지면 주문이 날아가나요?',
    a: '연결이 끊긴 동안 서버에 도달하지 않은 주문은 접수로 확정되지 않을 수 있습니다. 주문 화면의 접수 결과를 확인하고, 네트워크 복구 후 주문·결제 상태를 다시 조회해 주세요. 외부 POS·카드단말기의 오프라인 승인 내역도 각 업체의 원본 기록과 대조해야 합니다.'
  }, {
    q: '토스페이먼츠 라이브 가맹점 키 발급 및 승인 절차는 어떻게 되나요?',
    a: '위마켓 사업자 설정 탭에서 사업자 정보를 입력한 뒤, 토스페이먼츠 온라인 계약을 신청하시면 2~3일 이내에 상용 결제 클라이언트 키와 시크릿 키가 발급됩니다. 발급된 키를 관리자 콘솔에 등록하는 즉시 실결제창이 활성화됩니다.'
  }];
  const toggleFaq = idx => {
    setExpandedFaq(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };
  const filteredFaqs = faqs.filter(faq => faq.q.includes(searchQuery) || faq.a.includes(searchQuery));
  const integrationSources = [
    { title: 'POS·포스기', icon: Monitor, description: '매출 원장, 주문번호, 할인·취소, 부가세를 가져와 위마켓 주문과 비교합니다.' },
    { title: '키오스크·테이블오더', icon: Smartphone, description: '주문 채널과 주문 시각·품목·금액을 모아 QR 주문과 채널별 실적을 비교합니다.' },
    { title: '카드단말기·PG', icon: CreditCard, description: '승인·취소·환불·입금 내역을 매출 원장과 대사합니다. 결제 승인 자체를 위마켓이 대신하지 않습니다.' },
    { title: '포인트·멤버십', icon: Gift, description: '적립·사용·취소와 고객 동의 범위를 확인해 재방문 분석에 활용합니다.' },
  ];
  const integrationSteps = [
    ['1. 원본 준비', '사용 업체의 공식 API·제휴 범위를 확인하거나 관리자 화면에서 CSV 원장을 내려받습니다. 업체 사이트가 있다고 공개 매출 API가 있다는 뜻은 아닙니다.'],
    ['2. 연결 등록', '매장 관리자 → 데이터 통합·성장 메뉴에서 채널·업체·수집 방식을 등록합니다. API 키는 업체 서버에서 위마켓 수집 API를 호출할 때만 사용하고 브라우저에 넣지 않습니다.'],
    ['3. 미리보기·정규화', 'CSV 양식을 맞추고 먼저 미리보기합니다. 거래 시각·통화·상태·주문키·환불 누계를 검토한 후 확인된 자료만 수집합니다. 중복 이벤트는 제외됩니다.'],
    ['4. 합계·차이 확인', '현재 통합 센터에서는 선택 기간의 주문 매출·건수와 채널별 합계, 수집 이력을 확인합니다. 주문별 POS·PG 정산 대사는 업체별 식별자 매핑과 실제 원장 검증을 마친 뒤 제공해야 합니다.'],
  ];
  return <div className="min-h-screen bg-white text-slate-900 font-sans">
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
            {navItems.map(item => <Link key={item.label} to={item.to} className={`text-sm font-bold tracking-tight transition-all ${item.active ? 'text-orange-500' : 'text-slate-500 hover:text-slate-900'}`}>
                {item.label}
              </Link>)}
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
        {mobileMenuOpen && <div className="md:hidden border-t border-slate-200 bg-white px-6 py-6 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-200">
            {navItems.map(item => <Link key={item.label} to={item.to} onClick={() => setMobileMenuOpen(false)} className={`text-sm font-bold py-2 ${item.active ? 'text-orange-500' : 'text-slate-500'}`}>
                {item.label}
              </Link>)}
            <hr className="border-slate-200 my-2" />
            <Link to="/auth" onClick={() => setMobileMenuOpen(false)} className="text-sm font-bold text-slate-500 py-2">
              로그인
            </Link>
            <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="w-full py-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-center rounded-xl text-sm font-black shadow-lg">
              무료 시작하기
            </Link>
          </div>}
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
          {onboardingSteps.map((step, idx) => <div key={idx} className="bg-white border border-slate-200 rounded-3xl p-6 relative hover:border-orange-200 hover:shadow-lg hover:shadow-orange-500/5 transition-all">
              <div className="absolute -top-4 left-6 text-3xl font-mono font-black text-slate-200 tracking-wider">
                {step.step}
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-orange-500 flex items-center justify-center mb-6 mt-2">
                <step.icon className="size-5" />
              </div>
              <h4 className="text-sm font-black text-slate-900 mb-2">{step.title}</h4>
              <p className="text-slate-500 text-xs leading-relaxed">{step.desc}</p>
            </div>)}
        </div>
      </section>

      {/* POS·주변 장비 연동 및 데이터 분석 */}
      <section className="border-y border-slate-200 bg-slate-50/70 py-16 sm:py-20" aria-labelledby="integration-guide-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <header className="mx-auto mb-10 max-w-3xl text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600"><BarChart3 aria-hidden="true" className="h-6 w-6" /></div>
            <h3 id="integration-guide-title" className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">매장 장비 데이터를 연결해 한눈에 분석하기</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">POS, 키오스크, 카드단말기, 포인트 기기의 원장을 위마켓 주문·고객 데이터와 모아 채널별 매출과 정산 차이를 확인합니다.</p>
          </header>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {integrationSources.map(({ title, icon: Icon, description }) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <Icon aria-hidden="true" className="mb-4 h-5 w-5 text-orange-600" />
              <h4 className="font-bold text-slate-900">{title}</h4>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </article>)}
          </div>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex sm:items-start sm:gap-3">
            <RefreshCw aria-hidden="true" className="mb-2 h-5 w-5 shrink-0 text-amber-700 sm:mb-0" />
            <p className="text-sm leading-6 text-amber-950"><strong>현재 제공 범위:</strong> 공통 CSV 가져오기와 인증된 API 이벤트 수집 구조, 선택 기간의 주문·채널 합계와 수집 이력을 제공합니다. 업체별 자동 API 어댑터와 주문별 POS·PG 정산 대사는 계약·공식 권한·원본 데이터 검증이 끝난 뒤 활성화합니다. 연결 등록만으로 자동 동기화나 대사가 완료되지는 않으며, 실제 원본 데이터가 들어오기 전에는 운영 연동 완료로 표시하지 않습니다.</p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="데이터 연동 단계">
            {integrationSteps.map(([title, description]) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
              <h4 className="font-bold text-slate-900">{title}</h4>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </article>)}
          </div>

          <div className="mt-8 grid gap-5 rounded-2xl bg-slate-900 p-5 text-white sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
            <div>
              <h4 className="flex items-center gap-2 font-bold"><BarChart3 aria-hidden="true" className="h-5 w-5 text-orange-400" /> 모은 데이터로 확인할 수 있는 것</h4>
              <p className="mt-2 text-sm leading-6 text-slate-300">현재는 선택한 기간의 주문 기준 순매출·주문 수와 채널별 합계, 기존 CRM 고객 수와 수집 이력을 확인할 수 있습니다. 검증된 원본이 갖춰지면 취소·환불, 승인액·정산액 차이와 포인트·재방문 흐름을 대사·분석 대상으로 확장합니다. AI 매장 매니저는 연결된 출처와 분석 기간을 표시하고, 데이터가 부족하면 판단을 보류합니다.</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">전화번호·카드번호·비밀번호 등 불필요한 민감정보는 업로드하지 마세요. 카드 승인·포인트 실행은 해당 원천 시스템에서 처리하며, 같은 주문의 POS·PG 기록을 매출로 중복 합산하지 않습니다.</p>
            </div>
            <Link to="/auth" className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-600"><BookOpen aria-hidden="true" className="h-4 w-4" />사업자 로그인 후 데이터 통합 센터 열기</Link>
          </div>
        </div>
      </section>

      {/* 자주 묻는 질문 (FAQ) 아코디언 */}
      <section className="pb-20 sm:pb-24 lg:pb-36 max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h3 className="text-xl sm:text-2xl font-black tracking-tight mb-3 text-slate-900">자주 묻는 질문 (FAQ)</h3>
          <div className="relative mt-6 max-w-md mx-auto">
            <input type="text" placeholder="궁금한 내용을 입력해 보세요..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-10 py-3 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all placeholder-slate-400" />
            <Search className="size-4 text-slate-400 absolute left-3.5 top-3.5" />
          </div>
        </div>

        <div className="space-y-4">
          {filteredFaqs.length === 0 ? <div className="text-center py-10 text-slate-400 text-sm">
              검색어와 부합하는 도움말을 찾지 못했습니다. 다른 단어로 검색해 보세요.
            </div> : filteredFaqs.map((faq, idx) => {
          const isExpanded = expandedFaq[idx];
          return <div key={idx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all hover:border-slate-300">
                  <button onClick={() => toggleFaq(idx)} className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 font-bold text-sm text-slate-900 hover:text-orange-600 transition-colors">
                    <span>{faq.q}</span>
                    {isExpanded ? <ChevronUp className="size-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="size-4 text-slate-400 flex-shrink-0" />}
                  </button>
                  {isExpanded && <div className="px-5 sm:px-6 pb-5 sm:pb-6 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4 bg-slate-50/50">
                      {faq.a}
                    </div>}
                </div>;
        })}
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
    </div>;
}

