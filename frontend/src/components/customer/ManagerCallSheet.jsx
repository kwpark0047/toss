import React from 'react';
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
                    className="relative w-full max-w-md bg-white rounded-t-[2.5rem] p-8 shadow-2xl overflow-hidden"
                >
                    {/* 하단 시트 핸들 */}
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-200 rounded-full" />

                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('common.call_manager')}</h2>
                            <p className="text-slate-500 text-sm font-medium mt-1">{t('manager.help_msg')}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {/* 1. 실시간 채팅 */}
                        <button
                            onClick={() => { onOpenChat(); onClose(); }}
                            className="w-full flex items-center justify-between p-5 rounded-3xl bg-blue-50 border-2 border-blue-100 group hover:border-blue-200 transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                                    <MessageSquare size={24} />
                                </div>
                                <div className="text-left">
                                    <p className="font-black text-slate-900">{t('manager.chat')}</p>
                                    <p className="text-xs text-blue-600 font-bold">{t('manager.chat_desc')}</p>
                                </div>
                            </div>
                            <ChevronRight size={20} className="text-blue-300 group-hover:translate-x-1 transition-transform" />
                        </button>

                        <div className="grid grid-cols-2 gap-4">
                            {/* 2. 전화 연결 */}
                            <a
                                href={`tel:${store?.phone || '010-0000-0000'}`}
                                className="flex flex-col items-center justify-center p-5 rounded-3xl bg-slate-50 border-2 border-slate-100 hover:border-slate-200 transition-all"
                            >
                                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white mb-3 shadow-md">
                                    <Phone size={20} />
                                </div>
                                <span className="font-bold text-slate-900 text-sm">{t('manager.call')}</span>
                            </a>

                            {/* 3. 문자 전송 */}
                            <a
                                href={`sms:${store?.phone || '010-0000-0000'}`}
                                className="flex flex-col items-center justify-center p-5 rounded-3xl bg-slate-50 border-2 border-slate-100 hover:border-slate-200 transition-all"
                            >
                                <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white mb-3 shadow-md shadow-orange-100">
                                    <MessageCircle size={20} />
                                </div>
                                <span className="font-bold text-slate-900 text-sm">{t('manager.sms')}</span>
                            </a>
                        </div>

                        {/* 4. 빠른 호출 (벨) */}
                        <button
                            onClick={() => handleManagerCall('bell')}
                            className="w-full py-5 rounded-3xl bg-slate-900 text-white font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-slate-200"
                        >
                            <BellRing size={22} className="text-orange-400 animate-bounce" />
                            {t('manager.bell')}
                        </button>
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
