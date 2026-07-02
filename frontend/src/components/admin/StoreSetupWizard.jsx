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
function BusinessTypePicker({ value, customValue, onChange, onCustomChange }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);

  const popular = POPULAR_VALUES.map(v => ALL_BTYPES.find(b => b.value === v)).filter(Boolean);
  const filtered = search.trim()
    ? ALL_BTYPES.filter(b => b.label.includes(search) || b.value.includes(search.toLowerCase()))
    : null;

  const isCustom = value === '__custom__';
  const selectedLabel = isCustom ? customValue : getBtypeLabel(value);

  const select = (v) => { onChange(v); setSearch(''); setExpanded(false); };

  const CardBtn = ({ opt }) => (
    <button type="button" onClick={() => select(opt.value)}
      className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-2xl border text-center transition-all ${value === opt.value ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400 hover:border-amber-500/30 hover:text-amber-300'}`}>
      <span className="text-lg leading-none">{opt.icon}</span>
      <span className="text-[11px] font-bold leading-tight">{opt.label}</span>
    </button>
  );

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
            onFocus={() => setExpanded(true)}
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
          {filtered.map(opt => <CardBtn key={opt.value} opt={opt} />)}
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
            {popular.map(opt => <CardBtn key={opt.value} opt={opt} />)}
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
                      {grp.types.map(opt => <CardBtn key={opt.value} opt={opt} />)}
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
      0: '안녕하세요, 사장님! 저는 팅커벨이에요! ✨ 위마켓 가입을 환영합니다! 지금부터 매장 설정을 함께 해볼까요?',
      1: '먼저 매장 이름과 업종을 입력해주세요! 정보는 나중에 언제든지 수정할 수 있어요.',
      2: '이번엔 메뉴를 등록해볼까요? AI 자동완성 버튼을 눌러보세요!',
      3: '기본 테이블이 자동으로 배치됐어요! 드래그해서 위치를 바꾸거나 × 버튼으로 삭제할 수 있어요.',
      4: 'QR 코드가 준비됐어요! 인쇄해서 각 테이블에 붙여주세요. 손님들이 바로 주문할 수 있어요! 🎉',
    };
    if (scripts[step]) sayWithDelay(scripts[step], 300, step === 4);
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
      setCreatedStore(store);

      // 기본 카테고리 생성
      const catRes = await categoriesAPI.create({ store_id: store.id, name: '기본 메뉴' });
      setCreatedCategory(catRes?.data || catRes);

      // 기본 테이블 4개 자동 생성 (기본QR + 테이블01,02,03)
      sayWithDelay('매장 정보 저장 완료! 기본 테이블도 자동으로 만들고 있어요...', 100, true);
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

      sayWithDelay('완벽해요! 이제 메뉴를 등록해볼까요? 😊', 800, true);
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
    if (!name) { sayWithDelay('메뉴 이름을 먼저 입력해주세요!', 0); return; }
    setAiLoadingIdx(idx);
    sayWithDelay('잠깐만요! AI가 메뉴 정보를 분석 중이에요 ✨', 0);
    try {
      const btype = getBtypeLabel(storeForm.business_type, customBtype);
      const res = await aiAPI.proposeMenuFull({ name, categoryName: btype });
      const p = res?.proposal;
      if (p) {
        const newItems = [...menuItems];
        newItems[idx] = { ...newItems[idx], description: p.description || '', price: p.price ? String(p.price) : newItems[idx].price };
        setMenuItems(newItems);
        sayWithDelay(`"${name}" 메뉴 정보 완성! 가격이나 설명을 수정해도 돼요!`, 100, true);
      } else {
        sayWithDelay('AI 추천을 받지 못했어요. 직접 입력해주세요!', 0);
      }
    } catch {
      sayWithDelay('AI 서비스에 일시적인 문제가 있어요. 직접 입력해주세요!', 0);
    } finally {
      setAiLoadingIdx(null);
    }
  };

  // ── Step 2: 메뉴 저장
  const handleSaveMenus = async () => {
    const valid = menuItems.filter(m => m.name.trim() && m.price);
    if (valid.length === 0) { sayWithDelay('메뉴를 최소 한 개 이상 입력해주세요!', 0); return; }
    setSaving(true);
    try {
      const products = valid.map(m => ({
        name: m.name.trim(), price: parseInt(m.price, 10) || 0,
        description: m.description?.trim() || '', category_id: createdCategory?.id || null, is_active: true,
      }));
      const res = await productsAPI.bulkCreate({ store_id: createdStore.id, products });
      setCreatedMenus(res?.data || res || []);
      sayWithDelay('맛있겠다! 메뉴 등록 완료! 이제 테이블 배치를 확인해볼까요? 🍽️', 100, true);
      setTimeout(() => setStep(3), 900);
    } catch (e) {
      sayWithDelay('저장 중 오류가 발생했어요. 다시 시도해주세요!', 0);
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
      await tablesAPI.delete(id);
      setLayoutTables(prev => prev.filter(t => t.id !== id));
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
      sayWithDelay(`${newTableName} 테이블이 추가됐어요!`, 0, true);
    } catch (e) {
      console.error('테이블 추가 실패:', e);
    } finally {
      setSaving(false);
    }
  };

  // ── Step 3: 배치 저장 (위치 일괄 업데이트 후 Step 4)
  const handleSaveLayout = async () => {
    setSaving(true);
    sayWithDelay('테이블 배치를 저장하고 있어요!', 0);
    try {
      await Promise.all(layoutTables.map(t => tablesAPI.update(t.id, { x: t.x, y: t.y })));
      sayWithDelay('테이블 배치 저장 완료! QR 코드를 확인해볼까요? 🎉', 100, true);
      setTimeout(() => setStep(4), 900);
    } catch (e) {
      sayWithDelay('저장 중 오류가 발생했어요. 다시 시도해주세요!', 0);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── QR URL
  const getMenuUrl = (table) =>
    `${window.location.origin}/menu/${createdStore?.id}?table=${encodeURIComponent(table.table_number || '')}`;
  const getQrImgUrl = (table) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getMenuUrl(table))}&bgcolor=ffffff&color=0f172a&margin=4`;

  // ── 완료
  const handleFinish = () => {
    sessionStorage.setItem('wm_setup_skipped', '1');
    sayWithDelay('축하드려요 사장님! 이제 영업 시작! 팅커벨이 항상 응원할게요! ✨', 0, true);
    const dest = createdStore?.id ? `/admin/stores/${createdStore.id}/orders` : '/admin';
    setTimeout(() => navigate(dest), 1500);
  };

  // ── 메뉴 아이템 관리
  const addMenuItem    = () => setMenuItems(p => [...p, { name: '', price: '', description: '' }]);
  const removeMenuItem = (i) => setMenuItems(p => p.filter((_, idx) => idx !== i));
  const updateMenuItem = (i, f, v) => setMenuItems(p => p.map((m, idx) => idx === i ? { ...m, [f]: v } : m));

  // ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-start px-4 py-8">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #qr-print-area, #qr-print-area * { visibility: visible !important; }
          #qr-print-area { position: fixed; inset: 0; display: flex; flex-wrap: wrap; gap: 16px; padding: 32px; align-content: flex-start; }
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
                시작하기 <ArrowRight size={18} />
              </motion.button>
              <button onClick={() => { sessionStorage.setItem('wm_setup_skipped','1'); navigate('/admin'); }}
                className="mt-4 text-xs text-slate-600 hover:text-slate-400 transition-colors">
                건너뛰고 대시보드로 가기
              </button>
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
                  <h2 className="text-xl font-black text-white mb-5 flex items-center gap-2"><Store size={20} className="text-amber-400" /> 매장 정보 입력</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-1.5">매장 이름 *</label>
                      <input type="text" value={storeForm.name} onChange={e => setStoreForm(p => ({...p, name: e.target.value}))}
                        placeholder="예: 홍길동 카페"
                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:bg-white/15 transition-all text-sm font-bold" />
                    </div>
                    <div>
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-2">업종 *</label>
                      <BusinessTypePicker
                        value={storeForm.business_type}
                        customValue={customBtype}
                        onChange={v => setStoreForm(p => ({...p, business_type: v}))}
                        onCustomChange={setCustomBtype}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-black text-slate-400 block mb-1.5 flex items-center gap-1"><Clock size={11} /> 영업 시작</label>
                        <input type="time" value={storeForm.open_time} onChange={e => setStoreForm(p => ({...p, open_time: e.target.value}))}
                          className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50 transition-all" />
                      </div>
                      <div>
                        <label className="text-xs font-black text-slate-400 block mb-1.5 flex items-center gap-1"><Clock size={11} /> 영업 마감</label>
                        <input type="time" value={storeForm.close_time} onChange={e => setStoreForm(p => ({...p, close_time: e.target.value}))}
                          className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50 transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-black text-slate-400 block mb-1.5 flex items-center gap-1"><Phone size={11} /> 연락처</label>
                      <input type="tel" value={storeForm.phone} onChange={e => setStoreForm(p => ({...p, phone: e.target.value}))} placeholder="010-1234-5678"
                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-all text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-black text-slate-400 block mb-1.5 flex items-center gap-1"><MapPin size={11} /> 주소</label>
                      <input type="text" value={storeForm.address} onChange={e => setStoreForm(p => ({...p, address: e.target.value}))} placeholder="서울시 강남구..."
                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-all text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-black text-slate-400 block mb-1.5">매장 소개 (선택)</label>
                      <textarea rows={2} value={storeForm.description} onChange={e => setStoreForm(p => ({...p, description: e.target.value}))}
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
                  <p className="text-xs text-slate-500 mb-5">메뉴 이름 입력 후 AI 버튼으로 설명/가격을 자동완성 해보세요</p>
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {menuItems.map((item, idx) => (
                      <motion.div key={idx} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <div className="flex gap-2 mb-2">
                          <input type="text" value={item.name} onChange={e => updateMenuItem(idx, 'name', e.target.value)}
                            placeholder="메뉴 이름 (예: 아메리카노)"
                            className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-sm font-bold focus:outline-none focus:border-amber-500/50 transition-all" />
                          <input type="number" value={item.price} onChange={e => updateMenuItem(idx, 'price', e.target.value)}
                            placeholder="가격"
                            className="w-24 px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-sm font-bold focus:outline-none focus:border-amber-500/50 transition-all" />
                        </div>
                        <div className="flex gap-2">
                          <input type="text" value={item.description} onChange={e => updateMenuItem(idx, 'description', e.target.value)}
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

              {/* ── STEP 3: 테이블 배치 (드래그 레이아웃) ── */}
              {step === 3 && (
                <motion.div key="s3" initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-30 }}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-7">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-black text-white flex items-center gap-2"><LayoutGrid size={20} className="text-amber-400" /> 테이블 배치</h2>
                      <p className="text-xs text-slate-500 mt-1">드래그해서 위치 변경 · 호버 시 × 버튼으로 삭제</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                      <span className="w-3 h-3 rounded-sm bg-amber-500/30 border border-amber-500/50 inline-block" />기본QR
                      <span className="w-3 h-3 rounded-sm bg-slate-600 border border-slate-500/50 inline-block ml-2" />테이블
                    </div>
                  </div>

                  {/* ── 플로어맵 캔버스 ── */}
                  <div
                    ref={canvasRef}
                    className="relative w-full rounded-2xl border border-white/10 overflow-hidden"
                    style={{
                      height: 280,
                      background: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
                      backgroundSize: '24px 24px',
                      backgroundColor: 'rgba(15,23,42,0.6)',
                    }}
                  >
                    {/* 빈 상태 */}
                    {layoutTables.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-sm font-bold">
                        테이블을 추가해주세요
                      </div>
                    )}

                    {/* 테이블 카드들 */}
                    {layoutTables.map(table => (
                      <TableLayoutCard
                        key={table.id}
                        table={table}
                        canvasRef={canvasRef}
                        onMove={handleMoveTable}
                        onDelete={handleDeleteTable}
                      />
                    ))}
                  </div>

                  {/* 테이블 카운트 + 추가 버튼 */}
                  <div className="flex items-center justify-between mt-3 mb-1">
                    <span className="text-xs text-slate-500 font-bold">
                      총 <span className="text-white">{layoutTables.length}</span>개 테이블
                      <span className="ml-2 text-slate-600">(기본QR 포함)</span>
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
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mt-2 flex gap-2 items-center">
                          <input type="text" value={newTableName} onChange={e => setNewTableName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddTable()}
                            placeholder="테이블 이름 (예: 테이블04)"
                            className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-sm font-bold focus:outline-none focus:border-amber-500/50 transition-all" />
                          <select value={newTableCap} onChange={e => setNewTableCap(Number(e.target.value))}
                            className="w-20 px-2 py-2 bg-white/10 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50 transition-all">
                            {[2,4,6,8,10].map(n => <option key={n} value={n}>{n}인석</option>)}
                          </select>
                          <button onClick={handleAddTable} disabled={!newTableName.trim() || saving}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-black disabled:opacity-40 transition-all flex items-center gap-1">
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} 추가
                          </button>
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
                      {saving ? <><Loader2 size={16} className="animate-spin" /> 저장 중...</> : <>배치 저장 <ArrowRight size={14} /></>}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 4: QR 코드 ── */}
              {step === 4 && (
                <motion.div key="s4" initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-30 }}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-7">
                  <h2 className="text-xl font-black text-white mb-1 flex items-center gap-2"><QrCode size={20} className="text-amber-400" /> QR 코드 출력</h2>
                  <p className="text-xs text-slate-500 mb-5">각 테이블의 QR 코드를 인쇄해서 붙여주세요</p>
                  <div id="qr-print-area" className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1 mb-5">
                    {layoutTables.map(table => (
                      <div key={table.id} className={`bg-white rounded-2xl p-4 flex flex-col items-center gap-2 border-2 ${table.table_number === '기본QR' ? 'border-amber-300' : 'border-slate-100'}`}>
                        <img src={getQrImgUrl(table)} alt={`QR ${table.table_number}`} className="w-24 h-24 rounded-lg" />
                        <p className={`text-xs font-black ${table.table_number === '기본QR' ? 'text-amber-600' : 'text-slate-800'}`}>
                          {table.table_number}
                        </p>
                        <p className="text-[9px] text-slate-400 text-center break-all">{getMenuUrl(table).slice(0, 40)}...</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => window.print()}
                      className="flex-1 py-3 bg-white/10 border border-white/20 text-white rounded-2xl font-bold text-sm hover:bg-white/20 transition-all flex items-center justify-center gap-2">
                      🖨️ QR 인쇄
                    </button>
                    <motion.button whileHover={{ scale:1.01 }} whileTap={{ scale:0.98 }} onClick={handleFinish}
                      className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
                      <PartyPopper size={15} /> 설정 완료!
                    </motion.button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>

            {/* 팅커벨 */}
            <div className="flex justify-end">
              <WizardTinkerbell message={tbMsg} isHappy={tbHappy} voiceEnabled={voiceEnabled} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
