import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Star, MapPin, Clock, Megaphone,
  CheckCircle2, RotateCcw, Zap, QrCode,
  UtensilsCrossed, Link2, Gift,
  ShieldCheck, Wifi, Scan, Flame, Globe,
} from 'lucide-react';
import CategoryTabs from '../menu/CategoryTabs';
import MenuItemCard from '../menu/MenuItemCard';
import CartButton from '../menu/CartButton';
import CartModal from '../menu/CartModal';
import OptionSelectionModal from '../menu/OptionSelectionModal';
import TinkerBell from '../ai/TinkerBell';
import { loadTinkerBellSettings } from '../../utils/tinkerbell';

const DEMO_LANGS = [
  { code: 'ko', flag: '🇰🇷', label: 'KO' },
  { code: 'en', flag: '🇺🇸', label: 'EN' },
  { code: 'ja', flag: '🇯🇵', label: 'JA' },
  { code: 'zh', flag: '🇨🇳', label: 'ZH' },
];

const fp = n => new Intl.NumberFormat('ko-KR').format(n) + '원';
const makeCartId = () => `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// ── 데모 매장 ──────────────────────────────────────────────────────────────
const STORE = {
  name: '위마켓 시그니처 카페',
  table: 'A-07',
  desc: '매일 아침 직접 로스팅한 원두와 제철 재료로 만드는 수제 음료',
  address: '서울 강남구 테헤란로 123',
  hours: '08:00 – 22:00',
  rating: 4.8, reviews: 1247,
  notice: '🎉 6월 한정 시그니처 라떼 300원 할인! 앱 쿠폰 적용 시 추가 혜택',
};

// ── 옵션 그룹 ──────────────────────────────────────────────────────────────
const TEMP = { id:'temp', name:'온도', is_required:true, max_choices:1, choices:[{id:'hot',name:'HOT',price_adjustment:0},{id:'iced',name:'ICED',price_adjustment:0}] };
const SIZE = { id:'size', name:'사이즈', is_required:false, max_choices:1, choices:[{id:'reg',name:'Regular',price_adjustment:0},{id:'lg',name:'Large',price_adjustment:500}] };
const SYRUP = { id:'syrup', name:'시럽', is_required:false, max_choices:1, choices:[{id:'none',name:'없음',price_adjustment:0},{id:'vanilla',name:'바닐라',price_adjustment:300},{id:'caramel',name:'캐러멜',price_adjustment:300}] };

// ── 카테고리 ───────────────────────────────────────────────────────────────
const CATS = ['전체','🌟 시그니처','☕ 커피','🍵 논커피','🍋 에이드','🍰 디저트','🥐 푸드'];
const CAT_KEYS = ['all','signature','coffee','non-coffee','ade','dessert','food'];

// ── 상품 목록 ──────────────────────────────────────────────────────────────
const PRODUCTS = [
  { id:1,  cat:'signature',  name:'위마켓 시그니처 라떼',   price:6500, description:'달콤한 캐러멜과 직접 로스팅한 에스프레소의 완벽한 조화',   image_url:'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400&auto=format&fit=crop', isPopular:true,  isNew:false, isSoldOut:false, options:[TEMP,SIZE,SYRUP] },
  { id:2,  cat:'signature',  name:'오렌지 블라썸',           price:7000, description:'상큼한 오렌지 제스트와 얼그레이가 어우러진 시그니처 음료',   image_url:'https://images.unsplash.com/photo-1600718374662-0483d2b9da44?w=400&auto=format&fit=crop', isPopular:true,  isNew:true,  isSoldOut:false, options:[TEMP] },
  { id:3,  cat:'signature',  name:'블랙 세서미 라떼',        price:6800, description:'국내산 흑임자와 오트밀크의 고소하고 부드러운 조화',          image_url:'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&auto=format&fit=crop', isPopular:false, isNew:true,  isSoldOut:false, options:[TEMP,SIZE] },
  { id:4,  cat:'coffee',     name:'에스프레소 더블',         price:4000, description:'당일 로스팅 원두를 직접 추출한 진한 에스프레소',             image_url:'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&auto=format&fit=crop', isPopular:false, isNew:false, isSoldOut:false, options:[] },
  { id:5,  cat:'coffee',     name:'아메리카노',              price:4500, description:'깊고 진한 에스프레소의 풍미를 그대로',                        image_url:'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&auto=format&fit=crop', isPopular:true,  isNew:false, isSoldOut:false, options:[TEMP,SIZE] },
  { id:6,  cat:'coffee',     name:'바닐라 라떼',             price:5500, description:'마다가스카르산 바닐라빈이 들어간 부드러운 라떼',               image_url:'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&auto=format&fit=crop', isPopular:false, isNew:false, isSoldOut:false, options:[TEMP,SIZE,SYRUP] },
  { id:7,  cat:'coffee',     name:'콜드브루 아인슈패너',     price:6000, description:'12시간 냉침 추출 콜드브루 위에 풍성한 생크림',               image_url:'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&auto=format&fit=crop', isPopular:true,  isNew:false, isSoldOut:false, options:[SIZE] },
  { id:8,  cat:'non-coffee', name:'말차 라떼',               price:5500, description:'교토산 최상급 말차와 우유의 깊고 진한 맛',                    image_url:'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&auto=format&fit=crop', isPopular:true,  isNew:false, isSoldOut:false, options:[TEMP,SIZE] },
  { id:9,  cat:'non-coffee', name:'초코 라떼',               price:5500, description:'벨기에산 다크초콜릿과 우유의 달콤한 조화',                    image_url:'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=400&auto=format&fit=crop', isPopular:false, isNew:false, isSoldOut:false, options:[TEMP,SIZE] },
  { id:10, cat:'non-coffee', name:'얼 그레이 밀크티',        price:5500, description:'고급 얼그레이 잎을 우려낸 진한 밀크티',                       image_url:'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop', isPopular:false, isNew:true,  isSoldOut:false, options:[TEMP] },
  { id:11, cat:'ade',        name:'자몽 에이드',             price:5500, description:'상큼한 자몽 과육이 가득한 에이드',                            image_url:'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&auto=format&fit=crop', isPopular:true,  isNew:false, isSoldOut:false, options:[SIZE] },
  { id:12, cat:'ade',        name:'복숭아 아이스티',         price:5000, description:'국내산 백도복숭아로 만든 상큼한 아이스티',                     image_url:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&auto=format&fit=crop', isPopular:false, isNew:false, isSoldOut:true,  options:[] },
  { id:13, cat:'ade',        name:'청포도 에이드',           price:5500, description:'싱그러운 청포도와 라임의 상쾌한 에이드',                       image_url:'https://images.unsplash.com/photo-1560472355-536de3962603?w=400&auto=format&fit=crop', isPopular:false, isNew:true,  isSoldOut:false, options:[SIZE] },
  { id:14, cat:'dessert',    name:'크렘 브륄레 타르트',     price:6500, description:'바삭한 타르트 위에 부드러운 커스터드 크림',                     image_url:'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=400&auto=format&fit=crop', isPopular:true,  isNew:false, isSoldOut:false, options:[] },
  { id:15, cat:'dessert',    name:'뉴욕 치즈케이크',        price:7500, description:'뉴욕 스타일의 진한 치즈케이크 한 조각',                         image_url:'https://images.unsplash.com/photo-1567327613485-fbc7bf196198?w=400&auto=format&fit=crop', isPopular:false, isNew:false, isSoldOut:false, options:[] },
  { id:16, cat:'dessert',    name:'티라미수',               price:7000, description:'정통 이탈리안 레시피의 마스카포네 티라미수',                    image_url:'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400&auto=format&fit=crop', isPopular:false, isNew:false, isSoldOut:false, options:[] },
  { id:17, cat:'food',       name:'크로아상 샌드위치',       price:7000, description:'버터향 가득한 크로아상에 에그 마요와 베이컨',                   image_url:'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&auto=format&fit=crop', isPopular:true,  isNew:false, isSoldOut:false, options:[] },
  { id:18, cat:'food',       name:'아보카도 토스트',         price:8000, description:'통밀 사워도우에 아보카도 스프레드와 수란',                      image_url:'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&auto=format&fit=crop', isPopular:false, isNew:true,  isSoldOut:false, options:[] },
];
const POPULAR = PRODUCTS.filter(p => p.isPopular && !p.isSoldOut).slice(0, 4);

// ── 동석자 시나리오 ────────────────────────────────────────────────────────
const TABLEMATES = [
  { name:'김민준', avatar:'M', color:'#f97316', emoji:'☕', item:'아메리카노', price:4500,  delay:22000 },
  { name:'박지수', avatar:'J', color:'#8b5cf6', emoji:'🥐', item:'크로아상 샌드위치', price:7000, delay:38000 },
];

// ── 시스템 모니터 패널 (외부 컴포넌트 — 리렌더 시 안정적) ────────────────────
const MonitorPanel = ({ logs, uuidTyped, sessionId, screen, sharedItems, orderData, countdown, signupDone }) => {
  const logEndRef = useRef(null);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  return (
    <div className="hidden md:flex w-80 lg:w-96 bg-slate-950 flex-col flex-shrink-0 h-screen sticky top-0">
      {/* 제목 표시줄 */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <span className="text-slate-400 text-xs font-mono ml-2">wemarket — system monitor</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-[10px] font-mono">LIVE</span>
        </div>
      </div>

      {/* 세션 정보 */}
      <div className="px-5 py-4 border-b border-slate-800 space-y-2">
        <div className="flex justify-between text-[11px] font-mono">
          <span className="text-slate-500">TABLE</span>
          <span className="text-amber-400">{STORE.table}</span>
        </div>
        <div className="flex justify-between text-[11px] font-mono">
          <span className="text-slate-500">STATUS</span>
          <span className={
            screen === 'entry'   ? 'text-yellow-400' :
            screen === 'menu'    ? 'text-emerald-400' :
            screen === 'success' ? 'text-sky-400' : 'text-purple-400'
          }>
            {screen === 'entry' ? 'WAITING' : screen === 'menu' ? 'ACTIVE' : screen === 'success' ? 'ORDERED' : 'REGISTERED'}
          </span>
        </div>
        {uuidTyped && (
          <div className="flex flex-col gap-0.5 text-[10px] font-mono">
            <span className="text-slate-500">SESSION_ID</span>
            <span className="text-purple-400 break-all leading-relaxed">
              {uuidTyped}
              {uuidTyped.length < sessionId.length && <span className="animate-pulse text-purple-300">█</span>}
            </span>
          </div>
        )}
      </div>

      {/* 로그 스트림 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1.5 font-mono text-[11px]">
        {logs.map(log => (
          <motion.div key={log.id}
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            className={
              log.type === 'success'   ? 'text-emerald-400' :
              log.type === 'uuid'      ? 'text-purple-400 break-all' :
              log.type === 'highlight' ? 'text-amber-300 font-bold' :
              log.type === 'event'     ? 'text-sky-400' :
              log.type === 'idle'      ? 'text-slate-600' :
              'text-slate-400'
            }>
            {log.text}
          </motion.div>
        ))}
        <div ref={logEndRef} />
      </div>

      {/* 공유 장바구니 현황 */}
      {screen === 'menu' && sharedItems.length > 0 && (
        <div className="px-5 py-4 border-t border-slate-800">
          <p className="text-slate-500 text-[10px] font-mono mb-2">SHARED_CART</p>
          {sharedItems.map(item => (
            <div key={item.cartItemId} className="flex justify-between text-[11px] font-mono text-sky-400">
              <span>{item.fromTablemate}: {item.menuItem.name}</span>
              <span>+{fp(item.unitPrice)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 포인트 상태 */}
      {screen === 'success' && orderData && (
        <div className="px-5 py-4 border-t border-slate-800">
          <p className="text-slate-500 text-[10px] font-mono mb-2">POINTS_STATUS</p>
          <div className="flex justify-between text-[11px] font-mono">
            <span className="text-slate-400">EARNED</span>
            <span className="text-amber-400">{orderData.points}P</span>
          </div>
          <div className="flex justify-between text-[11px] font-mono mt-1">
            <span className="text-slate-400">EXPIRY_IN</span>
            <span className={countdown < 15 ? 'text-red-400 animate-pulse' : 'text-yellow-400'}>{countdown}s</span>
          </div>
          <div className="flex justify-between text-[11px] font-mono mt-1">
            <span className="text-slate-400">CONVERTED</span>
            <span className={signupDone ? 'text-emerald-400' : 'text-red-400'}>{signupDone ? 'YES' : 'NO'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
const MenuDemo = () => {
  const [screen, setScreen] = useState('entry');

  // 세션 UUID
  const [sessionId] = useState(() => {
    const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
    return `${h()}${h()}-${h()}-${h()}-${h()}-${h()}${h()}${h()}`;
  });

  // 시스템 모니터
  const [logs, setLogs] = useState([
    { id: 0, text: '> WeMarket POS v3.2.1', type: 'system' },
    { id: 1, text: '> 대기 중 — QR 스캔을 기다리는 중...', type: 'idle' },
  ]);
  const [uuidTyped, setUuidTyped] = useState('');
  const [scanClicked, setScanClicked] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);

  // 팅커벨 AI 도우미 — 저장된 설정(음성 안내 기본 ON 등) 반영
  const [tbSettings] = useState(loadTinkerBellSettings);
  const [tbLang,         setTbLang]         = useState(tbSettings.lang || 'ko');
  const [tbLastAdded,    setTbLastAdded]    = useState(null);
  const [showLangPicker, setShowLangPicker] = useState(false);

  // 메뉴 / 장바구니
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [cart, setCart] = useState([]);
  const [sharedItems, setSharedItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [optionItem, setOptionItem] = useState(null);
  const [showNotice, setShowNotice] = useState(true);
  const [toasts, setToasts] = useState([]);
  const topRef = useRef(null);

  // 주문 완료
  const [orderData, setOrderData] = useState(null);
  const [countdown, setCountdown] = useState(60);
  const [phone, setPhone] = useState('010-9999-1234');
  const [signupDone, setSignupDone] = useState(false);
  const [confetti, setConfetti] = useState([]);

  const addLog = (text, type = 'info') =>
    setLogs(prev => [...prev.slice(-30), { id: Date.now() + Math.random(), text, type }]);

  // 스크롤 투 탑 (카테고리 변경 시)
  useEffect(() => { topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [selectedCategory]);

  // 동석자 자동 주문 (메뉴 화면 진입 후 실행)
  useEffect(() => {
    if (screen !== 'menu') return;
    const timers = TABLEMATES.map(ev => setTimeout(() => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, ...ev }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
      setSharedItems(prev => [...prev, {
        cartItemId: `shared-${id}`,
        menuItem: { id: id, name: ev.item, price: ev.price },
        quantity: 1, selectedOptions: [], unitPrice: ev.price,
        fromTablemate: ev.name,
      }]);
      addLog(`[공유] ${ev.name} → "${ev.item}" 추가`, 'event');
    }, ev.delay));
    return () => timers.forEach(clearTimeout);
  }, [screen]);

  // 포인트 카운트다운
  useEffect(() => {
    if (screen !== 'success' || signupDone || countdown <= 0) return;
    const id = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(id);
  }, [screen, signupDone, countdown]);

  // ── QR 스캔 (ZFO) ──────────────────────────────────────────────────────
  const handleScan = () => {
    if (scanClicked) return;
    setScanClicked(true);
    let i = 0;
    const iv = setInterval(() => { i++; setUuidTyped(sessionId.slice(0, i)); if (i >= sessionId.length) clearInterval(iv); }, 35);
    const seq = [
      [100,  '> QR 스캔 감지됨 ✓', 'success'],
      [400,  '> 세션 초기화 중...', 'system'],
      [900,  `> UUID 생성: ${sessionId}`, 'uuid'],
      [1400, '> 임시 장바구니 할당 중...', 'system'],
      [1800, '> CART_ALLOCATED ✓', 'success'],
      [2100, '> 공유 오더 세션 활성화...', 'system'],
      [2500, '> SHARED_ORDER_ACTIVE ✓', 'success'],
      [2900, '> ZERO_FRICTION_COMPLETE ✓', 'highlight'],
    ];
    seq.forEach(([delay, text, type]) => setTimeout(() => addLog(text, type), delay));
    setTimeout(() => setScanComplete(true), 3000);
    setTimeout(() => setScreen('menu'), 3400);
  };

  // ── 장바구니 ────────────────────────────────────────────────────────────
  const handleAddToCart = item => {
    if (item.isSoldOut) return;
    if (item.options?.length > 0) { setOptionItem(item); return; }
    setCart(prev => [...prev, { cartItemId: makeCartId(), menuItem: item, quantity: 1, selectedOptions: [], unitPrice: item.price }]);
    setTbLastAdded({ name: item.name, id: item.id });
    setTimeout(() => setTbLastAdded(null), 80);
  };
  const handleOptionConfirm = (qty, opts, total) => {
    if (!optionItem) return;
    setCart(prev => [...prev, { cartItemId: makeCartId(), menuItem: optionItem, quantity: qty, selectedOptions: opts, unitPrice: Math.round(total / qty) }]);
    setTbLastAdded({ name: optionItem.name, id: optionItem.id });
    setTimeout(() => setTbLastAdded(null), 80);
    setOptionItem(null);
  };
  const updateQuantity = (cartItemId, delta) => {
    setCart(prev => prev.map(i => i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + delta } : i).filter(i => i.quantity > 0));
  };

  // ── 주문 ────────────────────────────────────────────────────────────────
  const handleOrder = () => {
    const all = [...cart, ...sharedItems];
    if (all.length === 0) return;
    setIsOrdering(true);
    addLog('> 주문 데이터 전송 중...', 'system');
    setTimeout(() => {
      const total = all.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const points = Math.floor(total * 0.02);
      const num = 'WM-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      setOrderData({ number: num, total, points });
      setCart([]); setSharedItems([]); setIsCartOpen(false); setIsOrdering(false);
      setCountdown(60); setSignupDone(false);
      addLog(`> 주문 ${num} 접수 완료 ✓`, 'success');
      addLog(`> 포인트 ${points}P 소멸 타이머 시작...`, 'event');
      setScreen('success');
    }, 1400);
  };

  // ── 회원가입 ────────────────────────────────────────────────────────────
  const handleSignup = () => {
    if (signupDone || !phone) return;
    setSignupDone(true);
    setConfetti(Array.from({ length: 22 }, (_, i) => ({
      id: i, x: Math.random() * 100, color: ['#f97316','#8b5cf6','#10b981','#3b82f6','#f59e0b'][i % 5],
    })));
    addLog(`> 회원가입: ${phone}`, 'system');
    addLog(`> 포인트 ${orderData.points}P 계정 귀속 ✓`, 'success');
    addLog('> RETENTION_CONVERSION: SUCCESS ✓', 'highlight');
  };

  // ── 파생 값 ─────────────────────────────────────────────────────────────
  const filtered = selectedCategory === '전체'
    ? PRODUCTS
    : PRODUCTS.filter(p => p.cat === CAT_KEYS[CATS.indexOf(selectedCategory)]);
  const totalItems = [...cart, ...sharedItems].reduce((s, i) => s + i.quantity, 0);
  const totalPrice = [...cart, ...sharedItems].reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  // ════════════════════════════════════════════════════════════
  //  단일 리턴 — 화면별 조건부 렌더링
  // ════════════════════════════════════════════════════════════
  return (
    <div className="flex min-h-screen bg-slate-100">

      {/* ── 시스템 모니터 (항상 표시, 외부 컴포넌트로 안정적) ── */}
      <MonitorPanel
        logs={logs} uuidTyped={uuidTyped} sessionId={sessionId}
        screen={screen} sharedItems={sharedItems}
        orderData={orderData} countdown={countdown} signupDone={signupDone}
      />

      {/* ── 고객 UI 영역 ── */}
      <div className="flex-1 flex flex-col items-center justify-start relative">

        <AnimatePresence mode="wait">

          {/* ────────────────── SCREEN: entry ────────────────── */}
          {screen === 'entry' && (
            <motion.div key="entry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex flex-col items-center justify-center min-h-screen p-4 relative">
              {/* 스캔 성공 오버레이 */}
              <AnimatePresence>
                {scanComplete && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-[2.5rem]">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      className="w-28 h-28 rounded-full bg-emerald-500 flex items-center justify-center shadow-2xl shadow-emerald-500/40">
                      <CheckCircle2 className="w-14 h-14 text-white" strokeWidth={2.5} />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="w-full max-w-sm bg-white md:rounded-[2.5rem] md:shadow-2xl overflow-hidden">
                {/* 상단 그라디언트 */}
                <div className="bg-gradient-to-br from-orange-500 via-rose-500 to-pink-600 px-6 pt-14 pb-10 text-center relative overflow-hidden">
                  {/* 앰비언트 파티클 */}
                  {[...Array(14)].map((_, i) => (
                    <motion.div key={`p-${i}`}
                      className="absolute rounded-full bg-white/15"
                      style={{
                        width: 2 + (i % 3) * 2,
                        height: 2 + (i % 3) * 2,
                        left: `${4 + (i * 7) % 92}%`,
                        top: `${8 + (i * 11) % 84}%`,
                      }}
                      animate={{ y: [0, -10 - (i % 4) * 6, 0], opacity: [0.1, 0.45, 0.1] }}
                      transition={{ duration: 3.5 + (i % 4) * 1.2, repeat: Infinity, delay: i * 0.35, ease: 'easeInOut' }}
                    />
                  ))}

                  {/* 글로우 스포트라이트 */}
                  <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.3) 0%, transparent 70%)' }}
                    animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  />

                  {/* QR 스캐너 뷰파인더 */}
                  <motion.div className="relative mx-auto mb-6"
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 200, delay: 0.15 }}>
                    <div className="relative w-40 h-40 mx-auto">
                      {/* 코너 브래킷 */}
                      <motion.div className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-white/80 rounded-tl-lg"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
                      <motion.div className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-white/80 rounded-tr-lg"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }} />
                      <motion.div className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-white/80 rounded-bl-lg"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 1 }} />
                      <motion.div className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-white/80 rounded-br-lg"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }} />

                      {/* 스캐닝 빔 */}
                      <motion.div
                        className="absolute left-3 right-3 h-0.5 rounded-full pointer-events-none"
                        style={{
                          background: 'linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.9) 30%, rgba(251,146,60,1) 50%, rgba(251,191,36,0.9) 70%, transparent 100%)',
                          boxShadow: '0 0 8px rgba(251,146,60,0.6), 0 0 20px rgba(251,146,60,0.3)',
                        }}
                        animate={{ top: ['6px', '154px', '6px'] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                      />

                      {/* 뒤쪽 흐린 글로우 */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-28 h-28 bg-orange-400/15 rounded-full blur-3xl" />
                      </div>

                      {/* QR 코드 아이콘 */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/10 shadow-lg">
                          <QrCode className="w-8 h-8 text-white" strokeWidth={1.5} />
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div className="relative" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}>
                    <h1 className="text-2xl font-black text-white tracking-tight">{STORE.name}</h1>
                    <p className="text-white/70 text-sm mt-1 font-bold">테이블 {STORE.table}</p>
                  </motion.div>
                </div>

                {/* 안내 & 버튼 */}
                <div className="px-6 py-8 space-y-6">
                  <div className="space-y-3">
                    {[
                      { icon: <Zap size={14} className="text-amber-500" />, text: '회원가입 없이 바로 주문 가능' },
                      { icon: <ShieldCheck size={14} className="text-emerald-500" />, text: '개인정보 입력 불필요 — 임시 세션 자동 생성' },
                      { icon: <Gift size={14} className="text-purple-500" />, text: '주문 후 포인트 적립 & 손쉬운 가입 연동' },
                    ].map((item, i) => (
                      <motion.div key={i} className="flex items-center gap-3 text-sm text-slate-600 font-medium"
                        initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * i + 0.4 }}>
                        <div className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center flex-shrink-0">{item.icon}</div>
                        {item.text}
                      </motion.div>
                    ))}
                  </div>

                  <motion.button onClick={handleScan} disabled={scanClicked || scanComplete} whileTap={!scanClicked ? { scale: 0.97 } : {}}
                    animate={!scanClicked ? {
                      boxShadow: [
                        '0 4px 14px rgba(249,115,22,0.3), 0 0 0 rgba(249,115,22,0)',
                        '0 8px 25px rgba(249,115,22,0.45), 0 0 18px rgba(249,115,22,0.15)',
                        '0 4px 14px rgba(249,115,22,0.3), 0 0 0 rgba(249,115,22,0)',
                      ],
                    } : {}}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className={`w-full h-16 rounded-2xl font-black text-base flex items-center justify-center gap-3 shadow-lg transition-all duration-300 relative overflow-hidden
                      ${scanClicked || scanComplete
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-orange-500/30 hover:shadow-xl'}`}>
                    {scanClicked ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-1">
                          {[0, 1, 2].map(i => (
                            <motion.div key={i}
                              className="w-2 h-5 bg-slate-400 rounded-full"
                              animate={{ height: [5, 16, 5], opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] text-slate-400">세션 초기화 중...</span>
                      </div>
                    ) : (
                      <><Scan size={20} />스캔 완료 — 주문 시작하기</>
                    )}
                    {/* 버튼 상단 하이라이트 */}
                    {!scanClicked && !scanComplete && (
                      <motion.div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      />
                    )}
                  </motion.button>

                  <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 rounded-xl">
                    <Zap size={12} className="text-indigo-400 flex-shrink-0" />
                    <p className="text-[11px] text-indigo-600 font-bold">데모 모드 · 실제 결제 없음</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ────────────────── SCREEN: menu ────────────────── */}
          {screen === 'menu' && (
            <motion.div key="menu" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
              className="w-full md:max-w-[420px] flex flex-col min-h-screen bg-slate-50" ref={topRef}>

              {/* ★ AI 팅커벨 도우미 오버레이 ★ */}
              <TinkerBell
                lang={tbLang}
                weather="sun"
                menuItems={PRODUCTS}
                lastAddedItem={tbLastAdded}
                voiceEnabled={tbSettings.voiceEnabled}
                mode="float"
              />

              {/* 동석자 토스트 */}
              <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
                <AnimatePresence>
                  {toasts.map(t => (
                    <motion.div key={t.id}
                      initial={{ opacity: 0, y: -20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.92 }}
                      className="w-72 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0"
                        style={{ backgroundColor: TABLEMATES.find(tm => tm.name === t.name)?.color || '#64748b' }}>
                        {t.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black">{t.name}님이 담았어요 {t.emoji}</p>
                        <p className="text-[11px] text-slate-400 truncate">{t.item} · {fp(t.price)}</p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* 공지 배너 */}
              <AnimatePresence>
                {showNotice && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-2.5 flex items-center gap-2">
                      <Megaphone size={12} className="text-amber-900 flex-shrink-0" />
                      <p className="text-xs font-bold text-amber-900 flex-1 leading-tight">{STORE.notice}</p>
                      <button onClick={() => setShowNotice(false)} className="text-amber-900/60 hover:text-amber-900 text-lg leading-none">×</button>
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
                  <div className="flex-1 min-w-0">
                    <h1 className="text-base font-black text-slate-900 leading-tight truncate">{STORE.name}</h1>
                    <p className="text-xs font-bold text-orange-500">{STORE.table}번 테이블</p>
                  </div>
                  {/* ★ 언어 선택기 ★ */}
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setShowLangPicker(p => !p)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 transition-colors">
                      <Globe size={12} className="text-slate-500" />
                      <span className="text-[10px] font-black text-slate-600">
                        {DEMO_LANGS.find(l => l.code === tbLang)?.flag} {DEMO_LANGS.find(l => l.code === tbLang)?.label}
                      </span>
                    </button>
                    <AnimatePresence>
                      {showLangPicker && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.94, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.94, y: -4 }}
                          className="absolute right-0 top-9 z-50 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 flex flex-col gap-1 min-w-[100px]">
                          {DEMO_LANGS.map(l => (
                            <button key={l.code}
                              onClick={() => { setTbLang(l.code); setShowLangPicker(false); }}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${tbLang === l.code ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                              <span>{l.flag}</span> {l.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ★ 공유 오더 배지 ★ */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <Link2 size={12} className="text-emerald-600" />
                    <span className="text-[10px] font-black text-emerald-700 hidden sm:inline">공유 오더 ON</span>
                    <div className="flex -space-x-1.5 ml-1">
                      {TABLEMATES.map(tm => (
                        <div key={tm.name} title={tm.name}
                          className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black text-white"
                          style={{ backgroundColor: tm.color }}>
                          {tm.avatar}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 공유 항목 인디케이터 */}
                {sharedItems.length > 0 && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="overflow-hidden bg-emerald-50 border-t border-emerald-100">
                    <div className="px-4 py-2 flex items-center gap-2 text-[11px]">
                      <span className="font-black text-emerald-700">동석자 {sharedItems.reduce((s, i) => s + i.quantity, 0)}개 추가됨</span>
                      <span className="text-emerald-500">— 함께 결제됩니다</span>
                    </div>
                  </motion.div>
                )}
              </header>

              {/* 매장 정보 */}
              <div className="bg-white border-b border-slate-100 px-4 py-3">
                <p className="text-xs text-slate-600 leading-relaxed">{STORE.desc}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1"><MapPin size={12} />{STORE.address}</div>
                  <div className="flex items-center gap-1"><Clock size={12} />{STORE.hours}</div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 rounded-full">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-600">영업 중</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    {STORE.rating}
                    <span className="text-slate-300 font-normal">({STORE.reviews.toLocaleString()})</span>
                  </div>
                </div>
              </div>

              {/* 카테고리 탭 */}
              <CategoryTabs categories={CATS} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />

              {/* 인기 메뉴 */}
              <AnimatePresence>
                {selectedCategory === '전체' && (
                  <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-white border-b border-slate-100 py-5">
                    <div className="px-4 flex items-center gap-2 mb-3">
                      <Flame size={14} className="text-orange-500 fill-orange-500" />
                      <h2 className="text-sm font-black text-slate-900">지금 인기 메뉴</h2>
                    </div>
                    <div className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar">
                      {POPULAR.map(item => (
                        <motion.button key={item.id} whileTap={{ scale: 0.96 }} onClick={() => handleAddToCart(item)}
                          className="min-w-[130px] flex-shrink-0 bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all text-left">
                          <div className="h-24 overflow-hidden bg-slate-50">
                            <img src={item.image_url} alt={item.name} loading="lazy" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
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
              <div className="px-4 py-3 pb-24 space-y-2">
                {selectedCategory !== '전체' && (
                  <div className="flex items-center gap-2 mb-4">
                    <UtensilsCrossed size={14} className="text-slate-400" />
                    <h2 className="text-sm font-black text-slate-700">{selectedCategory}</h2>
                    <span className="text-xs text-slate-300 font-bold">({filtered.length})</span>
                  </div>
                )}
                <AnimatePresence mode="wait">
                  <motion.div key={selectedCategory}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
                    {filtered.map(item => (
                      <div key={item.id} className="relative">
                        <MenuItemCard item={item} hasOptions={item.options?.length > 0}
                          isPopular={item.isPopular} isNew={item.isNew}
                          onAddToCart={handleAddToCart} disabled={item.isSoldOut} />
                        {item.isSoldOut && (
                          <div className="absolute top-3 right-3 px-2.5 py-1 bg-slate-900/80 text-white text-[10px] font-black rounded-full tracking-widest">SOLD OUT</div>
                        )}
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
                {filtered.length === 0 && (
                  <div className="text-center py-16"><div className="text-5xl mb-4">🍽️</div><p className="text-slate-400 font-bold">메뉴가 없습니다</p></div>
                )}
              </div>

              {/* 장바구니 버튼 */}
              <CartButton totalItems={totalItems} totalPrice={totalPrice} onClick={() => setIsCartOpen(true)} />

              {/* 장바구니 모달 */}
              <CartModal isOpen={isCartOpen} onClose={() => setIsCartOpen(false)}
                cart={[...cart, ...sharedItems]}
                onUpdateQuantity={updateQuantity}
                onOrder={handleOrder} isOrdering={isOrdering} totalPrice={totalPrice} />

              {/* 옵션 모달 */}
              {optionItem && (
                <OptionSelectionModal key={optionItem.id} isOpen={!!optionItem}
                  onClose={() => setOptionItem(null)} onConfirm={handleOptionConfirm}
                  item={optionItem} optionGroups={optionItem.options} />
              )}
            </motion.div>
          )}

          {/* ────────────────── SCREEN: success ────────────────── */}
          {screen === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="w-full flex flex-col items-center justify-center min-h-screen p-4 relative overflow-hidden">

              {/* 컨페티 */}
              <AnimatePresence>
                {confetti.map(p => (
                  <motion.div key={p.id} className="absolute w-3 h-3 rounded-sm pointer-events-none"
                    style={{ backgroundColor: p.color, left: `${p.x}%`, top: '-12px' }}
                    animate={{ y: ['0vh', '110vh'], rotate: [0, 720], opacity: [1, 0] }}
                    transition={{ duration: 1.5 + Math.random(), ease: 'easeIn' }} />
                ))}
              </AnimatePresence>

              <div className="w-full max-w-sm bg-white md:rounded-[2.5rem] md:shadow-2xl overflow-hidden">
                {/* 성공 배너 */}
                <div className="bg-gradient-to-br from-emerald-400 to-teal-500 px-6 pt-10 pb-12 text-center">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                    className="w-20 h-20 bg-white rounded-full mx-auto flex items-center justify-center shadow-xl shadow-teal-500/30">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" strokeWidth={2.5} />
                  </motion.div>
                  <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                    className="text-white font-black text-2xl mt-4">주문 완료!</motion.p>
                  <p className="text-white/70 text-sm mt-1">{STORE.name} · {STORE.table}번 테이블</p>
                </div>

                <div className="px-5 -mt-8 space-y-4 pb-8">
                  {/* 주문 정보 */}
                  {orderData && (
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-5 space-y-3">
                      {[
                        { label: '주문번호', value: orderData.number, cls: 'text-slate-900 font-black' },
                        { label: '결제금액', value: fp(orderData.total), cls: 'text-orange-500 font-black text-xl' },
                        { label: '예상대기', value: '약 12분', cls: 'text-slate-700 font-bold' },
                      ].map((r, i) => (
                        <div key={i}>
                          {i > 0 && <div className="h-px bg-slate-100" />}
                          <div className="flex justify-between items-center py-1">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{r.label}</span>
                            <span className={r.cls}>{r.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ★ 포인트 CTA + 카운트다운 ★ */}
                  <AnimatePresence mode="wait">
                    {!signupDone ? (
                      <motion.div key="cta" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-5 space-y-4">
                        {/* 포인트 헤드라인 */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-black text-amber-600 uppercase tracking-widest">적립 포인트</p>
                            <p className="text-3xl font-black text-amber-700 mt-0.5">+{orderData?.points ?? 0} P</p>
                          </div>
                          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
                            <Gift size={24} className="text-amber-500" />
                          </div>
                        </div>

                        {/* 카운트다운 바 */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className={countdown < 15 ? 'text-red-600 animate-pulse' : 'text-slate-600'}>
                              {countdown < 15 ? '⚠️ 포인트 곧 소멸!' : '⏱ 포인트 소멸까지'}
                            </span>
                            <span className={`font-black tabular-nums text-base ${countdown < 15 ? 'text-red-500' : 'text-slate-700'}`}>{countdown}초</span>
                          </div>
                          <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                            <motion.div className="h-full rounded-full"
                              style={{ background: countdown < 15 ? '#ef4444' : 'linear-gradient(to right,#f97316,#f59e0b)' }}
                              animate={{ width: `${(countdown / 60) * 100}%` }}
                              transition={{ duration: 0.9, ease: 'linear' }} />
                          </div>
                        </div>

                        {/* 전화번호 (사전 입력) */}
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">알림 수신 번호 (자동 입력됨)</p>
                          <div className="flex items-center gap-2 bg-white border-2 border-emerald-200 rounded-xl px-4 py-3">
                            <Wifi size={14} className="text-emerald-500 flex-shrink-0" />
                            <input value={phone} onChange={e => setPhone(e.target.value)}
                              className="flex-1 min-w-0 text-sm font-black text-slate-800 outline-none bg-transparent"
                              placeholder="010-0000-0000" />
                            <span className="shrink-0 text-[9px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full whitespace-nowrap">자동입력</span>
                          </div>
                        </div>

                        {/* ★ 원버튼 가입 CTA ★ */}
                        <motion.button onClick={handleSignup} whileTap={{ scale: 0.97 }}
                          className="w-full h-14 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black rounded-xl text-sm shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 hover:shadow-xl transition-shadow">
                          <ShieldCheck size={16} />
                          3초 만에 포인트 보존하기 ⚡
                        </motion.button>
                        <p className="text-center text-[10px] text-slate-400">위마켓 회원가입 동의 포함 · 언제든 탈퇴 가능</p>
                      </motion.div>
                    ) : (
                      <motion.div key="signed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200 }}
                        className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl p-6 text-center">
                        <div className="text-5xl mb-3">🎉</div>
                        <p className="text-xl font-black text-emerald-700">회원가입 완료!</p>
                        <p className="text-sm text-emerald-600 font-bold mt-1">{orderData?.points ?? 0}P 영구 적립 완료</p>
                        <p className="text-[11px] text-slate-400 mt-3">{phone} 으로 문자가 발송되었습니다</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 추가 주문 / 홈 */}
                  <div className="space-y-2 pt-1">
                    <button onClick={() => { setOrderData(null); setScreen('menu'); setSignupDone(false); setToasts([]); setSharedItems([]); }}
                      className="w-full h-12 bg-slate-900 text-white font-black rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors">
                      <RotateCcw size={14} /> 추가 주문하기
                    </button>
                    <Link to="/" className="block w-full h-11 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm flex items-center justify-center hover:bg-slate-200 transition-colors">
                      홈으로 돌아가기
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

export default MenuDemo;
