/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router";
import { storesAPI, categoriesAPI, productsAPI, tablesAPI, ordersAPI, cartAPI, paymentsAPI } from "../../api";
import {
  ShoppingCart, Plus, Minus, X, CreditCard, Banknote, Building2,
  Clock, CheckCircle, ChevronLeft, ChevronRight, MapPin, Phone, Timer,
  Star, Wand2, Search, Sparkles, BellRing, Users, Calendar,
  TrendingUp, Package, Truck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../common/LanguageSwitcher";
import { aiAPI } from "../../api";
import PaymentSheet from "./payment/PaymentSheet";
import TogetherPaymentSheet from "./payment/TogetherPaymentSheet"; // 분할 결제 시트
import ManagerCallSheet from "./ManagerCallSheet";
import ChatDrawer from "./ChatDrawer";
import ReviewModal from "./ReviewModal";
import ReservationSection from "./ReservationSection";
import MenuStoryModal from "./MenuStoryModal";
import FloatingCallButton from "./FloatingCallButton";
import { formatPrice } from "../../utils/format";
import { requestTossCheckout } from "../../utils/tossCheckout";
import { useOfflineSync } from "../../hooks/useOfflineSync";
import { enqueueOperation } from "../../lib/offlineQueue";

// 모듈화된 하위 컴포넌트들 임포트
import MenuSkeleton from "./MenuSkeleton";
import MenuProductList from "./MenuProductList";

const defaultTheme = {
  primaryColor: "#f97316",
  secondaryColor: "#1e3a5f",
  accentColor: "#10b981",
  backgroundColor: "#f8fafc",
  textColor: "#1e293b",
  fontFamily: "Pretendard",
  logoText: ""
};

const paymentMethods = [
  { id: "card", label: "카드결제", icon: CreditCard, desc: "신용/체크카드" },
  { id: "cash", label: "현금결제", icon: Banknote, desc: "카운터 결제" },
  { id: "transfer", label: "계좌이체", icon: Building2, desc: "실시간 이체" }
];

const Menu = () => {
  const { t, i18n } = useTranslation();
  const { qrCode } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL 파라미터: storeId, tableId 지원 (store도 호환성 유지)
  const storeIdParam = searchParams.get("storeId") || searchParams.get("store");
  const tableIdParam = searchParams.get("tableId");
  const [store, setStore] = useState(null);
  const [table, setTable] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [orderForm, setOrderForm] = useState({ customer_name: "", customer_phone: "", notes: "", payment_method: "card" });

  // 온라인/오프라인 상태 감지
  useEffect(() => {
    const goOnline = () => { setIsOnline(true); processQueue(); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [processQueue]);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [orderStep, setOrderStep] = useState("cart");
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [showCallSheet, setShowCallSheet] = useState(false);
  const [showTogetherSheet, setShowTogetherSheet] = useState(false); // 분할 결제 시트 상태
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false); // 리뷰 모달 상태
  const [showReservation, setShowReservation] = useState(false); // 예약 섹션 상태
  const [showStoryModal, setShowStoryModal] = useState(false); // 스토리 모달 상태
  const [selectedStoryProduct, setSelectedStoryProduct] = useState(null); // 스토리 대상 상품

  // AI 추천 관련 상태
  const [aiPreferences, setAiPreferences] = useState("");
  const [mood, setMood] = useState("보통"); // 기분 태그 상태
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [dessertRecommendations, setDessertRecommendations] = useState([]); // 후식 추천 상태
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiInput, setShowAiInput] = useState(false);

  // 기분 태그 정의
  const moodTags = [
    { label: "활기참", value: "energetic", icon: "🔥" },
    { label: "스트레스", value: "stressed", icon: "😫" },
    { label: "차분함", value: "calm", icon: "🧘" },
    { label: "위로 필요", value: "comfort", icon: "🍲" },
    { label: "기분 좋음", value: "happy", icon: "🥰" }
  ];

  // 카테고리 이모지 매핑 (m.fooddream.kr 스타일)
  const categoryEmojis = {
    "간편식": "🍱",
    "튀김류": "🍤",
    "포장부자재": "📦",
    "각종튀김": "🍤",
    "메인요리": "🍽️",
    "사이드": "🥗",
    "디저트": "🍰",
    "음료": "🥤",
    "커피": "☕",
    "간식": "🍪",
    "도시락": "🥡",
    "분식": "🍢",
    "한식": "🇰🇷",
    "중식": "🇨🇳",
    "일식": "🇯🇵",
    "양식": "🇫🇷",
    "버거": "🍔",
    "피자": "🍕",
    "치킨": "🍗",
    "샐러드": "🥗",
    "국/탕": "🍲",
    "김치찌개": "🥘",
    "비빔밥": "🍚",
    "떡볶이": "🍡",
    "오뎅": "🐟",
    "튀김": "🍳"
  };

  // 배너 슬라이더 상태
  const [currentBanner, setCurrentBanner] = useState(0);
  const bannerImages = store?.theme?.banners || [];
  const autoBanners = [
    { id: 1, title: "🔥 오늘의 특가", subtitle: "최대 30% 할인", bg: "from-orange-400 to-pink-500" },
    { id: 2, title: "🚚 무료 배달", subtitle: "3만원 이상 주문 시", bg: "from-blue-400 to-indigo-500" },
    { id: 3, title: "🎁 포인트 적립", subtitle: "결제금액의 5% 적립", bg: "from-purple-400 to-pink-500" }
  ];
  const banners = bannerImages.length > 0 ? bannerImages : autoBanners;

  // 다국어 번역 관련 상태
  const [translatedDescriptions, setTranslatedDescriptions] = useState({}); // { productId: translatedText }

  // Toss 앱 사용자 정보
  const tossUserKey = searchParams.get("toss_user_key") || "";
  const userPhone = searchParams.get("phone") || orderForm.customer_phone;
  const userIdentifier = useMemo(() => ({
    toss_user_key: tossUserKey,
    phone: userPhone
  }), [tossUserKey, userPhone]);

  // 테마 설정을 useMemo로 관리하여 불필요한 계산 방지
  const theme = useMemo(() => {
    if (!store?.theme) return defaultTheme;
    try {
      const parsed = typeof store.theme === "string" ? JSON.parse(store.theme) : store.theme;
      return { ...defaultTheme, ...parsed };
    } catch (e) {
      console.warn("Theme parse error:", e);
      return defaultTheme;
    }
  }, [store?.theme]);

  const effectiveStoreId = storeIdParam || (store?.id ? String(store.id) : null);
  const { queueOperation, processQueue, pendingCount, syncStatus } = useOfflineSync(effectiveStoreId);

  // 오프라인 주문 대기열 처리 (네트워크 복구 시 자동 동기화)
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      processQueue();
    }
  }, [isOnline, pendingCount, processQueue]);

  // 페이지 배경 및 그라디언트 스타일 계산 메모이제이션
  const styles = useMemo(() => {
    const gradientBg = `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`;
    const pageBg = `linear-gradient(180deg, ${theme.backgroundColor} 0%, white 100%)`;
    const themeStyles = { fontFamily: `${theme.fontFamily}, sans-serif` };
    return { gradientBg, pageBg, themeStyles };
  }, [theme]);

  const fetchStoreData = useCallback(async (storeId) => {
    try {
      const [storeRes, categoriesRes, productsRes] = await Promise.all([
        storesAPI.getById(storeId), categoriesAPI.getByStore(storeId), productsAPI.getByStore(storeId)
      ]);
      setStore(storeRes.data);
      setCategories(categoriesRes.data);
      setProducts(productsRes.data.filter((p) => p.is_active && !p.is_sold_out));
    } catch { setError("매장 정보를 불러올 수 없습니다"); }
    finally { setLoading(false); }
  }, []);

  const fetchTableData = useCallback(async () => {
    try {
      const res = await tablesAPI.getByQrCode(qrCode);
      setTable(res.data);
      await fetchStoreData(res.data.store_id);
    } catch { setError("유효하지 않은 QR 코드입니다"); setLoading(false); }
  }, [qrCode, fetchStoreData]);

  useEffect(() => {
    if (qrCode) {
      fetchTableData();
    } else if (storeIdParam) {
      fetchStoreData(storeIdParam);
      if (tableIdParam) {
        setTable({ id: tableIdParam, name: `테이블 ${tableIdParam}`, store_id: storeIdParam });
      }
    }
  }, [qrCode, storeIdParam, tableIdParam, fetchTableData, fetchStoreData]);

  // 실시간 주문 상태 및 공유 장바구니 수신
  useEffect(() => {
    const socket = ordersAPI.getSocket();
    if (!socket) return;

    if (orderSuccess?.id) {
      socket.emit('join-order', orderSuccess.id);
      socket.on('order-updated', (data) => {
        if (data?.order_id === orderSuccess.id) {
          setOrderSuccess(prev => ({ ...prev, status: data.status }));
          if (data.status === 'ready' && Notification?.permission === 'granted') {
            new Notification('식사가 준비되었습니다!', { body: data.status_label || '음식이 준비되었습니다.' });
          }
        }
      });
    }

    if (table?.id) {
      socket.emit('join-table-cart', { tableId: table.id });

      const loadCart = async () => {
        try {
          const res = await cartAPI.getCart(table.id);
          if (res.success && res.data.length > 0) {
            setCart(res.data.map(item => ({
              id: item.product_id,
              product_id: item.product_id,
              product_name: item.products.name,
              price: item.products.price,
              quantity: item.quantity,
              shared: true
            })));
          }
        } catch (err) { console.error('공유 장바구니 로드 실패:', err); }
      };
      loadCart();

      socket.on('cart-item-updated', (data) => {
        setCart(prev => {
          if (data.action === 'add' || data.action === 'update') {
            const exists = prev.find(i => (i.product_id || i.id) === data.item.product_id);
            if (exists) return prev.map(i => (i.product_id || i.id) === data.item.product_id ? { ...i, quantity: data.item.quantity } : i);
            return [...prev, {
              id: data.item.product_id,
              product_id: data.item.product_id,
              product_name: data.item.products?.name || '상품',
              price: data.item.products?.price || 0,
              quantity: data.item.quantity,
              shared: true
            }];
          } else if (data.action === 'remove') {
            return prev.filter(i => (i.product_id || i.id) !== data.item.product_id);
          } else if (data.action === 'clear') {
            return [];
          }
          return prev;
        });
      });
    }

    socket.on('product-updated', (data) => {
      setProducts(prev => prev.map(p => p.id === data.productId ? { ...p, ...data, is_sold_out: data.is_sold_out } : p));

      setCart(prev => {
        const itemInCart = prev.find(i => (i.product_id || i.id) === data.productId);
        if (itemInCart && data.is_sold_out) {
          alert(`죄송합니다. 담으신 [${data.name}] 메뉴가 방금 품절되었습니다.`);
          return prev.filter(i => (i.product_id || i.id) !== data.productId);
        }
        return prev;
      });
    });

    return () => {
      socket.off('order-updated');
      socket.off('cart-item-updated');
      socket.off('product-updated');
    };
  }, [orderSuccess?.id, table?.id]);

  const syncCartToServer = async (pid, qty, act) => {
    if (!table?.id) return;
    try {
      const res = await cartAPI.updateItem(table.id, { product_id: pid, quantity: qty, user_phone: userPhone });
      if (res.success) {
        ordersAPI.getSocket().emit('update-shared-cart', { tableId: table.id, item: res.data, userPhone, action: act });
      }
    } catch (err) { console.error('장바구니 서버 동기화 실패:', err); }
  };

  const addToCart = (product) => {
    if (product.is_sold_out) return alert("품절된 상품입니다.");
    setCart((prev) => {
      const existing = prev.find((item) => (item.product_id || item.id) === product.id);
      const newQty = existing ? existing.quantity + 1 : 1;
      syncCartToServer(product.id, newQty, existing ? 'update' : 'add');

      if (existing) return prev.map((item) => (item.product_id || item.id) === product.id ? { ...item, quantity: newQty } : item);
      return [...prev, { id: product.id, product_id: product.id, product_name: product.name, price: product.price, quantity: 1 }];
    });
  };

  const updateQuantity = (pid, d) => {
    setCart((prev) => {
      const item = prev.find((i) => (i.product_id || i.id) === pid);
      if (!item) return prev;
      const newQty = item.quantity + d;

      if (newQty <= 0) {
        syncCartToServer(pid, 0, 'remove');
        return prev.filter((i) => (i.product_id || i.id) !== pid);
      }
      syncCartToServer(pid, newQty, 'update');
      return prev.map((i) => (i.product_id || i.id) === pid ? { ...i, quantity: newQty } : i);
    });
  };

  const getTotalAmount = () => cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const getTotalItems = () => cart.reduce((s, i) => s + i.quantity, 0);

  const handleOrder = async () => {
    if (cart.length === 0) return;

    // 오프라인일 경우 IndexedDB에 주문을 버퍼링
    if (!isOnline) {
      const orderData = {
        store_id: store.id,
        table_id: table?.id || null,
        customer_name: orderForm.customer_name || null,
        customer_phone: orderForm.customer_phone || null,
        notes: orderForm.notes || null,
        payment_method: orderForm.payment_method,
        items: cart,
        total_amount: getTotalAmount(),
        timestamp: Date.now(),
        offline: true,
      };
      await queueOperation({ operation: 'CREATE_ORDER', data: orderData });
      setCart([]);
      if (table?.id) {
        cartAPI.clearCart(table.id);
        ordersAPI.getSocket().emit('update-shared-cart', { tableId: table.id, action: 'clear' });
      }
      setShowCart(false);
      setOrderStep("cart");
      alert('오프라인模式下 주문이 접수되었습니다. 연결 복구 시 자동으로 전송됩니다.');
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        store_id: store.id,
        table_id: table?.id || null,
        customer_name: orderForm.customer_name || null,
        customer_phone: orderForm.customer_phone || null,
        notes: orderForm.notes || null,
        payment_method: orderForm.payment_method,
        items: cart,
        total_amount: getTotalAmount()
      };

      const res = await ordersAPI.create(orderData);

      setOrderSuccess({ ...res.data, payment_method: orderForm.payment_method });
      setCart([]);
      if (table?.id) {
        cartAPI.clearCart(table.id);
        ordersAPI.getSocket().emit('update-shared-cart', { tableId: table.id, action: 'clear' });
      }
      setShowCart(false);
      setOrderStep("cart");

      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch (err) {
      // 서버 오류 시 오프라인 버퍼에 저장
      const orderData = {
        store_id: store.id,
        table_id: table?.id || null,
        customer_name: orderForm.customer_name || null,
        customer_phone: orderForm.customer_phone || null,
        notes: orderForm.notes || null,
        payment_method: orderForm.payment_method,
        items: cart,
        total_amount: getTotalAmount(),
        timestamp: Date.now(),
        offline: true,
        error: err.response?.data?.error || '네트워크 오류',
      };
      await queueOperation({ operation: 'CREATE_ORDER', data: orderData });
      alert('네트워크 오류로 주문이 보관되었습니다. 연결 복구 시 자동으로 전송됩니다.');
      setCart([]);
      if (table?.id) {
        cartAPI.clearCart(table.id);
        ordersAPI.getSocket().emit('update-shared-cart', { tableId: table.id, action: 'clear' });
      }
      setShowCart(false);
      setOrderStep("cart");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentComplete = (result) => {
    if (result.success) {
      setOrderSuccess({
        ...result.payment,
        payment_method: result.method,
        points_earned: result.earnPoints || 0,
        points_used: result.pointsUsed || 0
      });
      setCart([]);
      if (table?.id) {
        cartAPI.clearCart(table.id);
        ordersAPI.getSocket().emit('update-shared-cart', { tableId: table.id, action: 'clear' });
      }
      setShowCart(false);
      setShowPaymentSheet(false);
      setOrderStep("cart");
    }
  };

  const openPaymentSheet = () => {
    setShowCart(false);
    setShowPaymentSheet(true);
  };

  const handlePaymentSplit = async (splitData) => {
    if (!store?.id || cart.length === 0) return;
    setLoading(true);
    try {
      const orderData = {
        store_id: store.id,
        table_id: table?.id || null,
        customer_name: orderForm.customer_name || null,
        customer_phone: orderForm.customer_phone || userPhone || null,
        notes: orderForm.notes || null,
        payment_method: 'card',
        items: cart,
        total_amount: getTotalAmount(),
        is_split_payment: true,
        split_type: splitData.split_type
      };
      const orderRes = await ordersAPI.create(orderData);
      const order = orderRes.data;

      await paymentsAPI.splitRequest({
        order_id: order.id,
        split_type: splitData.split_type,
        num_people: splitData.people_count || 2
      }, order.order_capability);

      const payRes = await paymentsAPI.splitPay({
        order_id: order.id,
        amount: splitData.amount,
        payer_phone: orderForm.customer_phone || userPhone || '',
        split_type: splitData.split_type,
        payment_method: 'card'
      }, order.order_capability);

      await requestTossCheckout({
        paymentId: payRes.data.payment_id,
        amount: payRes.data.amount,
        orderId: payRes.data.pg_order_id,
        orderName: `WeMarket 분할결제 - ${order.order_number}`,
        phone: orderForm.customer_phone || userPhone || undefined,
      });
    } catch (err) {
      const errorMsg = err.response?.data?.error || "분할 결제 처리 중 오류가 발생했습니다.";
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGetRecommendations = async (e) => {
    if (e) e.preventDefault();
    setAiLoading(true);
    try {
      const response = await aiAPI.recommendPersonalized({
        store_id: store.id,
        preferences: aiPreferences,
        mood: mood,
        phone: userPhone,
        toss_user_key: tossUserKey,
        weather: "맑음"
      });
      setAiRecommendations(response.data?.recommendations || response.recommendations || []);
      setShowAiInput(false);
    } catch (error) {
      console.error("AI 추천 오류:", error);
      alert("AI 추천을 가져오는 중 오류가 발생했습니다.");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (cart.length > 0 && store?.id) {
      const fetchDessertRecommend = async () => {
        try {
          const currentItems = cart.map(item => item.product_name);
          const res = await aiAPI.recommendDessert({
            store_id: store.id,
            currentItems
          });
          setDessertRecommendations(res.data?.recommendations || res.recommendations || []);
        } catch (err) {
          console.error("후식 추천 로드 실패:", err);
        }
      };

      const timer = setTimeout(fetchDessertRecommend, 1000);
      return () => clearTimeout(timer);
    } else {
      setDessertRecommendations([]);
    }
  }, [cart.length, store?.id]);

  useEffect(() => {
    const lang = i18n.language.split("-")[0];
    if (lang === "ko" || !store?.id) {
      setTranslatedDescriptions({});
      return;
    }

    const autoTranslateMenu = async () => {
      setAiLoading(true);
      try {
        const res = await aiAPI.translateMenu(store.id, lang);
        if (res.success && res.translations) {
          const newTranslations = {};
          res.translations.forEach(item => {
            newTranslations[item.id + '_name'] = item.translated_name;
            newTranslations[item.id] = item.translated_description;
          });
          setTranslatedDescriptions(newTranslations);
        }
      } catch (err) {
        console.error("[AI] 메뉴 전체 번역 연동 실패:", err);
      } finally {
        setAiLoading(false);
      }
    };

    autoTranslateMenu();
  }, [i18n.language, store?.id]);

  // 배너 자동 슬라이드
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const filteredProducts = useMemo(() => {
    return selectedCategory ? products.filter((p) => p.category_id === selectedCategory) : products;
  }, [selectedCategory, products]);

  // 베스트/신상품 분리
  const bestProducts = useMemo(() => products.filter((p) => p.is_best), [products]);
  const newProducts = useMemo(() => products.filter((p) => p.is_new), [products]);

  const { themeStyles, gradientBg, pageBg } = styles;

  if (loading) return <MenuSkeleton pageBg={pageBg} />;
  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center" style={{ background: theme.backgroundColor }}>
      <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-6 text-red-500">
        <X size={40} />
      </div>
      <h2 className="text-xl font-bold mb-2">데이터 로딩 실패</h2>
      <p className="text-gray-500 mb-8">{error || t('common.error_loading')}</p>
      <button
        onClick={() => window.location.reload()}
        className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold shadow-lg"
      >
        다시 시도하기
      </button>
    </div>
  );

  if (orderSuccess) {
    const pInfo = paymentMethods.find(p => p.id === orderSuccess.payment_method);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: theme.backgroundColor, ...themeStyles }}
      >
        <div className="bg-white rounded-[3rem] shadow-2xl p-8 max-w-md w-full border border-white/20 overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-32 opacity-10" style={{ background: gradientBg }} />

          <div className="relative z-10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner" style={{ backgroundColor: theme.accentColor + "20" }}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12 }}
            >
              <CheckCircle size={48} style={{ color: theme.accentColor }} />
            </motion.div>
          </div>

          <h2 className="text-3xl font-black text-center mb-2 tracking-tight" style={{ color: theme.textColor }}>주문 완료!</h2>
          <p className="text-center text-gray-500 mb-10 font-medium">소중한 주문이 성공적으로 접수되었습니다</p>

          <div className="mb-8 p-6 rounded-[2rem] text-center shadow-inner" style={{ backgroundColor: theme.primaryColor + "08" }}>
            {orderSuccess.queue_number && (
              <div className="mb-4">
                <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Queue Number</p>
                <motion.p
                  initial={{ y: 10 }}
                  animate={{ y: 0 }}
                  className="text-6xl font-black"
                  style={{ color: theme.primaryColor }}
                >
                  #{orderSuccess.queue_number}
                </motion.p>
              </div>
            )}
            {orderSuccess.estimated_minutes && (
              <div className="flex items-center justify-center gap-2 py-2 px-4 bg-white/50 rounded-full w-fit mx-auto shadow-sm border border-white">
                <Timer size={18} style={{ color: theme.secondaryColor }} />
                <span className="font-bold text-sm" style={{ color: theme.secondaryColor }}>약 {orderSuccess.estimated_minutes}분 소요</span>
              </div>
            )}
          </div>

          <div className="rounded-2xl p-5 mb-6" style={{ backgroundColor: theme.backgroundColor }}>
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
              <span className="text-gray-500">{t('order.number')}</span>
              <span className="font-bold text-lg" style={{ color: theme.primaryColor }}>#{orderSuccess.order_number}</span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-500">{t('order.payment_method')}</span>
              <span className="font-medium flex items-center gap-2">
                {pInfo && <pInfo.icon size={18} style={{ color: theme.secondaryColor }} />}
                {t(`order.methods.${orderSuccess.payment_method}`)}
              </span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-500">{table ? t('order.table') : t('order.type')}</span>
              <span className="font-medium">{table?.name || t('order.takeout')}</span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-500">{t('order.status_title')}</span>
              <span className="font-medium px-2 py-1 rounded-lg text-sm" style={{ backgroundColor: orderSuccess.status === 'completed' ? '#10b98120' : orderSuccess.status === 'preparing' ? '#8b5cf620' : theme.primaryColor + '20', color: orderSuccess.status === 'completed' ? '#10b981' : orderSuccess.status === 'preparing' ? '#8b5cf6' : theme.primaryColor }}>
                {t(`status.${orderSuccess.status}`)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-gray-200">
              <span className="font-medium">{t('menu.total')}</span>
              <span className="text-2xl font-bold" style={{ color: theme.primaryColor }}>{formatPrice(orderSuccess.total_amount)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl mb-6" style={{ backgroundColor: theme.primaryColor + "10" }}>
            <Clock size={20} style={{ color: theme.primaryColor }} />
            <div>
              <p className="font-medium" style={{ color: theme.textColor }}>{t(`status_msg.${orderSuccess.status}`)}</p>
              <p className="text-sm text-gray-500">{orderSuccess.status === 'ready' ? t('status_msg.ready_sub') : t('status_msg.wait_sub')}</p>
            </div>
          </div>

          <div className="text-center text-sm text-gray-500 mb-8">
            <p className="font-medium" style={{ color: theme.textColor }}>{store?.name}</p>
            {store?.address && <p className="flex items-center justify-center gap-1 mt-1"><MapPin size={14} /> {store.address}</p>}
            {store?.phone && <p className="flex items-center justify-center gap-1 mt-1"><Phone size={14} /> {store.phone}</p>}
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setShowReviewModal(true)}
              className="w-full py-4 bg-orange-500/10 text-orange-600 rounded-2xl font-black border border-orange-500/20 active:bg-orange-500 active:text-white transition-colors flex items-center justify-center gap-2"
            >
              <Star size={18} fill="currentColor" />
              {t('review.write_review') || '리뷰 작성하고 혜택 받기'}
            </button>
            <button onClick={() => setOrderSuccess(null)} className="w-full py-4 text-white rounded-2xl font-medium shadow-lg" style={{ backgroundColor: theme.primaryColor }}>{t('order.order_more')}</button>
            <button onClick={() => navigate('/history')} className="w-full py-4 bg-slate-100 text-slate-700 rounded-2xl font-medium border border-slate-200">{t('common.history')}</button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen pb-28 selection:bg-orange-100" style={{ background: pageBg, ...themeStyles }}>
      {/* 프리미엄 플로팅 헤더 */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-header"
      >
        <div className="px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg ring-4 ring-white/30"
                style={{ background: gradientBg }}
              >
                {(theme.logoText || store?.name || "M").charAt(0)}
              </motion.div>
              <div>
                <h1 className="text-xl font-black tracking-tight" style={{ color: theme.textColor }}>{theme.logoText || store?.name}</h1>
                <div className="flex items-center gap-2">
                  {table && <p className="text-xs font-bold uppercase tracking-widest opacity-60" style={{ color: theme.secondaryColor }}>{table.name}</p>}
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowCallSheet(true)}
                    className="p-1 px-2 rounded-lg bg-orange-500/10 text-orange-600 text-[10px] font-black border border-orange-500/20 active:bg-orange-500 active:text-white transition-colors flex items-center gap-1"
                  >
                    <BellRing size={10} className="animate-pulse" />
                    {t('common.call_manager')}
                  </motion.button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate(`/wallet?store_id=${store.id}&phone=${userPhone}`)}
                className="p-3 rounded-2xl bg-white/50 text-orange-600 border border-white/60 shadow-sm hover:bg-white transition-colors"
              >
                <CreditCard size={22} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate('/feed')}
                className="p-3 rounded-2xl bg-white/50 text-rose-500 border border-white/60 shadow-sm hover:bg-white transition-colors"
                title="Social Feed"
              >
                <Star size={22} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowAiInput(!showAiInput)}
                className="p-3 rounded-2xl bg-white/50 text-blue-600 border border-white/60 shadow-sm hover:bg-white transition-colors"
              >
                <Wand2 size={22} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowReservation(!showReservation)}
                className="p-3 rounded-2xl bg-white/50 text-emerald-600 border border-white/60 shadow-sm hover:bg-white transition-colors"
                title="Reservation"
              >
                <Calendar size={22} />
              </motion.button>
              <LanguageSwitcher />
            </div>
          </div>
        </div>

        {/* AI 추천 입력 섹션 */}
        <AnimatePresence>
          {showAiInput && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-5 pb-5 overflow-hidden"
            >
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-5 shadow-2xl shadow-blue-200">
                <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                  <Sparkles size={16} /> {t('menu.ai_recommend')}
                </h3>
                <form onSubmit={handleGetRecommendations} className="relative group">
                  <input
                    type="text"
                    value={aiPreferences}
                    onChange={(e) => setAiPreferences(e.target.value)}
                    placeholder={t('common.search_placeholder') || "선호하는 맛이나 메뉴를 입력하세요..."}
                    className="w-full h-14 pl-5 pr-14 rounded-2xl text-sm outline-none bg-white/10 text-white placeholder:text-white/50 border border-white/20 focus:bg-white focus:text-slate-900 focus:placeholder:text-slate-400 transition-all shadow-inner"
                  />
                  <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                    {moodTags.map((tag) => (
                      <button
                        key={tag.value}
                        type="button"
                        onClick={() => setMood(tag.value)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${mood === tag.value
                          ? "bg-white text-blue-600 shadow-lg"
                          : "bg-white/10 text-white border border-white/20"
                          }`}
                      >
                        <span>{tag.icon}</span>
                        {tag.label}
                      </button>
                    ))}
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    type="submit"
                    disabled={aiLoading}
                    className="absolute right-1.5 top-1.5 bottom-1.5 w-11 bg-white text-blue-600 rounded-xl flex items-center justify-center disabled:opacity-50 shadow-lg group-focus-within:bg-blue-600 group-focus-within:text-white transition-colors"
                  >
                    {aiLoading ? <div className="w-5 h-5 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" /> : <Search size={22} />}
                  </motion.button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI 추천 결과 캐러셀 */}
        <AnimatePresence>
          {aiRecommendations.length > 0 && (
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="px-5 pb-5 overflow-x-auto scrollbar-hide"
            >
              <div className="flex gap-4 pb-2">
                {aiRecommendations.map((rec, idx) => (
                  <motion.div
                    key={rec.id}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="min-w-[300px] glass-panel p-4 flex gap-4 card-hover border-blue-100/50"
                  >
                    <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 shadow-md">
                      <img src={rec.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=200&auto=format&fit=crop'} alt={rec.name} loading="lazy" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <h4 className="font-bold text-base text-gray-900 truncate">{rec.name}</h4>
                        <p className="text-[12px] text-blue-600 font-bold mt-1 line-clamp-2 leading-snug">✨ {rec.recommend_reason}</p>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-black text-gray-900">{formatPrice(rec.price)}</span>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => addToCart(rec)}
                          className="text-[11px] font-bold text-white bg-blue-600 px-3 py-1.5 rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
                        >
                          {t('menu.add_cart')}
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 카테고리 칩 - m.fooddream.kr 스타일 (이모지 + 가로 스크롤) */}
        <div className="px-5 pb-4">
          <div className="flex overflow-x-auto gap-3 scrollbar-hide pb-1">
            <motion.button
              layout
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCategory(null)}
              className="relative px-5 py-3 rounded-2xl text-sm whitespace-nowrap font-bold transition-all border shadow-sm flex-shrink-0"
              style={selectedCategory === null ? { background: gradientBg, color: "white", borderColor: "transparent" } : { backgroundColor: "white", color: theme.textColor, borderColor: theme.backgroundColor }}
            >
              {selectedCategory === null && (
                <motion.div layoutId="activeCat" className="absolute inset-0 rounded-2xl bg-white/10" />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <span>📋</span> 전체
              </span>
            </motion.button>
            {categories.map((c) => {
              const emoji = categoryEmojis[c.name] || "📂";
              return (
                <motion.button
                  layout
                  key={c.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedCategory(c.id)}
                  className="relative px-5 py-3 rounded-2xl text-sm whitespace-nowrap font-bold transition-all border shadow-sm flex-shrink-0"
                  style={selectedCategory === c.id ? { backgroundColor: theme.primaryColor, color: "white", borderColor: "transparent" } : { backgroundColor: "white", color: theme.secondaryColor, borderColor: theme.backgroundColor }}
                >
                  {selectedCategory === c.id && (
                    <motion.div layoutId="activeCat" className="absolute inset-0 rounded-2xl bg-white/10" />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <span>{emoji}</span> {c.name}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </motion.header>

       {/* 메인 배너 슬라이더 - m.fooddream.kr 스타일 */}
       <div className="px-5 pb-6">
         <div className="relative w-full aspect-[21/9] rounded-3xl overflow-hidden shadow-2xl shadow-slate-200/50">
           <AnimatePresence>
             {banners.map((banner, idx) => {
               if (idx !== currentBanner) return null;
               const isCustom = typeof banner === 'string' || banner?.image_url;
               const bgClass = banner?.bg || (isCustom ? '' : 'from-orange-400 to-pink-500');
               const title = banner?.title || '특별한 혜택';
               const subtitle = banner?.subtitle || '지금 주문해보세요';
               
               return (
                 <motion.div
                   key={banner.id || idx}
                   initial={{ opacity: 0, x: 100 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: -100 }}
                   transition={{ duration: 0.5 }}
                   className={`absolute inset-0 flex items-center justify-between p-6 ${isCustom ? '' : `bg-gradient-to-r ${bgClass}`}`}
                 >
                   {isCustom ? (
                     <img src={typeof banner === 'string' ? banner : banner.image_url} alt={banner.title || '배너'} className="w-full h-full object-cover" />
                   ) : (
                     <>
                       <div className="text-white max-w-[60%]">
                         <p className="text-xs font-black uppercase tracking-[0.2em] opacity-80 mb-1">Welcome to</p>
                         <h2 className="text-2xl font-black tracking-tight mb-1">{store?.name}</h2>
                         <p className="text-sm font-bold opacity-90">{title}</p>
                         <p className="text-xs opacity-75 mt-1">{subtitle}</p>
                       </div>
                       <div className="text-right">
                         <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">
                           {idx === 0 ? '🔥' : idx === 1 ? '🚚' : '🎁'}
                         </div>
                       </div>
                     </>
                   )}
                 </motion.div>
               );
             })}
           </AnimatePresence>
           
           {/* 배너 인디케이터 */}
           <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
             {banners.map((_, idx) => (
               <button
                 key={idx}
                 onClick={() => setCurrentBanner(idx)}
                 className={`w-2 h-2 rounded-full transition-all ${idx === currentBanner ? 'w-6 bg-white' : 'bg-white/30'}`}
               />
             ))}
           </div>
         </div>
       </div>

       {/* 업종별 인기상품 섹션 - m.fooddream.kr 스타일 */}
       {bestProducts.length > 0 && (
         <div className="px-5 pb-6">
           <div className="flex items-center gap-2 mb-4">
             <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: theme.primaryColor + "15" }}>
               <TrendingUp size={18} style={{ color: theme.primaryColor }} />
             </div>
             <h3 className="font-black text-lg" style={{ color: theme.textColor }}>베스트 메뉴</h3>
           </div>
           <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
             {bestProducts.slice(0, 5).map((p) => (
               <motion.div
                 key={p.id}
                 whileTap={{ scale: 0.98 }}
                 className="min-w-[140px] bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden"
               >
                 <div className="aspect-square relative">
                   {p.image_url ? (
                     <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center bg-slate-50">
                       <Star size={24} className="text-slate-300" />
                     </div>
                   )}
                   <span className="absolute top-2 left-2 bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded">BEST</span>
                 </div>
                 <div className="p-2">
                   <p className="font-bold text-xs line-clamp-1" style={{ color: theme.textColor }}>{p.name}</p>
                   <p className="text-xs font-black mt-1" style={{ color: theme.primaryColor }}>{formatPrice(p.price)}</p>
                 </div>
               </motion.div>
             ))}
           </div>
         </div>
       )}

       {/* 메뉴 리스트 - 외부 모듈 컴포넌트로 위임 */}
       <MenuProductList
        filteredProducts={filteredProducts}
        theme={theme}
        translatedDescriptions={translatedDescriptions}
        addToCart={addToCart}
        setSelectedStoryProduct={setSelectedStoryProduct}
        setShowStoryModal={setShowStoryModal}
        gradientBg={gradientBg}
      />

      {/* 직원 호출 플로팅 버튼 */}
      <FloatingCallButton 
        onClick={() => setShowCallSheet(true)} 
        primaryColor={theme.primaryColor}
      />

      {/* 장바구니 바텀 시트 */}
      <AnimatePresence>
        {cart.length > 0 && !showCart && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-5 right-5 z-40"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setShowCart(true); setOrderStep("cart"); }}
              className="w-full py-5 text-white rounded-3xl flex items-center justify-between px-8 shadow-2xl shadow-orange-500/40 font-black text-lg overflow-hidden group"
              style={{ background: gradientBg }}
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="relative">
                  <ShoppingCart size={24} />
                  <span className="absolute -top-3 -right-3 bg-white text-orange-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow-lg">
                    {getTotalItems()}
                  </span>
                </div>
                <span>{cart.length}{t('menu.items_count')}</span>
                <span className="mx-2 opacity-50">|</span>
                <div className="flex items-center gap-1 text-orange-600">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                  </span>
                  <span className="text-[10px] font-black uppercase">Together</span>
                </div>
              </div>
              <span className="text-2xl font-black relative z-10">{formatPrice(getTotalAmount())}</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {showCart && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end">
          <div className="bg-white w-full rounded-t-[2.5rem] max-h-[90vh] overflow-y-auto shadow-2xl" style={themeStyles}>
            <div className="sticky top-0 bg-white/80 backdrop-blur-md p-6 border-b flex justify-between items-center z-10">
              {orderStep !== "cart" ? (
                <button onClick={() => setOrderStep("cart")} className="flex items-center gap-1 font-bold" style={{ color: theme.primaryColor }}>
                  <ChevronLeft size={20} />{t('common.back')}
                </button>
              ) : (
                <h2 className="text-xl font-black" style={{ color: theme.textColor }}>장바구니</h2>
              )}
              <button onClick={() => { setShowCart(false); setOrderStep("cart"); }} className="p-2 bg-slate-100 rounded-full">
                <X size={24} style={{ color: theme.textColor }} />
              </button>
            </div>

            {orderStep === "cart" && (
              <>
                <div className="p-6 space-y-4">
                  {cart.map((i) => (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={i.product_id}
                      className="flex items-center justify-between p-4 rounded-3xl bg-slate-50 border border-slate-100"
                    >
                      <div>
                        <p className="font-bold text-slate-800">{i.product_name}</p>
                        <p className="text-sm font-black" style={{ color: theme.primaryColor }}>{formatPrice(i.price)}</p>
                      </div>
                      <div className="flex items-center gap-3 bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
                        <button onClick={() => updateQuantity(i.product_id, -1)} className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors">
                          <Minus size={16} className="text-slate-600" />
                        </button>
                        <span className="w-6 text-center font-black text-slate-800">{i.quantity}</span>
                        <button onClick={() => updateQuantity(i.product_id, 1)} className="w-9 h-9 rounded-xl flex items-center justify-center bg-orange-50 hover:bg-orange-100 transition-colors">
                          <Plus size={16} className="text-orange-600" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <AnimatePresence>
                  {dessertRecommendations.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="px-6 pb-6"
                    >
                      <div className="bg-orange-50 rounded-[2rem] p-5 border border-orange-100/50">
                        <h4 className="text-orange-700 font-black text-sm mb-3 flex items-center gap-2">
                          <Sparkles size={16} /> 이런 후식은 어떠세요?
                        </h4>
                        <div className="flex gap-4 overflow-x-auto scrollbar-hide">
                          {dessertRecommendations.map((rec) => (
                            <motion.div
                              key={rec.id}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => addToCart(rec)}
                              className="min-w-[200px] bg-white p-3 rounded-2xl shadow-sm flex flex-col gap-2 cursor-pointer border border-white hover:border-orange-200 transition-all"
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-sm truncate pr-2">{rec.name}</span>
                                <span className="text-[10px] font-black text-orange-600 shrink-0">{formatPrice(rec.price)}</span>
                              </div>
                              <p className="text-[10px] text-slate-500 leading-tight">✨ {rec.recommend_reason}</p>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="p-6 border-t sticky bottom-0 bg-white/80 backdrop-blur-md">
                  <div className="flex justify-between mb-5 items-end">
                    <span className="font-bold text-slate-500 uppercase tracking-widest text-xs">Total Amount</span>
                    <span className="text-3xl font-black" style={{ color: theme.primaryColor }}>{formatPrice(getTotalAmount())}</span>
                  </div>
                  <button onClick={() => setOrderStep("payment")} className="w-full py-5 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-orange-500/30 active:scale-[0.98] transition-all" style={{ background: gradientBg }}>
                    {t('menu.order_now')}
                  </button>
                </div>
              </>
            )}

            {orderStep === "payment" && (
              <>
                <div className="p-6">
                  <h3 className="text-xl font-black mb-6" style={{ color: theme.textColor }}>결제 방식을 선택해주세요</h3>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setShowTogetherSheet(true); setShowCart(false); }}
                    className="w-full mb-6 p-5 rounded-[2rem] bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-xl shadow-blue-100 flex items-center justify-between group overflow-hidden relative"
                  >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                        <Users size={24} />
                      </div>
                      <div className="text-left">
                        <p className="font-black text-lg">함께 결제하기 (N분의 1)</p>
                        <p className="text-[11px] opacity-80 font-medium">따로 결제하고 포인트도 각자 받으세요!</p>
                      </div>
                    </div>
                    <ChevronRight size={24} className="opacity-50 group-hover:translate-x-1 transition-transform" />
                  </motion.button>

                  <div className="space-y-3">
                    {paymentMethods.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setOrderForm({ ...orderForm, payment_method: m.id })}
                        className="w-full p-5 rounded-[2rem] border-2 flex items-center gap-4 transition-all"
                        style={{
                          borderColor: orderForm.payment_method === m.id ? theme.primaryColor : "transparent",
                          backgroundColor: orderForm.payment_method === m.id ? theme.primaryColor + "08" : "#f8fafc"
                        }}
                      >
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: theme.primaryColor + "15" }}>
                          <m.icon size={24} style={{ color: theme.primaryColor }} />
                        </div>
                        <div className="text-left flex-1">
                          <p className="font-bold text-gray-900">{m.label}</p>
                          <p className="text-xs text-gray-400 font-medium">{m.desc}</p>
                        </div>
                        {orderForm.payment_method === m.id && <CheckCircle size={24} style={{ color: theme.primaryColor }} />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-8 border-t bg-white/80 backdrop-blur-md sticky bottom-0">
                  <button
                    onClick={() => setOrderStep("confirm")}
                    className="w-full py-5 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-orange-500/30 active:scale-[0.98] transition-all"
                    style={{ background: gradientBg }}
                  >
                    {t('order.enter_info')}
                  </button>
                </div>
              </>
            )}

            {orderStep === "confirm" && (
              <>
                <div className="p-6 space-y-4">
                  <h3 className="text-xl font-black mb-4" style={{ color: theme.textColor }}>
                    {t('order.order_info')} ({t('order.optional')})
                  </h3>
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    aria-label={t('order.name')}
                    placeholder={t('order.name')}
                    value={orderForm.customer_name}
                    onChange={(e) => setOrderForm({ ...orderForm, customer_name: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-orange-400 text-sm font-medium border"
                    style={{ backgroundColor: theme.backgroundColor }}
                  />
                  <input
                    type="tel"
                    name="tel"
                    autoComplete="tel"
                    inputMode="numeric"
                    aria-label={t('order.phone')}
                    placeholder={t('order.phone')}
                    value={orderForm.customer_phone}
                    onChange={(e) => setOrderForm({ ...orderForm, customer_phone: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-orange-400 text-sm font-medium border"
                    style={{ backgroundColor: theme.backgroundColor }}
                  />
                  <textarea
                    aria-label={t('order.notes')}
                    placeholder={t('order.notes')}
                    value={orderForm.notes}
                    onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                    rows={2}
                    className="w-full px-5 py-4 rounded-2xl outline-none resize-none focus-visible:ring-2 focus-visible:ring-orange-400 text-sm font-medium border"
                    style={{ backgroundColor: theme.backgroundColor }}
                  />

                  <div className="rounded-2xl p-5" style={{ backgroundColor: theme.backgroundColor }}>
                    <h4 className="font-bold mb-3 text-slate-800">{t('order.summary')}</h4>
                    {cart.map(i => (
                      <div key={i.product_id} className="flex justify-between text-sm py-1">
                        <span style={{ color: theme.textColor + "90" }}>{i.product_name} x {i.quantity}</span>
                        <span className="font-bold text-slate-800">{formatPrice(i.price * i.quantity)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold pt-3 mt-3 border-t" style={{ borderColor: theme.primaryColor + "20" }}>
                      <span style={{ color: theme.textColor }}>{t('order.total_amount')}</span>
                      <span style={{ color: theme.primaryColor }}>{formatPrice(getTotalAmount())}</span>
                    </div>
                  </div>
                </div>

                <div className="p-8 border-t bg-white/80 backdrop-blur-md sticky bottom-0">
                  <button
                    onClick={orderForm.payment_method === "card" ? openPaymentSheet : handleOrder}
                    className="w-full py-5 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-orange-500/30 active:scale-[0.98] transition-all"
                    style={{ background: gradientBg }}
                  >
                    {orderForm.payment_method === "card" ? t('order.pay_now') : t('order.place_order')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 통합 결제 시트 */}
      <PaymentSheet
        isOpen={showPaymentSheet}
        onClose={() => setShowPaymentSheet(false)}
        store={store}
        cart={cart}
        totalAmount={getTotalAmount()}
        onPaymentComplete={handlePaymentComplete}
        userIdentifier={userIdentifier}
      />

      {/* 함께 결제하기(분할 결제) 시트 */}
      <TogetherPaymentSheet
        isOpen={showTogetherSheet}
        onClose={() => setShowTogetherSheet(false)}
        cart={cart}
        totalAmount={getTotalAmount()}
        theme={theme}
        formatPrice={formatPrice}
        socket={ordersAPI.getSocket()}
        tableId={table?.id}
        onConfirm={(splitData) => {
          handlePaymentSplit(splitData);
        }}
      />

      {/* 매니저 호출 시트 및 채팅 드로어 */}
      <ManagerCallSheet
        isOpen={showCallSheet}
        onClose={() => setShowCallSheet(false)}
        store={store}
        table={table}
        onOpenChat={() => setShowChatDrawer(true)}
        onVoiceCall={(type) => {
          const socket = ordersAPI.getSocket();
          if (socket) {
            socket.emit('manager-call', {
              storeId: store.id,
              tableName: table?.name || '포장/비회원',
              type
            });
          }
        }}
      />

      <ChatDrawer
        isOpen={showChatDrawer}
        onClose={() => setShowChatDrawer(false)}
        store={store}
        table={table}
        customerInfo={{ phone: userPhone }}
      />

      {/* 리뷰 작성 모달 연동 */}
      <ReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        order={{
          ...orderSuccess,
          store_id: store?.id,
          store_name: store?.name,
          items: orderSuccess?.items || cart
        }}
        onSuccess={() => {}}
      />

      {/* 예약 섹션 오버레이 */}
      <AnimatePresence>
        {showReservation && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[70] flex items-center justify-center p-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-lg relative"
            >
              <button
                onClick={() => setShowReservation(false)}
                className="absolute -top-12 right-0 text-white/80 hover:text-white flex items-center gap-1 font-bold"
              >
                <X size={24} /> 닫기
              </button>
              <ReservationSection storeId={store.id} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI 스토리텔링 모달 */}
      <MenuStoryModal
        isOpen={showStoryModal}
        onClose={() => setShowStoryModal(false)}
        product={selectedStoryProduct}
        storeName={store?.name}
      />
    </div>
  );
};

export default Menu;
