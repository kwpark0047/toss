import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── 다국어 대사 ──────────────────────────────────────────────────────────────
const I18N = {
  ko: {
    greet: [
      '안녕하세요! 메뉴 안내 도와드릴게요 ✨',
      '어서오세요! 특별한 한 잔 추천해드릴까요? 🌟',
      '오늘은 뭘 드실까요? 인기 메뉴 알려드릴게요! ☕',
    ],
    weatherCtx: { rain:'비 오는 날 추천 ☔', sun:'오늘의 인기 메뉴 ☀️', cold:'몸 녹여드릴게요 ❄️', hot:'시원하게 드세요 🧊' },
    rec: {
      rain: '비 오는 날엔 따뜻한 {n} 어떠세요? ☕',
      sun:  '날씨 좋은 날 {n} 한 잔 어떠요? ☀️',
      cold: '추운 날엔 뜨끈한 {n} 강추! ❄️',
      hot:  '더운 날엔 시원한 {n} 드세요! 🧊',
    },
    add: [
      '{n} 담으셨군요! 탁월한 선택 ✨',
      '{n} 좋아요! 더 필요한 거 있으세요? 😊',
      '{n}~ 맛있겠다! 🤤',
    ],
    curious: [
      '메뉴 고르는 중이세요? 추천해드릴게요! 💬',
      '인기 메뉴 추천받으실래요? ⭐',
    ],
    admin: [
      '사장님, 오늘도 좋은 하루 되세요! 💼',
      '오늘 매출 목표까지 화이팅! 📊',
      '고객분들이 저를 좋아하더라고요 😊',
    ],
  },
  en: {
    greet: [
      'Hi there! Need help with the menu? ✨',
      'Welcome! Looking for a recommendation? 🌟',
      "What'll it be today? I know the best picks! ☕",
    ],
    weatherCtx: { rain:'Rainy day pick ☔', sun:"Today's favourite ☀️", cold:'Stay warm ❄️', hot:'Beat the heat 🧊' },
    rec: {
      rain: 'On a rainy day, try warm {n}! ☕',
      sun:  "It's lovely out — enjoy {n}! ☀️",
      cold: 'Stay cozy with {n}! ❄️',
      hot:  'Cool down with {n}! 🧊',
    },
    add: [
      'Great pick: {n}! ✨',
      '{n} — excellent choice! 😊',
      '{n} looks amazing! 🤤',
    ],
    curious: ['Still browsing? I can help! 💬', 'Want a popular recommendation? ⭐'],
    admin: ['Hi boss, have a great day! 💼', "Let's hit today's sales target! 📊", 'Customers love me 😊'],
  },
  ja: {
    greet: [
      'いらっしゃいませ！ご注文を承ります ✨',
      'おすすめメニューをご紹介しましょうか？ 🌟',
      '今日は何にしますか？人気メニューをどうぞ ☕',
    ],
    weatherCtx: { rain:'雨の日おすすめ ☔', sun:'今日の人気 ☀️', cold:'温まりましょう ❄️', hot:'涼しいものを 🧊' },
    rec: {
      rain: '雨の日は温かい{n}はいかがですか？ ☕',
      sun:  '良い天気！{n}をどうぞ ☀️',
      cold: '寒い日は{n}で温まりましょう ❄️',
      hot:  '暑い日は{n}で涼しく！ 🧊',
    },
    add: ['{n}、いい選択です！ ✨', '{n}を追加！ 😊', '{n}、美味しそう！ 🤤'],
    curious: ['まだお選びですか？お手伝いします！ 💬', '人気メニューをご紹介しましょうか？ ⭐'],
    admin: ['いらっしゃいませ！良い一日を 💼', '売上目標まで頑張りましょう 📊', 'お客様に喜ばれています 😊'],
  },
  zh: {
    greet: [
      '您好！需要帮您点餐吗？ ✨',
      '欢迎！想要推荐吗？ 🌟',
      '今天想吃什么？我来为您推荐！ ☕',
    ],
    weatherCtx: { rain:'雨天推荐 ☔', sun:'今日热门 ☀️', cold:'驱寒暖身 ❄️', hot:'清凉一夏 🧊' },
    rec: {
      rain: '下雨天来碗热乎的{n}吧！ ☕',
      sun:  '天气这么好，来杯{n}！ ☀️',
      cold: '天冷了，{n}暖身一下！ ❄️',
      hot:  '天热就来份凉爽的{n}！ 🧊',
    },
    add: ['{n}，眼光不错！ ✨', '{n}已加入购物车！ 😊', '{n}看起来真香！ 🤤'],
    curious: ['还在选择中吗？需要帮忙吗？ 💬', '要为您推荐人气菜品吗？ ⭐'],
    admin: ['老板好，祝生意兴隆！ 💼', '加油，完成今天的销售目标！ 📊', '顾客们都很喜欢我 😊'],
  },
};

