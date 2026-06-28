import { createContext, useContext, useState } from 'react';

export const THEMES = [
  { id: 'obsidian', label: '옵시디언', desc: '딥 블랙',    color: '#020617', accent: '#f97316' },
  { id: 'arctic',   label: '아틱',     desc: '클린 화이트', color: '#f1f5f9', accent: '#f97316' },
  { id: 'navy',     label: '네이비',   desc: '딥 블루',    color: '#050e1f', accent: '#3b82f6' },
  { id: 'sunset',   label: '선셋',     desc: '웜 다크',    color: '#130a04', accent: '#fb923c' },
  { id: 'forest',   label: '포레스트', desc: '그린 다크',  color: '#030d06', accent: '#22c55e' },
];

const AdminThemeContext = createContext(null);

export const AdminThemeProvider = ({ children }) => {
  const [themeId, setThemeId] = useState(
    () => localStorage.getItem('adm-theme') || 'obsidian'
  );

  const setTheme = (id) => {
    setThemeId(id);
    localStorage.setItem('adm-theme', id);
  };

  return (
    <AdminThemeContext.Provider value={{ themeId, setTheme, themes: THEMES }}>
      {children}
    </AdminThemeContext.Provider>
  );
};

export const useAdminTheme = () => {
  const ctx = useContext(AdminThemeContext);
  if (!ctx) throw new Error('useAdminTheme must be inside AdminThemeProvider');
  return ctx;
};
