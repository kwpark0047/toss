import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { AdminThemeProvider, useAdminTheme } from '../../contexts/AdminThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, LogOut, LayoutDashboard, UtensilsCrossed,
  Settings, Users, Receipt, Wallet, Palette,
  Menu as MenuIcon, MessageSquare, LogIn, Smartphone, CalendarCheck, Sparkles, Package, Bell,
  UserCircle, ChevronRight, ShoppingBag, Building2, Activity, Scale,
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import { TC } from './adminThemes';
import ThemeSwitcher from './ThemeSwitcher';



function AdminLayoutInner({ children, storeId, user, handleLogout, isSidebarOpen, setSidebarOpen, location, filteredNavItems }) {
  const { themeId } = useAdminTheme();
  const tc = TC[themeId];
  const [isMoreOpen, setMoreOpen] = useState(false);

  const mobileBottomNav = storeId ? [
    { label: '홈', icon: LayoutDashboard, path: '/admin' },
    { label: '주문서', icon: UtensilsCrossed, path: `/admin/stores/${storeId}/orders` },
    { label: '상품', icon: ShoppingBag, path: `/admin/stores/${storeId}/menu` },
    { label: 'AI', icon: Sparkles, path: '/admin/tinkerbell' },
  ] : [
    { label: '홈', icon: LayoutDashboard, path: '/admin' },
    { label: 'AI', icon: Sparkles, path: '/admin/tinkerbell' },
    { label: '지역커뮤니티', icon: Building2, path: '/admin/community' },
    { label: '게시판', icon: MessageSquare, path: '/board' },
  ];

  return (
    <NotificationProvider storeId={storeId} userId={user?.id} role={user?.role}>
      <div className={`min-h-screen flex overflow-hidden ${tc.root} ${themeId === 'arctic' ? 'admin-light' : ''}`}>
        {/* 배경 그리드 */}
        <div className={`fixed inset-0 pointer-events-none ${tc.grid} bg-[size:40px_40px]`} />

        {/* Sidebar (Desktop) */}
        <aside className={`hidden lg:flex w-80 flex-col z-30 relative ${tc.sidebar}`}>
          <div className="p-10">
            <Link to="/admin" className="flex items-center gap-4 group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-xl shadow-orange-500/20 group-hover:rotate-12 transition-transform">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className={`text-xl font-black tracking-tighter block leading-none mb-1 uppercase ${tc.logoText}`}>WeMarket</span>
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${tc.logoSub}`}>관리자 센터</span>
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
                  className={`flex items-center gap-4 px-5 py-4 rounded-[20px] font-bold text-sm transition-all relative group overflow-hidden ${
                    isActive
                      ? `${tc.textStrong} shadow-2xl ${tc.navActiveShadow}`
                      : `${tc.navText} ${tc.navHover}`
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className={`absolute inset-0 bg-gradient-to-r ${tc.navActiveBg} z-0`}
                    />
                  )}
                  <div className="relative z-10 flex items-center gap-4">
                    <item.icon size={20} className={isActive ? tc.textStrong : `${tc.navIconHover} transition-colors`} />
                    <span className="tracking-tight">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="p-8">
            {user ? (
              <div className={`p-5 rounded-[28px] ${tc.profile}`}>
                {(!user.name || !user.email) && (
                  <Link
                    to="/admin/profile"
                    className={`flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl hover:opacity-80 transition-opacity group ${tc.banner}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0 ${tc.bannerDot}`} />
                    <span className={`text-[11px] font-bold flex-1 leading-tight ${tc.bannerTxt}`}>
                      프로필을 완성해 보세요
                    </span>
                    <ChevronRight size={12} className={`${tc.bannerArrow} group-hover:translate-x-0.5 transition-transform`} />
                  </Link>
                )}
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black shadow-lg ${tc.avatarBg} ${tc.textStrong}`}>
                    {user.name ? user.name.charAt(0) : <UserCircle size={20} className={tc.textSub} />}
                  </div>
                  <div className="overflow-hidden flex-1">
                    <p className={`text-sm font-black truncate ${tc.textStrong}`}>{user.name || '이름 미설정'}</p>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${tc.textAccent}`}>{user.role === 'super_admin' ? '슈퍼관리자' : user.role === 'manager' ? '매니저' : user.role === 'staff' ? '직원' : '관리자'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    to="/admin/profile"
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${tc.btnBase}`}
                  >
                    <UserCircle size={13} /> 프로필
                  </Link>
                  <button
                    onClick={handleLogout}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 ${tc.btnDanger}`}
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
          <header className={`h-14 lg:h-24 flex items-center justify-between px-4 lg:px-10 sticky top-0 z-20 ${tc.header}`}>
            <Link to="/admin" aria-label="관리자 메인으로 이동" className="flex items-center gap-2.5 lg:hidden">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <Store size={15} className="text-white" aria-hidden="true" />
              </div>
              <span className={`font-black text-sm tracking-tight ${tc.logoText}`}>위마켓 관리자</span>
            </Link>

            <div className={`hidden lg:flex items-center gap-3 px-4 py-2 rounded-full ${tc.operational}`}>
              <div className={`w-2 h-2 rounded-full animate-pulse ${tc.operationalDot}`} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${tc.operationalTxt}`}>시스템 정상 운영 중</span>
            </div>

            <div className="flex items-center gap-2 lg:gap-3">
              <ThemeSwitcher />
              <NotificationBell />
              <div className={`hidden md:block h-8 w-px mx-1 ${tc.separator}`} />
              <div className={`hidden md:flex items-center gap-4 px-5 py-2.5 rounded-[20px] ${tc.statusBox}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg ${tc.statusIcon}`}>
                  <Sparkles size={18} />
                </div>
                <div className="hidden sm:block">
                  <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 ${tc.statusLabel}`}>상태</p>
                  <p className={`text-xs font-black leading-none ${tc.textStrong}`}>
                    {(user?.role === 'super_admin' ? '슈퍼관리자' : user?.role === 'manager' ? '매니저' : user?.role === 'staff' ? '직원' : '관리자')} 활성
                  </p>
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 pb-24 lg:pb-12 relative">
            <div className="max-w-7xl mx-auto w-full">
              {children}
            </div>
          </div>

          {/* Mobile Bottom Nav */}
          <nav
            className={`fixed bottom-0 left-0 right-0 z-30 lg:hidden border-t ${tc.separator} ${tc.bottomNav}`}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="flex h-16">
              {mobileBottomNav.map((item) => {
                const isActive = location.pathname === item.path ||
                  (item.path === '/admin' && location.pathname === '/admin');
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-all ${isActive ? '' : tc.navText}`}
                  >
                    <div className={`w-9 h-9 rounded-[14px] flex items-center justify-center transition-all ${
                      isActive ? `bg-gradient-to-br ${tc.navActiveBg} shadow-md ${tc.navActiveShadow}` : ''
                    }`}>
                      <item.icon size={18} className={isActive ? 'text-white' : ''} />
                    </div>
                    <span className={`text-[9px] font-bold leading-none ${isActive ? tc.textStrong : ''}`}>{item.label}</span>
                  </Link>
                );
              })}
              <button
                onClick={() => setMoreOpen(true)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-all ${tc.navText}`}
              >
                <div className="w-9 h-9 rounded-[14px] flex items-center justify-center">
                  <MenuIcon size={18} />
                </div>
                <span className="text-[9px] font-bold leading-none">더보기</span>
              </button>
            </div>
          </nav>
        </main>

        {/* Mobile More Bottom Sheet */}
        <AnimatePresence>
          {isMoreOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 lg:hidden"
                onClick={() => setMoreOpen(false)}
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden rounded-t-[2rem] ${tc.drawerBg} max-h-[85vh] overflow-y-auto`}
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
              >
                {/* Handle bar */}
                <div className="flex justify-center pt-4 pb-1">
                  <div className="w-10 h-1 bg-white/20 rounded-full" />
                </div>

                {/* User Profile Card */}
                {user && (
                  <div className={`mx-4 mt-3 mb-4 p-4 rounded-2xl ${tc.profile}`}>
                    {(!user.name || !user.email) && (
                      <Link
                        to="/admin/profile"
                        onClick={() => setMoreOpen(false)}
                        className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-xl ${tc.banner}`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0 ${tc.bannerDot}`} />
                        <span className={`text-[11px] font-bold flex-1 ${tc.bannerTxt}`}>프로필을 완성해 보세요</span>
                        <ChevronRight size={12} className={tc.bannerArrow} />
                      </Link>
                    )}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black flex-shrink-0 ${tc.avatarBg} ${tc.textStrong}`}>
                        {user.name ? user.name.charAt(0) : <UserCircle size={18} className={tc.textSub} />}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className={`text-sm font-black truncate ${tc.textStrong}`}>{user.name || '이름 미설정'}</p>
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${tc.textAccent}`}>{user.role === 'super_admin' ? '슈퍼관리자' : user.role === 'manager' ? '매니저' : user.role === 'staff' ? '직원' : '관리자'}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link to="/admin/profile" onClick={() => setMoreOpen(false)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${tc.btnBase}`}>
                        <UserCircle size={13} /> 프로필
                      </Link>
                      <button onClick={() => { setMoreOpen(false); handleLogout(); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 ${tc.btnDanger}`}>
                        <LogOut size={13} /> 로그아웃
                      </button>
                    </div>
                  </div>
                )}

                {/* All Nav Items */}
                <div className="px-4 pb-8 space-y-1">
                  <p className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 mb-3 ${tc.textSub}`}>전체 메뉴</p>
                  {filteredNavItems.map((item) => {
                    const isActive = location.pathname === item.path || (item.id === 'dashboard' && location.pathname === '/admin');
                    return (
                      <Link
                        key={item.label}
                        to={item.path}
                        onClick={() => setMoreOpen(false)}
                        className={`flex items-center gap-4 px-4 py-4 rounded-2xl font-bold text-base transition-all ${
                          isActive ? `shadow-lg ${tc.drawerNavActive}` : tc.drawerNavIdle
                        }`}
                      >
                        <item.icon size={20} />
                        <span className="flex-1">{item.label}</span>
                        {isActive && <ChevronRight size={16} />}
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </NotificationProvider>
  );
}

const AdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // 어드민 경로를 sessionStorage에 저장 → offline.html 복귀 시 원래 경로 복원
  useEffect(() => {
    try { sessionStorage.setItem('wm_last_path', location.pathname); } catch (_) {}
  }, [location.pathname]);

  // 관리자 화면 가독성: 루트 폰트를 유동 확대(≈1.5배, 브라우저 폭 반응형).
  // Tailwind rem 유틸이 루트 폰트 기준이라, 텍스트·간격이 일관 확대된다.
  // 관리자 화면에서만 적용하고 이탈 시 원복(고객 화면 무영향).
  useEffect(() => {
    const el = document.documentElement;
    el.classList.add('admin-scaled');
    return () => el.classList.remove('admin-scaled');
  }, []);

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
          <h2 className="text-3xl font-black text-white mb-4 tracking-tight">접근 권한 없음</h2>
          <p className="mb-10 text-slate-400 font-medium">진입 권한이 없습니다.<br />관리자 계정으로 로그인해 주세요.</p>
          <Link to="/login" className="w-full py-4 bg-white text-slate-950 rounded-2xl font-black text-sm hover:shadow-xl hover:shadow-white/10 transition-all block">
            로그인 페이지로 이동
          </Link>
        </motion.div>
      </div>
    );
  }

  const rawStoreId = location.pathname.split('/')[3];
  // 'new', 'undefined', 영문 경로 등 비숫자 값은 storeId로 인정하지 않음
  const storeId = rawStoreId && /^\d+$/.test(rawStoreId) ? rawStoreId : undefined;

  const navItems = [
    { label: '대시보드',      icon: LayoutDashboard, path: '/admin',                                           id: 'dashboard', roles: [] },
    { label: '주문서 현황',   icon: UtensilsCrossed,  path: `/admin/stores/${storeId}/orders`,                  show: !!storeId, roles: [] },
    { label: '상품 관리',     icon: ShoppingBag,       path: `/admin/stores/${storeId}/menu`,                    show: !!storeId, roles: [] },
    { label: '메뉴판 빌더',   icon: Palette,           path: `/admin/stores/${storeId}/visual-builder`,          show: !!storeId, roles: [] },
    { label: '스마트 예약',   icon: CalendarCheck,     path: `/admin/stores/${storeId}/reservations`,            show: !!storeId, roles: [] },
    { label: '정산 분석',     icon: Wallet,            path: `/admin/stores/${storeId}/settlements`,             show: !!storeId, roles: [] },
    { label: '사업자·결제',  icon: Building2,         path: `/admin/stores/${storeId}/business-settings`,       show: !!storeId, roles: [] },
    { label: '법적 정보',    icon: Scale,             path: `/admin/stores/${storeId}/legal`,                   show: !!storeId, roles: [] },
    { label: '영수증 커스텀', icon: Receipt,           path: `/admin/stores/${storeId}/receipt-settings`,        show: !!storeId, roles: [] },
    { label: '재고 관리',     icon: Package,           path: `/admin/stores/${storeId}/inventory`,               show: !!storeId, roles: [] },
    { label: '단골 관리',     icon: Users,             path: `/admin/stores/${storeId}/customers`,               show: !!storeId, roles: [] },
    { label: '팀원 관리',     icon: Users,             path: `/admin/stores/${storeId}/staff`,                   show: !!storeId, roles: [] },
    { label: '매장 환경설정', icon: Settings,          path: `/admin/stores/${storeId}/settings`,               show: !!storeId, roles: [] },
    { label: '알림 템플릿',   icon: Bell,              path: `/admin/stores/${storeId}/notification-templates`,  show: !!storeId, roles: [] },
    { label: '시스템 현황',   icon: Activity,     path: '/admin/system-status', roles: [] },
    { label: 'AI 팅커벨',     icon: Sparkles,     path: '/admin/tinkerbell',   roles: [] },
    { label: '통합 SMS 발송', icon: Smartphone,   path: '/admin/bulk-sms',     roles: ['super_admin'] },
    { label: '지역 커뮤니티', icon: Building2,    path: '/admin/community',    roles: [] },
    { label: '게시판',        icon: MessageSquare, path: '/board',             id: 'board', roles: [] },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (item.show === false) return false;
    if (item.roles.length === 0) return true;
    return item.roles.includes(user?.role);
  });

  return (
    <AdminThemeProvider>
      <AdminLayoutInner
        storeId={storeId}
        user={user}
        handleLogout={handleLogout}
        isSidebarOpen={isSidebarOpen}
        setSidebarOpen={setSidebarOpen}
        location={location}
        filteredNavItems={filteredNavItems}
      >
        {children}
      </AdminLayoutInner>
    </AdminThemeProvider>
  );
};

export default AdminLayout;
