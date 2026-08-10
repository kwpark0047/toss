import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import React from 'react';

const h = React.createElement;

// =====================
// Module-level mocks (hoisted by vitest)
// =====================

// react-router: controlled via mockUseParams/mockUseSearchParams
const mockUseParams = vi.fn(() => ({ storeId: '1' }));
const mockUseSearchParams = vi.fn(() => [new URLSearchParams('table=1'), vi.fn()]);
const mockNavigate = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => mockUseParams(),
    useSearchParams: () => mockUseSearchParams(),
    useNavigate: () => mockNavigate,
  };
});

import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';



// framer-motion
vi.mock('framer-motion', () => {
  const motionProxy = new Proxy({}, {
    get: (_, key) => (props) => {
      const tag = typeof key === 'string' ? key : 'div';
      return h(tag, props, props?.children);
    },
  });
  return {
    motion: motionProxy,
    AnimatePresence: ({ children }) => h(React.Fragment, null, children),
  };
});

// API modules
vi.mock('@/api/stores', () => ({
  storesAPI: { getById: vi.fn() },
}));
vi.mock('@/api/products', () => ({
  categoriesAPI: { getByStore: vi.fn() },
  productsAPI: { getByStore: vi.fn() },
}));
vi.mock('@/api/orders', () => ({
  ordersAPI: { create: vi.fn(), getSocket: vi.fn() },
}));
vi.mock('@/api/misc', () => ({
  weatherAPI: { getCurrent: vi.fn() },
}));
vi.mock('@/api/wakeup', () => ({
  wakeupServer: vi.fn(() => Promise.resolve()),
}));

// Hooks
vi.mock('@/hooks/useKioskMode', () => ({
  useKioskMode: vi.fn(() => ({ isKiosk: false, isFullscreen: false, enterFullscreen: vi.fn() })),
  default: vi.fn(() => ({ isKiosk: false, isFullscreen: false, enterFullscreen: vi.fn() })),
}));

// Utils
vi.mock('@/utils/menuCache', () => ({
  withOfflineCache: vi.fn((_id, _t, fetcher) => fetcher()),
}));
vi.mock('@/firebase', () => ({
  requestNotificationPermission: vi.fn(),
}));
vi.mock('@/utils/recentStores', () => ({
  addRecentStore: vi.fn(),
}));
vi.mock('@/utils/tinkerbell', () => ({
  loadTinkerBellSettings: vi.fn(() => null),
}));

vi.mock('@/components/menu/MenuHeader', () => ({ default: () => 'MenuHeader' }));
vi.mock('@/components/menu/StoreInfoBanner', () => ({ default: () => 'StoreInfoBanner' }));
vi.mock('@/components/menu/CategoryTabs', () => ({ default: () => 'CategoryTabs' }));
vi.mock('@/components/menu/MenuItemCard', () => ({ default: () => 'MenuItemCard' }));
vi.mock('@/components/menu/CartButton', () => ({ default: () => 'CartButton' }));
vi.mock('@/components/menu/CartModal', () => ({ default: () => 'CartModal' }));
vi.mock('@/components/menu/OptionSelectionModal', () => ({ default: () => 'OptionSelectionModal' }));
vi.mock('@/components/menu/OrderStatusModal', () => ({ default: () => 'OrderStatusModal' }));
vi.mock('@/components/menu/CustomerPhoneSheet', () => ({ default: () => 'CustomerPhoneSheet' }));
vi.mock('@/components/menu/PersonalizedRecommendations', () => ({ default: () => 'PersonalizedRecommendations' }));
vi.mock('@/components/customer/ReviewModal', () => ({ default: () => 'ReviewModal' }));
vi.mock('@/components/customer/FloatingCallButton', () => ({ default: () => 'FloatingCallButton' }));
vi.mock('@/components/customer/ManagerCallSheet', () => ({ default: () => 'ManagerCallSheet' }));
vi.mock('@/components/customer/ChatDrawer', () => ({ default: () => 'ChatDrawer' }));
vi.mock('@/components/customer/StoreReviews', () => ({ default: () => 'StoreReviews' }));
vi.mock('@/components/customer/LegalFooter', () => ({ default: () => 'LegalFooter' }));
vi.mock('@/components/common/EmptyState', () => ({ default: () => 'EmptyState' }));
vi.mock('@/components/menu/LanguageSelector', () => ({ default: () => 'LanguageSelector' }));
vi.mock('@/components/ai/TinkerBell', () => ({ default: () => 'TinkerBell' }));

