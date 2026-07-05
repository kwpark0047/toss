import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { reviewsAPI } from '../../api';
import { useTranslation } from 'react-i18next';
import { Camera, Send, Loader2, CheckCircle, X, Star } from "lucide-react";

/**
 * 리뷰 작성 모달 컴포넌트
 * 주문 완료 후 별점과 리뷰 내용을 작성하며, 데모용 사진 첨부 기능을 포함합니다.
 */
const ReviewModal = ({ isOpen, onClose, order, onSuccess }) => {
    const { t } = useTranslation();
    const [rating, setRating] = useState(5);
    const [content, setContent] = useState('');
    const [imageUrl, setImageUrl] = useState(''); // 데모용 이미지 URL
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // [데모용] 사진 첨부 시 랜덤 고화질 이미지 주입
    const handleAttachPhoto = () => {
        const demoImages = [
            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
            'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
            'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
            'https://images.unsplash.com/photo-1567620905732-2d1ec7bb7445?w=800'
        ];
        const randomImg = demoImages[Math.floor(Math.random() * demoImages.length)];
        setImageUrl(randomImg);
        alert('테스트용 사진이 첨부되었습니다.');
    };

    const handleSubmit = async () => {
        if (!order) return;
        if (content.length < 5) return alert(t('review.min_length_error'));

        setLoading(true);
        try {
            const res = await reviewsAPI.create({
                store_id: order.store_id,
                order_id: order.id,
                customer_name: localStorage.getItem('waiting_name') || t('common.anonymous'),
                customer_phone: localStorage.getItem('waiting_phone') || '',
                rating,
                content,
                image_url: imageUrl || null
            });

            if (res.success) {
                setSubmitted(true);
                setTimeout(() => {
                    if (onSuccess) onSuccess();
                    onClose();
                    // 성공 후 초기화
                    setSubmitted(false);
                    setContent('');
                    setRating(5);
                    setImageUrl('');
                }, 2000);
            }
        } catch (err) {
            console.error('리뷰 등록 실패:', err);
            alert(err.response?.data?.error || t('review.fail_error'));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl relative"
            >
                <button onClick={onClose} aria-label="닫기" className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 z-10">
                    <X size={24} />
                </button>

                <div className="p-8">
                    <AnimatePresence mode="wait">
                        {!submitted ? (
                            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                                <div className="text-center">
                                    <h2 className="text-2xl font-black text-slate-900 leading-tight">{t('review.how_was_meal') || '식사는 어떠셨나요?'}</h2>
                                    <p className="text-slate-500 font-bold mt-1">{t('review.share_experience', { name: order.store_name }) || `${order.store_name}에서의 경험을 들려주세요`}</p>
                                </div>

                                {/* 별점 선택 */}
                                <div className="flex justify-center gap-2 py-2">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => setRating(s)}
                                            className="transition-transform active:scale-90"
                                        >
                                            <Star
                                                size={40}
                                                className={s <= rating ? "text-orange-400 fill-orange-400" : "text-slate-100"}
                                            />
                                        </button>
                                    ))}
                                </div>

                                {/* 리뷰 작성 */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="text-sm font-black text-slate-700">{t('review.content') || '리뷰 내용'}</label>
                                        <span className="text-[10px] text-slate-400 font-bold">{content.length} / 300</span>
                                    </div>
                                    <textarea
                                        className="w-full h-32 bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-orange-500 transition-all font-medium resize-none placeholder:text-slate-300"
                                        placeholder={t('review.placeholder') || '솔직한 후기를 남겨주시면 매장 운영에 큰 도움이 됩니다.'}
                                        maxLength={300}
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                    />
                                </div>

                                {/* 사진 첨부 (데모) */}
                                <div className="space-y-3">
                                    {imageUrl && (
                                        <div className="relative w-full h-32 rounded-2xl overflow-hidden ring-2 ring-orange-500/20">
                                            <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                            <button
                                                onClick={() => setImageUrl('')}
                                                className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}
                                    <button
                                        onClick={handleAttachPhoto}
                                        className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center gap-2 text-slate-400 hover:border-orange-200 hover:text-orange-400 transition-colors"
                                    >
                                        <Camera size={20} />
                                        <span className="font-bold">{imageUrl ? '다른 사진으로 변경' : t('review.attach_photo') || '사진 첨부 (선택)'}</span>
                                    </button>
                                </div>

                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                                    {loading ? t('review.submitting') || '등록 중...' : t('review.submit') || '리뷰 등록하기'}
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div key="success" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-10">
                                <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-500/30">
                                    <CheckCircle size={40} />
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 mb-2">{t('review.success_title')}</h3>
                                <p className="text-slate-500 font-medium mb-8">{t('review.success_msg')}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};

export default ReviewModal;
