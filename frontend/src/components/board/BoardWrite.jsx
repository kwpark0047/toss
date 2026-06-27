import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { boardAPI } from '../../api';
import {
    ArrowLeft, Save, Megaphone, MessageSquare, HelpCircle, Pin, Sparkles, Type, Send, AlertCircle
} from 'lucide-react';
import { toast } from 'react-toastify';

// ==============================================================
// BoardWrite - 포커스 에디터 스타일
// 잡지 원고를 쓰는 듯한 미니멀하고 몰입감 있는 환경 제공
// ==============================================================

const BOARD_OPTIONS = [
    { key: 'notice', label: '공지사항', icon: Megaphone, desc: '공식 소식', adminOnly: true },
    { key: 'free', label: '자유게시판', icon: MessageSquare, desc: '커뮤니티 공간', adminOnly: false },
    { key: 'qna', label: '질문/답변', icon: HelpCircle, desc: '궁금한 점 문의', adminOnly: false },
    { key: 'faq', label: '도움말/FAQ', icon: HelpCircle, desc: '자주 묻는 질문', adminOnly: true },
];

const BoardWrite = () => {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isEditMode = !!id;

    const [boardType, setBoardType] = useState(searchParams.get('type') || 'free');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [is_pinned, setIsPinned] = useState(false);
    const [loading, setLoading] = useState(isEditMode);
    const [submitting, setSubmitting] = useState(false);

    const isAdmin = ['super_admin', 'store_admin'].includes(user?.role);

    useEffect(() => {
        if (!user) {
            toast.warning('로그인이 필요한 페이지입니다.');
            navigate('/login');
            return;
        }
        if (isEditMode) {
            fetchPost();
        }
    }, [id, user]);

    const fetchPost = async () => {
        try {
            const res = await boardAPI.getPost(id);
            const post = res.data?.data || res.data;
            setTitle(post.title);
            setContent(post.content);
            setBoardType(post.board_type);
            setIsPinned(post.is_pinned);
        } catch (error) {
            toast.error('기사를 불러오는데 실패했습니다.');
            navigate('/board');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 유효성 검사 강화
        if (!title.trim()) {
            toast.error('기사의 헤드라인을 입력해주세요.');
            return;
        }
        if (!content.trim()) {
            toast.error('본문 내용을 작성해주세요.');
            return;
        }
        if (content.trim().length < 10) {
            toast.error('기사 내용은 최소 10자 이상이어야 합니다.');
            return;
        }

        setSubmitting(true);
        try {
            const postData = {
                title: title.trim(),
                content: content.trim(),
                is_pinned,
                board_type: boardType
            };

            if (isEditMode) {
                await boardAPI.updatePost(id, postData);
                toast.success('기사가 성공적으로 수정되었습니다.');
                navigate(`/board/posts/${id}`);
            } else {
                const res = await boardAPI.createPost(boardType, postData);
                const newPostId = res.data?.data?.id || res.data?.id;
                toast.success('새로운 기사가 발행되었습니다.');
                navigate(newPostId ? `/board/posts/${newPostId}` : `/board/${boardType}`);
            }
        } catch (error) {
            toast.error(error.response?.data?.error || '발행 중 오류가 발생했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center py-64">
            <div className="text-[10rem] font-serif italic font-black text-slate-50 animate-pulse select-none">PREPARING...</div>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto pb-48 px-6 sm:px-10 font-sans text-slate-900">
            {/* Editorial Header */}
            <header className="border-b-[6px] border-slate-900 pb-12 mb-20 flex flex-col md:flex-row md:items-end justify-between gap-10">
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <span className="h-1 w-12 bg-slate-900"></span>
                        <div className="text-[12px] font-black tracking-[0.5em] text-slate-400 uppercase italic">
                            {isEditMode ? '원고 수정' : '원고 작성'} 섹션
                        </div>
                    </div>
                    <h1 className="text-7xl md:text-9xl font-serif font-black italic tracking-tighter leading-none select-none">
                        {isEditMode ? 'EDIT' : 'WRITE'}
                    </h1>
                </div>
                <div className="flex flex-col items-start md:items-end gap-6 h-full pb-2">
                    <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                        {BOARD_OPTIONS.filter(o => !o.adminOnly || isAdmin).map(type => (
                            <button
                                key={type.key}
                                onClick={() => setBoardType(type.key)}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black tracking-[0.2em] uppercase transition-all ${boardType === type.key ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-300 hover:text-slate-900'}`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="space-y-24">
                {/* 제목 입력부 (매거진 스타일 헤드라인) */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black tracking-[0.4em] uppercase text-slate-400 italic">Headline Strategy (기사 제목)</label>
                        <span className="text-[10px] font-black italic text-slate-200 tabular-nums uppercase">{title.length} / 100 자</span>
                    </div>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="이곳에 강렬한 헤드라인을 입력하세요..."
                        maxLength={100}
                        className="w-full bg-transparent border-b-[4px] border-slate-100 focus:border-slate-900 text-5xl md:text-8xl font-serif font-black italic tracking-tighter outline-none py-6 transition-all placeholder:text-slate-100"
                    />
                </div>

                {/* 본문 에디터 영역 */}
                <div className="space-y-6 relative group">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black tracking-[0.4em] uppercase text-slate-400 italic">The Manuscript Content (본문 내용)</label>
                        <div className="flex items-center gap-6">
                            <span className="text-[10px] font-black italic text-slate-200 tabular-nums uppercase">{content.split(/\s+/).filter(Boolean).length} 단어</span>
                            <span className="text-[10px] font-black italic text-slate-200 tabular-nums uppercase">{content.length} 자</span>
                        </div>
                    </div>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="당신의 이야기를 풀어내세요. 모든 단어가 이 아카이브에서 중요하게 다뤄집니다..."
                        className="w-full bg-slate-50 border-[3px] border-slate-100 rounded-[3rem] p-12 md:p-20 text-2xl md:text-3xl font-serif leading-[1.6] outline-none focus:border-slate-900 focus:bg-white transition-all placeholder:text-slate-200 min-h-[600px] resize-none selection:bg-slate-900 selection:text-white"
                    />
                    <div className="absolute -inset-4 bg-slate-100/30 rounded-[4rem] -z-10 opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
                </div>

                {/* Admin Features & Actions */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-12 pt-16 border-t-[3px] border-slate-900">
                    <div className="flex items-center gap-10">
                        {isAdmin && (
                            <button
                                type="button"
                                onClick={() => setIsPinned(!is_pinned)}
                                className={`flex items-center gap-3 px-8 py-3.5 rounded-full border-2 text-[10px] font-black tracking-[0.3em] uppercase transition-all shadow-sm active:scale-95 ${is_pinned ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-100 text-slate-300 hover:border-slate-900 hover:text-slate-900'}`}
                            >
                                <Pin size={16} className={is_pinned ? 'fill-current' : ''} />
                                {is_pinned ? '상단 고정 게시글' : '상단 고정 설정'}
                            </button>
                        )}
                        <div className="flex items-center gap-4 text-slate-300">
                            <AlertCircle size={18} />
                            <span className="text-[10px] font-black tracking-widest uppercase italic">게시물은 발행 후 영구적으로 아카이브에 기록됩니다.</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="px-10 py-4 text-[11px] font-black tracking-[0.4em] uppercase text-slate-400 hover:text-slate-900 transition-colors"
                        >
                            작성 취소
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="group relative flex items-center gap-4 px-14 py-5 bg-slate-900 text-white rounded-full font-bold text-sm overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-slate-900/30"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            {submitting ? (
                                <span className="relative z-10 animate-pulse tracking-[0.2em] uppercase">발행 중...</span>
                            ) : (
                                <>
                                    <Send size={18} className="relative z-10 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                    <span className="relative z-10 tracking-[0.2em]">{isEditMode ? '변경사항 저장' : '게시글 발행'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default BoardWrite;
