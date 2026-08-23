import { useState, useRef, useEffect } from 'react';
import { useTheme, THEMES } from '@/contexts/ThemeContext';
import { Palette, ChevronDown } from 'lucide-react';
import Icon from './ui/Icon';

export default function ThemeSwitcher() {
  const { themeId, setThemeId } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentTheme = THEMES[themeId] || THEMES.light;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-4 py-3 rounded-full bg-white border border-slate-200 shadow-lg shadow-slate-200/50 text-xs font-bold transition-all hover:shadow-xl hover:border-slate-300 active:scale-95"
        title="테마 변경"
      >
        <Icon icon="Palette" />
        <span className="hidden sm:inline">{currentTheme.icon} {currentTheme.name}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {Object.values(THEMES).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setThemeId(t.id);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2 transition-all ${
                themeId === t.id
                  ? 'bg-orange-50 text-orange-600'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="text-base">{t.icon}</span>
              <span>{t.name}</span>
              {themeId === t.id && (
                <span className="ml-auto text-orange-500">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
