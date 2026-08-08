import { motion } from 'framer-motion';
import { ShoppingCart, CreditCard, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const STEPS = [
  { id: 'cart', icon: ShoppingCart, labelKey: 'menu.step_cart' },
  { id: 'payment', icon: CreditCard, labelKey: 'menu.step_payment' },
  { id: 'confirm', icon: CheckCircle, labelKey: 'menu.step_confirm' },
];

export default function OrderProgressBar({ currentStep, kioskMode = false, theme, themeStyles = {} }) {
  const { t } = useTranslation();
  const currentIndex = STEPS.findIndex(s => s.id === currentStep);
  
  const stepStyles = {
    container: kioskMode ? 'px-6 py-4' : 'px-4 py-3',
    stepGap: kioskMode ? 'gap-6' : 'gap-4',
    iconSize: kioskMode ? 28 : 22,
    labelSize: kioskMode ? 'text-base' : 'text-sm',
    lineWidth: kioskMode ? 6 : 4,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center ${stepStyles.container} relative`}
      style={{ background: theme.backgroundColor, ...themeStyles }}
      role="progressbar"
      aria-valuenow={currentIndex + 1}
      aria-valuemin={1}
      aria-valuemax={STEPS.length}
      aria-label={t('menu.order_progress')}
    >
      {/* 진행선 */}
      <div className="absolute left-1/2 -translate-x-1/2 top-1/2 w-full h-1 z-0" style={{ background: theme.borderColor }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(currentIndex / (STEPS.length - 1), 1) * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: theme.primaryColor }}
        />
      </div>

      {STEPS.map((step, index) => {
        const isActive = index <= currentIndex;
        const isCompleted = index < currentIndex;
        
        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="flex flex-col items-center relative z-10 flex-1"
          >
            <div className="flex flex-col items-center gap-2">
              <div className={`relative flex items-center justify-center transition-all duration-300 ${isActive ? 'scale-110' : ''}`}>
                {/* 외부 링 */}
                <div className={`absolute inset-0 rounded-full border-2 transition-all ${isCompleted ? '' : isActive ? 'animate-pulse' : ''}`} 
                     style={{ 
                       borderColor: isCompleted ? theme.primaryColor : isActive ? theme.primaryColor : theme.borderColor,
                       width: stepStyles.iconSize + 16,
                       height: stepStyles.iconSize + 16,
                     }}
                />
                {/* 내부 아이콘 영역 */}
                <div className={`relative w-[${stepStyles.iconSize}px] h-[${stepStyles.iconSize}px] rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCompleted ? 'bg-green-500' : isActive ? 'bg-white ring-4' : 'bg-slate-100'
                }`} style={{ 
                  ringColor: isActive ? theme.primaryColor : 'transparent',
                  backgroundColor: isCompleted ? '#10B981' : isActive ? theme.primaryColor : theme.backgroundColor,
                }}>
                  <step.icon size={stepStyles.iconSize} className={`transition-colors ${isCompleted || isActive ? 'text-white' : 'text-slate-400'}`} />
                  {isCompleted && <CheckCircle size={stepStyles.iconSize} className="text-white" />}
                </div>
              </div>
              
              <motion.span
                key={step.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`font-medium ${stepStyles.labelSize} truncate max-w-[100px] text-center transition-colors ${
                  isActive ? 'font-black' : 'font-medium'
                }`} style={{ 
                  color: isActive ? theme.primaryColor : theme.textColor,
                }}>
                {t(step.labelKey)}
              </motion.span>
              
              {/* 완료 체크마크 (라벨 아래) */}
              {isCompleted && (
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-green-500"
                >
                  <CheckCircle size={16} fill="currentColor" />
                </motion.div>
              )}
            </div>
            
            {/* 연결선 (마지막 제외) */}
            {index < STEPS.length - 1 && (
              <div className="absolute left-1/2 top-1/2 w-full h-1 z-0 pointer-events-none" />
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export { STEPS };