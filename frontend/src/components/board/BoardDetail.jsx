import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { boardAPI } from '../../api';
import {
    ArrowLeft, MessageSquare, Eye, Clock,
    Trash2, Edit3, Pin, Heart, Share2, CornerDownRight, Send
} from 'lucide-react';
import { toast } from 'react-toastify';

// ==============================================================
// BoardDetail - 매거진 기사 스타일
// 게시글을 하나의 정제된 잡지 아티클처럼 구성
// ==============================================================

const BoardDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [replyTarget, setReplyTarget] = useState(null);

    const isAdmin = ['super_admin', 'store_admin'].includes(user?.role);
    const isAuthor = post?.author_id === user?.id;

    // 카테고리 한글 변환 헬퍼
    const getBoardLabel = (type) => {
        const labels = {
            'notice': '공지사항',
            'free': '자유게시판',
            'qna': '질문/답변',
            'faq': '도움말/FAQ'
        };
        return labels[type] || type?.toUpperCase();
    };

    useEffect(() => {
        fetchPostData();
    }, [id]);

    const fetchPostData = async () => {
        setLoading(true);
        try {
            const [postRes, commentRes] = await Promise.all([
                boardAPI.getPost(id),
                boardAPI.getComments(id)
            ]);
            setPost(postRes.data?.data || postRes.data);
            setComments(commentRes.data?.data || commentRes.data);
        } catch (error) {
            toast.error('게시글을 불러오는데 실패했습니다.');
            navigate('/board');
        } finally {
            setLoading(false);
        }
    };

    const handleComment = async (e) => {
        e.preventDefault();
        if (!user) {
            toast.warning('로그인이 필요합니다.');
            return;
        }
        if (!commentText.trim()) return;

        setSubmitting(true);
        try {
            await boardAPI.createComment(id, {
                content: commentText.trim(),
                parent_id: replyTarget
            });
            setCommentText('');
            setReplyTarget(null);
            fetchPostData();
            toast.success('댓글이 등록되었습니다.');
        } catch (error) {
            toast.error('댓글 등록에 실패했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeletePost = async () => {
        if (!window.confirm('정말로 이 기사를 삭제하시겠습니까? 관련 데이터가 모두 사라집니다.')) return;
        try {
            await boardAPI.deletePost(id);
            toast.success('게시글이 삭제되었습니다.');
            navigate('/board');
        } catch (error) {
            toast.error('삭제에 실패했습니다.');
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!window.confirm('댓글을 삭제하시겠습니까?')) return;
        try {
            await boardAPI.deleteComment(commentId);
            fetchPostData();
            toast.success('댓글이 삭제되었습니다.');
        } catch (error) {
            toast.error('댓글 삭제에 실패했습니다.');
        }
    };

    const togglePin = async () => {
        try {
            const res = await boardAPI.togglePin(id);
            setPost({ ...post, is_pinned: res.data?.data?.is_pinned });
            toast.success(res.data?.data?.is_pinned ? '상단에 고정되었습니다.' : '고정이 해제되었습니다.');
        } catch (error) {
            toast.error('권한이 없거나 오류가 발생했습니다.');
        }
    };

    // [프리미엄 스켈레톤 UI]
    if (loading) return (
        <div className="max-w-5xl mx-auto pb-48 px-6 sm:px-10 space-y-20 animate-pulse">
            <div className="h-10 border-b-[3px] border-slate-100 pb-8 flex justify-between items-center">
                <div className="w-32 h-4 bg-slate-100 rounded" />
                <div className="w-24 h-8 bg-slate-50 rounded-full" />
            </div>
            <div className="space-y-12">
                <div className="flex justify-between items-end border-b border-slate-50 pb-16">
                    <div className="space-y-8 flex-1">
                        <div className="w-48 h-4 bg-slate-100 rounded" />
                        <div className="w-full h-16 bg-slate-100 rounded-2xl" />
                        <div className="w-3/4 h-16 bg-slate-100 rounded-2xl" />
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="w-full h-4 bg-slate-50 rounded" />
                    <div className="w-full h-4 bg-slate-50 rounded" />
                    <div className="w-full h-4 bg-slate-50 rounded" />
                    <div className="w-2/3 h-4 bg-slate-50 rounded" />
                </div>
            </div>
        </div>
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="max-w-5xl mx-auto pb-48 px-6 sm:px-10 font-sans text-slate-900"
        >
            {/* Editorial Navigation */}
            <nav className="flex items-center justify-between border-b-[3px] border-slate-900 pb-8 mb-20">
                <button
                    onClick={() => navigate(-1)}
                    className="group flex items-center gap-4 text-[11px] font-black tracking-[0.4em] uppercase text-slate-400 hover:text-slate-900 transition-all"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-2 transition-transform" />
                    Back to Index
                </button>
                <div className="flex items-center gap-8">
                    {(isAuthor || isAdmin) && (
                        <div className="flex items-center gap-6">
                            <Link to={`/board/edit/${id}`} className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-400 hover:text-indigo-600 border-b border-transparent hover:border-indigo-600 transition-all">Edit Article</Link>
                            <button onClick={handleDeletePost} className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-400 hover:text-rose-600 border-b border-transparent hover:border-rose-600 transition-all">Discard</button>
                        </div>
                    )}
                    {isAdmin && (
                        <button
                            onClick={togglePin}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-full border-2 text-[10px] font-black tracking-[0.2em] uppercase transition-all shadow-sm active:scale-95 ${post.is_pinned ? 'bg-rose-600 border-rose-600 text-white shadow-rose-600/20' : 'border-slate-100 text-slate-300 hover:border-slate-900 hover:text-slate-900'
                                }`}
                        >
                            <Pin size={14} className={post.is_pinned ? 'fill-current' : ''} /> {post.is_pinned ? 'Featured' : 'Feature Story'}
                        </button>
                    )}
                </div>
            </nav>

            <article className="space-y-24">
                {/* Article Header */}
                <header className="space-y-12">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 border-b border-slate-100 pb-16">
                        <div className="space-y-8 flex-1">
                            <div className="flex items-center gap-4">
                                <span className="h-1 w-12 bg-rose-600 rounded-full"></span>
                                <span className="text-[12px] font-black tracking-[0.5em] uppercase text-rose-600 italic">
                                    {getBoardLabel(post.board_type)} / ARCHIVE NO.{id}
                                </span>
                            </div>
                            <h1 className="text-6xl md:text-8xl font-serif font-black leading-[0.95] tracking-tighter italic lg:-ml-1">
                                {post.title}
                            </h1>
                        </div>
                        <div className="flex flex-col items-start md:items-end gap-3 shrink-0 lg:pb-2">
                            <div className="text-[11px] font-black text-slate-900 tracking-[0.3em] uppercase border-b-[3px] border-slate-900 pb-1">Mastermind</div>
                            <div className="text-3xl font-serif font-black italic tracking-tight">{post.author_name}</div>
                            <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">
                                Published on {new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(post.created_at))}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-8 py-2">
                        <div className="flex items-center gap-10">
                            <div className="flex items-center gap-3 text-[11px] font-black tracking-[0.2em] uppercase text-slate-400">
                                <Eye size={18} className="text-slate-200" /> {post.view_count} Readers
                            </div>
                            <div className="flex items-center gap-3 text-[11px] font-black tracking-[0.2em] uppercase text-slate-400">
                                <MessageSquare size={18} className="text-slate-200" /> {comments.length} Responses
                            </div>
                        </div>
                        <button className="flex items-center gap-3 text-[11px] font-black tracking-[0.3em] uppercase text-slate-900 group hover:text-indigo-600 transition-colors">
                            <Share2 size={18} className="group-hover:translate-x-1 transition-transform" /> Spread the words
                        </button>
                    </div>
                </header>

                {/* Article Body */}
                <div className="prose prose-slate max-w-none">
                    <div className="text-xl md:text-2xl leading-[1.8] text-slate-800 font-medium whitespace-pre-wrap selection:bg-slate-900 selection:text-white first-letter:text-8xl first-letter:font-serif first-letter:font-black first-letter:float-left first-letter:mr-6 first-letter:mt-2 first-letter:text-slate-900 first-letter:leading-none">
                        {post.content}
                    </div>
                </div>

                {/* Interaction Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="pt-20 border-t-2 border-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-10"
                >
                    <div className="flex items-center gap-6">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="flex items-center gap-4 px-8 py-4 bg-white border-[3px] border-slate-900 rounded-full text-[11px] font-black tracking-[0.3em] uppercase hover:bg-slate-900 hover:text-white transition-all group shadow-xl shadow-slate-900/5 active:scale-95"
                        >
                            <Heart size={18} className="group-hover:fill-rose-500 group-hover:text-rose-500 transition-all" />
                            ADMIRE ARTICLE
                        </motion.button>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[11px] font-black tracking-[0.4em] text-slate-300 uppercase">Archive Tags /</span>
                        <div className="flex gap-4">
                            {['EDITORIAL', 'FEATURED', 'COMMUNITY'].map(tag => (
                                <motion.span
                                    key={tag}
                                    whileHover={{ y: -2 }}
                                    className="text-[11px] font-black tracking-[0.2em] text-slate-900 hover:text-indigo-600 cursor-pointer transition-colors relative group"
                                >
                                    #{tag}
                                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-indigo-600 group-hover:w-full transition-all"></span>
                                </motion.span>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </article>

            {/* Responses Section */}
            <section className="mt-48 space-y-20">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="flex flex-col items-center gap-6"
                >
                    <div className="text-[11px] font-black tracking-[0.8em] text-slate-200 uppercase italic">The Public Opinion</div>
                    <h2 className="text-5xl md:text-6xl font-serif font-black italic tracking-tighter">Public Responses</h2>
                    <span className="h-1 w-32 bg-slate-900 rounded-full"></span>
                </motion.div>

                {/* Comment Form */}
                <div className="relative">
                    <form onSubmit={handleComment} className="relative group z-10">
                        {replyTarget && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="absolute -top-12 left-0 flex items-center gap-4 bg-slate-900 text-white px-6 py-2 rounded-t-2xl text-[10px] font-black tracking-[0.3em] uppercase"
                            >
                                REPYING TO A VOICE
                                <button type="button" onClick={() => setReplyTarget(null)} className="ml-4 hover:text-rose-400 transition-colors uppercase">CANCEL</button>
                            </motion.div>
                        )}
                        <textarea
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder={user ? "Share your thoughts about this masterpiece..." : "로그인 후 댓글을 작성할 수 있습니다."}
                            disabled={!user || submitting}
                            rows={5}
                            className="w-full bg-slate-50 border-[3px] border-slate-100 rounded-[2.5rem] p-10 md:p-14 text-xl md:text-2xl font-serif italic outline-none focus:border-slate-900 focus:bg-white transition-all placeholder:text-slate-400 resize-none shadow-2xl shadow-slate-900/[0.02] disabled:bg-slate-100 disabled:cursor-not-allowed"
                        />
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            type="submit"
                            disabled={!user || submitting || !commentText.trim()}
                            className="absolute bottom-10 right-10 md:bottom-14 md:right-14 w-20 h-20 bg-slate-900 text-white rounded-3xl flex items-center justify-center shadow-3xl active:scale-95 disabled:opacity-20 disabled:scale-100 transition-all group overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600 to-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <Send size={28} className="relative z-10" />
                        </motion.button>
                    </form>
                    <div className="absolute -inset-4 bg-slate-100/50 rounded-[3.5rem] -z-0 opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
                </div>

                {/* Comments List */}
                <div className="space-y-16">
                    {comments.map((comment) => (
                        <div key={comment.id} className="group space-y-10 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex flex-col gap-6 border-l-[6px] border-slate-50 pl-10 md:pl-16 transition-all group-hover:border-slate-900">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-6">
                                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center text-[10px] font-black uppercase italic">
                                            {comment.author_name?.charAt(0)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[12px] font-black tracking-widest text-slate-900 uppercase italic leading-none">{comment.author_name}</span>
                                            <span className="text-[9px] font-bold text-slate-300 uppercase mt-2">{new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(comment.created_at))}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        {(comment.author_id === user?.id || isAdmin) && (
                                            <button
                                                onClick={() => handleDeleteComment(comment.id)}
                                                className="text-[10px] font-black tracking-widest text-slate-200 hover:text-rose-600 transition-colors uppercase"
                                            >
                                                Discard
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setReplyTarget(comment.id)}
                                            className="flex items-center gap-2 px-6 py-2 bg-slate-50 rounded-full text-[10px] font-black tracking-[0.2em] text-slate-400 hover:bg-slate-900 hover:text-white transition-all uppercase"
                                        >
                                            Response
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xl md:text-2xl font-serif italic text-slate-700 leading-relaxed tracking-tight group-hover:text-slate-900 transition-colors">
                                    "{comment.content}"
                                </p>
                            </div>

                            {/* Replies */}
                            {comment.replies?.length > 0 && (
                                <div className="ml-20 md:ml-32 space-y-12 border-l-2 border-slate-50 pl-12 md:pl-20 mt-10">
                                    {comment.replies.map((reply) => (
                                        <div key={reply.id} className="space-y-4 animate-in fade-in slide-in-from-left-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-5">
                                                    <CornerDownRight size={18} className="text-slate-200" />
                                                    <span className="text-[11px] font-black tracking-widest text-slate-900 uppercase italic">{reply.author_name}</span>
                                                    <span className="text-[9px] font-bold text-slate-300 uppercase">{new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }).format(new Date(reply.created_at))}</span>
                                                </div>
                                                {(reply.author_id === user?.id || isAdmin) && (
                                                    <button
                                                        onClick={() => handleDeleteComment(reply.id)}
                                                        className="text-[9px] font-black tracking-widest text-slate-200 hover:text-rose-600 transition-colors uppercase"
                                                    >
                                                        Discard
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-lg font-serif italic text-slate-500 leading-relaxed pl-10 group-hover:text-slate-700 transition-colors">
                                                "{reply.content}"
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    {comments.length === 0 && (
                        <div className="text-center py-32 space-y-8">
                            <div className="text-8xl font-serif italic text-slate-50 font-black select-none">QUIET</div>
                            <p className="text-[11px] font-black tracking-[0.5em] text-slate-200 uppercase">Be the first to echo your thoughts</p>
                        </div>
                    )}
                </div>
            </section>
        </motion.div>
    );
};

export default BoardDetail;
