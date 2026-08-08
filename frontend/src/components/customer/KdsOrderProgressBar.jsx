import { motion } from 'framer-motion';
import { Flame, CheckCircle, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const KDS_STEPS = [
  { id: 'pending', icon: Clock, labelKey: 'kds.step_pending', color: 'amber' },
  { id: 'preparing', icon: Flame, labelKey: 'kds.step_preparing', color: 'orange' },
  { id: 'ready', icon: CheckCircle, labelKey: 'kds.step_ready', color: 'emerald' },
];

const colorClasses = {
  amber: { bg: 'bg-amber-500', ring: 'ring-amber-500', light: 'bg-amber-100', text: 'text-amber-700' },
  orange: { bg: 'bg-orange-500', ring: 'ring-orange-500', light: 'bg-orange-100', text: 'text-orange-700' },
  emerald: { bg: 'bg-emerald-500', ring: 'ring-emerald-500', light: 'bg-emerald-100', text: 'text-emerald-700' },
};

export default function KdsOrderProgressBar({ currentStatus, compact = false }) {
  const { t } = useTranslation();
  const currentIndex = KDS_STEPS.findIndex(s => s.id === currentStatus);
  
  if (currentIndex === -1) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-2 relative ${compact ? 'px-2 py-1' : 'px-3 py-2'}`}
      role="progressbar"
      aria-valuenow={currentIndex + 1}
      aria-valuemin={1}
      aria-valuemax={KDS_STEPS.length}
      aria-label={t('kds.order_progress')}
    >
      {/* 진행선 */}
      <div className="absolute left-1/2 -translate-x-1/2 top-1/2 w-full h-1 z-0 bg-slate-200">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(currentIndex / (KDS_STEPS.length - 1), 1) * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: colorClasses[KDS_STEPS[currentIndex]?.color]?.bg }}
        />
      </div>

      {KDS_STEPS.map((step, index) => {
        const isActive = index <= currentIndex;
        const isCompleted = index < currentIndex;
        const colors = colorClasses[step.color];

        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="flex flex-col items-center relative z-10 flex-1"
          >
            <div className="relative flex flex-col items-center gap-1">
              <div className={`relative flex items-center justify-center transition-all duration-300 ${isActive ? 'scale-110' : ''}`}>
                {/* 외부 링 */}
                <div className={`absolute inset-0 rounded-full border-2 transition-all ${isCompleted ? '' : isActive ? 'animate-pulse' : ''}`} 
                     style={{ 
                       borderColor: isCompleted ? colors.bg : isActive ? colors.bg : '#e2e8f0',
                       width: compact ? 36 : 44,
                       height: compact ? 36 : 44,
                     }}
                />
                {/* 내부 아이콘 영역 */}
                <div className={`relative w-[${compact ? 28 : 36}px] h-[${compact ? 28 : 36}px] rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCompleted ? colors.bg : isActive ? 'bg-white ring-4' : 'bg-slate-100'
                }`} style={{ 
                  ringColor: isActive ? colors.bg : 'transparent',
                  backgroundColor: isCompleted ? colors.bg : isActive ? colors.bg : '#f1f5f9',
                }}>
                  <step.icon size={compact ? 14 : 16} className={`transition-colors ${isCompleted || isActive ? 'text-white' : 'text-slate-400'}`} />
                  {isCompleted && <CheckCircle size={compact ? 14 : 16} className="text-white" />}
                </div>
              </div>
              
              {!compact && (
                <motion.span
                  key={step.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`font-medium text-xs truncate max-w-[80px] text-center transition-colors ${
                    isActive ? 'font-black' : 'font-medium'
                  }`} style={{ 
                    color: isActive ? colors.text : '#64748b',
                  }}>
                  {t(step.labelKey)}
                </motion.span>
              )}
              
              {/* 완료 체크마크 (아이콘 아래) */}
              {isCompleted && !compact && (
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-green-500"
                >
                  <CheckCircle size={14} fill="currentColor" />
                </motion.div>
              )}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export { KDS_STEPS };