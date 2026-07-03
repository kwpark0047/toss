import React, { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Loader2, UtensilsCrossed, RefreshCw } from "lucide-react";
import { storesAPI, categoriesAPI, productsAPI, ordersAPI, wakeupServer } from "@/api";

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
import LegalFooter from "@/components/customer/LegalFooter";

const MenuPage = () => {
  const { storeId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tableNumber = searchParams.get("table") || "1";

  /* storeId가 숫자가 아닌 경우 → QrResolvePage로 위임 (즉시) */
  const isNumericStoreId = !!storeId && /^\d+$/.test(storeId);

  useEffect(() => {
    if (storeId && !isNumericStoreId) {
      navigate(`/qr/${storeId}`, { replace: true });
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
  const [isOrderStatusOpen, setIsOrderStatusOpen] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [optionModalItem, setOptionModalItem] = useState(null);
  const [optionModalGroups, setOptionModalGroups] = useState([]);
  const [isPhoneSheetOpen, setIsPhoneSheetOpen] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [currentOrderAmount, setCurrentOrderAmount] = useState(0);

  /* 콜드스타트 재시도 설정: 최대 10회, 5초 간격 (최대 30초 간격) */
  const coldStartRetry = {
    retry: 10,
    retryDelay: (idx) => Math.min(5000 * (idx + 1), 30000),
  };

  // Fetch store profile — 숫자 storeId일 때만 실행
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["storeProfile", storeId],
    queryFn: async () => {
      const raw = await storesAPI.getById(storeId);
      const data = raw?.data || raw;
      let parsedTheme = null;
      if (data?.theme) {
        try { parsedTheme = typeof data.theme === 'string' ? JSON.parse(data.theme) : data.theme; } catch { /* 무시 */ }
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
        announcement_active: parsedTheme?.announcementActive || false,
      };
    },
    enabled: isNumericStoreId,
    ...coldStartRetry,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["publicCategories", storeId],
    queryFn: async () => {
      const raw = await categoriesAPI.getByStore(storeId);
      return Array.isArray(raw) ? raw : (raw?.data || []);
    },
    enabled: isNumericStoreId,
    ...coldStartRetry,
  });

  // Fetch menu items
  const { data: menuItems = [], isLoading: menuLoading } = useQuery({
    queryKey: ["publicMenuItems", storeId],
    queryFn: async () => {
      const raw = await productsAPI.getByStore(storeId);
      const data = Array.isArray(raw) ? raw : (raw?.data || []);
      return data.map(item => ({ ...item, is_available: true }));
    },
    enabled: isNumericStoreId,
    ...coldStartRetry,
  });

  const isLoading = profileLoading || menuLoading;
  // analytics 호출 제거: authMiddleware 필수 엔드포인트 → 401 → 토큰 갱신 실패 → 로그아웃 유발
  const orderStats = [];

  // Helper functions
  const getTodayHours = () => {
    if (!profile?.open_time || !profile?.close_time) return null;
    return { open: profile.open_time, close: profile.close_time };
  };

  const isStoreOpen = () => {
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
  };

  const getOptionsForMenuItem = (itemId) => {
    const item = menuItems.find(i => i.id === itemId);
    if (!item?.options) return [];
    try {
      const parsed = typeof item.options === 'string' ? JSON.parse(item.options) : item.options;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const isNewItem = (item) => {
    if (!item.created_at) return false;
    const createdDate = new Date(item.created_at);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return createdDate > sevenDaysAgo;
  };

  // Computed values
  const todayHours = getTodayHours();
  const storeOpen = isStoreOpen();
  const categoryNames = useMemo(() => ["전체", ...categories.map(c => c.name)], [categories]);
  
  const filteredItems = useMemo(() => {
    if (selectedCategory === "전체") return menuItems;
    return menuItems.filter(item => {
      const category = categories.find(c => c.id === item.category_id);
      return category?.name === selectedCategory;
    });
  }, [selectedCategory, menuItems, categories]);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  // Handlers
  const handleAddToCartClick = async (item) => {
    if (!storeOpen) {
      toast.error("영업시간이 아닙니다. 영업시간을 확인해주세요.");
      return;
    }
    
    const options = getOptionsForMenuItem(item.id);
    
    if (options.length > 0) {
      setOptionModalItem(item);
      setOptionModalGroups(options);
    } else {
      addToCartDirect(item, 1, [], item.price);
    }
  };

  const addToCartDirect = (item, quantity, selectedOptions, unitPrice) => {
    const cartItemId = `${item.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    setCart(prev => [...prev, {
      cartItemId,
      menuItem: item,
      quantity,
      selectedOptions,
      unitPrice,
    }]);
    
    toast.success(`${item.name}을(를) 담았습니다`);
  };

  const handleOptionConfirm = (quantity, selectedOptions, totalPrice) => {
    if (!optionModalItem) return;
    
    const unitPrice = totalPrice / quantity;
    addToCartDirect(optionModalItem, quantity, selectedOptions, unitPrice);
    setOptionModalItem(null);
    setOptionModalGroups([]);
  };

  const updateQuantity = (cartItemId, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.cartItemId === cartItemId) {
          const newQuantity = item.quantity + delta;
          if (newQuantity <= 0) return null;
          return { ...item, quantity: newQuantity };
        }
        return item;
      }).filter(Boolean);
    });
  };

  const handleOrder = async () => {
    if (!storeId || cart.length === 0) return;
    
    if (!storeOpen) {
      toast.error("영업시간이 아닙니다. 주문할 수 없습니다.");
      return;
    }
    
    setIsOrdering(true);
    try {
      const orderData = {
        store_id: storeId,
        table_number: tableNumber, // URL 파라미터(테이블 번호 문자열) → 백엔드에서 table_id(정수)로 변환
        items: cart.map(item => ({
          product_id: item.menuItem.id,
          product_name: item.menuItem.name,
          price: item.unitPrice,
          quantity: item.quantity,
          subtotal: item.unitPrice * item.quantity,
          options: item.selectedOptions
        })),
        total_amount: totalPrice,
        payment_method: 'card'
      };

      const order = await ordersAPI.create(orderData);

      toast.success("주문이 완료되었습니다! 🎉", {
        description: "주문 현황에서 진행 상태를 확인하세요.",
      });

      const orderId = order?.data?.id || order?.id;
      setCurrentOrderId(orderId);
      setCurrentOrderAmount(totalPrice);
      setCart([]);
      setIsCartOpen(false);

      // 포인트 등록 시트 → 닫힌 후 주문 현황 자동 열기 (handlePhoneSheetClose에서 처리)
      setTimeout(() => setIsPhoneSheetOpen(true), 400);
    } catch {
      toast.error("주문에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsOrdering(false);
    }
  };

  if (!isNumericStoreId) return null;

  if (isLoading) {
    const isColdStart = elapsed >= 8;
    const progressPct = Math.min(elapsed * 1.8, 88);
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6">
        <div className="text-center space-y-6 max-w-xs w-full">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            {isColdStart
              ? <UtensilsCrossed size={28} className="text-orange-400" />
              : <Loader2 size={28} className="animate-spin text-orange-400" />}
          </div>

          <div>
            <h2 className="text-white font-black text-lg mb-1.5">
              {isColdStart ? '서버를 깨우는 중...' : '메뉴를 불러오는 중...'}
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              {elapsed < 8
                ? '잠시만 기다려주세요.'
                : elapsed < 30
                  ? '처음 접속 시 서버를 깨우는 데 최대 30초 걸립니다.'
                  : '거의 준비됐습니다! 조금만 더 기다려주세요...'}
            </p>
          </div>

          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="flex items-center justify-center gap-2 text-slate-600">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">{elapsed}초 경과</span>
          </div>

          {elapsed >= 50 && (
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw size={15} /> 페이지 새로고침
            </button>
          )}
        </div>
      </div>
    );
  }

  // 테마 CSS 변수 생성
  const themeStyle = profile?.theme ? {
    '--color-primary': profile.theme.primaryColor || '#f97316',
    '--color-secondary': profile.theme.secondaryColor || '#1e3a5f',
    '--color-accent': profile.theme.accentColor || '#10b981',
    '--color-bg': profile.theme.backgroundColor || '#f8fafc',
    '--color-card': profile.theme.cardColor || '#ffffff',
    '--color-text': profile.theme.textColor || '#1e293b',
    fontFamily: profile.theme.fontFamily || 'inherit',
    backgroundColor: profile.theme.backgroundColor || undefined,
    color: profile.theme.textColor || undefined,
  } : {};

  return (
    <div className="min-h-screen pb-24 font-sans tracking-tight" style={themeStyle}>
      {/* 공지사항 배너 */}
      {profile?.announcement_active && profile?.announcement && (
        <div className="px-4 py-2.5 flex items-center gap-2" style={{ backgroundColor: '#fbbf24' }}>
          <span className="text-xs">📢</span>
          <p className="text-xs font-bold text-amber-900 flex-1">{profile.announcement}</p>
        </div>
      )}

      {/* Header */}
      <MenuHeader
        storeName={profile?.store_name || "위마켓"}
        tableNumber={tableNumber}
        onOrderHistoryClick={() => setIsOrderStatusOpen(true)}
      />

      {/* Store Info */}
      <StoreInfoBanner
        description={profile?.description}
        phone={profile?.phone}
        address={profile?.address}
        isOpen={storeOpen}
        todayHours={todayHours}
      />

      {/* Category Tabs */}
      <CategoryTabs
        categories={categoryNames}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* Menu List */}
      <div className="container mx-auto px-4 py-6">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🍽️</div>
            <p className="text-slate-400 font-bold">등록된 메뉴가 없습니다</p>
            <p className="text-sm text-slate-300 mt-1">조금만 기다려주세요!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map(item => {
              const options = getOptionsForMenuItem(item.id);
              const isPopular = orderStats.includes(item.id);
              const isNew = isNewItem(item);
              
              return (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  hasOptions={options.length > 0}
                  isPopular={isPopular}
                  isNew={isNew}
                  onAddToCart={handleAddToCartClick}
                  disabled={!storeOpen}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Cart Button */}
      <CartButton
        totalItems={totalItems}
        totalPrice={totalPrice}
        onClick={() => setIsCartOpen(true)}
      />

      {/* Cart Modal */}
      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={updateQuantity}
        onOrder={handleOrder}
        isOrdering={isOrdering}
        totalPrice={totalPrice}
      />

      {/* Order Status Modal */}
      {storeId && (
        <OrderStatusModal
          isOpen={isOrderStatusOpen}
          onClose={() => { setIsOrderStatusOpen(false); }}
          orderId={currentOrderId}
          storeId={storeId}
          tableNumber={tableNumber}
        />
      )}

      {/* Option Selection Modal */}
      {optionModalItem && (
        <OptionSelectionModal
          key={optionModalItem.id}
          isOpen={!!optionModalItem}
          onClose={() => {
            setOptionModalItem(null);
            setOptionModalGroups([]);
          }}
          onConfirm={handleOptionConfirm}
          item={optionModalItem}
          optionGroups={optionModalGroups}
        />
      )}

      {/* 주문 후 핸드폰 번호 등록 (포인트·알림·회원가입 통합) */}
      <CustomerPhoneSheet
        isOpen={isPhoneSheetOpen}
        onClose={() => {
          setIsPhoneSheetOpen(false);
          setTimeout(() => setIsOrderStatusOpen(true), 300);
        }}
        storeId={storeId}
        orderId={currentOrderId}
        totalAmount={currentOrderAmount}
        storeName={profile?.store_name || "위마켓"}
      />

      {/* 전자상거래법 §13 필수 사업자 정보 표시 */}
      <LegalFooter storeId={storeId} />
    </div>
  );
};

export default MenuPage;
