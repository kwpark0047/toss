import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Flame, Sparkles } from 'lucide-react';

const MenuItemCard = ({ item, hasOptions, isPopular, isNew, onAddToCart, disabled }) => {
  const formatPrice = (price) => new Intl.NumberFormat('ko-KR').format(price) + '원';

  return (
    <motion.div
      whileTap={!disabled ? { scale: 0.98 } : {}}
      className={`bg-white rounded-2xl p-4 flex gap-4 border border-slate-100 shadow-sm transition-all ${
        disabled ? 'opacity-60 grayscale cursor-not-allowed' : 'hover:border-primary/20 hover:shadow-md'
      }`}
      onClick={() => !disabled && onAddToCart(item)}
    >
      <div className="relative w-24 h-24 rounded-xl bg-slate-50 overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-100">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="text-4xl">{item.emoji || '🍽️'}</span>
        )}
        
        {/* 배지 */}
        <div className="absolute top-1 left-1 flex flex-col gap-1">
          {isPopular && (
            <div className="bg-orange-500 text-white p-1 rounded-lg shadow-lg">
              <Flame size={12} fill="currentColor" />
            </div>
          )}
          {isNew && (
            <div className="bg-blue-500 text-white p-1 rounded-lg shadow-lg">
              <Sparkles size={12} fill="currentColor" />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-between py-0.5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-slate-900 leading-tight">{item.name}</h3>
            {hasOptions && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">옵션</span>}
          </div>
          {item.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>
        
        <div className="flex items-center justify-between mt-auto">
          <span className="text-[15px] font-black text-slate-900">{formatPrice(item.price)}</span>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Plus size={18} strokeWidth={3} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MenuItemCard;
