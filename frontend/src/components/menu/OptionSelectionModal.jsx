import { formatWon } from '../../utils/format';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '../common/Button';
import { vibrateClick } from '../../utils/notificationSound';

const OptionSelectionModal = ({ isOpen, onClose, onConfirm, item, optionGroups }) => {
  const [quantity, setQuantity] = useState(1);
  const { t } = useTranslation();
  const [selections, setSelections] = useState({});

  const getGroupChoices = (group) => Array.isArray(group.choices) ? group.choices.filter(choice => choice?.is_active !== false && choice?.isActive !== false) : [];
  const getMinChoices = (group) => Math.max(0, Number(group.min_choices ?? (group.is_required ? 1 : 0)) || 0);
  const getMaxChoices = (group) => Math.max(1, Number(group.max_choices) || (group.type === 'checkbox' ? getGroupChoices(group).length : 1));
  const isMultiple = (group) => group.type === 'checkbox' || getMaxChoices(group) > 1;
  const getSelectedChoices = (group) => Array.isArray(selections[group.id]) ? selections[group.id] : [];

  const toggleChoice = (group, choice) => {
    const selected = getSelectedChoices(group);
    const choiceId = String(choice.id ?? choice.name);
    const alreadySelected = selected.some(item => String(item.id ?? item.name) === choiceId);
    if (!isMultiple(group)) {
      setSelections(prev => ({ ...prev, [group.id]: [choice] }));
      return;
    }
    if (alreadySelected) {
      setSelections(prev => ({ ...prev, [group.id]: selected.filter(item => String(item.id ?? item.name) !== choiceId) }));
      return;
    }
    if (selected.length >= getMaxChoices(group)) return;
    setSelections(prev => ({ ...prev, [group.id]: [...selected, choice] }));
  };

  const canConfirm = (optionGroups || []).every(group => getSelectedChoices(group).length >= getMinChoices(group));

  const calculateTotal = () => {
    let base = Number(item.price) || 0;
    Object.values(selections).forEach(choices => {
      (Array.isArray(choices) ? choices : []).forEach(choice => {
        base += Number(choice.price_adjustment) || 0;
      });
    });
    return base * quantity;
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    const selectedOptions = Object.entries(selections).flatMap(([groupId, choices]) => {
      const group = optionGroups.find(g => String(g.id) === String(groupId));
      return (Array.isArray(choices) ? choices : []).map(choice => ({
        groupId,
        groupName: group.name,
        choiceId: choice.id,
        choiceName: choice.name,
        priceAdjustment: Number(choice.price_adjustment) || 0
      }));
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
            className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-[480px] z-[60] cust-bg-card rounded-t-[32px] max-h-[85vh] overflow-hidden flex flex-col shadow-2xl bottom-sheet"
          >
            <div className="w-12 h-1.5 bg-grey-200 dark:bg-white/10 rounded-full mx-auto my-3" />
            
            <div className="px-6 pb-4 flex items-center justify-between border-b cust-border">
              <div>
                <h2 className="tds-title cust-text-main">{item.name}</h2>
                <p className="tds-body cust-text-sub mt-0.5">{formatWon(item.price)}</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-grey-100 dark:hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6 text-grey-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {optionGroups.map((group) => (
                <div key={group.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="tds-body-strong cust-text-main flex items-center gap-2">
                      {group.name}
                      {getMinChoices(group) > 0 ? <span className="bg-primary/10 text-primary text-[9px] px-1.5 py-0.5 rounded uppercase font-black">필수 · {getMinChoices(group)}개 이상</span> : <span className="text-[10px] cust-text-sub">선택</span>}
                    </h3>
                    {isMultiple(group) && <span className="text-[10px] cust-text-sub">최대 {getMaxChoices(group)}개</span>}
                  </div>
                  
                  <div className="grid grid-cols-1 gap-1.5">
                    {getGroupChoices(group).map((choice, choiceIndex) => {
                      const selected = getSelectedChoices(group);
                      const isSelected = selected.some(item => String(item.id ?? item.name) === String(choice.id ?? choice.name));
                      const blockedByMax = isMultiple(group) && !isSelected && selected.length >= getMaxChoices(group);
                      const choiceKey = choice.id ?? `${group.id}-${choiceIndex}`;
                      return (
                        <button
                          key={choiceKey}
                          type="button"
                          onClick={() => {
                            vibrateClick();
                            toggleChoice(group, choice);
                          }}
                          disabled={blockedByMax}
                          aria-pressed={isSelected}
                          className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
                            isSelected ? 'border-primary bg-primary/5' : 'cust-border bg-white dark:bg-white/5 hover:brightness-95'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`${isMultiple(group) ? 'rounded' : 'rounded-full'} w-4 h-4 border-2 flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-primary border-primary' : 'border-grey-200 dark:border-white/10'
                            }`}>
                              {isSelected && <Check size={10} className="text-white" strokeWidth={4} />}
                            </div>
                            <span className={`text-sm font-bold ${isSelected ? 'text-primary' : 'cust-text-main'}`}>{choice.name}</span>
                          </div>
                          {Number(choice.price_adjustment) > 0 && (
                            <span className={`text-[11px] font-black ${isSelected ? 'text-primary' : 'text-grey-400'}`}>
                              +{formatWon(Number(choice.price_adjustment))}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="space-y-3">
                <h3 className="tds-body-strong cust-text-main">{t('option.quantity')}</h3>
                <div className="flex items-center justify-center gap-6 bg-grey-50 dark:bg-white/5 rounded-2xl py-4">
                  <button 
                    onClick={() => {
                      vibrateClick();
                      setQuantity(q => Math.max(1, q - 1));
                    }}
                    className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-md flex items-center justify-center text-grey-600 dark:text-slate-300 active:scale-90 transition-transform"
                  >
                    <Minus size={20} strokeWidth={3} />
                  </button>
                  <span className="text-2xl font-black cust-text-main w-10 text-center">{quantity}</span>
                  <button 
                    onClick={() => {
                      vibrateClick();
                      setQuantity(q => q + 1);
                    }}
                    className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-md flex items-center justify-center text-grey-600 dark:text-slate-300 active:scale-90 transition-transform"
                  >
                    <Plus size={20} strokeWidth={3} />
                  </button>
                </div>
              </div>
            </div>

            <div className="px-4 py-4 bg-grey-50 dark:bg-black/20">
              <Button 
                variant="primary" 
                size="lg" 
                fullWidth 
                layout="between" 
                disabled={!canConfirm}
                onClick={() => {
                  vibrateClick();
                  handleConfirm();
                }}
              >
                <span>{canConfirm ? t('option.add_to_cart') : '필수 옵션을 선택해 주세요'}</span>
                <span className="bg-white/20 px-3 py-1 rounded-full text-sm">{formatWon(calculateTotal())}</span>
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default OptionSelectionModal;
