import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe } from 'lucide-react';
import { vibrateClick } from '../../utils/notificationSound';

const LANGUAGES = [
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'tl', label: 'Tagalog', flag: '🇵🇭' },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'th', label: 'ไทย', flag: '🇹🇭' },
  { code: 'ms', label: 'Bahasa Melayu', flag: '🇲🇾' },
];

export default function LanguageSelector({ currentLang, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code) => {
    vibrateClick();
    onChange(code);
    setIsOpen(false);
  };

  const current = LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[0];

  return (
    <div className="absolute right-4 top-16 z-40" ref={menuRef}>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => { vibrateClick(); setIsOpen(!isOpen); }}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur shadow-sm border border-slate-200 dark:border-slate-700 rounded-full text-xs font-bold text-slate-700 dark:text-slate-200"
      >
        <Globe size={14} className="text-orange-500" />
        <span>{current.flag} {current.code.toUpperCase()}</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
          >
            <div className="py-1">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleSelect(lang.code)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    currentLang === lang.code 
                      ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold' 
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <span className="mr-2">{lang.flag}</span>
                  {lang.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}