import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck, Menu, X, Mail, Send, CheckCircle, Sparkles
} from 'lucide-react';

export default function FoodTruckContact() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    category: 'FOOD_TRUCK',
    message: ''
  });

  const navItems = [
    { label: '매장찾기', to: '/foodtruck/landing' },
    { label: '기능소개', to: '/foodtruck/landing' },
    { label: '요금제', to: '/foodtruck/landing' },
    { label: '이용가이드', to: '/foodtruck/landing' },
    { label: '문의하기', to: '/foodtruck/landing', active: true }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Navigation */}
      <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/foodtruck/landing" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tighter block uppercase bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-transparent">WeMarket</span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 block leading-none">Food Truck</span>
            </div>
          </Link>

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

          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-slate-400 hover:text-slate-200 p-2">
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-900 bg-slate-950 px-6 py-6 flex flex-col gap-4">
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
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(249,115,22,0.12),transparent_60%)] pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-mono font-bold mb-6">
            <Mail className="size-3.5" />
            <span>FOOD TRUCK SUPPORT</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-6">
            푸드트럭 운영 관련<br />
            <span className="bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-transparent">문의하기</span>
          </h2>
          <p className="text-slate-400 text-base max-w-2xl mx-auto leading-relaxed">
            푸드트럭 입점, 기능 문의, 제휴 제안 등 궁금하신 점을 남겨주시면 빠르게 답변 드리겠습니다.
          </p>
        </div>
      </section>

      {/* Contact Form */}
      <section className="pb-24 max-w-2xl mx-auto px-6">
        {submitted ? (
          <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-12 text-center">
            <CheckCircle className="size-12 text-orange-400 mx-auto mb-4" />
            <h3 className="text-xl font-black text-slate-100 mb-2">문의가 접수되었습니다</h3>
            <p className="text-slate-400 text-sm">빠른 시일 내에 답변 드리겠습니다.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">이름</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-orange-500/50 transition-all"
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">이메일</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-orange-500/50 transition-all"
                placeholder="example@email.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">전화번호</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-orange-500/50 transition-all"
                placeholder="010-0000-0000"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">문의 유형</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-orange-500/50 transition-all"
              >
                <option value="FOOD_TRUCK">푸드트럭 입점 문의</option>
                <option value="GENERAL">일반 문의</option>
                <option value="PAY_CONTRACT">결제 계약 문의</option>
                <option value="PARTNERSHIP">파트너십 제안</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">메시지</label>
              <textarea
                required
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-orange-500/50 transition-all resize-none"
                placeholder="문의 내용을 입력해주세요..."
              />
            </div>
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 text-white text-sm font-black shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Send className="size-4" />
              문의 보내기
            </button>
          </form>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-12 text-slate-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-800">
              <Truck className="w-4 h-4 text-slate-400" />
            </div>
            <span className="text-sm font-bold text-slate-400">WeMarket Food Truck</span>
          </div>
          <p className="text-xs font-mono">&copy; 2026 WeMarket Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