const VOICE_LANG = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN' };

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ── 날개 ────────────────────────────────────────────────────────────────────
const Wing = ({ side }) => (
  <motion.div
    className="absolute w-7 h-12"
    style={{
      [side]: 3, top: 14,
      background: 'rgba(255,255,255,0.52)',
      filter: 'blur(0.4px)',
      borderRadius: side === 'left'
        ? '60% 40% 70% 70% / 70% 70% 60% 60%'
        : '40% 60% 70% 70% / 70% 70% 60% 60%',
      transformOrigin: side === 'left' ? 'right center' : 'left center',
      boxShadow: 'inset 0 0 8px rgba(255,255,255,0.5)',
    }}
    animate={{ rotateZ: side === 'left' ? [16, 34, 16] : [-16, -34, -16], scaleX: [1, 0.5, 1] }}
    transition={{ duration: 0.25, repeat: Infinity, ease: 'easeInOut' }}
  />
);

// ── 요정 본체 ────────────────────────────────────────────────────────────────
const FairyBody = ({ isHappy }) => (
  <motion.div
    className="relative w-[78px] h-[78px]"
    animate={isHappy
      ? { y: [0, -18, 3, -8, 0], scale: [1, 1.14, 0.93, 1.06, 1] }
      : { y: [-6, 7, -6], rotate: [-4, 4, -4] }}
    transition={isHappy
      ? { duration: 0.65, ease: 'easeInOut', times: [0, 0.3, 0.55, 0.75, 1] }
      : { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}>
    {/* 오라 */}
    <motion.div
      className="absolute inset-0 -m-3 rounded-full"
      style={{ background: 'radial-gradient(circle, rgba(245,159,11,.62) 0%, rgba(245,159,11,.22) 50%, transparent 72%)' }}
      animate={{ scale: [1, 1.24, 1], opacity: [0.65, 1, 0.65] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
    />
    <Wing side="left" />
    <Wing side="right" />
    {/* 코어 */}
    <div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[46px] h-[46px] rounded-full flex items-center justify-center"
      style={{ background: 'radial-gradient(circle at 34% 28%, #FFF8E7, #F59E0B 62%, #D97706)', boxShadow: '0 4px 20px rgba(245,159,11,.65), 0 0 0 2px rgba(255,255,255,.2)' }}>
      <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
        <path d="M12 2l1.8 6.6c.2.7.8 1.3 1.5 1.5L22 12l-6.7 1.9c-.7.2-1.3.8-1.5 1.5L12 22l-1.8-6.6c-.2-.7-.8-1.3-1.5-1.5L2 12l6.7-1.9c.7-.2 1.3-.8 1.5-1.5L12 2z" />
      </svg>
    </div>
  </motion.div>
);

// ── 반짝이 파티클 ────────────────────────────────────────────────────────────
const Spark = ({ x, y, size, angle }) => (
  <motion.div
    className="absolute pointer-events-none"
    style={{ left: x, top: y }}
    initial={{ opacity: 0.95, scale: 1, y: 0, rotate: angle }}
    animate={{ opacity: 0, scale: 0.12, y: 30, rotate: angle + 170 }}
    transition={{ duration: 0.9 + Math.random() * 0.4, ease: 'easeOut' }}>
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#F59E0B" d="M12 2l1.8 6.6c.2.7.8 1.3 1.5 1.5L22 12l-6.7 1.9c-.7.2-1.3.8-1.5 1.5L12 22l-1.8-6.6c-.2-.7-.8-1.3-1.5-1.5L2 12l6.7-1.9c.7-.2 1.3-.8 1.5-1.5L12 2z" />
    </svg>
  </motion.div>
);

// ────────────────────────────────────────────────────────────────────────────
//  메인 컴포넌트
//
//  mode='float'   → position:fixed (고객 메뉴 화면 오버레이)
//  mode='preview' → position:absolute (관리자 폰 프리뷰 내부)
//  mode='admin'   → position:fixed, 관리자 전용 대사
// ────────────────────────────────────────────────────────────────────────────
export default function TinkerBell({
  lang = 'ko',
  weather = 'sun',
  menuItems = [],
  lastAddedItem = null,
  onRecommend,
  voiceEnabled = false,
  largeFont = false,
  mode = 'float',
  previewTrigger = 0,   // 증가할 때마다 미리보기에서 인사 재실행
  adminMode = false,    // true면 사업자 전용 대사
}) {
  const [isHappy,  setIsHappy]  = useState(false);
  const [isBusy,   setIsBusy]   = useState(false);
  const [visible,  setVisible]  = useState(false);
  const [floatY,   setFloatY]   = useState(0);   // 유동 수직 오프셋
  const [bubble,   setBubble]   = useState({ show: false, ctx: '', typed: '', full: '' });
  const [sparks,   setSparks]   = useState([]);

  const typingRef  = useRef(null);
  const sparkId    = useRef(0);
  const prevAdded  = useRef(null);

  // ── 음성 합성 ────────────────────────────────────────────────────────────
  const speak = useCallback((text) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[\p{Emoji}]/gu, ''));
    u.lang = VOICE_LANG[lang] || 'ko-KR';
    u.pitch = 1.1; u.rate = 0.98;
    window.speechSynthesis.speak(u);
  }, [lang, voiceEnabled]);

  // ── 말풍선 타이핑 ────────────────────────────────────────────────────────
  const say = useCallback((ctx, text, keepOpen = false) => {
    clearTimeout(typingRef.current);
    setBubble({ show: true, ctx: ctx || '', typed: '', full: text });
    let i = 0;
    const type = () => {
      if (i <= text.length) {
        setBubble(prev => ({ ...prev, typed: text.slice(0, i++) }));
        typingRef.current = setTimeout(type, 34);
      } else {
        speak((ctx ? ctx + '. ' : '') + text);
        if (!keepOpen)
          typingRef.current = setTimeout(() => setBubble(prev => ({ ...prev, show: false })), 4200);
      }
    };
    type();
  }, [speak]);

  // ── 반짝이 소환 ──────────────────────────────────────────────────────────
  const spawnSparks = useCallback((count = 7) => {
    const news = Array.from({ length: count }, () => ({
      id: ++sparkId.current,
      x: Math.random() * 30 - 15,
      y: Math.random() * 20 - 10,
      size: 6 + Math.random() * 8,
      angle: Math.random() * 360,
    }));
    setSparks(prev => [...prev.slice(-18), ...news]);
    setTimeout(() => setSparks(prev => prev.filter(s => !news.find(n => n.id === s.id))), 1200);
  }, []);

  // ── 입장 ──────────────────────────────────────────────────────────────────
  const entrance = useCallback(() => {
    setIsBusy(true); setBubble({ show: false, ctx: '', typed: '', full: '' });
    setTimeout(() => {
      setVisible(true);
      setTimeout(() => {
        spawnSparks(10);
        const L = I18N[lang] || I18N.ko;
        say('', adminMode ? pick(L.admin) : pick(L.greet));
        setIsBusy(false);
      }, 900);
    }, 120);
  }, [lang, adminMode, say, spawnSparks]);

  // ── 마운트 입장 ──────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(entrance, 650);
    return () => clearTimeout(t);
  }, []);

  // ── previewTrigger 변경 시 재등장 (관리자 미리보기) ───────────────────────
  useEffect(() => {
    if (previewTrigger === 0) return;
    entrance();
  }, [previewTrigger]);

  // ── 언어 변경 시 인사 ────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const L = I18N[lang] || I18N.ko;
    say('', adminMode ? pick(L.admin) : pick(L.greet));
  }, [lang]);

  // ── 유동 부유 ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const iv = setInterval(() => {
      if (!isBusy) setFloatY(v => v + (Math.random() * 6 - 3));
    }, 2600);
    return () => clearInterval(iv);
  }, [visible, isBusy]);

  // 수직 오프셋 클램프 (-14 ~ 14)
  useEffect(() => {
    setFloatY(prev => Math.max(-14, Math.min(14, prev)));
  }, [floatY]);

  // ── 장바구니 추가 반응 ───────────────────────────────────────────────────
  useEffect(() => {
    if (!lastAddedItem || lastAddedItem === prevAdded.current) return;
    prevAdded.current = lastAddedItem;
    const L = I18N[lang] || I18N.ko;
    const line = pick(L.add).replace('{n}', lastAddedItem.name || lastAddedItem);
    setIsHappy(true);
    spawnSparks(12);
    say('', line);
    setTimeout(() => setIsHappy(false), 1900);
  }, [lastAddedItem]);

  // ── 날씨 기반 자동 추천 ──────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || !menuItems.length || adminMode) return;
    const t = setTimeout(() => {
      const L = I18N[lang] || I18N.ko;
      const isWarm = weather === 'rain' || weather === 'cold';
      const isCool = weather === 'hot';
      let pool = isWarm
        ? menuItems.filter(m => !m.isSoldOut && (m.isHot || m.cat === 'coffee' || m.cat === 'non-coffee'))
        : isCool
        ? menuItems.filter(m => !m.isSoldOut && (m.isCold || m.cat === 'ade' || m.name?.includes('아이스')))
        : menuItems.filter(m => !m.isSoldOut && m.isPopular);
      if (!pool.length) pool = menuItems.filter(m => !m.isSoldOut);
      if (!pool.length) return;
      const chosen = pick(pool);
      const ctx  = L.weatherCtx[weather] || '';
      const text = (L.rec[weather] || L.rec.sun).replace('{n}', chosen.name || '');
      setIsBusy(true);
      spawnSparks(8);
      say(ctx, text);
      if (onRecommend) onRecommend(chosen);
      setTimeout(() => setIsBusy(false), 5500);
    }, 11000);
    return () => clearTimeout(t);
  }, [visible, weather, menuItems, lang]);

  // ── 호기심 메시지 ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || !menuItems.length || adminMode) return;
    const t = setTimeout(() => {
      const L = I18N[lang] || I18N.ko;
      say('', pick(L.curious));
    }, 26000);
    return () => clearTimeout(t);
  }, [visible, lang]);

  // ── 말풍선 위치 ─────────────────────────────────────────────────────────
  const bubbleStyle = mode === 'preview'
    ? { right: 56, top: -52, minWidth: 160, maxWidth: 190 }
    : { right: 82, top: -50, minWidth: 170, maxWidth: 210 };

  // ── 래퍼 스타일 ──────────────────────────────────────────────────────────
  const wrapperStyle = mode === 'preview'
    ? { position: 'absolute', right: 12, top: 80, zIndex: 20, pointerEvents: 'none' }
    : { position: 'fixed',    right: 16, top: 102, zIndex: 45, pointerEvents: 'none' };

  if (!visible) return null;

  return (
    <div style={wrapperStyle}>
      {/* 반짝이 */}
      <div className="absolute inset-0">
        {sparks.map(s => <Spark key={s.id} {...s} />)}
      </div>

      {/* 말풍선 */}
      <AnimatePresence>
        {bubble.show && (
          <motion.div
            key="bubble"
            style={{ position: 'absolute', ...bubbleStyle, zIndex: 10 }}
            className={`bg-slate-900 text-white rounded-2xl shadow-xl px-3 py-2.5 leading-relaxed ${largeFont ? 'text-sm' : 'text-xs'} font-semibold`}
            initial={{ opacity: 0, scale: 0.88, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 4 }}>
            {bubble.ctx && (
              <span className="block text-amber-400 font-black text-[10px] mb-1">{bubble.ctx}</span>
            )}
            <span>{bubble.typed}</span>
            <span className="inline-block w-1.5 h-3.5 bg-amber-400 ml-0.5 align-middle animate-pulse rounded-[1px]" />
            {/* 꼬리 */}
            <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-slate-900 rotate-45 rounded-[1px]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 요정 본체 */}
      <motion.div
        animate={{ y: floatY }}
        transition={{ type: 'spring', stiffness: 55, damping: 18 }}>
        <FairyBody isHappy={isHappy} />
      </motion.div>
    </div>
  );
}
