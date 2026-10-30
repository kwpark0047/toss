import { motion } from 'framer-motion';
import { formatPriceWithOptions } from '../../lib/themePresets';
import { vibrateClick } from '../../utils/notificationSound';
import LazyImage from '../common/LazyImage';
import Icon from '../../components/ui/Icon';
import { normalizeAllergens } from '../../utils/menuMetadata';

// TDS ListRow 상하 패딩 프리셋 (S/M/L/XL) — TDS ListRow 패딩과 1:1 매핑
const PADDING = { S: 'py-2', M: 'py-3', L: 'py-4', XL: 'py-5' };

/**
 * MenuItemCard — TDS ListRow 패턴 (leading 썸네일 · content 타이틀/설명 · trailing 가격+담기)
 * 행은 리스트 그룹 안에서 flush 배치되며, 상하 패딩은 padding prop(S/M/L/XL)으로 조절.
 * options: { showBadge, priceFormat, showPriceUnit } — 매장 테마 설정(menu_options) 반영.
 * TDS 준수: 375px 기준, ListRow 패딩, Icon 래퍼, 타입 스케일 2단계(일반형/포스트형)
 */
const MenuItemCard = ({ item, hasOptions, isPopular, isNew, onAddToCart, disabled, isGrid = false, padding = 'L', options }) => {
  const py = PADDING[padding] || PADDING.L;
  const allergens = normalizeAllergens(item.allergens);
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
      aria-disabled={disabled}
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
      className={isGrid
        ? `flex min-w-0 flex-col overflow-hidden rounded-2xl border cust-border cust-bg-card text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${disabled ? 'cursor-not-allowed' : 'hover:shadow-md active:scale-[0.99] cursor-pointer'}`
        : `flex items-center gap-3 px-4 ${py} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
          disabled ? 'cursor-not-allowed' : 'hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-white/5 dark:active:bg-white/10 cursor-pointer'
        }`}
    >
      {/* Leading — 썸네일 (LazyImage 적용) */}
      <div className={isGrid ? 'relative w-full overflow-hidden bg-slate-100' : 'relative h-16 w-16 flex-shrink-0'}>
        <LazyImage
          src={item.image_url}
          alt={item.name}
          placeholderEmoji={item.emoji || '🍽️'}
          ratio={isGrid ? 'aspect-[4/3]' : 'aspect-square'}
          className={isGrid ? 'w-full rounded-none border-0' : 'rounded-xl'}
        />
        <div className="absolute top-0.5 left-0.5 flex flex-col gap-0.5 z-20">
          {showBadge && isPopular && (
            <div className="flex items-center gap-1 rounded-lg bg-orange-600 px-1.5 py-1 text-white shadow-sm" aria-label="인기 메뉴">
              <Icon icon="Flame" />
              {isGrid && <span className="text-[10px] font-bold">인기</span>}
            </div>
          )}
          {showBadge && isNew && (
            <div className="flex items-center gap-1 rounded-lg bg-blue-700 px-1.5 py-1 text-white shadow-sm" aria-label="신규 메뉴">
              <Icon icon="Sparkles" />
              {isGrid && <span className="text-[10px] font-bold">신메뉴</span>}
            </div>
          )}
        </div>
      </div>

      {/* Content — 타이틀 + 설명 */}
      <div className={isGrid ? 'flex min-w-0 flex-1 flex-col p-3 sm:p-4' : 'flex-1 min-w-0'}>
        <div className="flex min-w-0 items-start gap-1.5">
          <h3 className={`menu-name ${isGrid ? 'menu-name-multiline min-h-10 sm:min-h-11' : 'truncate'}`}>{item.name}</h3>
          {hasOptions && (
            <span className="menu-badge bg-grey-100 dark:bg-white/10 text-grey-500 dark:text-grey-400 px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0">옵션</span>
          )}
        </div>
        {item.description && (
          <p className={`menu-desc mt-0.5 ${isGrid ? 'menu-desc-multiline min-h-8' : ''}`}>{item.description}</p>
        )}
        {allergens.length > 0 && (
          <p className="mt-1 text-[11px] leading-snug text-amber-800 dark:text-amber-200" aria-label={`알레르기 유발 정보: ${allergens.join(', ')}`}>
            알레르기 정보 · {allergens.join(' · ')}
          </p>
        )}
        <div className={`flex items-center justify-between gap-2 ${isGrid ? 'mt-auto pt-3' : 'mt-1'}`}>
          <span className="menu-price block min-w-0 truncate">{formatPriceWithOptions(item.price, priceFormat, showPriceUnit)}</span>

          {/* Trailing — 담기 */}
          <span className={isGrid
            ? 'inline-flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center gap-1 rounded-xl bg-primary px-3 text-white shadow-sm'
            : 'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'}
          >
            <Icon icon="Plus" />
            {isGrid && <span className="text-xs font-bold">담기</span>}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default MenuItemCard;

