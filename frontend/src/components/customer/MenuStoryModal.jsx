import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Heart, Quote, Share2, BookOpen } from 'lucide-react';
import { aiAPI } from '../../api';
import { useTranslation } from 'react-i18next';

const MenuStoryModal = ({ isOpen, onClose, product, storeName }) => {
    const { i18n } = useTranslation();
    const [story, setStory] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && product) {
            generateStory();
        }
    }, [isOpen, product]);

    const generateStory = async () => {
        setLoading(true);
        try {
            const lang = i18n.language.split("-")[0];
            const response = await aiAPI.storytelling({
                name: product.name,
                category: product.category_name || '추천 요리',
                description: product.description,
                targetLang: lang
            });
            if (response.data.success) {
                setStory(response.data.story);
            }
        } catch (error) {
            console.error('Failed to generate story:', error);
            setStory(product.description || '이 메뉴에는 아주 특별한 이야기가 담겨 있습니다.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-[80] flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl relative"
            >
                {/* 상단 이미지 영역 */}
                <div className="relative h-64 overflow-hidden">
                    <img
                        src={product.image_url || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1000&auto=format&fit=crop'}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/40 transition-colors"
                    >
                        <X size={20} />
                    </button>
                    <div className="absolute bottom-8 left-8 right-8 text-white">
                        <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest border border-white/30">
                            AI Storyteller
                        </span>
                        <h2 className="text-3xl font-black mt-3 leading-tight">
                            {product.name}
                        </h2>
                    </div>
                </div>

                {/* 스토리 본문 영역 */}
                <div className="p-10">
                    <div className="flex items-center gap-2 mb-6">
                        <Quote className="text-orange-500" size={24} />
                    </div>

                    {loading ? (
                        <div className="space-y-4 py-4">
                            <div className="h-4 bg-gray-100 rounded-full w-full animate-pulse" />
                            <div className="h-4 bg-gray-100 rounded-full w-5/6 animate-pulse" />
                            <div className="h-4 bg-gray-100 rounded-full w-4/6 animate-pulse" />
                            <div className="h-4 bg-gray-100 rounded-full w-full animate-pulse" />
                        </div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="relative"
                        >
                            <p className="text-lg text-gray-800 leading-relaxed font-serif italic text-justify">
                                {story}
                            </p>
                            <div className="mt-8 pt-8 border-t border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-black shadow-lg shadow-orange-500/20">
                                        W
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs font-black text-gray-900">{storeName}</p>
                                        <p className="text-[10px] text-gray-500 font-bold">Since 2024</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-gray-100 hover:text-rose-500 transition-colors">
                                        <Heart size={20} />
                                    </button>
                                    <button className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-gray-100 hover:text-blue-500 transition-colors">
                                        <Share2 size={20} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full h-16 bg-gray-900 text-white rounded-[24px] font-black text-lg mt-8 flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-xl shadow-gray-900/20"
                    >
                        주문하기로 이동
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default MenuStoryModal;
