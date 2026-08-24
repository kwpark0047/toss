import { motion } from 'framer-motion';
import { formatPriceWithOptions } from '../../lib/themePresets';
import { vibrateClick } from '../../utils/notificationSound';
import LazyImage from '../common/LazyImage';
import Icon from '../../components/ui/Icon';

// TDS ListRow 상하 패딩 프리셋 (S/M/L/XL) — TDS ListRow 패딩과 1:1 매핑
const PADDING = { S: 'py-2', M: 'py-3', L: 'py-4', XL: 'py-5' };

/**
 * MenuItemCard — TDS ListRow 패턴 (leading 썸네일 · content 타이틀/설명 · trailing 가격+담기)
 * 행은 리스트 그룹 안에서 flush 배치되며, 상하 패딩은 padding prop(S/M/L/XL)으로 조절.
 * options: { showBadge, priceFormat, showPriceUnit } — 매장 테마 설정(menu_options) 반영.
 * TDS 준수: 375px 기준, ListRow 패딩, Icon 래퍼, 타입 스케일 2단계(일반형/포스트형)
 */
const MenuItemCard = ({ item, hasOptions, isPopular, isNew, onAddToCart, disabled, padding = 'L', options }) => {
  const py = PADDING[padding] || PADDING.L;
  const {
    showBadge = true,
    priceFormat = 'comma',
    showPriceUnit = '원'
  } = options || {};

  return (
    <motion.div
      whileTap={!disabled ? { scale: 0.99 } : {}}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`${item.name} 담기`}
      onClick={() => {
        if (!disabled) {
          vibrateClick();
          onAddToCart(item);
        }
      }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          vibrateClick();
          onAddToCart(item);
        }
      }}
      className={`flex items-center gap-3 px-4 ${py} transition-colors ${
        disabled ? 'opacity-60 grayscale cursor-not-allowed' : 'hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-white/5 dark:active:bg-white/10 cursor-pointer'
      }`}
    >
      {/* Leading — 썸네일 (LazyImage 적용) */}
      <div className="relative w-16 h-16 flex-shrink-0">
        <LazyImage 
          src={item.image_url} 
          alt={item.name} 
          placeholderEmoji={item.emoji || '🍽️'}
          className="rounded-xl"
        />
        <div className="absolute top-0.5 left-0.5 flex flex-col gap-0.5 z-20">
          {showBadge && isPopular && (
            <div className="bg-orange-500 text-white p-0.5 rounded-lg shadow">
              <Icon icon="Flame" />
            </div>
          )}
          {showBadge && isNew && (
            <div className="bg-blue-500 text-white p-0.5 rounded-lg shadow">
              <Icon icon="Sparkles" />
            </div>
          )}
        </div>
      </div>

      {/* Content — 타이틀 + 설명 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="menu-name truncate">{item.name}</h3>
          {hasOptions && (
            <span className="menu-badge bg-grey-100 dark:bg-white/10 text-grey-500 dark:text-grey-400 px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0">옵션</span>
          )}
        </div>
        {item.description && (
          <p className="menu-desc mt-0.5">{item.description}</p>
        )}
        <span className="menu-price mt-1 block">{formatPriceWithOptions(item.price, priceFormat, showPriceUnit)}</span>
      </div>

      {/* Trailing — 담기 */}
      <div className="flex-shrink-0 self-center">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Icon icon="Plus" />
        </div>
      </div>
    </motion.div>
  );
};

export default MenuItemCard;
