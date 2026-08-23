/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../../ui/Icon';

// ── 1인 사업자 인기 업종
export const POPULAR_VALUES = ['food_truck', 'cafe', 'korean', 'chicken', 'bakery', 'hair', 'fitness', 'academy'];

// ── 전체 업종 그룹
export const BTYPE_GROUPS = [
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

export const ALL_BTYPES = BTYPE_GROUPS.flatMap(g => g.types);

export const getBtypeLabel = (value, custom = '') =>
  ALL_BTYPES.find(b => b.value === value)?.label || custom || value || '기타';

export const CardBtn = ({ opt, selected, onSelect }) => (
  <button type="button" onClick={() => onSelect(opt.value)}
    className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-2xl border text-center transition-all ${selected === opt.value ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400 hover:border-amber-500/30 hover:text-amber-300'}`}>
    <span className="text-lg leading-none">{opt.icon}</span>
    <span className="text-[11px] font-bold leading-tight">{opt.label}</span>
  </button>
);

export default function BusinessTypePicker({ value, customValue, onChange, onCustomChange, onPickerFocus }) {
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
          <Icon icon="Search" size="md" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
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
        <div className="grid grid-cols-3 xs:grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1">
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
          <div className="grid grid-cols-3 xs:grid-cols-4 gap-1.5">
            {popular.map(opt => <CardBtn key={opt.value} opt={opt} selected={value} onSelect={select} />)}
          </div>

          {/* 전체 업종 보기 토글 */}
          <button type="button" onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-slate-500 hover:text-amber-400 transition-colors font-bold">
            {expanded ? <><Icon icon="ChevronUp" size="md" /> 접기</> : <><Icon icon="ChevronDown" size="md" /> 전체 업종 보기</>}
          </button>

          {/* 전체 그룹 목록 */}
          <AnimatePresence>
            {expanded && (
              <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                className="overflow-hidden space-y-3 max-h-64 overflow-y-auto pr-1">
                {BTYPE_GROUPS.map(grp => (
                  <div key={grp.group}>
                    <p className="text-[10px] font-black text-slate-600 mb-1.5">{grp.group}</p>
                    <div className="grid grid-cols-3 xs:grid-cols-4 gap-1.5">
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
            <Icon icon="PenLine" size="md" className="text-slate-500 flex-shrink-0" />
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
