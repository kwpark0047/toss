import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, UtensilsCrossed, RefreshCw } from "lucide-react";
import { storesAPI } from "@/api/stores";
import { resolveThemeStyle } from "@/lib/themePresets";
import { categoriesAPI, productsAPI } from "@/api/products";
import { ordersAPI } from "@/api/orders";
import { wakeupServer } from "@/api/wakeup";
import { useKioskMode } from "@/hooks/useKioskMode";
import { withOfflineCache } from "@/utils/menuCache";
import { requestNotificationPermission } from "@/firebase";
import { addRecentStore } from "@/utils/recentStores";
import EmptyState from "@/components/common/EmptyState";
import { Maximize2 } from "lucide-react";

// Components
import MenuHeader from "@/components/menu/MenuHeader";
import StoreInfoBanner from "@/components/menu/StoreInfoBanner";
import CategoryTabs from "@/components/menu/CategoryTabs";
import MenuItemCard from "@/components/menu/MenuItemCard";
import CartButton from "@/components/menu/CartButton";
import CartModal from "@/components/menu/CartModal";
import OptionSelectionModal from "@/components/menu/OptionSelectionModal";
import OrderStatusModal from "@/components/menu/OrderStatusModal";
import CustomerPhoneSheet from "@/components/menu/CustomerPhoneSheet";
import PersonalizedRecommendations from "@/components/menu/PersonalizedRecommendations";
import { trackOrderConversion } from "@/utils/recommendationTracking";
import ReviewModal from "@/components/customer/ReviewModal";
import _FloatingCallButton from "@/components/customer/FloatingCallButton";
import ManagerCallSheet from "@/components/customer/ManagerCallSheet";
import ChatDrawer from "@/components/customer/ChatDrawer";
import StoreReviews from "@/components/customer/StoreReviews";
import LegalFooter from "@/components/customer/LegalFooter";
import { weatherAPI } from "@/api/misc";
import LanguageSelector from "@/components/menu/LanguageSelector";
import TinkerBell from "@/components/ai/TinkerBell";
import { loadTinkerBellSettings } from "@/utils/tinkerbell";
import { useTossPayment } from "@/hooks/useTossPayment";

/** 순수 함수: 항목이 최근 7일 이내 생성되었는지 확인 */
const isNewItem = item => {
  if (!item.created_at) return false;
  const createdDate = new Date(item.created_at);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return createdDate > sevenDaysAgo;
};

/** 순수 함수: 메뉴 항목의 옵션 목록 파싱 */
const getOptionsForMenuItem = (menuItems, itemId) => {
  const item = menuItems.find(i => i.id === itemId);
  if (!item?.options) return [];
  try {
    const parsed = typeof item.options === 'string' ? JSON.parse(item.options) : item.options;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** 콜드스타트 로딩 화면 */
const ColdStartLoading = ({
  elapsed
}) => {
  const {
    t
  } = useTranslation();
  const isColdStart = elapsed >= 8;
  const progressPct = Math.min(elapsed * 1.8, 88);
  return <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6">
      <div className="text-center space-y-6 max-w-xs w-full">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          {isColdStart ? <UtensilsCrossed size={28} className="text-orange-400" /> : <Loader2 size={28} className="animate-spin text-orange-400" />}
        </div>

        <div>
          <h2 className="text-white font-black text-lg mb-1.5">
            {isColdStart ? t('menu.loading') : t('menu.no_menu')}
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            {elapsed < 8 ? t('menu.please_wait') : elapsed < 30 ? t('menu.cold_start_hint') : t('menu.almost_ready')}
          </p>
        </div>

        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-orange-500 rounded-full transition-all duration-700" style={{
          width: `${progressPct}%`
        }} />
        </div>

        <div className="flex items-center justify-center gap-2 text-slate-600">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-xs">{elapsed}{t('menu.elapsed')}</span>
        </div>

        {elapsed >= 50 && <button onClick={() => window.location.reload()} className="w-full py-3 bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all">
            <RefreshCw size={15} /> {t('menu.refresh')}
          </button>}
      </div>
    </div>;
};

