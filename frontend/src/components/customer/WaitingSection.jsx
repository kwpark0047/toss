import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clock, Phone, User, X, ChevronRight, BellRing, Sparkles, CheckCircle } from 'lucide-react';
import { waitingAPI, ordersAPI } from '../../api';
import { useTranslation } from 'react-i18next';

const WaitingSection = ({ store, onClose }) => {
    const { t } = useTranslation();
    const [step, setStep] = useState('status'); // 'status', 'register', 'success'
    const [loading, setLoading] = useState(false);
    const [myWaiting, setMyWaiting] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        partySize: 2
    });

    // 초기 로드 시 기존 대입 상태 확인 (로컬 스토리지 또는 전화번호 입력 유도)
    useEffect(() => {
        const savedPhone = localStorage.getItem('waiting_phone');
        if (savedPhone) {
            fetchMyStatus(savedPhone);
        }
    }, []);

    const fetchMyStatus = async (phone) => {
        try {
            const res = await waitingAPI.getMyWaiting(phone);
            if (res.success && res.data.length > 0) {
                // 현재 해당 매장에 대기 중인 항목 찾기
                const active = res.data.find(w => w.store_id === store.id);
                if (active) {
                    setMyWaiting(active);
                    setStep('status');
                    // 소켓 룸 입장
                    const socket = ordersAPI.getSocket();
                    socket.emit('join-my-waiting', { phone });
                    socket.on('waiting-status-changed', (data) => {
                        setMyWaiting(prev => ({ ...prev, status: data.status }));
                        if (data.status === 'called') {
                            alert(data.message);
                        }
                    });
                    socket.on('refresh-ahead-count', () => {
                        fetchMyStatus(phone); // 다시 조회하여 순번 갱신
                    });
                }
            }
        } catch (err) {
            console.error('대기 상태 조회 실패:', err);
        }
    };

    const handleRegister = async () => {
        if (!formData.phone || !formData.name) return alert(t('waiting.errors.input_required'));
        setLoading(true);
        try {
            const res = await waitingAPI.register({
                store_id: store.id,
                customer_name: formData.name,
                customer_phone: formData.phone,
                party_size: formData.partySize
            });
            if (res.success) {
                localStorage.setItem('waiting_phone', formData.phone);
                setMyWaiting(res.data);
                setStep('success');
            }
        } catch (err) {
            alert(err.response?.data?.error || t('waiting.errors.register_failed'));
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!myWaiting) return;
        if (!window.confirm(t('waiting.errors.cancel_confirm'))) return;
        try {
            const res = await waitingAPI.cancel(myWaiting.id);
            if (res.success) {
                setMyWaiting(null);
                setStep('register');
            }
        } catch (err) {
            alert(t('waiting.errors.cancel_failed'));
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-end justify-center">
            <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="bg-white w-full max-w-xl rounded-t-[40px] p-8 shadow-2xl relative"
            >
                {/* 상단 닫기 버튼 */}
                <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                    <X size={20} />
                </button>

                <div className="mb-8">
                    <h2 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                        <Users className="text-orange-500" />
                        {store.name} <span className="text-orange-500">{t('waiting.title')}</span>
                    </h2>
                    <p className="text-slate-500 font-medium mt-1">{t('waiting.desc')}</p>
                </div>

                <AnimatePresence mode="wait">
                    {step === 'register' ? (
                        <motion.div
                            key="register"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-6"
                        >
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 ml-1">{t('waiting.name')}</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="text"
                                            placeholder={t('waiting.name_placeholder')}
                                            className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-orange-500 transition-all font-medium"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 ml-1">{t('waiting.phone')}</label>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="tel"
                                            placeholder="010-0000-0000"
                                            className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-orange-500 transition-all font-medium"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 text-center mt-1">🔒 AES-256 암호화 저장</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 ml-1">{t('waiting.party_size')}</label>
                                    <div className="flex items-center gap-3">
                                        {[1, 2, 3, 4, '5+'].map((num) => (
                                            <button
                                                key={num}
                                                onClick={() => setFormData({ ...formData, partySize: typeof num === 'string' ? 5 : num })}
                                                className={`flex-1 py-3 rounded-xl font-black transition-all ${(typeof num === 'string' ? formData.partySize >= 5 : formData.partySize === num)
                                                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                                                    : 'bg-slate-100 text-slate-500'
                                                    }`}
                                            >
                                                {num}{typeof num === 'number' ? t('waiting.person_count') : ''}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleRegister}
                                disabled={loading}
                                className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2 group"
                            >
                                {loading ? t('waiting.submitting') : (
                                    <>
                                        {t('waiting.submit')}
                                        <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </motion.button>
                        </motion.div>
                    ) : step === 'status' && myWaiting ? (
                        <motion.div
                            key="status"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="space-y-6"
                        >
                            <div className="glass-panel p-8 text-center rounded-[32px] border-2 border-orange-500/20 bg-orange-50/30">
                                <div className="inline-flex p-4 bg-orange-500 rounded-2xl text-white mb-4 shadow-xl shadow-orange-500/20">
                                    <BellRing className="animate-bounce" size={32} />
                                </div>
                                <h3 className="text-3xl font-black text-slate-900 mb-1">
                                    {t('waiting.ahead_count', { count: myWaiting.ahead_count || 0 })}
                                </h3>
                                <p className="text-slate-500 font-bold">{t('waiting.queue_number', { count: myWaiting.queue_number })}</p>

                                <div className="mt-8 grid grid-cols-2 gap-4">
                                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                        <p className="text-[10px] uppercase font-black text-slate-400 mb-1">Status</p>
                                        <p className="font-black text-slate-800">
                                            {myWaiting.status === 'waiting' ? t('status.pending') : t('status.ready')}
                                        </p>
                                    </div>
                                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                        <p className="text-[10px] uppercase font-black text-slate-400 mb-1">Estimated</p>
                                        <p className="font-black text-slate-800">{t('waiting.estimated_time', { count: (myWaiting.ahead_count || 0) * 10 + 5 })}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={handleCancel}
                                    className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold border border-slate-200"
                                >
                                    {t('waiting.cancel_waiting')}
                                </button>
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg"
                                >
                                    {t('common.confirm')}
                                </button>
                            </div>
                        </motion.div>
                    ) : step === 'success' ? (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-8"
                        >
                            <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-500/30">
                                <CheckCircle size={40} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 mb-2">{t('waiting.success_title')}</h3>
                            <p className="text-slate-500 font-medium mb-8">{t('waiting.success_msg')}</p>
                            <button
                                onClick={() => setStep('status')}
                                className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black"
                            >
                                {t('waiting.check_status')}
                            </button>
                        </motion.div>
                    ) : (
                        // 로딩 중이거나 상태가 없을 때 기본적으로 등록 유도
                        <div className="text-center py-10">
                            <Sparkles className="mx-auto text-orange-400 mb-4" size={40} />
                            <button
                                onClick={() => setStep('register')}
                                className="bg-orange-500 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-orange-500/30"
                            >
                                {t('waiting.register_now')}
                            </button>
                        </div>
                    )}
                </AnimatePresence>

                <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                        {t('waiting.notice_1')}<br />
                        {t('waiting.notice_2')}
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default WaitingSection;
