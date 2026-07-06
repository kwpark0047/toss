import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Check } from 'lucide-react';
import Button from '../common/Button';

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
            className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-[480px] z-[60] bg-white rounded-t-[32px] max-h-[85vh] overflow-hidden flex flex-col shadow-2xl bottom-sheet"
          >
            <div className="w-12 h-1.5 bg-grey-200 rounded-full mx-auto my-3" />
            
            <div className="px-6 pb-4 flex items-center justify-between border-b border-grey-50">
              <div>
                <h2 className="tds-title text-grey-900">{item.name}</h2>
                <p className="tds-body text-grey-500 mt-0.5">{formatPrice(item.price)}</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-grey-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-grey-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {optionGroups.map((group) => (
                <div key={group.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="tds-body-strong text-grey-800 flex items-center gap-2">
                      {group.name}
                      {group.is_required && <span className="bg-primary/10 text-primary text-[9px] px-1.5 py-0.5 rounded uppercase font-black">필수</span>}
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-1.5">
                    {group.choices.map((choice) => {
                      const isSelected = selections[group.id]?.id === choice.id;
                      return (
                        <button
                          key={choice.id}
                          onClick={() => toggleChoice(group, choice)}
                          className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                            isSelected ? 'border-primary bg-primary/5' : 'border-grey-100 bg-white hover:border-grey-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-primary border-primary' : 'border-grey-200'
                            }`}>
                              {isSelected && <Check size={10} className="text-white" strokeWidth={4} />}
                            </div>
                            <span className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-grey-700'}`}>{choice.name}</span>
                          </div>
                          {choice.price_adjustment > 0 && (
                            <span className={`text-[11px] font-black ${isSelected ? 'text-primary' : 'text-grey-400'}`}>
                              +{formatPrice(choice.price_adjustment)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="space-y-3">
                <h3 className="tds-body-strong text-grey-800">수량 선택</h3>
                <div className="flex items-center justify-center gap-6 bg-grey-50 rounded-2xl py-4">
                  <button 
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-grey-600 active:scale-90 transition-transform"
                  >
                    <Minus size={20} strokeWidth={3} />
                  </button>
                  <span className="text-2xl font-black text-grey-900 w-10 text-center">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(q => q + 1)}
                    className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-grey-600 active:scale-90 transition-transform"
                  >
                    <Plus size={20} strokeWidth={3} />
                  </button>
                </div>
              </div>
            </div>

            <div className="px-4 py-4 bg-grey-50">
              <Button variant="primary" size="lg" fullWidth layout="between" onClick={handleConfirm}>
                <span>장바구니 담기</span>
                <span className="bg-white/20 px-3 py-1 rounded-full text-sm">{formatPrice(calculateTotal())}</span>
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default OptionSelectionModal;
