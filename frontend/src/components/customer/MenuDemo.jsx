import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Star, MapPin, Clock, Megaphone,
  CheckCircle2, RotateCcw, Flame, Sparkles,
  Zap, QrCode, UtensilsCrossed
} from 'lucide-react';
import CategoryTabs from '../menu/CategoryTabs';
import MenuItemCard from '../menu/MenuItemCard';
import CartButton from '../menu/CartButton';
import CartModal from '../menu/CartModal';
import OptionSelectionModal from '../menu/OptionSelectionModal';

// ── 화폐 포맷 ─────────────────────────────────────────────────────────────
const fp = (n) => new Intl.NumberFormat('ko-KR').format(n) + '원';

// ── 데모 매장 정보 ─────────────────────────────────────────────────────────
const STORE = {
  name: '위마켓 시그니처 카페',
  table: 'A-07',
  description: '매일 아침 직접 로스팅한 원두와 제철 재료로 만드는 수제 음료',
  address: '서울 강남구 테헤란로 123',
  hours: '08:00 – 22:00',
  rating: 4.8,
  reviews: 1247,
  announcement: '🎉 6월 한정 시그니처 라떼 300원 할인! 앱 쿠폰 적용 시 추가 혜택',
};

// ── 옵션 프리셋 ───────────────────────────────────────────────────────────
const TEMP = {
  id: 'temp', name: '온도', is_required: true, max_choices: 1,
  choices: [
    { id: 'hot', name: 'HOT', price_adjustment: 0 },
    { id: 'iced', name: 'ICED', price_adjustment: 0 },
  ],
};
const SIZE = {
  id: 'size', name: '사이즈', is_required: false, max_choices: 1,
  choices: [
    { id: 'reg', name: 'Regular', price_adjustment: 0 },
    { id: 'lg', name: 'Large', price_adjustment: 500 },
    { id: 'xl', name: 'Extra Large', price_adjustment: 1000 },
  ],
};
const SYRUP = {
  id: 'syrup', name: '시럽 추가', is_required: false, max_choices: 1,
  choices: [
    { id: 'none', name: '없음', price_adjustment: 0 },
    { id: 'vanilla', name: '바닐라', price_adjustment: 300 },
    { id: 'caramel', name: '캐러멜', price_adjustment: 300 },
    { id: 'hazelnut', name: '헤이즐넛', price_adjustment: 300 },
  ],
};

// ── 카테고리 ──────────────────────────────────────────────────────────────
const CATS = ['전체', '🌟 시그니처', '☕ 커피', '🍵 논커피', '🍋 에이드', '🍰 디저트', '🥐 푸드'];
const CAT_KEYS = ['all', 'signature', 'coffee', 'non-coffee', 'ade', 'dessert', 'food'];

