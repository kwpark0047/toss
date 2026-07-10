import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ────────────────────────────────────────────────────────────────────
//  음성 합성 헬퍼 (공용 수출)
// ────────────────────────────────────────────────────────────────────
export const speak = (text, enabled) => {
  if (!enabled || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[\p{Emoji}]/gu, '').trim());
  u.lang = 'ko-KR'; u.pitch = 1.15; u.rate = 0.95; u.volume = 0.9;
  window.speechSynthesis.speak(u);
};

export const Wing = ({ side }) => (
  <motion.div
    className="absolute w-7 h-12"
    style={{
      [side]: 3, top: 14,
      background: 'rgba(255,255,255,0.52)', filter: 'blur(0.4px)',
      borderRadius: side === 'left' ? '60% 40% 70% 70% / 70% 70% 60% 60%' : '40% 60% 70% 70% / 70% 70% 60% 60%',
      transformOrigin: side === 'left' ? 'right center' : 'left center',
      boxShadow: 'inset 0 0 8px rgba(255,255,255,0.5)',
    }}
    animate={{ rotateZ: side === 'left' ? [16,34,16] : [-16,-34,-16], scaleX: [1,0.5,1] }}
    transition={{ duration: 0.25, repeat: Infinity, ease: 'easeInOut' }}
  />
);

export const Spark = ({ x, y, size, angle }) => (
  <motion.div className="absolute pointer-events-none" style={{ left: x, top: y }}
    initial={{ opacity: 0.95, scale: 1, y: 0, rotate: angle }}
    animate={{ opacity: 0, scale: 0.12, y: 30, rotate: angle + 170 }}
    transition={{ duration: 0.9 + Math.random() * 0.4, ease: 'easeOut' }}>
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#F59E0B" d="M12 2l1.8 6.6c.2.7.8 1.3 1.5 1.5L22 12l-6.7 1.9c-.7.2-1.3.8-1.5 1.5L12 22l-1.8-6.6c-.2-.7-.8-1.3-1.5-1.5L2 12l6.7-1.9c.7-.2 1.3-.8 1.5-1.5L12 2z" />
    </svg>
  </motion.div>
);

export default function WizardTinkerbell({ message, isHappy = false, voiceEnabled }) {
  const [typed, setTyped] = useState('');
  const [sparks, setSparks] = useState([]);
  const sparkId = useRef(0);
  const typingRef = useRef(null);

  useEffect(() => {
    if (!message) return;
    clearInterval(typingRef.current);
    setTyped('');
    speak(message, voiceEnabled);
    let i = 0;
    typingRef.current = setInterval(() => {
      i++;
      setTyped(message.slice(0, i));
      if (i >= message.length) clearInterval(typingRef.current);
    }, 32);
    return () => clearInterval(typingRef.current);
  }, [message, voiceEnabled]);

  useEffect(() => {
    if (!isHappy) return;
    const newSparks = Array.from({ length: 8 }, (_, i) => ({
      id: sparkId.current++,
      x: 10 + Math.random() * 60, y: -10 + Math.random() * 50,
      size: 8 + Math.random() * 8, angle: Math.random() * 360,
    }));
    setSparks(newSparks);
    const t = setTimeout(() => setSparks([]), 1200);
    return () => clearTimeout(t);
  }, [isHappy]);

  return (
    <div className="flex items-end gap-4">
      <AnimatePresence>
        {typed && (
          <motion.div initial={{ opacity: 0, scale: 0.85, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.85 }}
            className="relative max-w-xs bg-white rounded-2xl rounded-br-sm px-4 py-3 shadow-xl border border-amber-100">
            <p className="text-sm font-bold text-slate-800 leading-relaxed">{typed}</p>
            <div className="absolute -right-2 bottom-2 w-0 h-0"
              style={{ borderLeft: '10px solid white', borderTop: '8px solid transparent', borderBottom: '4px solid transparent', filter: 'drop-shadow(2px 1px 1px rgba(0,0,0,0.06))' }} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative flex-shrink-0">
        {sparks.map(s => <Spark key={s.id} {...s} />)}
        <motion.div className="relative w-[78px] h-[78px]"
          animate={isHappy ? { y:[0,-18,3,-8,0], scale:[1,1.14,0.93,1.06,1] } : { y:[-4,6,-4], rotate:[-3,3,-3] }}
          transition={isHappy ? { duration:0.65, ease:'easeInOut' } : { duration:3.4, repeat:Infinity, ease:'easeInOut' }}>
          <motion.div className="absolute inset-0 -m-3 rounded-full"
            style={{ background:'radial-gradient(circle, rgba(245,159,11,.6) 0%, rgba(245,159,11,.2) 50%, transparent 72%)' }}
            animate={{ scale:[1,1.22,1], opacity:[0.6,1,0.6] }}
            transition={{ duration:2.4, repeat:Infinity, ease:'easeInOut' }} />
          <Wing side="left" /><Wing side="right" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[46px] h-[46px] rounded-full flex items-center justify-center"
            style={{ background:'radial-gradient(circle at 34% 28%, #FFF8E7, #F59E0B 62%, #D97706)', boxShadow:'0 4px 20px rgba(245,159,11,.65), 0 0 0 2px rgba(255,255,255,.2)' }}>
            <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
              <path d="M12 2l1.8 6.6c.2.7.8 1.3 1.5 1.5L22 12l-6.7 1.9c-.7.2-1.3.8-1.5 1.5L12 22l-1.8-6.6c-.2-.7-.8-1.3-1.5-1.5L2 12l6.7-1.9c.7-.2 1.3-.8 1.5-1.5L12 2z" />
            </svg>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
