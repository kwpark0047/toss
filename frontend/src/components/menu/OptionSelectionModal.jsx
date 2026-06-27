import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Check } from 'lucide-react';

const OptionSelectionModal = ({ isOpen, onClose, onConfirm, item, optionGroups }) => {
  const [quantity, setQuantity] = useState(1);
  const [selections, setSelections] = useState(() => {
    const initial = {};
    if (optionGroups) {
      optionGroups.forEach(group => {
        if (group.is_required && group.choices.length > 0) {
          initial[group.id] = group.choices[0];
        }
      });
    }
    return initial;
  });

  const formatPrice = (price) => new Intl.NumberFormat('ko-KR').format(price) + '원';

  const toggleChoice = (group, choice) => {
    if (group.max_choices === 1) {
      setSelections(prev => ({ ...prev, [group.id]: choice }));
    } else {
      // 다중 선택 로직 (필요시 구현)
    }
  };

  const calculateTotal = () => {
    let base = item.price;
    Object.values(selections).forEach(choice => {
      base += choice.price_adjustment || 0;
    });
    return base * quantity;
  };

  const handleConfirm = () => {
    const selectedOptions = Object.entries(selections).map(([groupId, choice]) => {
      const group = optionGroups.find(g => g.id === groupId);
      return {
        groupId,
        groupName: group.name,
        choiceId: choice.id,
        choiceName: choice.name,
        priceAdjustment: choice.price_adjustment || 0
      };
    });
    onConfirm(quantity, selectedOptions, calculateTotal());
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-[32px] max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-3" />
            
            <div className="px-6 pb-4 flex items-center justify-between border-b border-slate-50">
              <div>
                <h2 className="text-xl font-black text-slate-900">{item.name}</h2>
                <p className="text-sm text-slate-400 mt-0.5">{formatPrice(item.price)}</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
              {optionGroups.map((group) => (
                <div key={group.id} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-slate-800 flex items-center gap-2">
                      {group.name}
                      {group.is_required && <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded uppercase font-black">필수</span>}
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {group.choices.map((choice) => {
                      const isSelected = selections[group.id]?.id === choice.id;
                      return (
                        <button
                          key={choice.id}
                          onClick={() => toggleChoice(group, choice)}
                          className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                            isSelected ? 'border-primary bg-primary/5' : 'border-slate-100 bg-white hover:border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-primary border-primary' : 'border-slate-200'
                            }`}>
                              {isSelected && <Check size={12} className="text-white" strokeWidth={4} />}
                            </div>
                            <span className={`font-bold ${isSelected ? 'text-primary' : 'text-slate-700'}`}>{choice.name}</span>
                          </div>
                          {choice.price_adjustment > 0 && (
                            <span className={`text-xs font-black ${isSelected ? 'text-primary' : 'text-slate-400'}`}>
                              +{formatPrice(choice.price_adjustment)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="space-y-4 pt-4">
                <h3 className="font-black text-slate-800">수량 선택</h3>
                <div className="flex items-center justify-center gap-8 bg-slate-50 rounded-2xl py-6">
                  <button 
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-slate-600 active:scale-90 transition-transform"
                  >
                    <Minus size={24} strokeWidth={3} />
                  </button>
                  <span className="text-3xl font-black text-slate-900 w-12 text-center">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(q => q + 1)}
                    className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-slate-600 active:scale-90 transition-transform"
                  >
                    <Plus size={24} strokeWidth={3} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleConfirm}
                className="w-full h-16 bg-primary text-white rounded-2xl font-black text-lg shadow-xl shadow-primary/20 flex items-center justify-between px-8"
              >
                <span>장바구니 담기</span>
                <span className="bg-white/20 px-4 py-1.5 rounded-full text-base">{formatPrice(calculateTotal())}</span>
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default OptionSelectionModal;
