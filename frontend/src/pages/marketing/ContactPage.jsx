import { useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence } from 'framer-motion';
import { Store, Menu, X, Mail, Phone, MapPin, Send, Sparkles } from 'lucide-react';
import Icon from '../../components/ui/Icon';
export default function ContactPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    storeName: '',
    phone: '',
    email: '',
    category: 'GENERAL',
    // GENERAL, PAY_CONTRACT, FOOD_TRUCK, PARTNERSHIP
    message: ''
  });
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
    to: '/guides'
  }, {
    label: '문의하기',
    to: '/contact',
    active: true
  }];
  const handleInputChange = e => {
    const {
      name,
      value
    } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  const handleSubmit = e => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.email || !formData.message) {
      alert('필수 기입 필드를 채워주세요.');
      return;
    }
    // 온라인 접수 시스템이 없으므로 성공을 가장하지 않고 이메일 안내로 전환한다.
    setSubmitted(true);
  };
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

      {/* 컨택트 레이아웃 */}
      <section className="relative py-20 lg:py-28 overflow-hidden max-w-7xl mx-auto px-4 sm:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_-20%,rgba(249,115,22,0.06),transparent_50%)] pointer-events-none" />
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10">
          {/* 좌측 정보 카드 */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 text-xs font-mono font-bold mb-6">
                <Sparkles className="size-3.5" />
                <span>CONTACT & SUPPORT</span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-black tracking-tight mb-4 text-slate-900">
                비즈니스에 맞는<br />
                <span className="bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent">상담 및 도입 문의</span>
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-8 max-w-sm">
                토스페이먼츠 PG 카드사 심사 대행, 이동식 푸드트럭 특화 요금제 컨설팅, 프랜차이즈 맞춤 구축 문의까지 위마켓 전문가가 상세히 응대해 드립니다.
              </p>
            </div>

            {/* 회사 세부 정보 */}
            <div className="space-y-6">
              <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 p-4 rounded-2xl max-w-sm">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 text-orange-500 flex items-center justify-center">
                  <Mail className="size-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">이메일 지원</p>
                  <p className="text-xs font-mono font-bold text-slate-800">support@wemarket.co.kr</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 p-4 rounded-2xl max-w-sm">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 text-orange-500 flex items-center justify-center">
                  <Phone className="size-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">고객 센터</p>
                  <p className="text-xs font-mono font-bold text-slate-800">1544-3024 (평일 09:00 - 18:00)</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 p-4 rounded-2xl max-w-sm">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 text-orange-500 flex items-center justify-center">
                  <Icon icon="MapPin" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">본사 위치</p>
                  <p className="text-xs font-bold text-slate-800 leading-snug">서울특별시 강남구 테헤란로 152 (역삼동, 파이낸스센터)</p>
                </div>
              </div>
            </div>
          </div>

          {/* 우측 인쇄 접수 양식 */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-8 lg:p-10 shadow-lg relative">
            <AnimatePresence mode="wait">
              {!submitted ? <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="contact-name" className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">성명 (필수)</label>
                      <input id="contact-name" type="text" name="name" required value={formData.name} onChange={handleInputChange} placeholder="홍길동" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-orange-400 transition-all placeholder-slate-400" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">매장명 / 상호 (선택)</label>
                      <input type="text" name="storeName" value={formData.storeName} onChange={handleInputChange} placeholder="위마켓 강남점" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-orange-400 transition-all placeholder-slate-400" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="contact-phone" className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">연락처 (필수)</label>
                      <input id="contact-phone" type="tel" name="phone" required value={formData.phone} onChange={handleInputChange} placeholder="010-1234-5678" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-orange-400 transition-all placeholder-slate-400" />
                    </div>
                    <div>
                      <label htmlFor="contact-email" className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">이메일 주소 (필수)</label>
                      <input id="contact-email" type="email" name="email" required value={formData.email} onChange={handleInputChange} placeholder="ceo@wemarket.co.kr" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-orange-400 transition-all placeholder-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">문의 유형</label>
                    <select name="category" value={formData.category} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-orange-400 text-slate-700 transition-all">
                      <option value="GENERAL">일반 도입 및 견적 문의</option>
                      <option value="PAY_CONTRACT">토스페이먼츠 가맹 및 수수료 문의</option>
                      <option value="FOOD_TRUCK">푸드트럭 세션 및 실시간 모듈 패키지 문의</option>
                      <option value="PARTNERSHIP">비즈니스 제휴 및 API 연동 문의</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="contact-message" className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">문의 내용 (필수)</label>
                    <textarea id="contact-message" name="message" required rows={5} value={formData.message} onChange={handleInputChange} placeholder="매장 규모, 테이블 개수, 현재 운영 중이신 업종 정보 등을 기입해 주시면 더욱 정확하고 빠른 상담을 받으실 수 있습니다." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-orange-400 transition-all placeholder-slate-400 resize-none leading-relaxed" />
                  </div>

                  <button type="submit" className="w-full py-4 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-2 transition-all">
                    <Send className="size-4" />
                    <span>이메일 문의 안내 보기</span>
                  </button>
                </form> : (/* 접수 안내 — 온라인 접수 시스템이 없으므로 성공을 가장하지 않는다 */
            <div role="alert" className="py-20 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-16 h-16 rounded-full bg-orange-50 border border-orange-200 text-orange-500 flex items-center justify-center mb-6">
                    <Mail className="size-8" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-3">이메일로 문의해 주세요</h3>
                  <p className="text-slate-500 text-xs leading-relaxed max-w-sm mb-8">
                    온라인으로 접수되지 않았습니다. 신속한 답변을 원하시면 아래 이메일로
                    문의 내용을 보내주세요. 영업일 기준 24시간 이내에 담당자가 회신드립니다.
                  </p>
                  <a href={`mailto:support@wemarket.co.kr?subject=${encodeURIComponent(`[문의] ${formData.storeName || formData.name}`)}&body=${encodeURIComponent(`성명: ${formData.name}\n상호: ${formData.storeName}\n연락처: ${formData.phone}\n문의 유형: ${formData.category}\n\n${formData.message}`)}`} className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 transition-all">
                    <Mail className="size-4" />
                    이메일로 문의하기
                  </a>
                  <button onClick={() => {
                setSubmitted(false);
                setFormData({
                  name: '',
                  storeName: '',
                  phone: '',
                  email: '',
                  category: 'GENERAL',
                  message: ''
                });
              }} className="mt-6 px-6 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all">
                    새로운 문의 작성하기
                  </button>
                </div>)}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-slate-200 bg-slate-50 py-12 text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-slate-200">
              <Store className="w-4 h-4 text-slate-400" />
            </div>
            <span className="text-sm font-bold text-slate-400">WeMarket SaaS</span>
          </div>
          <p className="text-xs font-mono">&copy; 2026 WeMarket Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>;
}