/** 테마 설정 → CSS 변수 객체 변환 (공용: lib/themePresets) */
const buildThemeStyle = resolveThemeStyle;
const MenuPage = () => {
  const {
    t,
    i18n
  } = useTranslation();
  const {
    storeId
  } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tableNumber = searchParams.get("table") || "1";
  const {
    isKiosk,
    isFullscreen,
    enterFullscreen
  } = useKioskMode();

  /* storeId가 숫자가 아닌 경우 → QrResolvePage로 위임 (즉시) */
  const isNumericStoreId = !!storeId && /^\d+$/.test(storeId);

  // 시스템 다크모드 감지
  const [isDark, setIsDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = e => setIsDark(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);
  useEffect(() => {
    if (storeId && !isNumericStoreId) {
      navigate(`/qr/${storeId}`, {
        replace: true
      });
    }
  }, [storeId, isNumericStoreId, navigate]);

  /* 첫 마운트 시 Render 서버 웨이크업 + 경과 시간 추적 */
  const startTimeRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isNumericStoreId) return;
    wakeupServer();
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 500);
    return () => clearInterval(iv);
  }, [isNumericStoreId]);

  // State
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  // 주문 알림 받을 번호 — 저장된 번호로 자동 초기화 (재방문 고객)
  const [notifyPhone, setNotifyPhone] = useState(() => {
    try {
      const d = (localStorage.getItem('wm_customer_phone') || '').replace(/\D/g, '');
      if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
      if (d.length >= 4) return d;
    } catch {/* 무시 */}
    return '';
  });
  const [isOrderStatusOpen, setIsOrderStatusOpen] = useState(false);
  const [reviewOrder, setReviewOrder] = useState(null); // 리뷰 작성 대상 주문
  const [isOrdering, setIsOrdering] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [optionModalItem, setOptionModalItem] = useState(null);
  const [optionModalGroups, setOptionModalGroups] = useState([]);
  const [isPhoneSheetOpen, setIsPhoneSheetOpen] = useState(false);
  const [showCallSheet, setShowCallSheet] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [currentOrderId, _setCurrentOrderId] = useState(null);
  const [currentOrderAmount, _setCurrentOrderAmount] = useState(0);
  const {
    initiateTossPayment
  } = useTossPayment();
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('wm_customer_lang') || 'ko';
    } catch {
      return 'ko';
    }
  });
  const handleLangChange = useCallback(newLang => {
    setLang(newLang);
    i18n.changeLanguage(newLang);
    try {
      localStorage.setItem('wm_customer_lang', newLang);
    } catch {/* 무시 */}
  }, [i18n]);

