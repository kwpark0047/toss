import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, ChefHat, LayoutGrid, QrCode, Check, Plus, Trash2,
  Volume2, VolumeX, Sparkles, ArrowRight, ArrowLeft, Loader2,
  Clock, Phone, MapPin, PartyPopper, Move, X, Search, ChevronDown, ChevronUp, PenLine
} from 'lucide-react';
import { storesAPI, categoriesAPI, productsAPI, tablesAPI, aiAPI } from '../../api';

// ────────────────────────────────────────────────────────────────────
//  음성 합성 헬퍼
// ────────────────────────────────────────────────────────────────────
const speak = (text, enabled) => {
  if (!enabled || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[\p{Emoji}]/gu, '').trim());
  u.lang = 'ko-KR'; u.pitch = 1.15; u.rate = 0.95; u.volume = 0.9;
  window.speechSynthesis.speak(u);
};

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ── Step 1 필드별 가이드 메시지 (순수 함수)
function getStep1Guide(focus, form, customBtype) {
  const nameDone  = form.name.trim().length > 0;
  const btypeDone = form.business_type && (form.business_type !== '__custom__' || customBtype.trim().length > 0);
  const btypeLabel = getBtypeLabel(form.business_type, customBtype);

  switch (focus) {
    case 'name':
      return nameDone
        ? { msg: pickRandom([
            `"${form.name}" 멋진 이름이에요! ✨ 이제 업종을 선택해주세요.`,
            `좋아요! "${form.name}" 완성! 업종도 골라볼까요?`,
            `"${form.name}"은 고객 마음에 쏙 들 것 같아요! 다음은 업종 선택이에요.`,
          ]), happy: true }
        : { msg: pickRandom([
            '고객들에게 보일 매장 이름을 입력해주세요! ✏️',
            '기억하기 쉬운 매장 이름을 지어보세요!',
            '사장님만의 특별한 매장 이름을 알려주세요!',
          ]), happy: false };
    case 'business_type':
      return btypeDone
        ? { msg: pickRandom([
            `${btypeLabel} 업종 완료! 이제 영업 시간을 설정해주세요.`,
            `${btypeLabel}이군요! AI가 딱 맞는 메뉴를 추천해드릴게요. 영업 시간도 입력해볼까요?`,
            `좋은 선택이에요! ${btypeLabel}에 최적화된 서비스로 도와드릴게요.`,
          ]), happy: true }
        : { msg: pickRandom([
            '어떤 업종의 사장님이신가요? 검색하거나 목록에서 골라보세요! 😊',
            '업종을 선택하면 AI가 딱 맞는 메뉴를 추천해드려요!',
            '카페? 식당? 미용실? 어떤 업종을 운영하시나요?',
          ]), happy: false };
    case 'time':
      return { msg: pickRandom([
        '영업 시간을 설정해주세요. 오픈·마감 시간을 모두 입력해주세요!',
        '몇 시에 문을 열고 닫으시나요? 고객이 영업 여부를 확인할 수 있어요.',
        '영업 시간을 입력하면 손님들이 헛걸음 안 해도 돼요!',
      ]), happy: false };
    case 'phone':
      return { msg: pickRandom([
        '연락처를 입력하면 고객이 전화로 문의할 수 있어요. (선택사항)',
        '고객 문의 전화번호를 입력해주세요! 없으면 건너뛰셔도 됩니다.',
        '전화 주문도 받으신다면 번호를 꼭 입력해두세요!',
      ]), happy: false };
    case 'address':
      return { msg: pickRandom([
        '매장 주소를 입력하면 지도에서 찾을 수 있어요! (선택사항)',
        '주소를 입력하면 손님들이 더 쉽게 찾아올 수 있어요.',
        '매장 위치를 알려주면 지역 검색에서 노출될 수 있어요!',
      ]), happy: false };
    case 'description':
      return { msg: pickRandom([
        '매장을 한 줄로 소개해보세요! 첫인상이 중요하답니다. ✨ (선택사항)',
        '어떤 매장인지 한 줄로 설명해보세요. 예: "직접 볶은 원두로 내린 스페셜티 커피"',
        '매력적인 소개 문구 하나가 단골 손님을 만들어요!',
      ]), happy: false };
    default:
      if (!nameDone)  return { msg: pickRandom([
        '먼저 매장 이름을 입력해주세요! 아래 이름 칸을 클릭해보세요 😊',
        '매장 이름 칸을 눌러주세요! 첫 번째 단계예요.',
      ]), happy: false };
      if (!btypeDone) return { msg: pickRandom([
        '업종을 선택해주세요! 업종별 AI 메뉴 추천이 달라져요.',
        '어떤 종류의 매장인지 골라주세요! AI가 최적의 도움을 드릴게요.',
      ]), happy: false };
      return { msg: pickRandom([
        `"${form.name}" 정보 준비 완료! 저장 버튼을 눌러주세요! 🎉`,
        `완벽해요! 이제 저장만 하면 메뉴 등록으로 넘어가요!`,
        `멋진 매장 정보네요! 저장 버튼을 눌러볼까요?`,
      ]), happy: true };
  }
}

// ────────────────────────────────────────────────────────────────────
//  기본 테이블 레이아웃 (생성 직후 초기 배치)
// ────────────────────────────────────────────────────────────────────
const DEFAULT_TABLES = [
  { table_number: '기본QR',  x: 24,  y: 24,  capacity: 0, isBase: true  },
  { table_number: '테이블01', x: 180, y: 100, capacity: 4, isBase: false },
  { table_number: '테이블02', x: 340, y: 100, capacity: 4, isBase: false },
  { table_number: '테이블03', x: 500, y: 100, capacity: 4, isBase: false },
];

// ────────────────────────────────────────────────────────────────────
//  팅커벨 요정 컴포넌트
// ────────────────────────────────────────────────────────────────────
const Wing = ({ side }) => (
  <motion.div
    className="absolute w-7 h-12"
    style={{
      [side]: 3, top: 14,
      background: 'rgba(255,255,255,0.52)', filter: 'blur(0.4px)',
      borderRadius: side === 'left' ? '60% 40% 70% 70% / 70% 70% 60% 60%' : '40% 60% 70% 70% / 70% 70% 60% 60%',
      transformOrigin: side === 'left' ? 'right center' : 'left center',
      boxShadow: 'inset 0 0 8px rgba(255,255,255,0.5)',
    }}
    animate={{ rotateZ: side === 'left' ? [16,34,16] : [-16,-34,-16], scaleX: [1,0.5,1] }}
    transition={{ duration: 0.25, repeat: Infinity, ease: 'easeInOut' }}
  />
);

const Spark = ({ x, y, size, angle }) => (
  <motion.div className="absolute pointer-events-none" style={{ left: x, top: y }}
    initial={{ opacity: 0.95, scale: 1, y: 0, rotate: angle }}
    animate={{ opacity: 0, scale: 0.12, y: 30, rotate: angle + 170 }}
    transition={{ duration: 0.9 + Math.random() * 0.4, ease: 'easeOut' }}>
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#F59E0B" d="M12 2l1.8 6.6c.2.7.8 1.3 1.5 1.5L22 12l-6.7 1.9c-.7.2-1.3.8-1.5 1.5L12 22l-1.8-6.6c-.2-.7-.8-1.3-1.5-1.5L2 12l6.7-1.9c.7-.2 1.3-.8 1.5-1.5L12 2z" />
    </svg>
  </motion.div>
);