// ── 상품 데이터 ───────────────────────────────────────────────────────────
const PRODUCTS = [
  /* ── 시그니처 ── */
  {
    id: 1, cat: 'signature', name: '위마켓 시그니처 라떼', price: 6500,
    description: '달콤한 캐러멜과 직접 로스팅한 에스프레소의 완벽한 조화',
    image_url: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400&auto=format&fit=crop',
    isPopular: true, isNew: false, isSoldOut: false,
    options: [TEMP, SIZE, SYRUP],
  },
  {
    id: 2, cat: 'signature', name: '오렌지 블라썸', price: 7000,
    description: '상큼한 오렌지 제스트와 얼그레이가 어우러진 시그니처 음료',
    image_url: 'https://images.unsplash.com/photo-1600718374662-0483d2b9da44?w=400&auto=format&fit=crop',
    isPopular: true, isNew: true, isSoldOut: false,
    options: [TEMP],
  },
  {
    id: 3, cat: 'signature', name: '블랙 세서미 라떼', price: 6800,
    description: '국내산 흑임자와 오트밀크의 고소하고 부드러운 조화',
    image_url: 'https://images.unsplash.com/photo-1577961046272-3a87cd5ccf5a?w=400&auto=format&fit=crop',
    isPopular: false, isNew: true, isSoldOut: false,
    options: [TEMP, SIZE],
  },
  /* ── 커피 ── */
  {
    id: 4, cat: 'coffee', name: '에스프레소 더블', price: 4000,
    description: '당일 로스팅 원두를 직접 추출한 진한 에스프레소',
    image_url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&auto=format&fit=crop',
    isPopular: false, isNew: false, isSoldOut: false,
    options: [],
  },
  {
    id: 5, cat: 'coffee', name: '아메리카노', price: 4500,
    description: '깊고 진한 에스프레소의 풍미를 그대로',
    image_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&auto=format&fit=crop',
    isPopular: true, isNew: false, isSoldOut: false,
    options: [TEMP, SIZE],
  },
  {
    id: 6, cat: 'coffee', name: '바닐라 라떼', price: 5500,
    description: '마다가스카르산 바닐라빈이 들어간 부드러운 라떼',
    image_url: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&auto=format&fit=crop',
    isPopular: false, isNew: false, isSoldOut: false,
    options: [TEMP, SIZE, SYRUP],
  },
  {
    id: 7, cat: 'coffee', name: '콜드브루 아인슈패너', price: 6000,
    description: '12시간 냉침 추출 콜드브루 위에 풍성한 생크림',
    image_url: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&auto=format&fit=crop',
    isPopular: true, isNew: false, isSoldOut: false,
    options: [SIZE],
  },
  /* ── 논커피 ── */
  {
    id: 8, cat: 'non-coffee', name: '말차 라떼', price: 5500,
    description: '교토산 최상급 말차와 우유의 깊고 진한 맛',
    image_url: 'https://images.unsplash.com/photo-1515823662972-da6a2ab5cfd0?w=400&auto=format&fit=crop',
    isPopular: true, isNew: false, isSoldOut: false,
    options: [TEMP, SIZE],
  },
  {
    id: 9, cat: 'non-coffee', name: '초코 라떼', price: 5500,
    description: '벨기에산 다크초콜릿과 우유의 달콤한 조화',
    image_url: 'https://images.unsplash.com/photo-1548254853-b985b3fa0fb5?w=400&auto=format&fit=crop',
    isPopular: false, isNew: false, isSoldOut: false,
    options: [TEMP, SIZE],
  },
  {
    id: 10, cat: 'non-coffee', name: '얼 그레이 밀크티', price: 5500,
    description: '고급 얼그레이 잎을 우려낸 진한 밀크티',
    image_url: 'https://images.unsplash.com/photo-1593502560432-dcf2cb5e8fd4?w=400&auto=format&fit=crop',
    isPopular: false, isNew: true, isSoldOut: false,
    options: [TEMP],
  },
  /* ── 에이드 ── */
  {
    id: 11, cat: 'ade', name: '자몽 에이드', price: 5500,
    description: '상큼한 자몽 과육이 가득한 에이드',
    image_url: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&auto=format&fit=crop',
    isPopular: true, isNew: false, isSoldOut: false,
    options: [SIZE],
  },
  {
    id: 12, cat: 'ade', name: '복숭아 아이스티', price: 5000,
    description: '국내산 백도복숭아로 만든 상큼한 아이스티',
    image_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&auto=format&fit=crop',
    isPopular: false, isNew: false, isSoldOut: true,
    options: [],
  },
  {
    id: 13, cat: 'ade', name: '청포도 에이드', price: 5500,
    description: '싱그러운 청포도와 라임의 상쾌한 에이드',
    image_url: 'https://images.unsplash.com/photo-1560472355-536de3962603?w=400&auto=format&fit=crop',
    isPopular: false, isNew: true, isSoldOut: false,
    options: [SIZE],
  },
  /* ── 디저트 ── */
  {
    id: 14, cat: 'dessert', name: '크렘 브륄레 타르트', price: 6500,
    description: '바삭한 타르트 위에 부드러운 커스터드 크림',
    image_url: 'https://images.unsplash.com/photo-1519915028121-7d3463d5b1ff?w=400&auto=format&fit=crop',
    isPopular: true, isNew: false, isSoldOut: false,
    options: [],
  },
  {
    id: 15, cat: 'dessert', name: '뉴욕 치즈케이크', price: 7500,
    description: '뉴욕 스타일의 진한 치즈케이크 한 조각',
    image_url: 'https://images.unsplash.com/photo-1567327613485-fbc7bf196198?w=400&auto=format&fit=crop',
    isPopular: false, isNew: false, isSoldOut: false,
    options: [],
  },
  {
    id: 16, cat: 'dessert', name: '티라미수', price: 7000,
    description: '정통 이탈리안 레시피의 마스카포네 티라미수',
    image_url: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400&auto=format&fit=crop',
    isPopular: false, isNew: false, isSoldOut: false,
    options: [],
  },
  /* ── 푸드 ── */
  {
    id: 17, cat: 'food', name: '크로아상 샌드위치', price: 7000,
    description: '버터향 가득한 크로아상에 에그 마요와 베이컨',
    image_url: 'https://images.unsplash.com/photo-1509722747041-616f39b57ef3?w=400&auto=format&fit=crop',
    isPopular: true, isNew: false, isSoldOut: false,
    options: [],
  },
  {
    id: 18, cat: 'food', name: '아보카도 토스트', price: 8000,
    description: '통밀 사워도우에 아보카도 스프레드와 수란',
    image_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&auto=format&fit=crop',
    isPopular: false, isNew: true, isSoldOut: false,
    options: [],
  },
];