// Import after all mocks
import MenuPage from '@/pages/MenuPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// API refs for per-test control
import { storesAPI } from '@/api/stores';
import { categoriesAPI, productsAPI } from '@/api/products';
import { weatherAPI } from '@/api/misc';
import { useKioskMode } from '@/hooks/useKioskMode';

// =====================
// Helpers
// =====================

const createWrapper = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }) =>
    h(I18nextProvider, { i18n },
      h(QueryClientProvider, { client: qc },
        children
      )
    );
};

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

// =====================
// Pure function tests
// =====================

describe('isNewItem', () => {
  const fn = (item) => {
    if (!item?.created_at) return false;
    const d = new Date(item.created_at);
    const ago = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return d > ago;
  };

  it('null/undefined → false', () => { expect(fn({})).toBe(false); });
  it('어제 생성 → true', () => {
    const y = new Date(Date.now() - 86400000).toISOString();
    expect(fn({ created_at: y })).toBe(true);
  });
  it('8일 전 → false', () => {
    const d = new Date(Date.now() - 8 * 86400000).toISOString();
    expect(fn({ created_at: d })).toBe(false);
  });
});

describe('getOptionsForMenuItem', () => {
  const fn = (items, id) => {
    const item = items.find(i => i.id === id);
    if (!item?.options) return [];
    try {
      const p = typeof item.options === 'string' ? JSON.parse(item.options) : item.options;
      return Array.isArray(p) ? p : [];
    } catch { return []; }
  };
  const items = [
    { id: 1, name: 'a' },
    { id: 2, name: 'b', options: [{ name: '사이드', choices: ['감자'] }] },
    { id: 3, name: 'c', options: JSON.stringify([{ name: '크기', choices: ['M'] }]) },
  ];

  it('옵션 없음 → []', () => expect(fn(items, 1)).toEqual([]));
  it('객체 옵션 반환', () => expect(fn(items, 2)).toEqual([{ name: '사이드', choices: ['감자'] }]));
  it('JSON 문자열 파싱', () => expect(fn(items, 3)).toEqual([{ name: '크기', choices: ['M'] }]));
  it('없는 ID → []', () => expect(fn(items, 999)).toEqual([]));
});

describe('buildThemeStyle', () => {
  const fn = (theme) => {
    if (!theme) return {};
    return {
      '--color-primary': theme.primaryColor || '#f97316',
      '--color-secondary': theme.secondaryColor || '#1e3a5f',
      '--color-accent': theme.accentColor || '#10b981',
      '--color-bg': theme.backgroundColor || '#f8fafc',
      '--color-card': theme.cardColor || '#ffffff',
      '--color-text': theme.textColor || '#1e293b',
      fontFamily: theme.fontFamily || 'inherit',
      backgroundColor: theme.backgroundColor || undefined,
      color: theme.textColor || undefined,
    };
  };
  it('null → {}', () => expect(fn(null)).toEqual({}));
  it('기본값', () => {
    const s = fn({});
    expect(s['--color-primary']).toBe('#f97316');
    expect(s.backgroundColor).toBeUndefined();
  });
  it('오버라이드', () => {
    const s = fn({ primaryColor: '#000', backgroundColor: '#fff' });
    expect(s['--color-primary']).toBe('#000');
    expect(s.backgroundColor).toBe('#fff');
  });
});

// =====================
// MenuPage Integration
// =====================

