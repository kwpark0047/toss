import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Flame, Sparkles } from 'lucide-react';

// TDS ListRow 상하 패딩 프리셋 (S/M/L/XL)
const PADDING = { S: 'py-2', M: 'py-3', L: 'py-4', XL: 'py-5' };

/**
 * MenuItemCard — TDS ListRow 패턴 (leading 썸네일 · content 타이틀/설명 · trailing 가격+담기)
 * 행은 리스트 그룹 안에서 flush 배치되며, 상하 패딩은 padding prop(S/M/L/XL)으로 조절.
 */
const MenuItemCard = ({ item, hasOptions, isPopular, isNew, onAddToCart, disabled, padding = 'L' }) => {
  const formatPrice = (price) => new Intl.NumberFormat('ko-KR').format(price) + '원';
  const py = PADDING[padding] || PADDING.L;

  return (
    <motion.div
      whileTap={!disabled ? { scale: 0.99 } : {}}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`${item.name} 담기`}
      onClick={() => !disabled && onAddToCart(item)}
      onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onAddToCart(item); } }}
      className={`flex items-center gap-3 px-4 ${py} transition-colors ${
        disabled ? 'opacity-60 grayscale cursor-not-allowed' : 'hover:bg-slate-50 active:bg-slate-100 cursor-pointer'
      }`}
    >
      {/* Leading — 썸네일 */}
      <div className="relative w-16 h-16 rounded-xl bg-slate-50 overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-100">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl">{item.emoji || '🍽️'}</span>
        )}
        <div className="absolute top-0.5 left-0.5 flex flex-col gap-0.5">
          {isPopular && (
            <div className="bg-orange-500 text-white p-0.5 rounded-lg shadow"><Flame size={10} fill="currentColor" /></div>
          )}
          {isNew && (
            <div className="bg-blue-500 text-white p-0.5 rounded-lg shadow"><Sparkles size={10} fill="currentColor" /></div>
          )}
        </div>
      </div>

      {/* Content — 타이틀 + 설명 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="tds-body-strong text-grey-900 truncate">{item.name}</h3>
          {hasOptions && (
            <span className="text-[9px] bg-grey-100 text-grey-500 px-1.5 py-0.5 rounded font-bold whitespace-nowrap flex-shrink-0">옵션</span>
          )}
        </div>
        {item.description && (
          <p className="tds-caption text-grey-500 line-clamp-1 mt-0.5">{item.description}</p>
        )}
        <span className="block tds-body-strong text-grey-900 mt-1">{formatPrice(item.price)}</span>
      </div>

      {/* Trailing — 담기 */}
      <div className="flex-shrink-0 self-center">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Plus size={18} strokeWidth={3} />
        </div>
      </div>
    </motion.div>
  );
};

export default MenuItemCard;