function WizardTinkerbell({ message, isHappy = false, voiceEnabled }) {
  const [typed, setTyped] = useState('');
  const [sparks, setSparks] = useState([]);
  const sparkId = useRef(0);
  const typingRef = useRef(null);

  useEffect(() => {
    if (!message) return;
    clearInterval(typingRef.current);
    setTyped('');
    speak(message, voiceEnabled);
    let i = 0;
    typingRef.current = setInterval(() => {
      i++;
      setTyped(message.slice(0, i));
      if (i >= message.length) clearInterval(typingRef.current);
    }, 32);
    return () => clearInterval(typingRef.current);
  }, [message, voiceEnabled]);

  useEffect(() => {
    if (!isHappy) return;
    const newSparks = Array.from({ length: 8 }, (_, i) => ({
      id: sparkId.current++,
      x: 10 + Math.random() * 60, y: -10 + Math.random() * 50,
      size: 8 + Math.random() * 8, angle: Math.random() * 360,
    }));
    setSparks(newSparks);
    const t = setTimeout(() => setSparks([]), 1200);
    return () => clearTimeout(t);
  }, [isHappy]);

  return (
    <div className="flex items-end gap-4">
      <AnimatePresence>
        {typed && (
          <motion.div initial={{ opacity: 0, scale: 0.85, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.85 }}
            className="relative max-w-xs bg-white rounded-2xl rounded-br-sm px-4 py-3 shadow-xl border border-amber-100">
            <p className="text-sm font-bold text-slate-800 leading-relaxed">{typed}</p>
            <div className="absolute -right-2 bottom-2 w-0 h-0"
              style={{ borderLeft: '10px solid white', borderTop: '8px solid transparent', borderBottom: '4px solid transparent', filter: 'drop-shadow(2px 1px 1px rgba(0,0,0,0.06))' }} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative flex-shrink-0">
        {sparks.map(s => <Spark key={s.id} {...s} />)}
        <motion.div className="relative w-[78px] h-[78px]"
          animate={isHappy ? { y:[0,-18,3,-8,0], scale:[1,1.14,0.93,1.06,1] } : { y:[-4,6,-4], rotate:[-3,3,-3] }}
          transition={isHappy ? { duration:0.65, ease:'easeInOut' } : { duration:3.4, repeat:Infinity, ease:'easeInOut' }}>
          <motion.div className="absolute inset-0 -m-3 rounded-full"
            style={{ background:'radial-gradient(circle, rgba(245,159,11,.6) 0%, rgba(245,159,11,.2) 50%, transparent 72%)' }}
            animate={{ scale:[1,1.22,1], opacity:[0.6,1,0.6] }}
            transition={{ duration:2.4, repeat:Infinity, ease:'easeInOut' }} />
          <Wing side="left" /><Wing side="right" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[46px] h-[46px] rounded-full flex items-center justify-center"
            style={{ background:'radial-gradient(circle at 34% 28%, #FFF8E7, #F59E0B 62%, #D97706)', boxShadow:'0 4px 20px rgba(245,159,11,.65), 0 0 0 2px rgba(255,255,255,.2)' }}>
            <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
              <path d="M12 2l1.8 6.6c.2.7.8 1.3 1.5 1.5L22 12l-6.7 1.9c-.7.2-1.3.8-1.5 1.5L12 22l-1.8-6.6c-.2-.7-.8-1.3-1.5-1.5L2 12l6.7-1.9c.7-.2 1.3-.8 1.5-1.5L12 2z" />
            </svg>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
//  드래그 가능한 테이블 카드
// ────────────────────────────────────────────────────────────────────
const CARD_W = 130;
const CARD_H = 80;

function TableLayoutCard({ table, canvasRef, onMove, onDelete }) {
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e) => {
    if (e.target.closest('[data-del]')) return;
    e.preventDefault();
    isDragging.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left - table.x,
      y: e.clientY - rect.top - table.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(0, Math.min(Math.round(e.clientX - rect.left - dragOffset.current.x), rect.width - CARD_W));
    const newY = Math.max(0, Math.min(Math.round(e.clientY - rect.top - dragOffset.current.y), rect.height - CARD_H));
    onMove(table.id, newX, newY);
  };

  const handlePointerUp = () => { isDragging.current = false; };

  const isBase = table.table_number === '기본QR';

  return (
    <div
      style={{ position: 'absolute', left: table.x, top: table.y, width: CARD_W, height: CARD_H, touchAction: 'none', zIndex: 10 }}
      className="select-none cursor-grab active:cursor-grabbing group"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className={`w-full h-full rounded-2xl border-2 flex flex-col items-center justify-center gap-1 shadow-lg transition-shadow group-active:shadow-2xl
        ${isBase
          ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/60'
          : 'bg-gradient-to-br from-slate-700/80 to-slate-800/80 border-slate-500/60'
        }`}>
        {/* 이동 핸들 아이콘 */}
        <Move size={11} className={`${isBase ? 'text-amber-400/60' : 'text-slate-500'}`} />
        {/* 테이블 번호 */}
        <span className={`text-xs font-black leading-none ${isBase ? 'text-amber-300' : 'text-white'}`}>
          {table.table_number}
        </span>
        {!isBase && (
          <span className="text-[10px] text-slate-500 font-medium">{table.capacity}인석</span>
        )}
        {isBase && (
          <span className="text-[10px] text-amber-500 font-medium">매장 공통 QR</span>
        )}
      </div>
      {/* 삭제 버튼 */}
      <button
        data-del="1"
        onClick={() => onDelete(table.id)}
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-rose-500 border-2 border-slate-900 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-400 z-20"
      >
        <X size={10} className="text-white" />
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
//  스텝 지시자
// ────────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: '매장 정보', icon: Store },
  { id: 2, label: '메뉴 등록', icon: ChefHat },
  { id: 3, label: '테이블 배치', icon: LayoutGrid },
  { id: 4, label: 'QR 코드',   icon: QrCode },
];

// ── Step 1 서식 위 인라인 팅커벨 가이드
function Step1InlineGuide({ focus, form, customBtype, voiceEnabled }) {
  const { msg, happy } = getStep1Guide(focus, form, customBtype);
  const [typed, setTyped]   = useState('');
  const [sparks, setSparks] = useState([]);
  const typingRef  = useRef(null);
  const sparkId    = useRef(0);
  const prevFocus  = useRef(null);

  // 타이핑 애니메이션 (msg 바뀔 때마다)
  useEffect(() => {
    clearInterval(typingRef.current);
    setTyped('');
    let i = 0;
    typingRef.current = setInterval(() => {
      i++;
      setTyped(msg.slice(0, i));
      if (i >= msg.length) clearInterval(typingRef.current);
    }, 26);
    return () => clearInterval(typingRef.current);
  }, [msg]);

  // 음성: focus 전환 시만 (키 입력 때마다 발화 방지)
  useEffect(() => {
    if (focus !== prevFocus.current) {
      prevFocus.current = focus;
      const g = getStep1Guide(focus, form, customBtype);
      speak(g.msg, voiceEnabled);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, voiceEnabled]);

  // 해피 sparks
  useEffect(() => {
    if (!happy) return;
    const s = Array.from({ length: 7 }, () => ({
      id: sparkId.current++,
      x: 4 + Math.random() * 44, y: -4 + Math.random() * 44,
      size: 6 + Math.random() * 6, angle: Math.random() * 360,
    }));
    setSparks(s);
    const t = setTimeout(() => setSparks([]), 1100);
    return () => clearTimeout(t);
  }, [happy, focus]);

  return (
    <div className="flex items-center gap-3 mb-5 px-3 py-3 bg-gradient-to-r from-amber-500/[0.08] to-orange-500/[0.05] rounded-2xl border border-amber-500/20">
      {/* 소형 팅커벨 요정 */}
      <div className="relative flex-shrink-0 w-[54px] h-[54px]">
        {sparks.map(s => <Spark key={s.id} {...s} />)}
        <motion.div className="relative w-[54px] h-[54px]"
          animate={happy
            ? { y:[0,-14,2,-7,0], scale:[1,1.13,0.93,1.05,1] }
            : { y:[-3,5,-3], rotate:[-2.5,2.5,-2.5] }}
          transition={happy
            ? { duration:0.6, ease:'easeInOut' }
            : { duration:3.2, repeat:Infinity, ease:'easeInOut' }}>
          <motion.div className="absolute inset-0 -m-2 rounded-full"
            style={{ background:'radial-gradient(circle, rgba(245,159,11,.55) 0%, rgba(245,159,11,.18) 50%, transparent 72%)' }}
            animate={{ scale:[1,1.2,1], opacity:[0.55,0.95,0.55] }}
            transition={{ duration:2.3, repeat:Infinity, ease:'easeInOut' }} />
          <Wing side="left" /><Wing side="right" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[34px] h-[34px] rounded-full flex items-center justify-center"
            style={{ background:'radial-gradient(circle at 34% 28%, #FFF8E7, #F59E0B 62%, #D97706)', boxShadow:'0 3px 14px rgba(245,159,11,.6), 0 0 0 1.5px rgba(255,255,255,.2)' }}>
            <svg viewBox="0 0 24 24" fill="white" width="16" height="16">
              <path d="M12 2l1.8 6.6c.2.7.8 1.3 1.5 1.5L22 12l-6.7 1.9c-.7.2-1.3.8-1.5 1.5L12 22l-1.8-6.6c-.2-.7-.8-1.3-1.5-1.5L2 12l6.7-1.9c.7-.2 1.3-.8 1.5-1.5L12 2z" />
            </svg>
          </div>
        </motion.div>
      </div>
      {/* 말풍선 텍스트 */}
      <div className="flex-1 min-h-[36px] flex items-center">
        <AnimatePresence mode="wait">
          <motion.p key={msg.slice(0, 14)} initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            className="text-[13px] font-bold text-white leading-relaxed">
            {typed}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── 1인 사업자 인기 업종 (첫 화면에 노출)
const POPULAR_VALUES = ['cafe', 'korean', 'chicken', 'bakery', 'food_truck', 'hair', 'fitness', 'academy'];

// ── 전체 업종 그룹 (가나다 / 업종 계열별 분류)
const BTYPE_GROUPS = [
  {
    group: '☕ 음료 · 카페',
    types: [
      { value: 'cafe',         label: '카페/커피숍',   icon: '☕' },
      { value: 'dessert_cafe', label: '디저트카페',     icon: '🍰' },
      { value: 'bubble_tea',   label: '버블티/음료',   icon: '🧋' },
      { value: 'juice_bar',    label: '과일주스/스무디',icon: '🥤' },
      { value: 'tearoom',      label: '티룸/전통찻집', icon: '🍵' },
    ],
  },
  {
    group: '🍽️ 음식점',
    types: [
      { value: 'korean',    label: '한식',           icon: '🍲' },
      { value: 'chinese',   label: '중식',           icon: '🥢' },
      { value: 'japanese',  label: '일식/초밥',      icon: '🍱' },
      { value: 'western',   label: '양식/파스타',    icon: '🍝' },
      { value: 'chicken',   label: '치킨/닭요리',    icon: '🍗' },
      { value: 'pizza',     label: '피자',           icon: '🍕' },
      { value: 'snack',     label: '분식',           icon: '🍜' },
      { value: 'bbq',       label: '고기/바베큐',    icon: '🥩' },
      { value: 'seafood',   label: '해산물/회',      icon: '🐟' },
      { value: 'soup',      label: '국밥/찌개',      icon: '🥘' },
    ],
  },
  {
    group: '🚚 특수 외식',
    types: [
      { value: 'food_truck', label: '푸드트럭',      icon: '🚚' },
      { value: 'bakery',     label: '베이커리/빵집', icon: '🥐' },
      { value: 'fastfood',   label: '패스트푸드',    icon: '🍔' },
      { value: 'bar',        label: '술집/바',       icon: '🍺' },
      { value: 'pub',        label: '호프/포차',     icon: '🍻' },
      { value: 'buffet',     label: '뷔페/셀프식당', icon: '🍱' },
      { value: 'nightclub',  label: '클럽/라운지',  icon: '🎵' },
    ],
  },
  {
    group: '📚 교육 · 스포츠',
    types: [
      { value: 'academy',   label: '학원/교습소',    icon: '📚' },
      { value: 'fitness',   label: '헬스클럽/피트니스', icon: '💪' },
      { value: 'yoga',      label: '요가/필라테스',  icon: '🧘' },
      { value: 'swimming',  label: '수영장',         icon: '🏊' },
      { value: 'sports',    label: '스포츠시설',     icon: '⚽' },
      { value: 'golf',      label: '골프/스크린골프', icon: '⛳' },
      { value: 'dance',     label: '댄스/무술학원',  icon: '🕺' },
      { value: 'reading',   label: '독서실/스터디카페', icon: '📖' },
    ],
  },
  {
    group: '💇 뷰티 · 웰니스',
    types: [
      { value: 'hair',      label: '미용실/헤어샵',  icon: '💇' },
      { value: 'nail',      label: '네일샵',         icon: '💅' },
      { value: 'spa',       label: '마사지/스파',    icon: '💆' },
      { value: 'skincare',  label: '피부관리실',     icon: '✨' },
      { value: 'tatoo',     label: '타투/반영구',    icon: '🎨' },
      { value: 'barber',    label: '이발소/남성헤어', icon: '💈' },
    ],
  },
  {
    group: '🏪 소매 · 생활',
    types: [
      { value: 'convenience', label: '편의점/마트',  icon: '🏪' },
      { value: 'flower',      label: '꽃집',         icon: '💐' },
      { value: 'pet',         label: '반려동물샵',   icon: '🐾' },
      { value: 'laundry',     label: '세탁소',       icon: '👕' },
      { value: 'pharmacy',    label: '약국',         icon: '💊' },
      { value: 'stationery',  label: '문구/잡화점',  icon: '✏️' },
      { value: 'bookstore',   label: '서점',         icon: '📕' },
    ],
  },
  {
    group: '🎮 엔터 · 기타',
    types: [
      { value: 'karaoke',   label: '노래방',         icon: '🎤' },
      { value: 'pc_cafe',   label: 'PC방/게임방',    icon: '🎮' },
      { value: 'pool',      label: '당구장',         icon: '🎱' },
      { value: 'coin_laundry', label: '코인세탁방',  icon: '🌀' },
      { value: 'parking',   label: '주차장',         icon: '🅿️' },
      { value: 'etc',       label: '기타',           icon: '🏠' },
    ],
  },
];

// 전체 평탄화 목록
const ALL_BTYPES = BTYPE_GROUPS.flatMap(g => g.types);
const getBtypeLabel = (value, custom = '') =>
  ALL_BTYPES.find(b => b.value === value)?.label || custom || value || '기타';

// ── 업종 선택 피커 컴포넌트
// 모듈 레벨 컴포넌트: 리스트 렌더마다 재생성 방지 (react-best-practices: rerender-no-inline-components)
const CardBtn = ({ opt, selected, onSelect }) => (
  <button type="button" onClick={() => onSelect(opt.value)}
    className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-2xl border text-center transition-all ${selected === opt.value ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400 hover:border-amber-500/30 hover:text-amber-300'}`}>
    <span className="text-lg leading-none">{opt.icon}</span>
    <span className="text-[11px] font-bold leading-tight">{opt.label}</span>
  </button>
);

function BusinessTypePicker({ value, customValue, onChange, onCustomChange, onPickerFocus }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);

  const popular = POPULAR_VALUES.map(v => ALL_BTYPES.find(b => b.value === v)).filter(Boolean);
  const filtered = search.trim()
    ? ALL_BTYPES.filter(b => b.label.includes(search) || b.value.includes(search.toLowerCase()))
    : null;

  const isCustom = value === '__custom__';
  const selectedLabel = isCustom ? customValue : getBtypeLabel(value);

  const select = (v) => { onChange(v); setSearch(''); setExpanded(false); };

  return (
    <div className="space-y-2">
      {/* 선택된 업종 표시 + 검색 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setExpanded(true); }}
            onFocus={() => { setExpanded(true); onPickerFocus?.(); }}
            placeholder={isCustom ? customValue || '업종 검색...' : (selectedLabel || '업종 검색...')}
            className="w-full pl-8 pr-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-xs font-bold focus:outline-none focus:border-amber-500/50 transition-all"
          />
        </div>
        {(value || isCustom) && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black flex-shrink-0 ${isCustom ? 'bg-violet-500/20 border border-violet-500/30 text-violet-300' : 'bg-amber-500/20 border border-amber-500/30 text-amber-300'}`}>
            <span>{isCustom ? '✍️' : ALL_BTYPES.find(b => b.value === value)?.icon}</span>
            <span className="max-w-[80px] truncate">{selectedLabel}</span>
          </div>
        )}
      </div>

      {/* 검색 결과 */}
      {filtered && filtered.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
          {filtered.map(opt => <CardBtn key={opt.value} opt={opt} selected={value} onSelect={select} />)}
        </div>
      )}
      {filtered && filtered.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-2">검색 결과 없음 — 직접 입력을 사용해보세요</p>
      )}

      {/* 인기 업종 (기본 노출) */}
      {!filtered && (
        <>
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider">⭐ 인기 업종</p>
          <div className="grid grid-cols-4 gap-1.5">
            {popular.map(opt => <CardBtn key={opt.value} opt={opt} selected={value} onSelect={select} />)}
          </div>

          {/* 전체 업종 보기 토글 */}
          <button type="button" onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-slate-500 hover:text-amber-400 transition-colors font-bold">
            {expanded ? <><ChevronUp size={12} /> 접기</> : <><ChevronDown size={12} /> 전체 업종 보기</>}
          </button>

          {/* 전체 그룹 목록 */}
          <AnimatePresence>
            {expanded && (
              <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                className="overflow-hidden space-y-3 max-h-64 overflow-y-auto pr-0.5">
                {BTYPE_GROUPS.map(grp => (
                  <div key={grp.group}>
                    <p className="text-[10px] font-black text-slate-600 mb-1.5">{grp.group}</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {grp.types.map(opt => <CardBtn key={opt.value} opt={opt} selected={value} onSelect={select} />)}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* 직접 입력 */}
      {!filtered && (
        <div className="border-t border-white/10 pt-2">
          <div className="flex items-center gap-2">
            <PenLine size={11} className="text-slate-500 flex-shrink-0" />
            <input
              type="text"
              value={customValue}
              onChange={e => { onCustomChange(e.target.value); onChange('__custom__'); }}
              onFocus={() => onPickerFocus?.()}
              placeholder="목록에 없으면 직접 입력 (예: 꽃배달, 반찬가게)"
              className="flex-1 px-3 py-2 bg-white/5 border border-dashed border-white/20 rounded-xl text-white placeholder:text-slate-600 text-xs focus:outline-none focus:border-violet-500/50 transition-all"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
//  메인 마법사
// ────────────────────────────────────────────────────────────────────
export default function StoreSetupWizard() {
  const navigate = useNavigate();

  const [step, setStep]               = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [saving, setSaving]           = useState(false);
  const [tbMsg, setTbMsg]             = useState('');
  const [tbHappy, setTbHappy]         = useState(false);
  const voiceEnabledRef = useRef(true);
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

  const [createdStore,    setCreatedStore]    = useState(null);
  const [createdCategory, setCreatedCategory] = useState(null);
  const [createdMenus,    setCreatedMenus]    = useState([]);
  const [layoutTables,    setLayoutTables]    = useState([]);

  // Step 1 form
  const [storeForm, setStoreForm] = useState({
    name: '', business_type: 'cafe', description: '', phone: '',
    address: '', open_time: '09:00', close_time: '22:00',
  });
  const [customBtype, setCustomBtype] = useState(''); // 직접 입력 업종
  const [step1Focus, setStep1Focus]   = useState(null); // 현재 포커스된 필드

  // Step 2 menu
  const [menuItems, setMenuItems]     = useState([{ name: '', price: '', description: '' }]);
  const [aiLoadingIdx, setAiLoadingIdx] = useState(null);

  // Step 3 새 테이블 추가
  const [addingTable, setAddingTable]     = useState(false);
  const [newTableName, setNewTableName]   = useState('');
  const [newTableCap, setNewTableCap]     = useState(4);
  const canvasRef = useRef(null);

  // ── 팅커벨 대사
  const sayWithDelay = useCallback((msg, delay = 0, happy = false) => {
    setTimeout(() => { setTbMsg(msg); setTbHappy(happy); }, delay);
  }, []);

  useEffect(() => {
    const scripts = {
      0: [
        '안녕하세요, 사장님! 저는 AI 도우미 팅커벨이에요! ✨ 함께 멋진 매장을 만들어볼까요?',
        '어서 오세요! 4단계만 따라오시면 위마켓 매장이 뚝딱 완성돼요! 지금 시작해볼까요?',
        '반갑습니다, 사장님! 오늘부터 스마트한 QR 주문 매장 운영이 시작돼요!',
      ],
      1: [
        '먼저 매장 이름과 업종을 입력해주세요! 정보는 나중에 언제든지 수정할 수 있어요.',
        '매장 이름, 업종, 영업 시간을 알려주세요! 2분이면 충분해요.',
        '① 매장 이름부터 시작해볼까요? 고객들에게 보여질 이름이에요!',
      ],
      2: [
        '이번엔 메뉴를 등록해볼까요? 메뉴 이름 입력 후 AI 버튼을 눌러보세요!',
        '메뉴 이름만 입력하면 AI가 설명과 가격까지 자동으로 완성해줘요!',
        '대표 메뉴부터 입력해보세요! AI가 금방 도와드릴게요. 여러 개 추가도 가능해요!',
      ],
      3: [
        '기본 테이블이 자동으로 배치됐어요! 드래그해서 위치를 바꾸거나 테이블을 추가해보세요.',
        '매장 레이아웃에 맞게 테이블을 배치해주세요. 테이블 번호가 QR 주문에 사용돼요!',
        '테이블을 원하는 대로 자유롭게 배치해보세요! 나중에도 수정할 수 있어요.',
      ],
      4: [
        'QR 코드가 준비됐어요! 인쇄해서 각 테이블에 붙여주세요. 손님들이 바로 주문할 수 있어요! 🎉',
        '드디어 마지막 단계예요! QR 코드를 인쇄해서 테이블에 붙여두면 바로 운영 시작!',
        '완성이 눈앞이에요! QR 코드를 출력하면 오늘부터 스마트 매장이 돼요!',
      ],
    };
    if (step === 1) setStep1Focus(null);
    const candidates = scripts[step];
    if (!candidates) return;
    const msg = pickRandom(candidates);
    sayWithDelay(msg, 300, step === 4);
    // step 0, 1은 WizardTinkerbell이 없으므로 직접 speak() 호출
    if (step <= 1) setTimeout(() => speak(msg, voiceEnabledRef.current), 500);
    // step 4 진입 시 추가 축하 메시지 시퀀스
    if (step === 4) {
      const extras = [
        { msg: '사장님 정말 대단해요! 단 몇 분 만에 완성하셨어요!', delay: 3500, happy: true },
        { msg: 'QR 인쇄 후 테이블에 붙이면 바로 주문 받을 수 있어요!', delay: 6500, happy: false },
      ];
      extras.forEach(({ msg: m, delay: d, happy: h }) => sayWithDelay(m, d, h));
    }
   
  }, [step, sayWithDelay]);

  // ── Step 1: 매장 저장 + 기본 테이블 자동 생성
  const handleSaveStore = async () => {
    if (!storeForm.name.trim()) return;
    setSaving(true);
    try {
      const apiData = {
        ...storeForm,
        // custom 업종이면 실제 입력값을 business_type으로 전송
        business_type: storeForm.business_type === '__custom__'
          ? (customBtype.trim() || 'etc')
          : storeForm.business_type,
      };
      const res = await storesAPI.create(apiData);
      const store = res?.data || res;

      // 공공데이터 기존 매장과 상호·주소 일치 → 연동 승인 요청됨(신규 생성 아님)
      if (store?.linkRequested) {
        sayWithDelay(
          `"${store.matchedStore?.name || storeForm.name}"은(는) 이미 등록된 매장이에요! 🔗 관리자 승인 후 바로 관리하실 수 있어요. 연동 요청을 보냈습니다 ✅`,
          100, true
        );
        setTimeout(() => navigate('/admin', { replace: true }), 4000);
        return; // 카테고리/테이블 생성 스킵
      }

      setCreatedStore(store);

      // 기본 카테고리 생성
      const catRes = await categoriesAPI.create({ store_id: store.id, name: '기본 메뉴' });
      setCreatedCategory(catRes?.data || catRes);

      // 기본 테이블 4개 자동 생성 (기본QR + 테이블01,02,03)
      sayWithDelay(pickRandom([
        '매장 정보 저장 완료! 기본 테이블도 자동으로 만들고 있어요...',
        `"${storeForm.name}" 매장이 생성됐어요! 테이블도 자동 배치 중이에요!`,
      ]), 100, true);
      const created = await Promise.all(
        DEFAULT_TABLES.map(t =>
          tablesAPI.create({ store_id: store.id, table_number: t.table_number, capacity: t.capacity, x: t.x, y: t.y })
        )
      );
      const tables = created.map((r, i) => {
        const t = r?.data || r;
        return { ...t, x: t.x ?? DEFAULT_TABLES[i].x, y: t.y ?? DEFAULT_TABLES[i].y };
      });
      setLayoutTables(tables);

      sayWithDelay(pickRandom([
        '완벽해요! 이제 메뉴를 등록해볼까요? 😊',
        '매장 준비 완료! 다음은 손님들이 볼 메뉴를 등록해볼게요!',
        '훌륭해요! 메뉴만 등록하면 반 이상 완성이에요!',
      ]), 800, true);
      setTimeout(() => setStep(2), 1600);
    } catch (e) {
      sayWithDelay('앗, 저장 중 오류가 발생했어요. 다시 시도해주세요!', 100);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── Step 2: AI 메뉴 자동완성
  const handleAISuggest = async (idx) => {
    const name = menuItems[idx]?.name?.trim();
    if (!name) {
      sayWithDelay(pickRandom([
        '메뉴 이름을 먼저 입력해주세요!',
        '메뉴 이름 칸에 이름을 적어야 AI가 도울 수 있어요!',
      ]), 0);
      return;
    }
    setAiLoadingIdx(idx);
    sayWithDelay(pickRandom([
      `"${name}" 분석 중이에요! AI가 최적의 정보를 찾고 있어요 ✨`,
      '잠깐만요! AI가 메뉴 정보를 분석 중이에요!',
      `AI가 "${name}"에 딱 맞는 설명과 가격을 찾고 있어요!`,
    ]), 0);
    try {
      const btype = getBtypeLabel(storeForm.business_type, customBtype);
      const res = await aiAPI.proposeMenuFull({ name, categoryName: btype });
      const p = res?.proposal;
      if (p) {
        const newItems = [...menuItems];
        newItems[idx] = { ...newItems[idx], description: p.description || '', price: p.price ? String(p.price) : newItems[idx].price };
        setMenuItems(newItems);
        sayWithDelay(pickRandom([
          `"${name}" 완성! 가격이나 설명을 수정해도 돼요!`,
          `AI가 "${name}" 정보를 완성했어요! 확인하고 필요하면 수정해주세요.`,
          `"${name}" 메뉴 자동완성 성공! 다른 메뉴도 추가해볼까요?`,
        ]), 100, true);
      } else {
        sayWithDelay(pickRandom([
          'AI 추천을 받지 못했어요. 직접 설명과 가격을 입력해주세요!',
          '이 메뉴는 AI가 잘 모르는 것 같아요. 사장님이 직접 입력해주세요!',
        ]), 0);
      }
    } catch {
      sayWithDelay(pickRandom([
        'AI 서비스에 일시적인 문제가 있어요. 직접 입력해주세요!',
        'AI가 잠깐 쉬고 있어요. 직접 입력하거나 잠시 후 다시 시도해주세요!',
      ]), 0);
    } finally {
      setAiLoadingIdx(null);
    }
  };

  // ── Step 2: 메뉴 저장
  const handleSaveMenus = async () => {
    const valid = menuItems.filter(m => m.name.trim() && m.price);
    if (valid.length === 0) {
      sayWithDelay(pickRandom([
        '메뉴를 최소 한 개 이상 입력해주세요!',
        '메뉴 이름과 가격을 하나 이상 입력해야 저장할 수 있어요!',
      ]), 0);
      return;
    }
    setSaving(true);
    sayWithDelay(pickRandom([
      `${valid.length}개 메뉴를 저장하고 있어요! 잠깐만요...`,
      '맛있는 메뉴들을 등록하고 있어요!',
    ]), 0);
    try {
      const products = valid.map(m => ({
        name: m.name.trim(), price: parseInt(m.price, 10) || 0,
        description: m.description?.trim() || '', category_id: createdCategory?.id || null, is_active: true,
      }));
      const res = await productsAPI.bulkCreate({ store_id: createdStore.id, products });
      setCreatedMenus(res?.data || res || []);
      sayWithDelay(pickRandom([
        `${valid.length}개 메뉴 등록 완료! 이제 테이블 배치를 확인해볼까요? 🍽️`,
        '메뉴 저장 성공! 손님들이 정말 좋아하실 것 같아요! 다음은 테이블 배치예요.',
        '맛있겠다! 메뉴 등록 완료! 테이블 배치로 넘어가볼게요!',
      ]), 100, true);
      setTimeout(() => setStep(3), 900);
    } catch (e) {
      sayWithDelay(pickRandom([
        '저장 중 오류가 발생했어요. 다시 시도해주세요!',
        '앗, 잠깐 문제가 생겼어요! 잠시 후 다시 눌러주세요.',
      ]), 0);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── Step 3: 드래그로 위치 변경 (state 업데이트)
  const handleMoveTable = useCallback((id, x, y) => {
    setLayoutTables(prev => prev.map(t => t.id === id ? { ...t, x, y } : t));
  }, []);

  // ── Step 3: 테이블 삭제
  const handleDeleteTable = async (id) => {
    try {
      const target = layoutTables.find(t => t.id === id);
      await tablesAPI.delete(id);
      setLayoutTables(prev => prev.filter(t => t.id !== id));
      sayWithDelay(pickRandom([
        `${target?.table_number || '테이블'} 삭제했어요! 필요하면 다시 추가할 수 있어요.`,
        `삭제 완료! 테이블 배치를 원하는 대로 조정해보세요.`,
      ]), 0);
    } catch (e) {
      console.error('테이블 삭제 실패:', e);
    }
  };

  // ── Step 3: 테이블 추가
  const handleAddTable = async () => {
    if (!newTableName.trim()) return;
    setSaving(true);
    try {
      // 빈 자리 찾기 (기존 테이블과 겹치지 않는 위치)
      const existX = layoutTables.map(t => t.x);
      const safeX = Math.max(...existX, 0) + CARD_W + 20;
      const res = await tablesAPI.create({
        store_id: createdStore.id, table_number: newTableName.trim(),
        capacity: newTableCap, x: Math.min(safeX, 500), y: 180,
      });
      const t = res?.data || res;
      setLayoutTables(prev => [...prev, { ...t, x: t.x ?? Math.min(safeX, 500), y: t.y ?? 180 }]);
      setNewTableName(''); setNewTableCap(4); setAddingTable(false);
      sayWithDelay(pickRandom([
        `${newTableName} 테이블이 추가됐어요! 드래그해서 위치를 잡아보세요.`,
        `${newTableName} 완성! 테이블을 원하는 위치로 옮겨볼까요?`,
        `${newTableName} 추가 완료! 매장이 점점 완성되어 가요!`,
      ]), 0, true);
    } catch (e) {
      console.error('테이블 추가 실패:', e);
    } finally {
      setSaving(false);
    }
  };

  // ── Step 3: 배치 저장 (위치 일괄 업데이트 후 Step 4)
  const handleSaveLayout = async () => {
    setSaving(true);
    sayWithDelay(pickRandom([
      '테이블 배치를 저장하고 있어요! 잠깐만요...',
      `${layoutTables.length}개 테이블 배치를 저장 중이에요!`,
    ]), 0);
    try {
      await Promise.all(layoutTables.map(t => tablesAPI.update(t.id, { x: t.x, y: t.y })));
      sayWithDelay(pickRandom([
        '테이블 배치 저장 완료! 이제 QR 코드만 출력하면 끝이에요! 🎉',
        `${layoutTables.length}개 테이블 배치 완료! 드디어 마지막 단계예요!`,
        '완벽한 레이아웃이에요! QR 코드를 출력하러 가볼까요?',
      ]), 100, true);
      setTimeout(() => setStep(4), 900);
    } catch (e) {
      sayWithDelay(pickRandom([
        '저장 중 오류가 발생했어요. 다시 시도해주세요!',
        '앗, 잠깐 문제가 생겼어요! 다시 한 번 시도해볼까요?',
      ]), 0);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── QR URL
  const getMenuUrl = (table) =>
    `${window.location.origin}/menu/${createdStore?.id}?table=${encodeURIComponent(table.table_number || '')}`;
  const getQrImgUrl = (table) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(getMenuUrl(table))}&bgcolor=ffffff&color=0f172a&margin=6`;

  // ── 완료
  const handleFinish = () => {
    sessionStorage.setItem('wm_setup_skipped', '1');
    const celebrations = [
      { msg: '🎉 완성! 사장님 정말 대단해요! 이제 스마트 매장 운영을 시작해볼까요?', delay: 0, happy: true },
      { msg: '팅커벨이 항상 응원할게요! 주문이 쏟아지기 시작할 거예요!', delay: 2500, happy: true },
    ];
    celebrations.forEach(({ msg, delay, happy }) => sayWithDelay(msg, delay, happy));
    const dest = createdStore?.id ? `/admin/stores/${createdStore.id}/orders` : '/admin';
    setTimeout(() => navigate(dest), 2000);
  };

  // ── 메뉴 아이템 관리
  const addMenuItem    = () => setMenuItems(p => [...p, { name: '', price: '', description: '' }]);
  const removeMenuItem = (i) => setMenuItems(p => p.filter((_, idx) => idx !== i));
  const updateMenuItem = (i, f, v) => setMenuItems(p => p.map((m, idx) => idx === i ? { ...m, [f]: v } : m));

  // ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-start px-4 py-8">
      <style>{`
        /* 화면에서는 인쇄 영역 숨김 */
        #qr-print-area { display: none; }

        @media print {
          /* A4 여백 없음 — 카드 자체가 여백 포함 */
          @page { size: A4 portrait; margin: 0; }
          /* 배경색·그라디언트 강제 인쇄 */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          /* 화면 UI 전체 숨김 */
          body * { visibility: hidden !important; }
          /* 인쇄 영역만 표시 */
          #qr-print-area { display: grid !important; visibility: visible !important; }
          #qr-print-area * { visibility: visible !important; }
          /* A4 2×2 고정 격자: 105mm × 148.5mm 카드 4장 */
          #qr-print-area {
            position: fixed; top: 0; left: 0;
            width: 210mm;
            grid-template-columns: 105mm 105mm;
            grid-auto-rows: 148.5mm;
            gap: 0;
            background: white;
          }
        }
      `}</style>

      {/* 상단 */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <span className="text-white font-black text-sm">위마켓 매장 설정</span>
        </div>
        <button onClick={() => setVoiceEnabled(v => !v)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${voiceEnabled ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
          {voiceEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          {voiceEnabled ? '음성 ON' : '음성 OFF'}
        </button>
      </div>

      {/* ── Welcome ── */}
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="welcome" initial={{ opacity:0, scale:0.92 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.92 }}
            className="w-full max-w-2xl">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-10 text-center">
              <motion.div animate={{ y:[-6,6,-6] }} transition={{ duration:3, repeat:Infinity, ease:'easeInOut' }} className="flex justify-center mb-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl shadow-orange-500/40">
                  <svg viewBox="0 0 24 24" fill="white" width="44" height="44">
                    <path d="M12 2l1.8 6.6c.2.7.8 1.3 1.5 1.5L22 12l-6.7 1.9c-.7.2-1.3.8-1.5 1.5L12 22l-1.8-6.6c-.2-.7-.8-1.3-1.5-1.5L2 12l6.7-1.9c.7-.2 1.3-.8 1.5-1.5L12 2z" />
                  </svg>
                </div>
              </motion.div>
              <h1 className="text-3xl font-black text-white mb-2">안녕하세요, 사장님! ✨</h1>
              <p className="text-slate-400 text-base mb-2">저는 AI 도우미 <span className="text-amber-400 font-black">팅커벨</span>이에요!</p>
              <p className="text-slate-400 text-sm mb-8">지금부터 <strong className="text-white">4단계</strong>로 매장 설정을 도와드릴게요.<br />어렵지 않으니 따라오세요! 😊</p>
              <div className="grid grid-cols-4 gap-3 mb-8">
                {STEPS.map(s => { const Icon = s.icon; return (
                  <div key={s.id} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/10">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center">
                      <Icon size={16} className="text-amber-400" />
                    </div>
                    <span className="text-xs font-bold text-slate-400">{s.label}</span>
                  </div>
                );})}
              </div>
              <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }} onClick={() => setStep(1)}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black text-base shadow-xl shadow-orange-500/30 flex items-center justify-center gap-2">
                지금 시작하기 <ArrowRight size={18} />
              </motion.button>
              <div className="flex items-center justify-between mt-4">
                <button onClick={() => { sessionStorage.setItem('wm_setup_skipped','1'); navigate('/admin'); }}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                  건너뛰고 대시보드로 가기
                </button>
                <button onClick={() => setVoiceEnabled(v => !v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${voiceEnabled ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                  {voiceEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
                  음성 {voiceEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── 스텝 공통 래퍼 ── */}
        {step >= 1 && step <= 4 && (
          <motion.div key="steps" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="w-full max-w-2xl space-y-6">

            {/* 진행 바 */}
            <div className="flex items-center gap-2">
              {STEPS.map((s, i) => { const Icon = s.icon; const done = step > s.id; const active = step === s.id; return (
                <div key={s.id} className="flex-1 flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all flex-shrink-0 ${done ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : active ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' : 'bg-white/5 text-slate-600 border border-white/10'}`}>
                    {done ? <Check size={12} /> : <Icon size={12} />}
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded-full ${done ? 'bg-emerald-500/40' : 'bg-white/10'}`} />}
                </div>
              );})}
            </div>

            <AnimatePresence mode="wait">

              {/* ── STEP 1: 매장 정보 ── */}
              {step === 1 && (
                <motion.div key="s1" initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-30 }}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-7">
                  <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2"><Store size={20} className="text-amber-400" /> 매장 정보 입력</h2>

                  {/* 팅커벨 인라인 가이드 — 서식 위에서 입력 순서 안내 */}
                  <Step1InlineGuide focus={step1Focus} form={storeForm} customBtype={customBtype} voiceEnabled={voiceEnabled} />

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-1.5">① 매장 이름 *</label>
                      <input type="text" aria-label="매장 이름" value={storeForm.name}
                        onChange={e => setStoreForm(p => ({...p, name: e.target.value}))}
                        onFocus={() => setStep1Focus('name')}
                        placeholder="예: 홍길동 카페"
                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:bg-white/15 transition-all text-sm font-bold" />
                    </div>
                    <div>
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-2">② 업종 *</label>
                      <BusinessTypePicker
                        value={storeForm.business_type}
                        customValue={customBtype}
                        onChange={v => setStoreForm(p => ({...p, business_type: v}))}
                        onCustomChange={setCustomBtype}
                        onPickerFocus={() => setStep1Focus('business_type')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-black text-slate-400 block mb-1.5 flex items-center gap-1"><Clock size={11} /> ③ 영업 시작</label>
                        <input type="time" aria-label="영업 시작 시간" value={storeForm.open_time}
                          onChange={e => setStoreForm(p => ({...p, open_time: e.target.value}))}
                          onFocus={() => setStep1Focus('time')}
                          className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50 transition-all" />
                      </div>
                      <div>
                        <label className="text-xs font-black text-slate-400 block mb-1.5 flex items-center gap-1"><Clock size={11} /> 영업 마감</label>
                        <input type="time" aria-label="영업 마감 시간" value={storeForm.close_time}
                          onChange={e => setStoreForm(p => ({...p, close_time: e.target.value}))}
                          onFocus={() => setStep1Focus('time')}
                          className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50 transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-black text-slate-400 block mb-1.5 flex items-center gap-1"><Phone size={11} /> ④ 연락처 (선택)</label>
                      <input type="tel" aria-label="연락처" value={storeForm.phone}
                        onChange={e => setStoreForm(p => ({...p, phone: e.target.value}))}
                        onFocus={() => setStep1Focus('phone')}
                        placeholder="010-1234-5678"
                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-all text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-black text-slate-400 block mb-1.5 flex items-center gap-1"><MapPin size={11} /> ⑤ 주소 (선택)</label>
                      <input type="text" aria-label="주소" value={storeForm.address}
                        onChange={e => setStoreForm(p => ({...p, address: e.target.value}))}
                        onFocus={() => setStep1Focus('address')}
                        placeholder="서울시 강남구..."
                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-all text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-black text-slate-400 block mb-1.5">⑥ 매장 소개 (선택)</label>
                      <textarea rows={2} value={storeForm.description}
                        onChange={e => setStoreForm(p => ({...p, description: e.target.value}))}
                        onFocus={() => setStep1Focus('description')}
                        placeholder="매장에 대한 간단한 소개"
                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-all text-sm resize-none" />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button onClick={() => setStep(0)} className="px-5 py-3 bg-white/5 border border-white/10 text-slate-400 rounded-2xl font-bold text-sm hover:bg-white/10 transition-all flex items-center gap-1.5">
                      <ArrowLeft size={14} /> 이전
                    </button>
                    <motion.button whileHover={{ scale:1.01 }} whileTap={{ scale:0.98 }} onClick={handleSaveStore}
                      disabled={!storeForm.name.trim() || saving}
                      className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-orange-500/20 disabled:opacity-40 flex items-center justify-center gap-2">
                      {saving ? <><Loader2 size={16} className="animate-spin" /> 저장 중...</> : <>매장 저장 <ArrowRight size={14} /></>}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 2: 메뉴 등록 ── */}
              {step === 2 && (
                <motion.div key="s2" initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-30 }}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-7">
                  <h2 className="text-xl font-black text-white mb-1 flex items-center gap-2"><ChefHat size={20} className="text-amber-400" /> 메뉴 등록</h2>
                  {/* 팅커벨 상단 안내 */}
                  <div className="flex items-center gap-3 mb-5 px-3 py-2.5 bg-gradient-to-r from-violet-500/[0.08] to-purple-500/[0.05] rounded-2xl border border-violet-500/20">
                    <div className="relative flex-shrink-0 w-[38px] h-[38px]">
                      <motion.div className="relative w-[38px] h-[38px]"
                        animate={{ y:[-3,5,-3], rotate:[-2.5,2.5,-2.5] }}
                        transition={{ duration:3.2, repeat:Infinity, ease:'easeInOut' }}>
                        <motion.div className="absolute inset-0 -m-1.5 rounded-full"
                          style={{ background:'radial-gradient(circle, rgba(139,92,246,.5) 0%, transparent 72%)' }}
                          animate={{ scale:[1,1.2,1], opacity:[0.5,0.9,0.5] }}
                          transition={{ duration:2.3, repeat:Infinity, ease:'easeInOut' }} />
                        <Wing side="left" /><Wing side="right" />
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[24px] h-[24px] rounded-full flex items-center justify-center"
                          style={{ background:'radial-gradient(circle at 34% 28%, #FFF8E7, #F59E0B 62%, #D97706)', boxShadow:'0 2px 10px rgba(245,159,11,.5)' }}>
                          <svg viewBox="0 0 24 24" fill="white" width="12" height="12">
                            <path d="M12 2l1.8 6.6c.2.7.8 1.3 1.5 1.5L22 12l-6.7 1.9c-.7.2-1.3.8-1.5 1.5L12 22l-1.8-6.6c-.2-.7-.8-1.3-1.5-1.5L2 12l6.7-1.9c.7-.2 1.3-.8 1.5-1.5L12 2z" />
                          </svg>
                        </div>
                      </motion.div>
                    </div>
                    <p className="text-[12px] font-bold text-violet-200 leading-relaxed flex-1">
                      메뉴 이름을 입력한 뒤 <span className="text-violet-300 font-black">AI ✨ 버튼</span>을 눌러보세요! 설명과 가격을 자동으로 완성해드려요.
                    </p>
                  </div>
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {menuItems.map((item, idx) => (
                      <motion.div key={idx} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <div className="flex gap-2 mb-2">
                          <input type="text" aria-label="메뉴 이름" value={item.name} onChange={e => updateMenuItem(idx, 'name', e.target.value)}
                            onFocus={() => {
                              if (!item.name.trim()) {
                                sayWithDelay(pickRandom([
                                  '대표 메뉴 이름을 입력해보세요! AI가 설명과 가격을 완성해줄게요!',
                                  '메뉴 이름 입력 후 AI 버튼을 눌러보세요!',
                                  '어떤 메뉴를 판매하시나요? 이름만 입력하면 AI가 도와드려요!',
                                ]), 0);
                              }
                            }}
                            placeholder="메뉴 이름 (예: 아메리카노)"
                            className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-sm font-bold focus:outline-none focus:border-amber-500/50 transition-all" />
                          <input type="number" aria-label="메뉴 가격" value={item.price} onChange={e => updateMenuItem(idx, 'price', e.target.value)}
                            placeholder="가격"
                            className="w-24 px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-sm font-bold focus:outline-none focus:border-amber-500/50 transition-all" />
                        </div>
                        <div className="flex gap-2">
                          <input type="text" aria-label="메뉴 설명" value={item.description} onChange={e => updateMenuItem(idx, 'description', e.target.value)}
                            placeholder="메뉴 설명 (AI 자동완성 가능)"
                            className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-xs focus:outline-none focus:border-amber-500/50 transition-all" />
                          <button onClick={() => handleAISuggest(idx)} disabled={aiLoadingIdx === idx}
                            className="px-3 py-2 bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30 text-violet-300 rounded-xl text-xs font-black hover:from-violet-500/30 transition-all disabled:opacity-50 flex items-center gap-1 flex-shrink-0">
                            {aiLoadingIdx === idx ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} AI
                          </button>
                          {menuItems.length > 1 && (
                            <button onClick={() => removeMenuItem(idx)} className="p-2 text-rose-400/60 hover:text-rose-400 rounded-xl hover:bg-rose-500/10 transition-all">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <button onClick={addMenuItem}
                    className="mt-3 w-full py-2.5 border border-dashed border-white/20 text-slate-500 rounded-2xl text-sm font-bold hover:border-amber-500/30 hover:text-amber-400 transition-all flex items-center justify-center gap-1.5">
                    <Plus size={14} /> 메뉴 추가
                  </button>
                  <div className="flex gap-3 mt-5">
                    <button onClick={() => setStep(1)} className="px-5 py-3 bg-white/5 border border-white/10 text-slate-400 rounded-2xl font-bold text-sm hover:bg-white/10 transition-all flex items-center gap-1.5">
                      <ArrowLeft size={14} /> 이전
                    </button>
                    <motion.button whileHover={{ scale:1.01 }} whileTap={{ scale:0.98 }} onClick={handleSaveMenus} disabled={saving}
                      className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-orange-500/20 disabled:opacity-40 flex items-center justify-center gap-2">
                      {saving ? <><Loader2 size={16} className="animate-spin" /> 저장 중...</> : <>메뉴 저장 <ArrowRight size={14} /></>}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 3: 테이블 설정 (모바일 최적화 리스트) ── */}
              {step === 3 && (
                <motion.div key="s3" initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-30 }}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-7">
                  <h2 className="text-xl font-black text-white mb-1 flex items-center gap-2"><LayoutGrid size={20} className="text-amber-400" /> 테이블 설정</h2>
                  <p className="text-xs text-slate-500 mb-4">테이블을 추가하거나 삭제해보세요. QR 주문 시 테이블 번호가 표시돼요.</p>

                  {/* 팅커벨 인라인 힌트 */}
                  <div className="flex items-center gap-2.5 mb-4 px-3 py-2.5 bg-gradient-to-r from-amber-500/[0.07] to-orange-500/[0.04] rounded-2xl border border-amber-500/20">
                    <span className="text-base flex-shrink-0">✨</span>
                    <p className="text-[12px] font-bold text-amber-200/80 leading-relaxed">
                      기본 테이블 3개가 자동 추가됐어요! 필요에 따라 삭제하거나 더 추가해보세요.
                    </p>
                  </div>

                  {/* 테이블 카드 리스트 — 1열 (모바일 기본) */}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {layoutTables.length === 0 && (
                      <div className="py-10 text-center text-slate-600 text-sm font-bold">
                        테이블을 추가해주세요
                      </div>
                    )}
                    <AnimatePresence>
                      {layoutTables.map((table, idx) => {
                        const isBase = table.table_number === '기본QR';
                        return (
                          <motion.div
                            key={table.id}
                            initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, x:-20, height:0 }}
                            transition={{ delay: idx * 0.04 }}
                            className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all ${
                              isBase
                                ? 'bg-amber-500/10 border-amber-500/30'
                                : 'bg-white/5 border-white/10 hover:border-white/20'
                            }`}>
                            {/* 아이콘 */}
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              isBase ? 'bg-amber-500/20' : 'bg-slate-700/70'
                            }`}>
                              {isBase
                                ? <QrCode size={16} className="text-amber-400" />
                                : <LayoutGrid size={16} className="text-slate-300" />
                              }
                            </div>
                            {/* 정보 */}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-black truncate ${isBase ? 'text-amber-300' : 'text-white'}`}>
                                {table.table_number}
                              </p>
                              <p className={`text-[11px] ${isBase ? 'text-amber-500/80' : 'text-slate-500'}`}>
                                {isBase ? '매장 공통 QR — 테이블 미지정 주문용' : `${table.capacity}인석`}
                              </p>
                            </div>
                            {/* 삭제 버튼 (기본QR은 삭제 불가) */}
                            {!isBase && (
                              <button
                                onClick={() => handleDeleteTable(table.id)}
                                className="p-2 text-rose-400/50 hover:text-rose-400 rounded-xl hover:bg-rose-500/10 transition-all flex-shrink-0"
                              >
                                <X size={15} />
                              </button>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* 테이블 카운트 + 추가 버튼 */}
                  <div className="flex items-center justify-between mt-3 mb-1">
                    <span className="text-xs text-slate-500 font-bold">
                      총 <span className="text-white">{layoutTables.length}</span>개
                      <span className="ml-1 text-slate-600">(기본QR 포함)</span>
                    </span>
                    <button
                      onClick={() => setAddingTable(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 hover:border-amber-500/30 hover:text-amber-400 text-slate-400 rounded-xl text-xs font-bold transition-all">
                      <Plus size={12} /> 테이블 추가
                    </button>
                  </div>

                  {/* 테이블 추가 패널 */}
                  <AnimatePresence>
                    {addingTable && (
                      <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                        className="overflow-hidden">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mt-2 space-y-2">
                          <input type="text" aria-label="테이블 이름" value={newTableName} onChange={e => setNewTableName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddTable()}
                            placeholder="테이블 이름 (예: 테이블04, 룸A, 야외1)"
                            className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-sm font-bold focus:outline-none focus:border-amber-500/50 transition-all" />
                          <div className="flex gap-2">
                            <select value={newTableCap} onChange={e => setNewTableCap(Number(e.target.value))}
                              className="flex-1 px-3 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50 transition-all">
                              {[2,4,6,8,10].map(n => <option key={n} value={n}>{n}인석</option>)}
                            </select>
                            <button onClick={handleAddTable} disabled={!newTableName.trim() || saving}
                              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-black disabled:opacity-40 transition-all flex items-center justify-center gap-1.5">
                              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} 추가
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-3 mt-5">
                    <button onClick={() => setStep(2)} className="px-5 py-3 bg-white/5 border border-white/10 text-slate-400 rounded-2xl font-bold text-sm hover:bg-white/10 transition-all flex items-center gap-1.5">
                      <ArrowLeft size={14} /> 이전
                    </button>
                    <motion.button whileHover={{ scale:1.01 }} whileTap={{ scale:0.98 }} onClick={handleSaveLayout} disabled={saving}
                      className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-orange-500/20 disabled:opacity-40 flex items-center justify-center gap-2">
                      {saving ? <><Loader2 size={16} className="animate-spin" /> 저장 중...</> : <>다음 단계 <ArrowRight size={14} /></>}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 4: QR 코드 A4 인쇄 ── */}
              {step === 4 && (() => {
                const storeName = createdStore?.name || '위마켓 매장';
                const initial   = storeName.trim()[0] || 'W';
                const phone     = (createdStore?.phone || storeForm?.phone || '').trim();

                // ── 인쇄 카드 공용 렌더 (모두 인라인 스타일 — CSS 충돌 없음)
                const renderPrintCard = (table) => {
                  const isBase = table.table_number === '기본QR';
                  return (
                    <div key={table.id} style={{
                      width: '105mm', height: '148.5mm', boxSizing: 'border-box',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      backgroundColor: '#ffffff', border: '0.4mm solid #e2e8f0',
                      pageBreakInside: 'avoid', breakInside: 'avoid',
                      overflow: 'hidden', position: 'relative',
                      fontFamily: 'sans-serif',
                    }}>
                      {/* 상단 amber 그라디언트 바 */}
                      <div style={{ width: '100%', height: '3.5mm', flexShrink: 0,
                        background: 'linear-gradient(90deg,#f59e0b,#ea580c)' }} />

                      {/* 카드 내용 */}
                      <div style={{
                        padding: '3.5mm 5mm 3mm', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', flex: 1, width: '100%', boxSizing: 'border-box',
                      }}>
                        {/* 로고 + 상호 */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5mm', marginBottom: '2mm' }}>
                          <div style={{
                            width: '12mm', height: '12mm', borderRadius: '50%',
                            background: 'linear-gradient(135deg,#f59e0b,#ea580c)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: '6mm', fontWeight: 900, lineHeight: 1,
                          }}>{initial}</div>
                          <p style={{ margin: 0, fontSize: '4mm', fontWeight: 900, color: '#0f172a',
                            textAlign: 'center', lineHeight: 1.2, wordBreak: 'keep-all' }}>
                            {storeName}
                          </p>
                        </div>

                        {/* 구분선 */}
                        <div style={{ width: '100%', height: '0.3mm', background: '#e2e8f0', margin: '1.5mm 0' }} />

                        {/* QR 코드 — 55mm 고정 */}
                        <img
                          src={getQrImgUrl(table)}
                          alt={`QR ${table.table_number}`}
                          style={{ width: '58mm', height: '58mm', display: 'block', margin: '1.5mm 0' }}
                        />

                        {/* 구분선 */}
                        <div style={{ width: '100%', height: '0.3mm', background: '#e2e8f0', margin: '1.5mm 0' }} />

                        {/* 업종 배지 (기본QR 전용) */}
                        {isBase && (
                          <span style={{
                            display: 'inline-block', background: '#fef3c7', color: '#b45309',
                            fontSize: '2.8mm', fontWeight: 700, padding: '0.5mm 2.5mm',
                            borderRadius: '1.5mm', marginBottom: '1mm',
                          }}>매장 공통</span>
                        )}

                        {/* 테이블 번호 */}
                        <p style={{ margin: '0 0 1.5mm', fontSize: '6.5mm', fontWeight: 900,
                          color: '#0f172a', textAlign: 'center', lineHeight: 1.1 }}>
                          {isBase ? '테이블 없이 주문' : table.table_number}
                        </p>

                        {/* 전화번호 */}
                        {phone && (
                          <p style={{ margin: '0 0 1.5mm', fontSize: '3mm', color: '#475569',
                            fontWeight: 600, textAlign: 'center' }}>
                            ☎ {phone}
                          </p>
                        )}

                        {/* 안내 문구 */}
                        <p style={{ margin: '1.5mm 0 0', fontSize: '3mm', color: '#64748b',
                          textAlign: 'center', lineHeight: 1.6, wordBreak: 'keep-all' }}>
                          📱 QR코드를 스캔하면<br />메뉴를 확인하고 주문하실 수 있습니다
                        </p>

                        {/* 푸터 */}
                        <p style={{ marginTop: 'auto', paddingTop: '2mm', fontSize: '2.2mm',
                          color: '#cbd5e1', textAlign: 'center' }}>
                          Powered by 위마켓
                        </p>
                      </div>
                    </div>
                  );
                };

                return (
                  <motion.div key="s4" initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-30 }}
                    className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-7">
                    <h2 className="text-xl font-black text-white mb-1 flex items-center gap-2"><QrCode size={20} className="text-amber-400" /> QR 코드 출력</h2>

                    {/* 축하 배너 */}
                    <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
                      className="flex items-center gap-3 mb-4 px-4 py-3 bg-gradient-to-r from-emerald-500/15 to-teal-500/10 rounded-2xl border border-emerald-500/25">
                      <motion.div animate={{ rotate:[0,10,-10,0], scale:[1,1.1,1] }} transition={{ duration:1, repeat:Infinity, repeatDelay:2 }}
                        className="text-xl flex-shrink-0">🎉</motion.div>
                      <div className="flex-1">
                        <p className="text-[13px] font-black text-emerald-300">매장 설정 완료!</p>
                        <p className="text-[11px] text-emerald-400/80">A4 한 장에 4개씩 인쇄됩니다. 코팅 후 각 테이블에 붙여두세요!</p>
                      </div>
                    </motion.div>

                    {/* 인쇄 안내 칩 */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {['📄 A4 자동 4분할','🏪 매장 로고·상호','📞 전화번호','📱 스캔 안내문'].map(t => (
                        <span key={t} className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-[11px] text-slate-400 font-bold">{t}</span>
                      ))}
                    </div>

                    {/* ── 화면 미리보기 (Tailwind, 인쇄 시 숨겨짐) ── */}
                    <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1 mb-4">
                      {layoutTables.map(table => {
                        const isBase = table.table_number === '기본QR';
                        return (
                          <div key={table.id} className="bg-white rounded-2xl border border-slate-100 flex flex-col items-center p-3 gap-1 overflow-hidden"
                            style={{ borderTop: '3px solid #f59e0b' }}>
                            {/* 상호 */}
                            <div className="flex items-center gap-1.5 w-full justify-center mb-1">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                                style={{ background: 'linear-gradient(135deg,#f59e0b,#ea580c)' }}>{initial}</div>
                              <p className="text-[10px] font-black text-slate-800 truncate">{storeName}</p>
                            </div>
                            {/* QR */}
                            <img src={getQrImgUrl(table)} alt={`QR ${table.table_number}`}
                              className="w-20 h-20" loading="eager" />
                            {/* 정보 */}
                            {isBase && <span className="text-[8px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">매장 공통</span>}
                            <p className="text-[11px] font-black text-slate-800 text-center">{isBase ? '테이블 없이 주문' : table.table_number}</p>
                            {phone && <p className="text-[9px] text-slate-500">☎ {phone}</p>}
                            <div className="w-full h-px bg-slate-100 my-0.5" />
                            <p className="text-[8px] text-slate-400 text-center leading-tight">📱 QR스캔 → 메뉴 → 주문</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* ── 실제 인쇄 영역 (화면에서 숨겨짐, 인쇄 시 A4 격자로 표시) ── */}
                    <div id="qr-print-area">
                      {layoutTables.map(t => renderPrintCard(t))}
                    </div>

                    <p className="text-[11px] text-slate-600 text-center mb-4">
                      💡 5장 이상은 자동으로 다음 페이지 · 코팅 후 사용 시 오래 써요
                    </p>

                    {/* 버튼 */}
                    <div className="flex gap-3">
                      <button onClick={() => setStep(3)} className="px-5 py-3 bg-white/5 border border-white/10 text-slate-400 rounded-2xl font-bold text-sm hover:bg-white/10 transition-all flex items-center gap-1.5">
                        <ArrowLeft size={14} /> 이전
                      </button>
                      <button onClick={() => {
                        sayWithDelay(pickRandom([
                          'QR 인쇄 시작! 코팅해서 테이블에 붙여두면 더 오래 쓸 수 있어요!',
                          '인쇄 후 각 테이블에 붙여두면 손님이 바로 주문할 수 있어요!',
                        ]), 0);
                        window.print();
                      }}
                        className="flex-1 py-3 bg-gradient-to-r from-slate-700 to-slate-600 border border-slate-500/50 text-white rounded-2xl font-bold text-sm hover:from-slate-600 transition-all flex items-center justify-center gap-2">
                        🖨️ A4 인쇄
                      </button>
                      <motion.button whileHover={{ scale:1.01 }} whileTap={{ scale:0.98 }} onClick={handleFinish}
                        className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
                        <PartyPopper size={15} /> 설정 완료!
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })()}

            </AnimatePresence>

            {/* 팅커벨 — Step 1은 인라인 가이드가 주 안내, 하단에는 Step 전환 메시지만 표시 */}
            {step >= 2 && (
              <div className="flex justify-end">
                <WizardTinkerbell message={tbMsg} isHappy={tbHappy} voiceEnabled={voiceEnabled} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
