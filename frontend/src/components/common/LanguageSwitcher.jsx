import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Check } from 'lucide-react';
import { useState } from 'react';

const languages = [
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'zh', name: '简体中文', flag: '🇨🇳' }
];

const LanguageSwitcher = () => {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    const currentLang = languages.find(l => l.code === i18n.language.split('-')[0]) || languages[0];

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-white/80 backdrop-blur-md px-3 py-2 rounded-xl shadow-sm border border-slate-100 font-bold text-xs text-slate-700"
            >
                <Globe size={14} className="text-orange-500" />
                <span>{currentLang.flag} {currentLang.name}</span>
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* 배경 클릭 시 닫기 */}
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 mt-2 w-40 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 p-1"
                        >
                            {languages.map((lang) => (
                                <button
                                    key={lang.code}
                                    onClick={() => changeLanguage(lang.code)}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-colors ${i18n.language.startsWith(lang.code)
                                            ? 'bg-orange-50 text-orange-600 font-black'
                                            : 'text-slate-600 hover:bg-slate-50 font-bold'
                                        }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <span>{lang.flag}</span>
                                        {lang.name}
                                    </span>
                                    {i18n.language.startsWith(lang.code) && <Check size={14} />}
                                </button>
                            ))}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default LanguageSwitcher;
