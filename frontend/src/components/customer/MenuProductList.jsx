import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import MenuItemImage from './MenuItemImage';
import { formatPrice } from '../../utils/format';
import Icon from '../ui/Icon';

export default function MenuProductList({
  filteredProducts,
  theme,
  translatedDescriptions,
  addToCart,
  setSelectedStoryProduct,
  setShowStoryModal,
  gradientBg
}) {
  const { t } = useTranslation();

  return (
    <motion.div
      layout
      className={`tds-stack tds-gap-4 ${theme.layoutMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3' : 'tds-stack'}`}
    >
      <AnimatePresence mode="popLayout">
        {filteredProducts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="tds-stack items-center justify-center py-20 bg-white/40 rounded-[3rem] border-2 border-dashed border-slate-200 col-span-full"
            style={{ color: theme.textColor + '80' }}
          >
            <Icon icon="ShoppingCart" />
            {t('menu.no_items')}
          </motion.div>
        ) : (
          filteredProducts.map((p) => {
            if (theme.layoutMode === 'grid') {
              return (
                <motion.div
                  layout
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileTap={{ scale: 0.98 }}
                  className="tds-stack bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-md group flex flex-col h-full"
                >
                  <div className="aspect-[4/3] relative overflow-hidden bg-slate-100">
                    <MenuItemImage 
                      src={p.image_url} 
                      alt={p.name} 
                      isMagazine={false}
                    />
                    {p.is_best && (
                      <span className="absolute top-2 left-2 tds-badge tds-badge-popular tds-stack-h tds-gap-1 items-center">
                        <Icon icon="Flame" />
                        베스트
                      </span>
                    )}
                    {p.is_new && (
                      <span className="absolute top-2 right-2 bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg">
                        NEW
                      </span>
                    )}
                  </div>
                  <div className="tds-p-3 tds-stack flex-1 flex flex-col justify-between tds-gap-1">
                    <div>
                      <h3 className="tds-text-bold text-sm line-clamp-1 mb-1" style={{ color: theme.textColor }}>
                        {translatedDescriptions[p.id + '_name'] || p.name}
                      </h3>
                      <p className="tds-caption opacity-50 line-clamp-2 leading-relaxed" style={{ color: theme.textColor }}>
                        {translatedDescriptions[p.id] || p.description}
                      </p>
                    </div>
                    <div className="tds-stack-h tds-gap-2 items-center justify-between mt-3">
                      <span className="tds-text-bold text-base" style={{ color: theme.primaryColor }}>
                        {formatPrice(p.price)}
                      </span>
                      {p.is_sold_out ? (
                        <span className="tds-caption font-black text-rose-500">SOLD OUT</span>
                      ) : (
                        <button 
                          onClick={() => addToCart(p)} 
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-md"
                          style={{ background: gradientBg }}
                        >
                          <Icon icon="Plus" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            }

            const isMagazine = theme.layoutMode === 'magazine';

            return (
              <motion.div
                layout
                key={p.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`${isMagazine ? 'grid grid-cols-5 h-48 sm:h-56' : 'tds-stack-h tds-gap-5'} bg-white/80 backdrop-blur-md tds-p-5 rounded-[2.5rem] border border-white/60 shadow-xl shadow-slate-200/50 group relative overflow-hidden`}
              >
                <div
                  className="absolute top-0 left-0 bottom-0 w-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: theme.primaryColor }}
                />

                {/* 이미지 영역 */}
                <div className={`${isMagazine ? 'col-span-2 -m-5 mr-5 rounded-none' : 'relative shrink-0'}`}>
                  <MenuItemImage src={p.image_url} alt={p.name} isMagazine={isMagazine} />
                  {p.is_best && !isMagazine && (
                    <span className="absolute -top-2 -left-2 bg-orange-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg uppercase tracking-tighter flex items-center gap-0.5 tds-badge tds-badge-popular tds-stack-h tds-gap-1 items-center">
                      <Icon icon="Flame" />
                      BEST
                    </span>
                  )}
                </div>

                {/* 내용 영역 */}
                <div className={`${isMagazine ? 'col-span-3' : 'flex-1'} min-w-0 flex flex-col justify-center`}>
                  <div className="tds-stack-h tds-gap-2 items-center">
                    {p.is_best && isMagazine && (
                      <span className="tds-stack-h tds-gap-0.5 tds-caption text-orange-500 uppercase font-black flex items-center">
                        <Icon icon="Flame" />
                        Featured Menu
                      </span>
                    )}
                    <h3 className={`${isMagazine ? 'tds-text-bold text-2xl' : 'tds-text-bold text-xl'} tracking-tight group-hover:text-orange-600 transition-colors`} style={{ color: theme.textColor }}>
                      {translatedDescriptions[p.id + '_name'] || p.name}
                    </h3>
                    {p.is_new && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                  </div>

                  <div className="tds-stack-h tds-gap-2 mt-1.5 mb-3">
                    {p.description && (
                      <p className="tds-text line-clamp-2 leading-relaxed opacity-60 font-medium flex-1 text-slate-600">
                        {translatedDescriptions[p.id] || p.description}
                      </p>
                    )}
                  </div>

                  <div className="tds-stack-h tds-gap-2 items-end justify-between mt-auto">
                    <div className="tds-stack tds-gap-1">
                      <div className="tds-stack-h tds-gap-1.5 tds-small font-black text-slate-400 uppercase tracking-tight">
                        <Icon icon="Timer" />
                        <span>Ready in {p.cooking_time || 5} min</span>
                      </div>
                      <p className={`${isMagazine ? 'tds-text-bold text-3xl' : 'tds-text-bold text-2xl'}`} style={{ color: theme.primaryColor }}>
                        {formatPrice(p.price)}
                      </p>
                    </div>

                    {p.is_sold_out ? (
                      <div className="tds-p-2 tds-p-2.5 bg-slate-100 text-slate-400 rounded-2xl font-black text-sm border border-slate-200 uppercase italic tracking-widest">
                        Sold Out
                      </div>
                    ) : (
                      <div className="tds-stack-h tds-gap-2">
                        {isMagazine && (
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => { setSelectedStoryProduct(p); setShowStoryModal(true); }}
                            className="tds-p-1 tds-p-2 bg-slate-900 text-white rounded-xl tds-small font-black hover:bg-slate-800 transition-all flex items-center gap-1.5"
                          >
                            <Icon icon="Sparkles" />
                            AI Story
                          </motion.button>
                        )}
                        <motion.button
                          whileHover={{ scale: 1.1, rotate: 90 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => addToCart(p)}
                          className="w-12 h-12 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30 transition-shadow group-hover:shadow-orange-500/50"
                          style={{ background: gradientBg }}
                        >
                          <Icon icon="Plus" />
                        </motion.button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </AnimatePresence>
    </motion.div>
  );
}