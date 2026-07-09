import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, MessageSquare, MessageCircle, BellRing, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * ManagerCallSheet 컴포넌트
 * 매장 상호명 옆의 호출 버튼 클릭 시 나타나는 하단 시트입니다.
 * 전화, 문자, 채팅 옵션을 제공합니다.
 */
const ManagerCallSheet = ({ isOpen, onClose, store, table, onOpenChat, onVoiceCall }) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    const handleManagerCall = (type) => {
        // 소켓 이벤트 등을 통해 매니저에게 알림을 보낼 수도 있음
        if (type === 'bell') {
            onVoiceCall && onVoiceCall('bell');
            alert(t('manager.bell_success'));
            onClose();
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-end justify-center">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                />

                {/* Sheet */}
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="relative w-full max-w-md bg-white rounded-t-[3rem] p-8 pb-12 shadow-2xl overflow-hidden border-t border-slate-100"
                >
                    {/* 하단 시트 핸들 */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-slate-100 rounded-full" />

                    <div className="flex justify-between items-start mb-8 pt-2">
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-orange-500 rounded-full inline-block" />
                                {t('common.call_manager')}
                            </h2>
                            <p className="text-slate-400 text-sm font-semibold mt-1.5 pl-3 border-l-2 border-slate-50 italic">
                                "{t('manager.help_msg')}"
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            aria-label="닫기"
                            className="p-2.5 bg-slate-50 rounded-full text-slate-300 hover:text-slate-900 hover:bg-slate-100 transition-all active:scale-90"
                        >
                            <X size={22} aria-hidden="true" />
                        </button>
                    </div>

                    <div className="space-y-5">
                        {/* 1. 빠른 호출 (벨) - 네온 효과 가미 */}
                        <button
                            onClick={() => handleManagerCall('bell')}
                            className="w-full group relative overflow-hidden py-8 rounded-[2.5rem] bg-slate-900 text-white shadow-[0_20px_40px_rgba(15,23,42,0.2)] active:scale-[0.97] transition-all"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-orange-600/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="relative z-10 flex flex-col items-center gap-1.5">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <BellRing size={32} className="text-orange-400" />
                                        <motion.div 
                                            animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
                                            transition={{ duration: 1, repeat: Infinity }}
                                            className="absolute inset-0 bg-orange-400 rounded-full -z-10"
                                        />
                                    </div>
                                    <span className="text-2xl font-black tracking-tight">{t('manager.bell')}</span>
                                </div>
                                <p className="text-[10px] text-orange-500/60 font-black uppercase tracking-[0.2em] mt-1">Premium Help Support</p>
                            </div>
                        </button>

                        {/* 2. 실시간 채팅 - 그라데이션 및 카드 디자인 개선 */}
                        <button
                            onClick={() => { onOpenChat(); onClose(); }}
                            className="w-full flex items-center justify-between p-6 rounded-[2.5rem] bg-gradient-to-br from-blue-50 to-white border-2 border-blue-100/50 group hover:border-blue-300 shadow-sm active:scale-[0.97] transition-all"
                        >
                            <div className="flex items-center gap-5">
                                <div className="w-16 h-16 rounded-[1.5rem] bg-blue-600 flex items-center justify-center text-white shadow-[0_10px_20px_rgba(37,99,235,0.2)] rotate-3 group-hover:rotate-0 transition-transform">
                                    <MessageSquare size={32} />
                                </div>
                                <div className="text-left">
                                    <p className="font-black text-slate-900 text-xl leading-tight">{t('manager.chat')}</p>
                                    <p className="text-xs text-blue-500 font-bold mt-1.5 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                        {t('manager.chat_desc')}
                                    </p>
                                </div>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-md group-hover:bg-blue-600 group-hover:text-white transition-all">
                                <ChevronRight size={24} />
                            </div>
                        </button>

                        <div className="grid grid-cols-2 gap-5">
                            {/* 3. 전화 연결 */}
                            <a
                                href={`tel:${store?.phone || '010-0000-0000'}`}
                                className="flex flex-col items-center justify-center p-6 rounded-[2.5rem] bg-slate-50 border-2 border-slate-100/50 hover:border-slate-300 hover:bg-white active:scale-[0.95] transition-all group shadow-sm"
                            >
                                <div className="w-14 h-14 rounded-[1.5rem] bg-white flex items-center justify-center text-slate-900 mb-3 shadow-md group-hover:bg-slate-900 group-hover:text-white transition-all group-hover:-translate-y-1">
                                    <Phone size={26} />
                                </div>
                                <span className="font-black text-slate-900 text-sm tracking-tight">{t('manager.call')}</span>
                            </a>

                            {/* 4. 문자 전송 */}
                            <a
                                href={`sms:${store?.phone || '010-0000-0000'}`}
                                className="flex flex-col items-center justify-center p-6 rounded-[2.5rem] bg-slate-50 border-2 border-slate-100/50 hover:border-slate-300 hover:bg-white active:scale-[0.95] transition-all group shadow-sm"
                            >
                                <div className="w-14 h-14 rounded-[1.5rem] bg-white flex items-center justify-center text-orange-500 mb-3 shadow-md group-hover:bg-orange-500 group-hover:text-white transition-all group-hover:-translate-y-1">
                                    <MessageCircle size={26} />
                                </div>
                                <span className="font-black text-slate-900 text-sm tracking-tight">{t('manager.sms')}</span>
                            </a>
                        </div>
                    </div>

                    <p className="mt-8 text-center text-[11px] text-slate-400 font-medium">
                        {t('manager.delay_msg')} <br />
                        {table ? t('manager.table_prefix', { name: table.name }) : t('manager.takeout_inquiry')}
                    </p>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ManagerCallSheet;
