import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const THEMES = {
  light: {
    id: 'light',
    name: '라이트',
    icon: '☀️',
    colors: {
      bg: 'bg-white',
      bgSecondary: 'bg-slate-50',
      bgCard: 'bg-white',
      text: 'text-slate-900',
      textSecondary: 'text-slate-600',
      textMuted: 'text-slate-400',
      border: 'border-slate-200',
      borderHover: 'border-slate-300',
      navBg: 'bg-white/80',
      footerBg: 'bg-slate-50',
      footerText: 'text-slate-500',
      inputBg: 'bg-white',
      inputBorder: 'border-slate-300',
      accent: 'text-orange-500',
      accentBg: 'bg-orange-500',
      accentLight: 'bg-orange-50',
      accentBorder: 'border-orange-200',
    },
  },
  dark: {
    id: 'dark',
    name: '다크',
    icon: '🌙',
    colors: {
      bg: 'bg-slate-950',
      bgSecondary: 'bg-slate-900',
      bgCard: 'bg-slate-900/40',
      text: 'text-slate-100',
      textSecondary: 'text-slate-400',
      textMuted: 'text-slate-500',
      border: 'border-slate-900',
      borderHover: 'border-slate-800',
      navBg: 'bg-slate-950/80',
      footerBg: 'bg-slate-950',
      footerText: 'text-slate-500',
      inputBg: 'bg-slate-950',
      inputBorder: 'border-slate-800',
      accent: 'text-orange-400',
      accentBg: 'bg-orange-500',
      accentLight: 'bg-orange-500/10',
      accentBorder: 'border-orange-500/20',
    },
  },
  blue: {
    id: 'blue',
    name: '블루',
    icon: '💎',
    colors: {
      bg: 'bg-blue-50/50',
      bgSecondary: 'bg-white',
      bgCard: 'bg-white',
      text: 'text-slate-900',
      textSecondary: 'text-slate-600',
      textMuted: 'text-slate-400',
      border: 'border-blue-100',
      borderHover: 'border-blue-200',
      navBg: 'bg-white/90',
      footerBg: 'bg-blue-50',
      footerText: 'text-slate-500',
      inputBg: 'bg-white',
      inputBorder: 'border-blue-200',
      accent: 'text-blue-600',
      accentBg: 'bg-blue-600',
      accentLight: 'bg-blue-50',
      accentBorder: 'border-blue-200',
    },
  },
  youth: {
    id: 'youth',
    name: '20대',
    icon: '🚀',
    colors: {
      bg: 'bg-white',
      bgSecondary: 'bg-purple-50/50',
      bgCard: 'bg-white',
      text: 'text-slate-900',
      textSecondary: 'text-slate-600',
      textMuted: 'text-slate-400',
      border: 'border-purple-100',
      borderHover: 'border-purple-200',
      navBg: 'bg-white/90',
      footerBg: 'bg-purple-50',
      footerText: 'text-slate-500',
      inputBg: 'bg-white',
      inputBorder: 'border-purple-200',
      accent: 'text-purple-600',
      accentBg: 'bg-purple-600',
      accentLight: 'bg-purple-50',
      accentBorder: 'border-purple-200',
    },
  },
  mature: {
    id: 'mature',
    name: '50대',
    icon: '👔',
    colors: {
      bg: 'bg-stone-50',
      bgSecondary: 'bg-white',
      bgCard: 'bg-white',
      text: 'text-stone-900',
      textSecondary: 'text-stone-600',
      textMuted: 'text-stone-400',
      border: 'border-stone-200',
      borderHover: 'border-stone-300',
      navBg: 'bg-white/95',
      footerBg: 'bg-stone-100',
      footerText: 'text-stone-500',
      inputBg: 'bg-white',
      inputBorder: 'border-stone-300',
      accent: 'text-stone-700',
      accentBg: 'bg-stone-700',
      accentLight: 'bg-stone-100',
      accentBorder: 'border-stone-300',
    },
  },
};

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => {
    return localStorage.getItem('wemarket-theme') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('wemarket-theme', themeId);
    document.documentElement.setAttribute('data-theme', themeId);
  }, [themeId]);

  const theme = THEMES[themeId] || THEMES.light;

  return (
    <ThemeContext.Provider value={{ theme, themeId, setThemeId, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return { theme: THEMES.light, themeId: 'light', setThemeId: () => {}, themes: THEMES };
  }
  return context;
}
