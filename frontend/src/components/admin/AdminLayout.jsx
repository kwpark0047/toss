import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../contexts/StoreContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { AdminThemeProvider, useAdminTheme } from '../../contexts/AdminThemeContext';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import NotificationBell from './NotificationBell';
import { TC } from './adminThemes';
import ThemeSwitcher from './ThemeSwitcher';
import LanguageSwitcher from '../common/LanguageSwitcher';
import AdminChatManager from './AdminChatManager';
import { storesAPI } from '../../api';
import Icon from '../../components/ui/Icon';
import '../../styles/adminDashboard.css';

function AdminLayoutInner({ children, storeId, user, handleLogout, location, filteredNavItems }) {
  const { themeId } = useAdminTheme();
  const { t } = useTranslation(undefined, { keyPrefix: 'admin' });
  const tc = TC[themeId] || TC.obsidian;
  const [isMoreOpen, setMoreOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const menuButton = useRef(null);
  const menuPanel = useRef(null);
  const active = item => location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(`${item.path}/`));
  const pageTitle = filteredNavItems.find(active)?.label || t('adminCenter');
  const quickNav = storeId ? [
    { label: t('home'), icon: 'LayoutDashboard', path: '/admin' },
    { label: t('orders'), icon: 'UtensilsCrossed', path: `/admin/stores/${storeId}/orders` },
    { label: t('products'), icon: 'ShoppingBag', path: `/admin/stores/${storeId}/menu` },
    { label: t('ai'), icon: 'Sparkles', path: '/admin/tinkerbell' },
  ] : filteredNavItems.slice(0, 4);

  useEffect(() => {
    Promise.resolve().then(() => setMoreOpen(false));
  }, [location.pathname]);

  useEffect(() => {
    if (!isMoreOpen) return;
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    menuPanel.current?.querySelector('button')?.focus();
    const keydown = event => {
      if (event.key === 'Escape') setMoreOpen(false);
      if (event.key !== 'Tab') return;
      const items = [...(menuPanel.current?.querySelectorAll('a[href], button:not([disabled])') || [])];
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keydown);
      previous?.focus?.();
    };
  }, [isMoreOpen]);

  const navigation = onNavigate => filteredNavItems.map(item => (
    <Link key={item.path} to={item.path} onClick={onNavigate} aria-current={active(item) ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active(item) ? 'bg-orange-500/10 text-orange-500' : `${tc.navText} ${tc.navHover} hover:bg-white/5`}`}>
      <Icon icon={item.icon} size="sm" />
      <span className="min-w-0 truncate">{item.label}</span>
    </Link>
  ));
  const profile = <div className={`rounded-xl border p-3 ${tc.profile}`}>
    <div className="mb-3 flex items-center gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-semibold ${tc.avatarBg} ${tc.textStrong}`}>
        {user?.name?.charAt(0) || <Icon icon="UserCircle" size="sm" />}
      </div>
      <div className="min-w-0"><p className={`truncate text-sm font-semibold ${tc.textStrong}`}>{user?.name || t('nameNotSet')}</p>
        <p className={`text-xs ${tc.textMuted}`}>{user?.role === 'super_admin' ? t('superAdmin') : user?.role === 'staff' ? t('staff') : t('admin')}</p></div>
    </div>
    {(!user?.name || !user?.email) && <Link to="/admin/profile" onClick={() => setMoreOpen(false)} className="mb-2 block text-xs text-orange-500">{t('completeProfile')}</Link>}
    <div className="flex gap-2">
      <Link to="/admin/profile" onClick={() => setMoreOpen(false)} className={`flex min-h-9 flex-1 items-center justify-center gap-1 rounded-lg text-xs ${tc.btnBase}`}><Icon icon="UserCircle" size="sm" />{t('profile')}</Link>
      <button onClick={handleLogout} className={`flex min-h-9 flex-1 items-center justify-center gap-1 rounded-lg text-xs ${tc.btnDanger}`}><Icon icon="LogOut" size="sm" />{t('logout')}</button>
    </div>
  </div>;

  return <NotificationProvider storeId={storeId} userId={user?.id} role={user?.role}>
    <div data-testid="admin-shell" className={`admin-shell min-h-dvh lg:grid lg:grid-cols-[240px_minmax(0,1fr)] ${tc.root} ${themeId === 'arctic' ? 'admin-light' : ''}`}>
      <a href="#admin-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-orange-500 focus:p-3 focus:text-white">본문으로 바로가기</a>
      <AdminChatManager isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      <aside data-testid="admin-sidebar" className={`sticky top-0 hidden h-dvh min-h-0 flex-col border-r lg:flex ${tc.sidebar}`}>
        <Link to="/admin" className="flex h-16 shrink-0 items-center gap-3 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white"><Icon icon="Store" size="sm" color="inverse" /></span>
          <span><span className={`block text-sm font-bold tracking-wide ${tc.logoText}`}>WEMARKET</span><span className={`text-xs ${tc.textMuted}`}>{t('adminCenter')}</span></span>
        </Link>
        <nav aria-label="관리자 메뉴" className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-3">{navigation()}</nav>
        <div className="shrink-0 p-3">{profile}</div>
      </aside>
      <main className="min-w-0">
        <header className={`sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b px-4 py-3 lg:px-6 ${tc.header}`}>
          <div className="min-w-0"><p className={`hidden text-xs lg:block ${tc.textMuted}`}>WeMarket / {t('adminCenter')}</p><p className={`truncate text-sm font-semibold ${tc.textStrong}`}>{pageTitle}</p></div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => setIsChatOpen(true)} className={`flex h-9 w-9 items-center justify-center rounded-lg ${tc.statusBox}`} aria-label={t('chatInquiry')}><Icon icon="Headset" size="sm" /></button>
            <ThemeSwitcher /><div className="hidden sm:block"><LanguageSwitcher /></div><NotificationBell />
          </div>
        </header>
        <section id="admin-content" tabIndex={-1} className="admin-content mx-auto w-full max-w-[1440px] p-4 pb-24 outline-none lg:p-6 lg:pb-6">{children}</section>
      </main>
      <nav aria-label="빠른 메뉴" className={`fixed inset-x-0 bottom-0 z-30 border-t lg:hidden ${tc.bottomNav}`} style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex h-16">{quickNav.map(item => <Link key={item.path} to={item.path} aria-current={active(item) ? 'page' : undefined} className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs ${active(item) ? 'text-orange-500' : tc.textMuted}`}><Icon icon={item.icon} size="sm" /><span>{item.label}</span></Link>)}
          <button ref={menuButton} onClick={() => setMoreOpen(true)} aria-label="전체 메뉴 열기" aria-expanded={isMoreOpen} className={`flex flex-1 flex-col items-center justify-center gap-1 text-xs ${tc.textMuted}`}><Icon icon="Menu" size="sm" />{t('allMenu')}</button></div>
      </nav>
      {isMoreOpen && <div className="fixed inset-0 z-50 lg:hidden">
        <div className="absolute inset-0 bg-black/50" onClick={() => setMoreOpen(false)} aria-hidden="true" />
        <div ref={menuPanel} role="dialog" aria-modal="true" aria-label={t('allMenu')} className={`absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl p-4 ${tc.drawerBg}`} style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          <div className="mb-3 flex items-center justify-between"><h2 className={`text-base font-semibold ${tc.textStrong}`}>{t('allMenu')}</h2><button onClick={() => setMoreOpen(false)} aria-label="메뉴 닫기" className="flex h-10 w-10 items-center justify-center"><Icon icon="X" size="sm" /></button></div>
          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain">{navigation(() => setMoreOpen(false))}</nav>
          <div className="mt-3 shrink-0">{profile}</div>
        </div>
      </div>}
    </div>
  </NotificationProvider>;
}
const AdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { selectedStore } = useStore();
  const { t } = useTranslation(undefined, { keyPrefix: 'admin' });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    try { sessionStorage.setItem('wm_last_path', location.pathname); } catch (_) {}
  }, [location.pathname]);

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

  const rawStoreId = location.pathname.split('/')[3];
  const storeId = rawStoreId && /^\d+$/.test(rawStoreId) ? rawStoreId : selectedStore?.id;

  const [storeInfo, setStoreInfo] = useState(null);

  useEffect(() => {
    if (storeId) {
      storesAPI.getById(storeId)
        .then(json => {
          const data = json.data || json;
          setStoreInfo(data);
        })
        .catch(err => console.error('Failed to fetch store info inside sidebar:', err));
    } else {
      Promise.resolve().then(() => setStoreInfo(null));
    }
  }, [storeId]);

  if (!user && !isPublicBoardPath) {
    return (
      <div className="min-h-screen tds-stack items-center justify-center bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(249,115,22,0.05),transparent_50%)] pointer-events-none" />
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-slate-900/50 backdrop-blur-2xl tds-p-12 tds-stack tds-gap-4 text-center max-w-sm w-full mx-4 rounded-[40px] border border-white/10 shadow-2xl relative z-10"
        >
          <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-brand-500 to-rose-600 tds-stack items-center justify-center shadow-2xl shadow-brand-500/20">
            <Icon icon="Store" size="md" />
          </div>
          <h2 className="tds-text-bold text-3xl text-white mb-4 tracking-tight">{t('noAccess')}</h2>
          <p className="mb-10 text-slate-400 font-medium">{t('noAccessDesc')}<br />{t('loginAsAdmin')}</p>
          <Link to="/login" className="w-full tds-p-4 bg-white text-slate-950 rounded-2xl font-black text-sm hover:shadow-xl hover:shadow-white/10 transition-all block">
            {t('goToLogin')}
          </Link>
        </motion.div>
      </div>
    );
  }

  const isFoodTruck = storeInfo?.business_type === 'FOOD_TRUCK' || storeInfo?.business_type === 'food_truck' || storeInfo?.business_type === '푸드트럭';

  const navItems = [
    { label: t('dashboard'),      icon: 'LayoutDashboard', path: '/admin',                                           id: 'dashboard', roles: [] },
    { label: t('brandManagement'), icon: 'Building2',         path: '/admin/supervisor',                                         roles: [] },
    { label: t('ordersStatus'),   icon: 'UtensilsCrossed',  path: `/admin/stores/${storeId}/orders`,                  show: !!storeId, roles: [] },
    { label: t('kitchenMonitor'), icon: 'ChefHat',          path: `/admin/stores/${storeId}/kitchen`,                  show: !!storeId, roles: [] },
    { label: t('alimtalkMonitor'), icon: 'MessageSquare',      path: `/admin/stores/${storeId}/alimtalk`,                show: !!storeId, roles: [] },
    { label: t('productManagement'),     icon: 'ShoppingBag',       path: `/admin/stores/${storeId}/menu`,                    show: !!storeId, roles: [] },
    { label: t('menuBuilder'),   icon: 'Palette',           path: `/admin/stores/${storeId}/visual-builder`,          show: !!storeId, roles: [] },
    { label: t('smartReservation'),   icon: 'CalendarCheck',     path: `/admin/stores/${storeId}/reservations`,            show: !!storeId, roles: [] },
    { label: t('smartWaiting'),   icon: 'Clock',     path: `/admin/stores/${storeId}/waiting`,            show: !!storeId, roles: [] },
    { label: t('settlementAnalysis'),     icon: 'Wallet',            path: `/admin/stores/${storeId}/settlements`,             show: !!storeId, roles: [] },
    { label: t('businessPayment'),  icon: 'Building2',         path: `/admin/stores/${storeId}/settings`,              show: !!storeId, roles: [] },
    { label: t('legalInfo'),    icon: 'Scale',             path: `/admin/stores/${storeId}/legal`,                   show: !!storeId, roles: [] },
    { label: t('receiptCustom'), icon: 'Receipt',           path: `/admin/stores/${storeId}/receipt`,                show: !!storeId, roles: [] },
    { label: t('inventoryManagement'),     icon: 'Package',           path: `/admin/stores/${storeId}/inventory`,               show: !!storeId, roles: [] },
    { label: t('dynamicPricing'),     icon: 'TrendingUp',      path: `/admin/stores/${storeId}/pricing`,                  show: !!storeId, roles: [] },
    { label: t('customerManagement'),     icon: 'Users',             path: `/admin/stores/${storeId}/customers`,               show: !!storeId, roles: [] },
    { label: 'AI 매장 매니저', icon: 'Sparkles', path: `/admin/stores/${storeId}/ai-manager`, show: !!storeId, roles: [] },
    { label: '데이터 통합 · 성장', icon: 'Database', path: `/admin/stores/${storeId}/integrations`, show: !!storeId, roles: [] },
    { label: t('campaignDashboard'),  icon: 'Megaphone',         path: `/admin/stores/${storeId}/campaigns`,               show: !!storeId, roles: [] },
    { label: t('aiRecommendationStats'),  icon: 'Sparkles',       path: `/admin/stores/${storeId}/recommendation-stats`,    show: !!storeId, roles: [] },
    { label: t('staffManagement'),     icon: 'Users',             path: `/admin/stores/${storeId}/staff`,                   show: !!storeId, roles: [] },
    { label: t('storeSettings'), icon: 'Settings',          path: `/admin/stores/${storeId}/store-settings`,         show: !!storeId, roles: [] },
    { label: t('membership'),    icon: 'Award',             path: `/admin/stores/${storeId}/plan`,                    show: !!storeId, roles: [] },
    { label: t('foodtruckManagement'), icon: 'Truck',             path: `/admin/stores/${storeId}/foodtruck`,              show: !!storeId && isFoodTruck, roles: [] },
    { label: t('foodtruckAnalysis'), icon: 'Activity',          path: `/admin/stores/${storeId}/foodtruck/analytics`,    show: !!storeId && isFoodTruck, roles: [] },
    { label: t('truckDesignShowcase'), icon: 'Palette',    path: '/foodtruck/showcase',                             show: isFoodTruck, roles: [] },
    { label: t('notificationTemplates'),   icon: 'Bell',              path: `/admin/stores/${storeId}/notifications`,          show: !!storeId, roles: [] },
    { label: t('systemStatus'),   icon: 'Activity',     path: '/admin/system-status', roles: [] },
    { label: '공통 API 설정', icon: 'KeyRound', path: '/admin/provider-settings', roles: ['super_admin'] },
    { label: t('aiTinkerbell'),     icon: 'Sparkles',     path: '/admin/tinkerbell',   roles: [] },
    { label: t('bulkSms'), icon: 'Smartphone',   path: '/admin/bulk-sms',     roles: ['super_admin'] },
    { label: t('localCommunity'), icon: 'Building2',    path: '/admin/community',    roles: [] },
    { label: t('board'),        icon: 'MessageSquare', path: '/board',             id: 'board', roles: [] },
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
        location={location}
        filteredNavItems={filteredNavItems}
      >
        {children}
      </AdminLayoutInner>
    </AdminThemeProvider>
  );
};

export default AdminLayout;
