import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X, Search, ChevronLeft, MessageCircle, RefreshCw } from 'lucide-react';
import { chatAPI, getSocket } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
const formatTimeHHMM = dateStr => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};
const formatTimeAmPm = dateStr => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  let hours = date.getHours();
  const ampm = hours >= 12 ? '오후' : '오전';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${ampm} ${hours}:${minutes}`;
};

/**
 * AdminChatManager — 슈퍼관리자 & 사업자 간 1:1 채팅 관리자.
 * 슈퍼관리자는 모든 사업자 목록을 보고 대화할 수 있으며,
 * 사업자는 플랫폼 운영자(슈퍼관리자)와 대화할 수 있습니다.
 */
const AdminChatManager = ({
  isOpen,
  onClose
}) => {
  const {
    user
  } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const socket = getSocket();
  const scrollRef = useRef(null);
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

const loadMessages = useCallback(async roomId => {
    try {
      const res = await chatAPI.getMessages(roomId);
      if (res.success) {
        setMessages(res.data);
        // 읽음 처리
        chatAPI.markAsRead(roomId, {
          sender_type_not: isSuperAdmin ? 'super_admin' : 'owner'
        });
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, [isSuperAdmin]);
  const loadRooms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await chatAPI.getAdminRooms();
      if (res.success) setRooms(res.data);
    } catch (error) {
      console.error('Failed to load chat rooms:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  const accessSupportRoom = useCallback(async (targetUserId = null) => {
    setLoading(true);
    try {
      const res = await chatAPI.accessAdminRoom({
        user_id: targetUserId
      });
      if (res.success) {
        setActiveRoom(res.data);
        loadMessages(res.data.id);
      }
    } catch (error) {
      console.error('Failed to access admin room:', error);
    } finally {
      setLoading(false);
    }
  }, [loadMessages]);

  // 1. 초기화: 룸 목록(슈퍼관리자) 또는 자동 접속(사업자)
  useEffect(() => {
    if (isOpen) {
if (isSuperAdmin) {
        loadRooms();
      } else {
        accessSupportRoom();
      }
    }
  }, [isOpen, isSuperAdmin, loadRooms, accessSupportRoom]);

  // 2. 소켓 연결 & 메시지 리스너
  useEffect(() => {
    if (socket && activeRoom) {
      socket.emit('join-chat-room', {
        roomId: activeRoom.id
      });
      const handleNewMessage = message => {
        if (message.room_id === activeRoom.id) {
          setMessages(prev => [...prev, message]);
          // 활성창이면 즉시 읽음 처리
          chatAPI.markAsRead(activeRoom.id, {
            sender_type_not: isSuperAdmin ? 'super_admin' : 'owner'
          });
        }
        // 룸 목록 갱신 (마지막 메시지 업데이트용)
        if (isSuperAdmin) loadRooms();
      };
      socket.on('new-chat-message', handleNewMessage);
      return () => socket.off('new-chat-message', handleNewMessage);
    }
  }, [socket, activeRoom, isSuperAdmin, loadRooms]);

  // 스크롤 하단 고정
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
}, [messages]);
  const handleSendMessage = async e => {
    if (e) e.preventDefault();
    if (!input.trim() || !activeRoom) return;
    const messageData = {
      room_id: activeRoom.id,
      sender_type: isSuperAdmin ? 'super_admin' : 'owner',
      content: input
    };
    try {
      const res = await chatAPI.sendMessage(messageData);
      if (res.success) {
        socket.emit('send-chat-message', {
          roomId: activeRoom.id,
          message: res.data,
          roomType: activeRoom.type,
          targetId: isSuperAdmin ? activeRoom.user_id : null // 사업자에게 보낼 때는 사업자의 user_id
        });
        setInput('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };
  const filteredRooms = rooms.filter(r => r.users?.name?.toLowerCase().includes(search.toLowerCase()) || r.last_message?.toLowerCase().includes(search.toLowerCase()));
  return <AnimatePresence>
      {isOpen && <div className="fixed inset-0 z-[100] flex items-center justify-end pointer-events-none p-4 sm:p-6">
          <motion.div initial={{
        opacity: 0,
        x: 100,
        scale: 0.95
      }} animate={{
        opacity: 1,
        x: 0,
        scale: 1
      }} exit={{
        opacity: 0,
        x: 100,
        scale: 0.95
      }} className="w-full max-w-md h-[85vh] bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-white/5 bg-gradient-to-r from-slate-800 to-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {activeRoom && isSuperAdmin && <button onClick={() => setActiveRoom(null)} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors">
                    <ChevronLeft size={20} />
                  </button>}
                <div>
                  <h3 className="font-black text-lg flex items-center gap-2">
                    <MessageSquare size={20} className="text-orange-400" />
                    {isSuperAdmin ? activeRoom ? activeRoom.users?.name : '사업자 지원 센터' : '플랫폼 운영팀 문의'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {activeRoom ? isSuperAdmin ? activeRoom.users?.phone : '1:1 실시간 상담중' : '대화 목록'}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400">
                <X size={20} />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col bg-slate-900/50">
              {isSuperAdmin && !activeRoom ?
          // 룸 목록 (슈퍼관리자)
          <div className="flex flex-col h-full">
                  <div className="p-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input type="text" placeholder="사업자명 또는 메시지 검색..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-orange-500/50 transition-colors" />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading && rooms.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
                        <RefreshCw className="animate-spin" size={24} />
                        <p className="text-sm">채팅방을 불러오는 중...</p>
                      </div> : filteredRooms.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-slate-500 p-10 text-center">
                        <MessageCircle size={40} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium">참여 중인 대화가 없습니다.</p>
                      </div> : <div className="divide-y divide-white/5">
                        {filteredRooms.map(room => <button key={room.id} onClick={() => {
                  setActiveRoom(room);
                  loadMessages(room.id);
                }} className="w-full p-4 flex items-center gap-4 hover:bg-white/5 transition-colors text-left">
                            <div className="relative">
                              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 font-bold border border-orange-500/20">
                                {room.users?.name?.charAt(0)}
                              </div>
                              {room.unreadCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-[10px] font-black text-white flex items-center justify-center rounded-full border-2 border-slate-900 animate-bounce">
                                  {room.unreadCount}
                                </span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-sm truncate">{room.users?.name}</span>
                                <span className="text-[10px] text-slate-500">
                                  {room.updated_at ? formatTimeHHMM(room.updated_at) : ''}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 truncate leading-relaxed">
                                {room.last_message || '대화 내역이 없습니다.'}
                              </p>
                            </div>
                          </button>)}
                      </div>}
                  </div>
                </div> :
          // 채팅창
          <div className="flex flex-col h-full relative">
                  {loading && messages.length === 0 ? <div className="absolute inset-0 z-10 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center text-orange-400">
                      <RefreshCw size={24} className="animate-spin" />
                    </div> : null}

                  <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {messages.length === 0 && !loading ? <div className="py-10 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 text-slate-500 mb-3">
                          <MessageSquare size={20} />
                        </div>
                        <p className="text-sm text-slate-500">상담이 시작되었습니다.<br />문의하실 내용을 입력해 주세요.</p>
                      </div> : messages.map((msg, idx) => {
                const isMine = isSuperAdmin ? msg.sender_type === 'super_admin' : msg.sender_type === 'owner';
                return <div key={msg.id || idx} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                              {!isMine && <span className="text-[10px] font-bold text-slate-500 ml-1">
                                  {msg.sender_type === 'super_admin' ? '플랫폼 지원팀' : '사업자'}
                                </span>}
                              <div className={`
                                px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                                ${isMine ? 'bg-orange-500 text-white font-medium rounded-tr-none' : 'bg-white/10 text-slate-200 border border-white/5 rounded-tl-none'}
                              `}>
                                {msg.content}
                              </div>
                              <div className="flex items-center gap-1.5 px-1">
                                {isMine && msg.is_read && <span className="text-[10px] text-orange-400/60 font-bold uppercase tracking-tighter">Read</span>}
                                <span className="text-[9px] text-slate-600">
                                  {formatTimeAmPm(msg.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>;
              })}
                  </div>

                  {/* Input */}
                  <div className="p-4 bg-slate-800/50 border-t border-white/5">
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="메시지를 입력하세요..." className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500/50 transition-all placeholder:text-slate-600" />
                      <button type="submit" disabled={!input.trim()} className="p-3 bg-orange-500 text-white rounded-2xl hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 transition-all shadow-lg shadow-orange-500/20">
                        <Send size={20} />
                      </button>
                    </form>
                    <p className="text-[10px] text-slate-600 mt-2 text-center">
                      운영 시간: 평일 09:00 - 18:00 (공휴일 제외)
                    </p>
                  </div>
                </div>}
            </div>
          </motion.div>
        </div>}
    </AnimatePresence>;
};
export default AdminChatManager;