// i18next 초기 언어 동기화
  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [i18n, lang]);
  const [tinkerSettings] = useState(() => loadTinkerBellSettings());
  const [lastAddedItem, _setLastAddedItem] = useState(null);
  const {
    data: weatherData
  } = useQuery({
    queryKey: ["currentWeather"],
    queryFn: async () => {
      try {
        const res = await weatherAPI.getCurrent('108');
        return res?.data?.data || null;
      } catch (_err) {
        return null;
      }
    },
    staleTime: 600000
  });

  /* 콜드스타트 재시도 설정: 최대 10회, 5초 간격 (최대 30초 간격) */
  const coldStartRetry = {
    retry: 10,
    retryDelay: idx => Math.min(5000 * (idx + 1), 30000)
  };

  // Fetch store profile — 숫자 storeId일 때만 실행
  const {
    data: profile,
    isLoading: profileLoading
  } = useQuery({
    queryKey: ["storeProfile", storeId],
    queryFn: () => withOfflineCache(storeId, "profile", async () => {
      const raw = await storesAPI.getById(storeId);
      const data = raw?.data || raw;
      let parsedTheme = null;
      if (data?.theme) {
        try {
          parsedTheme = typeof data.theme === 'string' ? JSON.parse(data.theme) : data.theme;
        } catch {/* 무시 */}
      }
      return {
        store_name: data?.name,
        address: data?.address,
        description: data?.description,
        open_time: data?.open_time,
        close_time: data?.close_time,
        phone: data?.phone,
        theme: parsedTheme,
        announcement: parsedTheme?.announcement || null,
        announcement_active: parsedTheme?.announcementActive || false
      };
    }),
    enabled: isNumericStoreId,
    ...coldStartRetry
  });

  // 최근 본 매장 추적
  useEffect(() => {
    if (profile?.store_name) addRecentStore(profile);
  }, [profile]);

  // Fetch categories
  const {
    data: categories = []
  } = useQuery({
    queryKey: ["publicCategories", storeId],
    queryFn: () => withOfflineCache(storeId, "categories", async () => {
      const raw = await categoriesAPI.getByStore(storeId);
      return Array.isArray(raw) ? raw : raw?.data || [];
    }),
    enabled: isNumericStoreId,
    ...coldStartRetry
  });

  // Fetch menu items
  const {
    data: menuItems = [],
    isLoading: menuLoading
  } = useQuery({
    queryKey: ["publicMenuItems", storeId],
    queryFn: () => withOfflineCache(storeId, "menu", async () => {
      const raw = await productsAPI.getByStore(storeId);
      const data = Array.isArray(raw) ? raw : raw?.data || [];
      return data.map(item => ({
        ...item,
        is_available: true
      }));
    }),
    enabled: isNumericStoreId,
    ...coldStartRetry
  });
  const isLoading = profileLoading || menuLoading;
  // analytics 호출 제거: authMiddleware 필수 엔드포인트 → 401 → 토큰 갱신 실패 → 로그아웃 유발
  const orderStats = [];

  // Helper functions
  const getTodayHours = useCallback(() => {
    if (!profile?.open_time || !profile?.close_time) return null;
    return {
      open: profile.open_time,
      close: profile.close_time
    };
  }, [profile?.open_time, profile?.close_time]);
  const isStoreOpen = useCallback(() => {
    if (!profile?.open_time || !profile?.close_time) return true; // 시간 미설정 시 항상 영업 중
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    try {
      const [openHour, openMin] = profile.open_time.split(":").map(Number);
      const [closeHour, closeMin] = profile.close_time.split(":").map(Number);
      const openTime = openHour * 60 + openMin;
      const closeTime = closeHour * 60 + closeMin;
      if (closeTime < openTime) return currentTime >= openTime || currentTime < closeTime;
      return currentTime >= openTime && currentTime < closeTime;
    } catch {
      return true;
    }
  }, [profile?.open_time, profile?.close_time]);

  // Computed values
  const todayHours = getTodayHours();
  const storeOpen = isStoreOpen();
  const categoryNames = useMemo(() => [t('menu.all_category'), ...categories.map(c => c.name)], [categories, t]);