const POPULAR = PRODUCTS.filter((p) => p.isPopular && !p.isSoldOut).slice(0, 4);

// ── 장바구니 더미 아이템 생성 helper ─────────────────────────────────────
const makeCartId = () => `cart-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────
const MenuDemo = () => {
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [optionItem, setOptionItem] = useState(null);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [waitTime, setWaitTime] = useState(12);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const topRef = useRef(null);

  // 카테고리 변경 시 최상단 스크롤
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedCategory]);

  // 주문 완료 후 대기 시간 카운트다운
  useEffect(() => {
    if (!orderSuccess) return;
    if (waitTime <= 0) return;
    const id = setInterval(() => setWaitTime((t) => t - 1), 60000);
    return () => clearInterval(id);
  }, [orderSuccess, waitTime]);

  // ── 상품 필터 ──────────────────────────────────────────────────────────
  const filtered = selectedCategory === '전체'
    ? PRODUCTS
    : PRODUCTS.filter((p) => {
        const idx = CATS.indexOf(selectedCategory);
        return p.cat === CAT_KEYS[idx];
      });

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  // ── 장바구니 핸들러 ─────────────────────────────────────────────────────
  const handleAddToCart = (item) => {
    if (item.isSoldOut) return;
    if (item.options?.length > 0) {
      setOptionItem(item);
    } else {
      addDirect(item, 1, [], item.price);
    }
  };

  const addDirect = (item, qty, opts, unitPrice) => {
    setCart((prev) => [...prev, { cartItemId: makeCartId(), menuItem: item, quantity: qty, selectedOptions: opts, unitPrice }]);
  };

  const handleOptionConfirm = (qty, opts, total) => {
    if (!optionItem) return;
    addDirect(optionItem, qty, opts, total / qty);
    setOptionItem(null);
  };

  const updateQuantity = (cartItemId, delta) => {
    setCart((prev) =>
      prev.map((i) => i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + delta } : i)
          .filter((i) => i.quantity > 0)
    );
  };

  // ── 주문 ────────────────────────────────────────────────────────────────
  const handleOrder = () => {
    if (cart.length === 0) return;
    setIsOrdering(true);
    setTimeout(() => {
      const num = 'DM-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      setOrderSuccess({ number: num, total: totalPrice, items: cart.length });
      setCart([]);
      setIsCartOpen(false);
      setWaitTime(12);
      setIsOrdering(false);
    }, 1400);
  };

  // ── 주문 완료 화면 ───────────────────────────────────────────────────────
  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-6">
        {/* 배경 파티클 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-orange-400/30"
              initial={{ opacity: 0, scale: 0, x: '50vw', y: '50vh' }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0],
                x: `${Math.random() * 100}vw`,
                y: `${Math.random() * 100}vh`,
              }}
              transition={{ duration: 1.8, delay: i * 0.08, ease: 'easeOut' }}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className="relative w-full max-w-sm"
        >
          {/* 카드 */}
          <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden">
            {/* 상단 그라디언트 배너 */}
            <div className="bg-gradient-to-br from-orange-400 to-rose-500 px-8 pt-10 pb-14 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2, stiffness: 200 }}
                className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center shadow-xl shadow-rose-500/30"
              >
                <CheckCircle2 className="w-10 h-10 text-orange-500" strokeWidth={2.5} />
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="text-white font-black text-2xl mt-5 tracking-tight"
              >
                주문 완료!
              </motion.p>
              <p className="text-white/70 text-sm mt-1">{STORE.name} · {STORE.table}번 테이블</p>
            </div>

            {/* 정보 영역 */}
            <div className="-mt-8 mx-5">
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-5 space-y-4">
                {/* 주문번호 */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">주문번호</span>
                  <span className="text-base font-black text-slate-900 tracking-wider">{orderSuccess.number}</span>
                </div>
                <div className="h-px bg-slate-100" />
                {/* 결제금액 */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">결제금액</span>
                  <span className="text-xl font-black text-orange-500">{fp(orderSuccess.total)}</span>
                </div>
                <div className="h-px bg-slate-100" />
                {/* 예상 대기 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                    <Clock size={12} /> 예상 대기
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-black text-slate-900">{waitTime}</span>
                    <span className="text-sm font-bold text-slate-400">분</span>
                  </div>
                </div>
              </div>
            </div>

            {/* QR 코드 영역 */}
            <div className="mx-5 mt-4 p-5 bg-slate-50 rounded-2xl flex items-center gap-4">
              <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center">
                <QrCode className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900">주문 현황 QR</p>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">카운터에서 스캔하면<br />주문 상태를 확인할 수 있어요</p>
              </div>
            </div>

            {/* 데모 모드 안내 */}
            <div className="mx-5 mt-3 mb-5 p-3 bg-indigo-50 rounded-xl flex items-center gap-2">
              <Zap size={14} className="text-indigo-400 flex-shrink-0" />
              <p className="text-[11px] text-indigo-600 font-bold">데모 모드 — 실제 주문이 전송되지 않습니다</p>
            </div>

            {/* 버튼 */}
            <div className="px-5 pb-7 space-y-3">
              <button
                onClick={() => setOrderSuccess(null)}
                className="w-full h-14 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-black rounded-2xl text-sm shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} /> 추가 주문하기
              </button>
              <Link
                to="/"
                className="block w-full h-12 bg-slate-100 text-slate-600 font-black rounded-2xl text-sm flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                홈으로 돌아가기
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── 메인 메뉴 화면 ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 pb-28" ref={topRef}>

      {/* 공지사항 */}
      <AnimatePresence>
        {showAnnouncement && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-2.5 flex items-center gap-2">
              <Megaphone size={14} className="text-amber-900 flex-shrink-0" />
              <p className="text-xs font-bold text-amber-900 flex-1 leading-tight">{STORE.announcement}</p>
              <button
                onClick={() => setShowAnnouncement(false)}
                className="text-amber-900/60 hover:text-amber-900 transition-colors text-lg leading-none"
              >×</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="px-4 h-16 flex items-center gap-3">
          <Link to="/" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-slate-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-black text-slate-900 leading-tight">{STORE.name}</h1>
            <p className="text-xs font-bold" style={{ color: '#f97316' }}>{STORE.table}번 테이블</p>
          </div>
          {/* 데모 배지 */}
          <span className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">
            <Zap size={10} /> DEMO
          </span>
        </div>
      </header>

      {/* 매장 정보 배너 */}
      <div className="bg-white border-b border-slate-100 px-4 py-4">
        <p className="text-sm text-slate-600 leading-relaxed">{STORE.description}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5 text-[12px] text-slate-400">
          <div className="flex items-center gap-1">
            <MapPin size={12} />{STORE.address}
          </div>
          <div className="flex items-center gap-1">
            <Clock size={12} />{STORE.hours}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-black text-emerald-600">영업 중</span>
          </div>
          <div className="flex items-center gap-1 text-[12px] font-bold text-slate-500">
            <Star size={11} className="fill-amber-400 text-amber-400" />
            {STORE.rating}
            <span className="text-slate-300 font-normal">({STORE.reviews.toLocaleString()})</span>
          </div>
        </div>
      </div>

      {/* 카테고리 탭 */}
      <CategoryTabs
        categories={CATS}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* 인기 메뉴 가로 스크롤 (전체 카테고리일 때만) */}
      <AnimatePresence>
        {selectedCategory === '전체' && (
          <motion.section
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="bg-white border-b border-slate-100 py-5"
          >
            <div className="px-4 flex items-center gap-2 mb-3">
              <Flame size={16} className="text-orange-500 fill-orange-500" />
              <h2 className="text-sm font-black text-slate-900">지금 인기 메뉴</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar">
              {POPULAR.map((item) => (
                <motion.button
                  key={item.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleAddToCart(item)}
                  className="min-w-[130px] flex-shrink-0 bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all text-left"
                >
                  <div className="h-24 overflow-hidden bg-slate-50">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-[11px] font-black text-slate-900 leading-tight line-clamp-2">{item.name}</p>
                    <p className="text-[11px] font-black text-orange-500 mt-1">{fp(item.price)}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* 상품 목록 */}
      <div className="px-4 py-5 space-y-3">
        {/* 섹션 헤더 */}
        {selectedCategory !== '전체' && (
          <div className="flex items-center gap-2 mb-4">
            <UtensilsCrossed size={14} className="text-slate-400" />
            <h2 className="text-sm font-black text-slate-700">{selectedCategory}</h2>
            <span className="text-xs text-slate-300 font-bold">({filtered.length})</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={selectedCategory}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="space-y-3"
          >
            {filtered.map((item) => (
              <div key={item.id} className="relative">
                <MenuItemCard
                  item={item}
                  hasOptions={item.options?.length > 0}
                  isPopular={item.isPopular}
                  isNew={item.isNew}
                  onAddToCart={handleAddToCart}
                  disabled={item.isSoldOut}
                />
                {item.isSoldOut && (
                  <div className="absolute top-3 right-3 px-2.5 py-1 bg-slate-900/80 text-white text-[10px] font-black rounded-full tracking-widest">
                    SOLD OUT
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🍽️</div>
            <p className="text-slate-400 font-bold">메뉴가 없습니다</p>
          </div>
        )}
      </div>

      {/* 장바구니 버튼 */}
      <CartButton
        totalItems={totalItems}
        totalPrice={totalPrice}
        onClick={() => setIsCartOpen(true)}
      />

      {/* 장바구니 모달 */}
      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={updateQuantity}
        onOrder={handleOrder}
        isOrdering={isOrdering}
        totalPrice={totalPrice}
      />

      {/* 옵션 선택 모달 */}
      {optionItem && (
        <OptionSelectionModal
          key={optionItem.id}
          isOpen={!!optionItem}
          onClose={() => setOptionItem(null)}
          onConfirm={handleOptionConfirm}
          item={optionItem}
          optionGroups={optionItem.options}
        />
      )}
    </div>
  );
};

export default MenuDemo;
