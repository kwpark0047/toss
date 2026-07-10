import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Star, Plus, Timer, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import MenuItemImage from './MenuItemImage';
import { formatPrice } from '../../utils/format';

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
      className={`p-5 grid gap-6 ${theme.layoutMode === 'grid' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1'}`}
    >
      <AnimatePresence mode="popLayout">
        {filteredProducts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center py-20 bg-white/40 rounded-[3rem] border-2 border-dashed border-slate-200 col-span-full"
            style={{ color: theme.textColor + "80" }}
          >
            <ShoppingCart size={48} className="mx-auto mb-4 opacity-20" />
            {t('menu.no_items')}
          </motion.div>
        ) : (
          filteredProducts.map((p) => {
            // 레이아웃 모드에 따른 카드 렌더링 분기
            if (theme.layoutMode === 'grid') {
              return (
                <motion.div
                  layout
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-white/80 backdrop-blur-md rounded-[2rem] overflow-hidden border border-white/60 shadow-lg shadow-slate-200/50 group flex flex-col h-full"
                >
                  <div className="aspect-square relative overflow-hidden bg-slate-100">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : <div className="w-full h-full flex items-center justify-center text-slate-300"><Star size={32} /></div>}
                    {p.is_best && <span className="absolute top-3 left-3 bg-orange-500 text-white text-[9px] font-black px-2 py-1 rounded-lg">BEST</span>}
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-black text-sm line-clamp-1 mb-1" style={{ color: theme.textColor }}>{translatedDescriptions[p.id + '_name'] || p.name}</h3>
                      <p className="text-[10px] opacity-50 line-clamp-2 leading-relaxed" style={{ color: theme.textColor }}>{translatedDescriptions[p.id] || p.description}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="font-black text-sm" style={{ color: theme.primaryColor }}>{formatPrice(p.price)}</span>
                      {p.is_sold_out ? (
                        <span className="text-[9px] font-black text-rose-500">SOLD OUT</span>
                      ) : (
                        <button onClick={() => addToCart(p)} className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-md shadow-orange-500/20" style={{ background: gradientBg }}>
                          <Plus size={16} strokeWidth={3} />
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
                className={`${isMagazine ? 'grid grid-cols-5 h-48 sm:h-56' : 'flex gap-5'} bg-white/80 backdrop-blur-md p-5 rounded-[2.5rem] border border-white/60 shadow-xl shadow-slate-200/50 group relative overflow-hidden`}
              >
                <div
                  className="absolute top-0 left-0 bottom-0 w-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: theme.primaryColor }}
                />

                {/* 이미지 영역 */}
                <div className={`${isMagazine ? 'col-span-2 -m-5 mr-5 rounded-none' : 'relative shrink-0'}`}>
                  <MenuItemImage src={p.image_url} alt={p.name} isMagazine={isMagazine} />
                  {p.is_best && !isMagazine && (
                    <span className="absolute -top-2 -left-2 bg-orange-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg uppercase tracking-tighter">BEST</span>
                  )}
                </div>

                {/* 내용 영역 */}
                <div className={`${isMagazine ? 'col-span-3' : 'flex-1'} min-w-0 flex flex-col justify-center`}>
                  <div className="flex items-center gap-2">
                    {p.is_best && isMagazine && <span className="text-[10px] font-black text-orange-500 uppercase">Featured Menu</span>}
                    <h3 className={`${isMagazine ? 'text-2xl' : 'text-xl'} font-black tracking-tight group-hover:text-orange-600 transition-colors`} style={{ color: theme.textColor }}>
                      {translatedDescriptions[p.id + '_name'] || p.name}
                    </h3>
                    {p.is_new && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                  </div>

                  <div className="flex items-center gap-2 mt-1.5 mb-3">
                    {p.description && (
                      <p className="text-sm line-clamp-2 leading-relaxed opacity-60 font-medium flex-1 text-slate-600">
                        {translatedDescriptions[p.id] || p.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-end justify-between mt-auto">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-tight">
                        <Timer size={12} className="text-slate-300" />
                        <span>Ready in {p.cooking_time || 5} min</span>
                      </div>
                      <p className={`${isMagazine ? 'text-3xl' : 'text-2xl'} font-black`} style={{ color: theme.primaryColor }}>{formatPrice(p.price)}</p>
                    </div>

                    {p.is_sold_out ? (
                      <div className="px-5 py-2.5 bg-slate-100 text-slate-400 rounded-2xl font-black text-sm border border-slate-200 uppercase italic tracking-widest">
                        Sold Out
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {isMagazine && (
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => { setSelectedStoryProduct(p); setShowStoryModal(true); }}
                            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black hover:bg-slate-800 transition-all flex items-center gap-1.5"
                          >
                            <Sparkles size={12} className="text-blue-400" /> AI Story
                          </motion.button>
                        )}
                        <motion.button
                          whileHover={{ scale: 1.1, rotate: 90 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => addToCart(p)}
                          className="w-12 h-12 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30 transition-shadow group-hover:shadow-orange-500/50"
                          style={{ background: gradientBg }}
                        >
                          <Plus size={24} strokeWidth={3} />
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
