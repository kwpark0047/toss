import { useState, useRef, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminTheme, THEMES } from '../../contexts/AdminThemeContext';
import Icon from '../ui/Icon';

export default function ThemeSwitcher() {
  const { themeId, setTheme } = useAdminTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = THEMES.find(t => t.id === themeId);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="테마 변경"
        aria-label="테마 변경"
        aria-haspopup="true"
        aria-expanded={open}
        className="w-12 h-12 flex items-center justify-center rounded-2xl border-2 transition-all hover:scale-105 active:scale-95"
        style={{ background: current.color, borderColor: current.accent + '60' }}
      >
        <Icon icon="Palette" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-3 p-4 rounded-3xl bg-slate-900/98 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/60 z-50"
          >
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">테마 선택</p>
            <div className="flex gap-3">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTheme(t.id); setOpen(false); }}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110"
                    style={{
                      background: t.color,
                      border: `2px solid ${themeId === t.id ? t.accent : 'rgba(255,255,255,0.08)'}`,
                      boxShadow: themeId === t.id ? `0 0 20px ${t.accent}50` : '',
                    }}
                  >
                    {themeId === t.id && (
                      <Check size={14} style={{ color: t.accent }} strokeWidth={3} />
                    )}
                  </div>
                  <span className={`text-[9px] font-black transition-colors ${
                    themeId === t.id ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
                  }`}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