const filteredItems = useMemo(() => {
    if (selectedCategory === t('menu.all_category')) return menuItems;
    return menuItems.filter(item => {
      const category = categories.find(c => c.id === item.category_id);
      return category?.name === selectedCategory;
    });
  }, [selectedCategory, menuItems, categories, t]);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  // Handlers
  const addToCartDirect = useCallback((item, quantity, selectedOptions, unitPrice) => {
    const cartItemId = `${item.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setCart(prev => [...prev, {
      cartItemId,
      menuItem: item,
      quantity,
      selectedOptions,
      unitPrice
    }]);
    toast.success(t('order.item_added', {
      name: item.name
    }));
  }, [t]);
const handleAddToCartClick = useCallback(async item => {
    if (!storeOpen) {
      toast.error(t('order.not_business_hours'));
      return;
    }
    const options = getOptionsForMenuItem(menuItems, item.id);
    if (options.length > 0) {
      setOptionModalItem(item);
      setOptionModalGroups(options);
    } else {
      addToCartDirect(item, 1, [], item.price);
    }
  }, [storeOpen, menuItems, addToCartDirect, t]);
const handleOptionConfirm = useCallback((quantity, selectedOptions, totalPrice) => {
    if (!optionModalItem) return;
    const unitPrice = totalPrice / quantity;
    addToCartDirect(optionModalItem, quantity, selectedOptions, unitPrice);
    setOptionModalItem(null);
    setOptionModalGroups([]);
}, [optionModalItem, addToCartDirect]);
  const updateQuantity = useCallback((cartItemId, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.cartItemId === cartItemId) {
          const newQuantity = item.quantity + delta;
          if (newQuantity <= 0) return null;
          return {
            ...item,
            quantity: newQuantity
          };
        }
        return item;
      }).filter(Boolean);
    });
  }, []);
const handleOrder = useCallback(async () => {
    if (!storeId || cart.length === 0) return;
    if (!storeOpen) {
      toast.error(t('order.cannot_order'));
      return;
    }
    setIsOrdering(true);
    try {
      const notifyDigits = notifyPhone.replace(/\D/g, '');
      const hasPhone = notifyDigits.length >= 10;

      // 전화번호 미입력(거부) 시 FCM 푸시 토큰을 발급받아 대체 알림 채널로 사용
      let fcmToken = null;
      if (!hasPhone) {
        try {
          fcmToken = await requestNotificationPermission();
        } catch {
          fcmToken = null;
        }
      }
      const orderData = {
        store_id: storeId,
        table_number: tableNumber,
        // URL 파라미터(테이블 번호 문자열) → 백엔드에서 table_id(정수)로 변환
        items: cart.map(item => ({
          product_id: item.menuItem.id,
          product_name: item.menuItem.name,
          price: item.unitPrice,
          quantity: item.quantity,
          subtotal: item.unitPrice * item.quantity,
          options: item.selectedOptions
        })),
        total_amount: totalPrice,
        payment_method: paymentMethod,
        // 알림 받을 번호 (입력 시 주문에 연결, 유효할 때만 전송)
        ...(hasPhone ? {
          customer_phone: notifyDigits
        } : {}),
        // 전화번호 거부 시 FCM 토큰으로 푸시 알림 수신
        ...(!hasPhone && fcmToken ? {
          customer_fcm_token: fcmToken
        } : {})
      };
      // 재방문 자동입력을 위해 유효 번호 저장
      if (hasPhone) {
        try {
          localStorage.setItem('wm_customer_phone', notifyDigits);
        } catch {/* 무시 */}
      }
const order = await ordersAPI.create(orderData);
      const orderData_ = order?.data || order || {};
      const createdOrderId = orderData_.id;
      if (!createdOrderId) throw new Error('주문 생성 결과에 주문 ID가 없습니다.');

      // AI 추천 전환(주문 성공) 어트리뷰션 기록 — 실패해도 주문 흐름은 방해하지 않음
      trackOrderConversion(
        Number(storeId),
        createdOrderId,
        cart.map(item => ({ id: Number(item.menuItem.id), name: item.menuItem.name })),
        'ai_personalized'
      ).catch(() => { /* 추적 실패는 무시 */ });

      // 온라인 결제는 주문을 먼저 생성한 뒤 서버가 만든 결제 대기 레코드와
      // 동일한 주문을 Toss 승인 흐름으로 연결한다.
      if (paymentMethod === 'card' || paymentMethod === 'toss') {
        const paymentResult = await initiateTossPayment({
          orderId: createdOrderId,
          storeId,
          totalAmount: Number(orderData_.total_amount ?? totalPrice),
          tossUserKey: undefined,
          phone: hasPhone ? notifyDigits : undefined,
          capability: orderData_.order_capability
        });
        if (!paymentResult?.success) {
          throw new Error(paymentResult?.error || '결제 진행에 실패했습니다.');
        }
        // 웹 SDK는 successUrl로 이동하므로 여기서는 장바구니를 유지한다.
        if (paymentResult.pendingRedirect) return;
      }
      toast.success(t('order.success'));
      const orderNo = orderData_.order_number || orderData_.id;
      // 예상 준비시간: 메뉴별 실제 조리시간(cooking_time, 기본 5분) 기준.
      // 가장 오래 걸리는 메뉴가 기준이 되고, 수량이 많을수록 큐 지연을 더한다.
      const times = cart.map(i => Number(i.menuItem?.cooking_time) || 5);
      const maxPrep = times.length ? Math.max(...times) : 5;
      const totalQty = cart.reduce((a, i) => a + i.quantity, 0);
      const eta = Math.min(60, maxPrep + Math.max(0, totalQty - 1));
      setCart([]);
      setIsCartOpen(false);

      // 주문 완료 → 매장 위치 페이지로 이동(주문번호·예상시간 전달)
      const params = new URLSearchParams({
        order: String(orderNo || ''),
        eta: String(eta)
      });
      if (profile?.store_name) params.set('store', profile.store_name);
      navigate(`/?${params.toString()}#locations`);
    } catch {
      toast.error(t('order.failed'));
    } finally {
      setIsOrdering(false);
    }
  }, [storeId, cart, storeOpen, tableNumber, totalPrice, navigate, profile, paymentMethod, initiateTossPayment, notifyPhone, t]);

  // Stable callbacks for JSX props (prevents child re-renders from inline closures)
  const handleOpenOrderHistory = useCallback(() => setIsOrderStatusOpen(true), []);
  const handleOpenCart = useCallback(() => setIsCartOpen(true), []);
  const handleCloseCart = useCallback(() => setIsCartOpen(false), []);
  const handleCloseOrderStatus = useCallback(() => setIsOrderStatusOpen(false), []);
  const handleCloseReview = useCallback(() => setReviewOrder(null), []);
  const handleWriteReview = useCallback(order => {
    setIsOrderStatusOpen(false);
    setReviewOrder(order || {
      id: currentOrderId,
      store_id: Number(storeId),
      store_name: profile?.store_name
    });
  }, [currentOrderId, storeId, profile?.store_name]);
  const handleCloseOptionModal = useCallback(() => {
    setOptionModalItem(null);
    setOptionModalGroups([]);
  }, []);
  const handleClosePhoneSheet = useCallback(() => {
    setIsPhoneSheetOpen(false);
    setTimeout(() => setIsOrderStatusOpen(true), 300);
  }, []);
  if (!isNumericStoreId) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6">
        <div className="text-center space-y-4">
          <Loader2 size={28} className="animate-spin text-orange-400 mx-auto" />
          <h2 className="text-white font-black text-lg">메뉴판으로 이동 중...</h2>
          <p className="text-slate-400 text-sm">잠시만 기다려주세요.</p>
        </div>
      </div>;
  }
  if (isLoading) return <ColdStartLoading elapsed={elapsed} />;
  const themeStyle = buildThemeStyle(profile?.theme);

  // 매장 테마 설정(menu_layout / ui_size / menu_options) 파생 — 미저장 매장은 기존 목록형 유지
  const themeSettings = profile?.theme || {};
  const isGridLayout = themeSettings.menu_layout === 'grid';
  const cardPadding = themeSettings.ui_size === 'small' ? 'S' : themeSettings.ui_size === 'large' ? 'XL' : 'L';
  const menuDisplayOptions = themeSettings.menu_options || {};
  return (
    // TDS 미니앱 프레임: 모바일 폭(480px) 중앙 정렬, 데스크톱에선 좌우 여백 배경
    <div className={`min-h-screen w-full flex justify-center bg-slate-200 overflow-x-hidden ${isDark ? 'dark' : ''}`}>
    <div className="relative w-full max-w-full sm:max-w-[480px] min-h-screen pb-24 font-sans tracking-tight cust-bg-base shadow-2xl shadow-black/10" style={themeStyle}>
      {/* 키오스크 모드: 전체화면 진입 안내 (미진입 상태에서만) */}
      {isKiosk && !isFullscreen && <button onClick={enterFullscreen} className="w-full px-4 py-2.5 flex items-center justify-center gap-2 bg-orange-500 text-white text-sm font-black" aria-label="전체화면으로 전환">
          <Maximize2 size={16} /> {t('menu.kiosk_hint')}
        </button>}

      {/* 공지사항 배너 */}
      {profile?.announcement_active && profile?.announcement && <div className="px-4 py-2.5 flex items-center gap-2" style={{
          backgroundColor: '#fbbf24'
        }}>
          <span className="text-xs">📢</span>
          <p className="text-xs font-bold text-amber-900 flex-1">{profile.announcement}</p>
        </div>}

      {/* Header */}
      <MenuHeader storeName={profile?.store_name || t('menu.store_name_default')} tableNumber={tableNumber} onOrderHistoryClick={handleOpenOrderHistory} onCallStaffClick={() => setShowCallSheet(true)} />

      {/* Store Info */}
      <StoreInfoBanner storeName={profile?.store_name} description={profile?.description} phone={profile?.phone} address={profile?.address} isOpen={storeOpen} todayHours={todayHours} />

      {/* AI 개인화 추천 (F9) */}
      <PersonalizedRecommendations storeId={storeId} storeOpen={storeOpen} onAddToCart={handleAddToCartClick} menuItems={menuItems} />

      {/* Category Tabs */}
      <CategoryTabs categories={categoryNames} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />

      {/* Menu List */}
      <div className="container mx-auto px-4 py-6">
        {filteredItems.length === 0 ? <EmptyState icon="🍽️" title={t('menu.empty')} description={selectedCategory === t('menu.all_category') ? t('menu.empty_desc') : t('menu.category_empty')} /> :
          // 테마 menu_layout=grid → 2열 카드 그리드, 그 외 → TDS 리스트 그룹 (flush divider)
          <div className={isGridLayout ? 'grid grid-cols-2 gap-3' : 'cust-bg-card rounded-2xl border cust-border shadow-sm overflow-hidden cust-divide'}>
            {filteredItems.map(item => {
              const options = getOptionsForMenuItem(menuItems, item.id);
              const isPopular = orderStats.includes(item.id);
              const isNew = isNewItem(item);
              return <MenuItemCard key={item.id} item={item} hasOptions={options.length > 0} isPopular={isPopular} isNew={isNew} onAddToCart={handleAddToCartClick} disabled={!storeOpen} padding={isGridLayout ? cardPadding : 'L'} options={menuDisplayOptions} />;
            })}
          </div>}

        {/* 매장 리뷰 목록 (첨부 사진 포함) */}
        <StoreReviews storeId={storeId} />
      </div>

      {/* Cart Button */}
      <CartButton totalItems={totalItems} totalPrice={totalPrice} onClick={handleOpenCart} />

      {/* Cart Modal */}
      <CartModal isOpen={isCartOpen} onClose={handleCloseCart} cart={cart} onUpdateQuantity={updateQuantity} onOrder={handleOrder} isOrdering={isOrdering} totalPrice={totalPrice} notifyPhone={notifyPhone} onNotifyPhoneChange={setNotifyPhone} paymentMethod={paymentMethod} onPaymentMethodChange={setPaymentMethod} menuItems={menuItems} storeId={storeId} onAddToCartClick={handleAddToCartClick} />

      {/* Order Status Modal */}
      {storeId && <OrderStatusModal isOpen={isOrderStatusOpen} onClose={handleCloseOrderStatus} orderId={currentOrderId} storeId={storeId} tableNumber={tableNumber} onWriteReview={handleWriteReview} />}

      {/* 리뷰 작성 모달 (주문 상태에서 진입, 실제 사진 첨부 지원) */}
      <ReviewModal isOpen={!!reviewOrder} onClose={handleCloseReview} order={reviewOrder} onSuccess={handleCloseReview} />

      {/* Option Selection Modal */}
      {optionModalItem && <OptionSelectionModal key={optionModalItem.id} isOpen={!!optionModalItem} onClose={handleCloseOptionModal} onConfirm={handleOptionConfirm} item={optionModalItem} optionGroups={optionModalGroups} />}

      {/* 주문 후 핸드폰 번호 등록 (포인트·알림·회원가입 통합) */}
      <CustomerPhoneSheet isOpen={isPhoneSheetOpen} onClose={handleClosePhoneSheet} storeId={storeId} orderId={currentOrderId} totalAmount={currentOrderAmount} storeName={profile?.store_name || t('menu.store_name_default')} />

      {/* 전자상거래법 §13 필수 사업자 정보 표시 */}
      <LegalFooter storeId={storeId} />

      {/* 매니저 호출 시트 및 채팅 드로어 */}
      <ManagerCallSheet isOpen={showCallSheet} onClose={() => setShowCallSheet(false)} store={profile} table={{
          name: t('menu.table', {
            number: tableNumber
          })
        }} onOpenChat={() => setShowChatDrawer(true)} onVoiceCall={type => {
          const socket = ordersAPI.getSocket();
          if (socket) {
            socket.emit('manager-call', {
              storeId: parseInt(storeId),
              tableName: t('menu.table', {
                number: tableNumber
              }),
              type
            });
            // 서버 handlers.js의 manager-call 처리 후 manager-call-ack 수신
            socket.once('manager-call-ack', ack => {
              if (ack?.message) toast.info(ack.message);
            });
          }
        }} />

      <ChatDrawer isOpen={showChatDrawer} onClose={() => setShowChatDrawer(false)} store={{
          id: parseInt(storeId),
          ...profile
        }} table={{
          name: t('menu.table', {
            number: tableNumber
          })
        }} customerInfo={{
          phone: notifyPhone
        }} />

      <LanguageSelector currentLang={lang} onSelectLang={handleLangChange} />

      <TinkerBell lang={lang} menuItems={menuItems} weatherData={weatherData} voiceEnabled={tinkerSettings?.voiceEnabled} largeFont={tinkerSettings?.largeFont} lastAddedItem={lastAddedItem} onAddToCart={item => handleAddToCartClick(item)} />
    </div>
    </div>
  );
};
export default MenuPage;
