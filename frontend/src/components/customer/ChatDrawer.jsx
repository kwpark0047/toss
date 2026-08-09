import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, ShieldCheck, Sparkles, Image as ImageIcon } from 'lucide-react';
import { chatAPI, getSocket } from '../../api';

/**
 * ChatDrawer 컴포넌트
 * 매니저와 1:1 실시간 대화를 나눌 수 있는 프리미엄 채팅 인터페이스입니다.
 */
const ChatDrawer = ({ isOpen, onClose, store, _table, customerInfo }) => {
    const { t } = useTranslation();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [roomId, setRoomId] = useState(null);
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);
    const socket = getSocket();

    // 채팅방 접속 및 메시지 로딩
    useEffect(() => {
        if (isOpen && store?.id) {
            initChat();
        }
    }, [isOpen, store?.id, initChat]);

    // 스크롤 하단 고정
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // 소켓 리스너
    useEffect(() => {
        if (socket && roomId) {
            socket.emit('join-chat-room', { roomId });

            socket.on('new-chat-message', (message) => {
                setMessages(prev => [...prev, message]);
            });

            return () => {
                socket.off('new-chat-message');
            };
        }
    }, [socket, roomId]);

    const initChat = useCallback(async () => {
        setLoading(true);
        try {
            const res = await chatAPI.accessRoom({
                store_id: store.id,
                customer_phone: customerInfo?.phone || localStorage.getItem('user_phone'),
                customer_id: customerInfo?.id || null
            });

            if (res.success) {
                setRoomId(res.data.id);
                const msgRes = await chatAPI.getMessages(res.data.id);
                if (msgRes.success) {
                    setMessages(msgRes.data);
                }
            }
        } catch (error) {
            console.error('채팅 초기화 실패:', error);
        } finally {
            setLoading(false);
        }
    }, [store?.id, customerInfo?.phone, customerInfo?.id]);

    const handleSendMessage = async (e) => {
        if (e) e.preventDefault();
        if (!input.trim() || !roomId) return;

        const messageData = {
            room_id: roomId,
            sender_type: 'customer',
            content: input,
            created_at: new Date().toISOString()
        };

        try {
            // 1. 서버 DB 저장
            const res = await chatAPI.sendMessage(messageData);

            if (res.success) {
                // 2. 실시간 소켓 전송
                socket.emit('send-chat-message', {
                    roomId,
                    storeId: store.id,
                    message: res.data
                });

                setInput('');
            }
        } catch (error) {
            console.error('메시지 전송 실패:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                />

                {/* Chat Window */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative w-full max-w-md h-[80vh] bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
                >
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg">
                                <ShieldCheck size={20} />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900 tracking-tight">{t('chat.manager_title', { name: store?.name })}</h3>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('chat.live_support')}</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            aria-label="채팅 닫기"
                            className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X size={20} aria-hidden="true" />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth bg-slate-50/50"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="w-8 h-8 border-3 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="text-center py-10">
                                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                                    <Sparkles className="text-blue-500" size={24} />
                                </div>
                                <p className="text-slate-500 font-medium text-sm">{t('chat.ask_manager')}</p>
                                <p className="text-slate-400 text-[11px] mt-1 font-bold italic">{t('chat.chat_examples')}</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => {
                                const isMe = msg.sender_type === 'customer';
                                return (
                                    <motion.div
                                        key={msg.id || idx}
                                        initial={{ opacity: 0, x: isMe ? 10 : -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[80%] ${isMe ? 'order-1' : 'order-2'}`}>
                                            <div className={`p-4 rounded-3xl text-sm font-medium ${isMe
                                                ? 'bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-100'
                                                : 'bg-white text-slate-800 rounded-tl-none border border-slate-100 shadow-sm'
                                                }`}>
                                                {msg.content}
                                            </div>
                                            <span className={`text-[10px] text-slate-400 font-bold mt-1 block ${isMe ? 'text-right' : 'text-left'}`}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-5 bg-white border-t border-slate-100">
                        <form
                            onSubmit={handleSendMessage}
                            className="relative flex items-center gap-3"
                        >
                            <button
                                type="button"
                                className="p-3 text-slate-400 hover:text-blue-600 transition-colors"
                            >
                                <ImageIcon size={22} />
                            </button>
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder={t('chat.input_placeholder')}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm outline-none focus:bg-white focus:border-blue-600/30 focus:ring-4 focus:ring-blue-600/5 transition-all"
                                />
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    type="submit"
                                    disabled={!input.trim()}
                                    className="absolute right-1.5 top-1.5 bottom-1.5 w-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-md disabled:bg-slate-200 disabled:shadow-none transition-all"
                                >
                                    <Send size={18} />
                                </motion.button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div >
        </AnimatePresence >
    );
};

export default ChatDrawer;