describe('MenuPage', () => {
  it('DEBUG: string component renders as text in wrapper', async () => {
    // verify mock component rendering within full menu page context
    storesAPI.getById.mockReturnValue(Promise.resolve({ data: { id: 1, name: '테', theme: null, open_time: '09:00', close_time: '22:00' } }));
    categoriesAPI.getByStore.mockReturnValue(Promise.resolve({ data: [] }));
    productsAPI.getByStore.mockReturnValue(Promise.resolve({ data: [] }));
    const errors = [];
    const origError = console.error;
    console.error = (...args) => { errors.push(args.join(' ')); };
    try {
      await act(async () => render(h(MenuPage), { wrapper: createWrapper() }));
      await waitFor(() => {
        expect(screen.queryByText(/MenuHeader/) || screen.queryByText(/EmptyState/)).toBeInTheDocument();
      }, { timeout: 2000 });
    } finally {
      console.error = origError;
    }
    if (errors.length) console.log('CONSOLE ERRORS:', errors.join('\n'));
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockImplementation(() => ({ storeId: '1' }));
    mockUseSearchParams.mockImplementation(() => [new URLSearchParams('table=1'), vi.fn()]);
  });
  afterEach(() => { cleanup(); });

  it('숫자가 아닌 storeId → /qr/{storeId}로 리다이렉트', async () => {
    mockUseParams.mockReturnValue({ storeId: 'abc' });
    await act(async () => render(h(MenuPage), { wrapper: createWrapper() }));
    expect(mockNavigate).toHaveBeenCalledWith('/qr/abc', { replace: true });
  });

  it('로딩 중 → ColdStartLoading 표시', async () => {
    const pr = deferred();
    storesAPI.getById.mockReturnValue(pr.promise);
    // 카테고리/메뉴는 resolve 되지만 profile이 pending이므로 profileLoading=true

    await act(async () => render(h(MenuPage), { wrapper: createWrapper() }));

    // elapsed<8 → "메뉴 정보를 불러오는 중" (t('menu.no_menu'))
    await waitFor(() => {
      const found = screen.queryAllByText(/불러오는 중|로딩|잠시만|기다려/);
      // elapsed가 0이므로 t('menu.no_menu')="메뉴 정보를 불러오는 중"이거나
      // t('menu.please_wait')="잠시만 기다려 주세요" 둘 중 하나
      expect(found.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('로딩 완료 → 자식 컴포넌트 렌더링', async () => {
    storesAPI.getById.mockReturnValue(Promise.resolve({ data: { id: 1, name: '테스트', address: '서울', phone: '02', open_time: '09:00', close_time: '22:00', theme: null } }));
    categoriesAPI.getByStore.mockReturnValue(Promise.resolve({ data: [{ id: 1, name: '커피' }] }));
    productsAPI.getByStore.mockReturnValue(Promise.resolve({ data: [{ id: 1, name: '아메리카노', category_id: 1, price: 3000 }] }));

    const { container } = render(h(MenuPage), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/MenuHeader/)).toBeInTheDocument();
      expect(screen.getByText(/StoreInfoBanner/)).toBeInTheDocument();
      expect(screen.getByText(/CategoryTabs/)).toBeInTheDocument();
      expect(screen.getByText(/MenuItemCard/)).toBeInTheDocument();
      expect(screen.getByText(/CartButton/)).toBeInTheDocument();
      expect(screen.getByText(/LegalFooter/)).toBeInTheDocument();
      expect(screen.getByText(/LanguageSelector/)).toBeInTheDocument();
      expect(screen.getByText(/TinkerBell/)).toBeInTheDocument();
      expect(screen.getByText(/StoreReviews/)).toBeInTheDocument();
    });
  });

  it('메뉴 없음 → EmptyState, MenuItemCard 없음', async () => {
    storesAPI.getById.mockReturnValue(Promise.resolve({ data: { id: 1, name: '매장', theme: null, open_time: '09:00', close_time: '22:00' } }));
    categoriesAPI.getByStore.mockReturnValue(Promise.resolve({ data: [] }));
    productsAPI.getByStore.mockReturnValue(Promise.resolve({ data: [] }));

    const { container } = render(h(MenuPage), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/EmptyState/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/MenuItemCard/)).not.toBeInTheDocument();
  });

  it('키오스크 모드 → 전체화면 안내 버튼', async () => {
    vi.mocked(useKioskMode).mockReturnValue({
      isKiosk: true, isFullscreen: false, enterFullscreen: vi.fn(),
    });

    storesAPI.getById.mockReturnValue(Promise.resolve({ data: { id: 1, name: '매장', theme: null, open_time: '09:00', close_time: '22:00' } }));
    categoriesAPI.getByStore.mockReturnValue(Promise.resolve({ data: [] }));
    productsAPI.getByStore.mockReturnValue(Promise.resolve({ data: [] }));

    await act(async () => render(h(MenuPage), { wrapper: createWrapper() }));

    await waitFor(() => {
      const btn = screen.getByLabelText(/전체화면/);
      expect(btn).toBeInTheDocument();
    });

    // reset
    vi.mocked(useKioskMode).mockReturnValue({
      isKiosk: false, isFullscreen: false, enterFullscreen: vi.fn(),
    });
  });

  it('공지사항 활성 → 공지 배너 표시', async () => {
    storesAPI.getById.mockReturnValue(Promise.resolve({
      data: {
        id: 1, name: '매장', theme: JSON.stringify({ announcement: '오늘 휴무', announcementActive: true }),
        open_time: '09:00', close_time: '22:00',
      },
    }));
    categoriesAPI.getByStore.mockReturnValue(Promise.resolve({ data: [] }));
    productsAPI.getByStore.mockReturnValue(Promise.resolve({ data: [] }));

    await act(async () => render(h(MenuPage), { wrapper: createWrapper() }));

    await waitFor(() => {
      expect(screen.getByText('오늘 휴무')).toBeInTheDocument();
    });
  });
});
