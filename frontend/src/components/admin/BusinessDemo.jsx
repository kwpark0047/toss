import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Store, LayoutDashboard, UtensilsCrossed, ShoppingBag, Users, Wallet,
  Sparkles, DollarSign, BadgeCheck, Activity, ArrowUpRight, Zap, ReceiptText,
  ChefHat, BarChart3, MessageSquareText, ArrowLeft, ArrowRight, Play, ChevronRight,
} from 'lucide-react';

/**
 * BusinessDemo — 사업자(관리자) 데모 체험.
 * 로그인·API 없이 최신 관리자 대시보드 UI(다크 테마·가로형 통계 카드·빠른 실행·
 * 실시간 주문)를 데모 데이터로 보여준다. 고객 데모(MenuDemo)의 사업자 버전.
 */
const NAV = [
  { label: '대시보드', icon: LayoutDashboard, active: true },
  { label: '주문서 현황', icon: UtensilsCrossed },
  { label: '상품 관리', icon: ShoppingBag },
  { label: '매출 분석', icon: BarChart3 },
  { label: '단골 관리', icon: Users },
  { label: '정산 분석', icon: Wallet },
  { label: 'AI 팅커벨', icon: Sparkles },
];

const STATS = [
  { title: '총 매출', icon: DollarSign, color: 'text-orange-400', bg: 'bg-orange-500/10', value: '₩1,284,000', trend: 18, accent: 'border-orange-500/20' },
  { title: '총 주문', icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-500/10', value: '86건', trend: 12, accent: 'border-blue-500/20' },
  { title: '완료율', icon: BadgeCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10', value: '97%', accent: 'border-emerald-500/20' },
  { title: '매장 상태', icon: Activity, color: 'text-violet-400', bg: 'bg-violet-500/10', value: '대기 3건', accent: 'border-orange-500/40' },
];

const QUICK = [
  { label: '주문 관리', icon: ReceiptText, color: 'from-orange-500 to-amber-500', badge: 3 },
  { label: '메뉴 관리', icon: ChefHat, color: 'from-blue-500 to-cyan-500' },
  { label: '테이블', icon: LayoutDashboard, color: 'from-violet-500 to-purple-500' },
  { label: '매출 분석', icon: BarChart3, color: 'from-emerald-500 to-teal-500' },
  { label: '직원 관리', icon: Users, color: 'from-rose-500 to-pink-500' },
  { label: '리뷰 관리', icon: MessageSquareText, color: 'from-fuchsia-500 to-pink-500' },
];

const ORDERS = [
  { no: '#942', table: '3번', name: '비회원', time: '오후 09:30', amount: '₩24,000', status: '조리중', cls: 'bg-amber-500/15 text-amber-400' },
  { no: '#941', table: '7번', name: '김민준', time: '오후 09:12', amount: '₩38,500', status: '완료', cls: 'bg-emerald-500/15 text-emerald-400' },
  { no: '#940', table: '1번', name: '박지수', time: '오후 08:55', amount: '₩17,000', status: '완료', cls: 'bg-emerald-500/15 text-emerald-400' },
];

export default function BusinessDemo() {
  const [period, setPeriod] = useState('오늘');

  return (
    <div className="min-h-screen flex bg-slate-950 text-white">
      {/* 데모 상단 배너 */}
      <div className="fixed top-0 inset-x-0 z-50 bg-gradient-to-r from-orange-500 to-rose-600 text-white text-center py-2 text-xs sm:text-sm font-black flex items-center justify-center gap-2">
        <Play size={14} className="fill-current" /> 사업자 데모 체험 — 실제 데이터가 아닌 예시 화면입니다
        <Link to="/" className="ml-3 underline underline-offset-2 opacity-90 hover:opacity-100">나가기</Link>
      </div>

      {/* 사이드바 (데모, 데스크톱) */}
      <aside className="hidden lg:flex w-72 flex-col bg-slate-900/60 border-r border-white/5 pt-14">
        <div className="p-8">
          <Link to="/" aria-label="메인 페이지로 이동" className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-xl shadow-orange-500/20">
              <Store className="w-6 h-6 text-white" aria-hidden="true" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight block leading-none uppercase">WeMarket</span>
              <span className="text-[11px] text-slate-500 font-bold">관리자 센터</span>
            </div>
          </Link>
        </div>
        <nav className="px-5 space-y-1">
          {NAV.map(({ label, icon: Icon, active }) => (
            <div key={label}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm ${active ? 'bg-gradient-to-r from-orange-500 to-rose-600 text-white shadow-lg shadow-orange-500/20' : 'text-slate-400'}`}>
              <Icon size={18} /> {label}
            </div>
          ))}
        </nav>
      </aside>

      {/* 본문 */}
      <main className="flex-1 min-w-0 pt-14">
        <div className="p-5 sm:p-8 max-w-5xl mx-auto space-y-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm text-slate-500 font-medium">좋은 저녁이에요, 사장님 👋</p>
              <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2">
                WeMarket 카페 강남본점
                <span className="text-[11px] bg-white/10 px-2 py-1 rounded-full text-slate-300 font-bold">데모 매장</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">7월 7일 (화)</p>
            </div>
          </div>

          {/* 기간 탭 */}
          <div className="flex bg-white/5 rounded-2xl p-1">
            {['오늘', '주간', '월간'].map(t => (
              <button key={t} onClick={() => setPeriod(t)}
                className={`flex-1 h-11 rounded-xl text-sm font-black transition-all ${period === t ? 'bg-white text-slate-900' : 'text-slate-400'}`}>
                {t}
              </button>
            ))}
          </div>

          {/* 통계 카드 (가로형) */}
          <div className="grid grid-cols-2 gap-3">
            {STATS.map(({ title, icon: Icon, color, bg, value, trend, accent }) => (
              <div key={title} className={`bg-white/5 border ${accent} rounded-2xl p-3 flex items-center gap-3`}>
                <div className={`p-2.5 rounded-xl ${bg} shrink-0`}><Icon size={18} className={color} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[11px] text-slate-500 font-bold truncate">{title}</p>
                    {trend !== undefined && (
                      <div className="shrink-0 flex items-center text-[9px] font-black px-1.5 py-0.5 rounded-md gap-0.5 bg-emerald-500/15 text-emerald-400">
                        <ArrowUpRight size={10} />{trend}%
                      </div>
                    )}
                  </div>
                  <p className="text-lg font-black leading-tight tabular-nums truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 빠른 실행 */}
          <div>
            <h2 className="text-sm font-black flex items-center gap-2 mb-3"><Zap size={15} className="text-orange-400" /> 빠른 실행</h2>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5">
              {QUICK.map(({ label, icon: Icon, color, badge }) => (
                <div key={label} className="relative flex flex-col items-center gap-2 p-3 md:p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
                    <Icon size={18} className="text-white" />
                  </div>
                  <span className="text-[11px] font-black text-slate-300 text-center leading-tight">{label}</span>
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 bg-orange-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1.5 shadow-lg">{badge}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 실시간 주문 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> 실시간 주문
                <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">대기 1</span>
              </h2>
            </div>
            <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden divide-y divide-white/5">
              {ORDERS.map(o => (
                <div key={o.no} className="flex items-center gap-3 p-3">
                  <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center text-xs font-black text-slate-400 shrink-0">{o.no}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{o.table} <span className="text-slate-500 font-medium">{o.name}</span></p>
                    <p className="text-[11px] text-slate-500">{o.time} · <span className="text-orange-400 font-bold">{o.amount}</span></p>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-black ${o.cls}`}>{o.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 실제 시작 CTA */}
          <div className="bg-gradient-to-r from-orange-500/10 to-rose-500/10 border border-orange-500/20 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black">내 매장으로 직접 시작해보세요</h3>
              <p className="text-sm text-slate-400 mt-1">가입 후 첫 매장을 만들면 이 대시보드를 그대로 사용할 수 있어요.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link to="/menu/demo" className="inline-flex items-center gap-2 px-5 py-3 bg-white/10 rounded-xl font-black text-sm hover:bg-white/15 transition-colors">
                고객 데모 <ChevronRight size={16} />
              </Link>
              <Link to="/login" className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-xl font-black text-sm shadow-lg shadow-orange-500/20">
                무료로 시작하기 <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <div className="pt-2 pb-10 text-center">
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors">
              <ArrowLeft size={15} /> 홈으로 돌아가기
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
