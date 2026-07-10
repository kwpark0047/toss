import { motion } from 'framer-motion';
import { BellRing } from 'lucide-react';
import { vibrateClick } from '../../utils/notificationSound';

/**
 * FloatingCallButton — 고객 화면에서 항상 잘 보이도록 떠 있는 호출 버튼.
 * 맥박 애니메이션과 그라데이션을 적용하여 가시성을 극대화합니다.
 */
const FloatingCallButton = ({ onClick, primaryColor = "#f97316" }) => {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className="fixed bottom-28 right-6 z-50 lg:bottom-12 lg:right-12"
    >
      {/* Ripple Pulse Effect */}
      <motion.div
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.3, 0, 0.3],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: primaryColor }}
      />

      <button
        onClick={() => {
          vibrateClick();
          onClick();
        }}
        className="relative flex flex-col items-center justify-center w-20 h-20 rounded-full text-white shadow-[0_20px_50px_rgba(249,115,22,0.4)] border-4 border-white overflow-hidden group transition-all"
        style={{ 
          background: `linear-gradient(135deg, ${primaryColor}, #e11d48)`,
        }}
      >
        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex flex-col items-center justify-center gap-0.5">
          <BellRing size={28} className="drop-shadow-lg" />
          <div className="flex flex-col items-center leading-none">
            <span className="text-[12px] font-black tracking-tight">직원호출</span>
            <span className="text-[8px] font-bold opacity-80 tracking-widest uppercase mt-0.5">Call</span>
          </div>
        </div>
        
        {/* 맺음 강조 광택 효과 */}
        <motion.div 
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12" 
        />
      </button>
    </motion.div>
  );
};

export default FloatingCallButton;
