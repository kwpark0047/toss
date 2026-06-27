import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, LogOut, LayoutDashboard, UtensilsCrossed,
  Settings, Users, Receipt, Wallet, Palette,
  Menu as MenuIcon, X, MessageSquare, LogIn, Smartphone, CalendarCheck, Sparkles, Package,
  UserCircle, ChevronRight
} from 'lucide-react';
import NotificationBell from './NotificationBell';

/**
 * 프리미엄 다크 디자인이 적용된 관리자 레이아웃
 * 글래스모피즘과 세련된 애니메이션을 통해 하이엔드 관리자 경험을 제공합니다.
 */
const AdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isBoardPath = location.pathname.startsWith('/board');
  const isPublicBoardPath = isBoardPath && !location.pathname.startsWith('/board/write') && !location.pathname.startsWith('/board/edit');

  if (!user && !isPublicBoardPath) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(249,115,22,0.05),transparent_50%)] pointer-events-none" />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-slate-900/50 backdrop-blur-2xl p-12 text-center max-w-sm w-full mx-4 rounded-[40px] border border-white/10 shadow-2xl relative z-10"
        >
          <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-2xl shadow-orange-500/20">
            <Store className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Access Denied</h2>
          <p className="mb-10 text-slate-400 font-medium">진입 권한이 없습니다.<br/>관리자 계정으로 로그인해 주세요.</p>
          <Link to="/login" className="w-full py-4 bg-white text-slate-950 rounded-2xl font-black text-sm hover:shadow-xl hover:shadow-white/10 transition-all block">
            로그인 페이지로 이동
          </Link>
        </motion.div>
      </div>
    );
  }

  const storeId = location.pathname.split('/')[3];

  const navItems = [
    { label: '대시보드', icon: LayoutDashboard, path: '/admin', id: 'dashboard', roles: [] },
    { label: '주문서 현황', icon: UtensilsCrossed, path: `/admin/stores/${storeId}/orders`, show: !!storeId, roles: [] },
    { label: '메뉴판 빌더', icon: Palette, path: `/admin/stores/${storeId}/visual-builder`, show: !!storeId, roles: ['super_admin', 'store_admin'] },
    { label: '스마트 예약', icon: CalendarCheck, path: `/admin/stores/${storeId}/reservations`, show: !!storeId, roles: ['super_admin', 'store_admin', 'manager'] },
    { label: '정산 분석', icon: Wallet, path: `/admin/stores/${storeId}/settlements`, show: !!storeId, roles: ['super_admin', 'store_admin'] },
    { label: '영수증 커스텀', icon: Receipt, path: `/admin/stores/${storeId}/receipt-settings`, show: !!storeId, roles: ['super_admin', 'store_admin'] },
    { label: '재고 관리', icon: Package, path: `/admin/stores/${storeId}/inventory`, show: !!storeId, roles: ['super_admin', 'store_admin', 'manager'] },
    { label: '단골 관리', icon: Users, path: `/admin/stores/${storeId}/customers`, show: !!storeId, roles: ['super_admin', 'store_admin', 'manager'] },
    { label: '팀원 관리', icon: Users, path: `/admin/stores/${storeId}/staff`, show: !!storeId, roles: ['super_admin', 'store_admin', 'manager'] },
    { label: '매장 환경설정', icon: Settings, path: `/admin/stores/${storeId}/settings`, show: !!storeId, roles: ['super_admin', 'store_admin'] },
    { label: '통합 SMS 발송', icon: Smartphone, path: '/admin/bulk-sms', roles: ['super_admin'] },
    { label: '커뮤니티', icon: MessageSquare, path: '/board', id: 'board', roles: [] },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (item.show === false) return false;
    if (item.roles.length === 0) return true;
    return item.roles.includes(user?.role);
  });

  return (
    <div className="min-h-screen bg-slate-950 flex overflow-hidden text-slate-300">
      {/* 배경 장식 */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Sidebar (Desktop) */}
      <aside className="hidden lg:flex w-80 flex-col bg-slate-900/50 backdrop-blur-3xl border-r border-white/5 z-30 relative">
        <div className="p-10">
          <Link to="/admin" className="flex items-center gap-4 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-xl shadow-orange-500/20 group-hover:rotate-12 transition-transform">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-black text-white tracking-tighter block leading-none mb-1 uppercase">WeMarket</span>
              <span className="text-[10px] font-black text-orange-500/70 uppercase tracking-[0.2em]">Master Admin</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-6 space-y-2 overflow-y-auto scrollbar-hide py-4">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path || (item.id === 'dashboard' && location.pathname === '/admin');
            return (
              <Link
                key={item.label}
                to={item.path}
                className={`flex items-center gap-4 px-5 py-4 rounded-[20px] font-bold text-sm transition-all relative group overflow-hidden ${isActive
                  ? 'text-white shadow-2xl shadow-orange-500/20'
                  : 'text-slate-500 hover:text-slate-200'
                  }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeNav"
                    className="absolute inset-0 bg-gradient-to-r from-orange-500 to-rose-600 z-0" 
                  />
                )}
                <div className="relative z-10 flex items-center gap-4">
                  <item.icon size={20} className={isActive ? 'text-white' : 'group-hover:text-orange-500 transition-colors'} />
                  <span className="tracking-tight">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-8">
          {user ? (
            <div className="bg-white/5 p-5 rounded-[28px] border border-white/5 backdrop-blur-xl">
              {/* 프로필 미완성 배너 */}
              {(!user.name || !user.email) && (
                <Link
                  to="/admin/profile"
                  className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl hover:bg-orange-500/20 transition-colors group"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
                  <span className="text-[11px] font-bold text-orange-400 flex-1 leading-tight">
                    프로필을 완성해 보세요
                  </span>
                  <ChevronRight size={12} className="text-orange-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              )}
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center font-black text-white border border-white/10 shadow-lg">
                  {user.name ? user.name.charAt(0) : <UserCircle size={20} className="text-slate-400" />}
                </div>
                <div className="overflow-hidden flex-1">
                  <p className="text-sm font-black text-white truncate">{user.name || '이름 미설정'}</p>
                  <p className="text-[10px] text-orange-500/70 font-black uppercase tracking-widest">{user.role || 'Admin'}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  to="/admin/profile"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
                >
                  <UserCircle size={13} /> 프로필
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-black text-rose-400 hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all active:scale-95"
                >
                  <LogOut size={13} /> 로그아웃
                </button>
              </div>
            </div>
          ) : (
            <Link
              to="/login"
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-white text-slate-950 text-sm font-black hover:shadow-xl hover:shadow-white/10 transition-all active:scale-95"
            >
              <LogIn size={18} /> 로그인
            </Link>
          )}
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-24 flex items-center justify-between px-10 bg-slate-950/50 backdrop-blur-2xl sticky top-0 z-20 border-b border-white/5">
          <div className="flex items-center gap-6 lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-2xl text-white active:bg-white/10 transition-colors border border-white/5"
            >
              <MenuIcon size={24} />
            </button>
            <span className="font-black text-white uppercase tracking-tighter">WeMarket</span>
          </div>

          <div className="hidden lg:flex items-center gap-3 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">System Operational</span>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="h-8 w-px bg-white/5 mx-2" />
            <div className="flex items-center gap-4 px-5 py-2.5 bg-white/5 border border-white/5 rounded-[20px] backdrop-blur-xl">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                <Sparkles size={18} />
              </div>
              <div className="hidden sm:block">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Status</p>
                <p className="text-xs font-black text-white leading-none">Admin Active</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 md:p-10 lg:p-12 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="max-w-7xl mx-auto w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-80 bg-slate-900 z-50 lg:hidden p-10 flex flex-col border-r border-white/10"
            >
              <div className="flex items-center justify-between mb-16">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center text-white">
                    <Store size={24} />
                  </div>
                  <span className="text-2xl font-black text-white tracking-tighter">ADMIN</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors">
                  <X size={28} />
                </button>
              </div>

              <nav className="flex-1 space-y-3 overflow-y-auto scrollbar-hide">
                {filteredNavItems.map((item) => (
                  <Link
                    key={item.label}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-4 px-6 py-5 rounded-[24px] font-bold text-lg transition-all ${location.pathname === item.path 
                      ? 'bg-gradient-to-r from-orange-500 to-rose-600 text-white shadow-xl shadow-orange-500/20' 
                      : 'text-slate-500 active:bg-white/5'
                    }`}
                  >
                    <item.icon size={22} /> {item.label}
                  </Link>
                ))}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminLayout;

