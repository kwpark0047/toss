import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { reviewsAPI } from '../../api';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../common/LanguageSwitcher';

const ReviewFeed = () => {
    const { t } = useTranslation();
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all', 'best'

    useEffect(() => {
        fetchFeed();
    }, []);

    const fetchFeed = async () => {
        setLoading(true);
        try {
            const res = await reviewsAPI.getFeed();
            if (res.success) {
                setReviews(res.data);
            }
        } catch (err) {
            console.error('피드 로드 실패:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async (reviewId) => {
        const userPhone = localStorage.getItem('waiting_phone') || 'guest';
        try {
            const res = await reviewsAPI.toggleLike(reviewId, userPhone);
            if (res.success) {
                setReviews(prev => prev.map(r => {
                    if (r.id === reviewId) {
                        const currentLikes = r._count?.likes || 0;
                        return {
                            ...r,
                            _count: {
                                ...r._count,
                                likes: res.action === 'liked' ? currentLikes + 1 : currentLikes - 1
                            },
                            isLiked: res.action === 'liked'
                        };
                    }
                    return r;
                }));
            }
        } catch (err) {
            console.error('좋아요 토글 실패:', err);
        }
    };

    const formatTime = (dateStr) => {
        const now = new Date();
        const past = new Date(dateStr);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 60) return t('review.time_min', { count: diffMins });
        if (diffHours < 24) return t('review.time_hour', { count: diffHours });
        return t('review.time_day', { count: diffDays });
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            <div className="glass sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-900">Social <span className="text-orange-500">Feed</span></h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">{t('review.community_picks')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <LanguageSwitcher />
                    <div className="flex gap-2">
                        {['all', 'best'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-1.5 rounded-full text-xs font-black transition-all ${filter === f ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-slate-100 text-slate-500'
                                    }`}
                            >
                                {f === 'all' ? t('common.all') : t('common.best')}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 리스트 */}
            <div className="max-w-xl mx-auto p-4 space-y-8">
                {loading ? (
                    <div className="space-y-12 animate-pulse">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white rounded-[32px] overflow-hidden border border-white/60 shadow-xl shadow-slate-200/30">
                                <div className="p-5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100" />
                                        <div className="space-y-2">
                                            <div className="w-24 h-4 bg-slate-100 rounded" />
                                            <div className="w-32 h-3 bg-slate-50 rounded" />
                                        </div>
                                    </div>
                                </div>
                                <div className="aspect-square bg-slate-50" />
                                <div className="p-5 space-y-4">
                                    <div className="flex justify-between">
                                        <div className="flex gap-4">
                                            <div className="w-6 h-6 bg-slate-100 rounded-full" />
                                            <div className="w-6 h-6 bg-slate-100 rounded-full" />
                                        </div>
                                        <div className="w-20 h-4 bg-slate-100 rounded-lg" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="w-full h-4 bg-slate-100 rounded" />
                                        <div className="w-full h-4 bg-slate-100 rounded" />
                                        <div className="w-2/3 h-4 bg-slate-50 rounded" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : reviews.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-24 bg-white/40 backdrop-blur-sm rounded-[3rem] border border-dashed border-slate-200"
                    >
                        <MessageSquare className="mx-auto text-slate-300 mb-6" size={64} />
                        <p className="text-slate-500 font-black text-xl">{t('review.no_reviews')}</p>
                    </motion.div>
                ) : (
                    reviews.filter(r => filter === 'all' || r.is_best).map((r, idx) => (
                        <motion.div
                            key={r.id}
                            initial={{ opacity: 0, y: 30, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{
                                type: "spring",
                                stiffness: 80,
                                damping: 15,
                                delay: idx * 0.1
                            }}
                            className="bg-white/80 backdrop-blur-md overflow-hidden rounded-[32px] border border-white/40 shadow-xl shadow-slate-200/50 hover:shadow-2xl transition-all"
                        >
                            {/* 리뷰어 헤더 */}
                            <div className="p-5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white font-black text-sm shadow-inner">
                                        {r.customer_name?.[0] || 'G'}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 text-sm">{r.customer_name || t('order.anonymous')}</h4>
                                        <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                            <Store size={10} /> {r.stores?.name} • {formatTime(r.created_at)}
                                        </p>
                                    </div>
                                </div>
                                <button className="text-slate-400"><MoreHorizontal size={20} /></button>
                            </div>

                            {/* 리뷰 이미지 */}
                            {r.image_url ? (
                                <div className="relative aspect-square">
                                    <img src={r.image_url} alt="리뷰 사진" loading="lazy" className="w-full h-full object-cover" />
                                    {r.is_best && (
                                        <div className="absolute top-4 left-4 bg-orange-500 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg flex items-center gap-1">
                                            <Star size={10} fill="currentColor" /> {t('review.best')}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-2 bg-gradient-to-r from-orange-500 to-rose-500" />
                            )}

                            {/* 액션바 */}
                            <div className="p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => handleLike(r.id)}
                                            className={`flex items-center gap-1.5 transition-colors ${r.isLiked ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'}`}
                                        >
                                            <Heart size={24} fill={r.isLiked ? "currentColor" : "none"} />
                                            <span className="text-sm font-black">{r._count?.likes || 0}</span>
                                        </button>
                                        <button className="text-slate-400 hover:text-slate-600">
                                            <MessageCircle size={24} />
                                        </button>
                                        <button className="text-slate-400 hover:text-slate-600">
                                            <Share2 size={24} />
                                        </button>
                                    </div>
                                    <div className="flex gap-0.5">
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <Star
                                                key={s}
                                                size={14}
                                                className={s <= r.rating ? "text-orange-400 fill-orange-400" : "text-slate-200"}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <p className="text-slate-700 text-sm leading-relaxed font-semibold line-clamp-3">
                                    {r.content}
                                </p>

                                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
                                    <span className="text-[10px] font-black text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md uppercase">{t('review.certified')}</span>
                                    <span className="text-[10px] font-bold text-slate-400">{t('order.number')} #{r.order_id || 'N/A'}</span>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ReviewFeed;
