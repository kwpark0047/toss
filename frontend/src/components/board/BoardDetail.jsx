import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { boardAPI } from '../../api';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Heart, Eye, MessageSquare, Share2, Pin,
    Trash2, Edit3, CornerDownRight, ChevronUp, Tag,
    Clock, Send
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';

const TYPE_LABELS = { notice: '공지사항', free: '자유게시판', qna: '질문/답변', faq: '도움말/FAQ' };
const TYPE_COLORS = {
    notice: 'bg-rose-600 text-white',
    free:   'bg-orange-500 text-white',
    qna:    'bg-emerald-600 text-white',
    faq:    'bg-slate-700 text-white',
};

const fmtDateFull = (d) =>
    new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

const fmtDateShort = (d) => {
    const diff = (Date.now() - new Date(d)) / 1000;
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(d));
};

const CommentItem = ({ comment, user, onDelete, onReply, depth = 0 }) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className={`${depth > 0 ? 'pl-8 border-l-2 border-white/10' : ''}`}>
        <div className="flex gap-4 py-6">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center text-xs font-black shrink-0">
                {comment.author_name?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className="text-[11px] font-black text-white uppercase tracking-widest">{comment.author_name}</span>
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                        <Clock size={9} />{fmtDateShort(comment.created_at)}
                    </span>
                </div>
                <p className="text-[13px] text-slate-500 leading-relaxed">{comment.content}</p>
                <div className="flex items-center gap-4 mt-3">
                    {depth === 0 && (
                        <button onClick={() => onReply(comment.id, comment.author_name)}
                            className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-orange-500 uppercase tracking-widest transition-colors">
                            <CornerDownRight size={11} /> Reply
                        </button>
                    )}
                    {user && (user.id === comment.author_id || ['super_admin', 'store_admin'].includes(user.role)) && (
                        <button onClick={() => onDelete(comment.id)}
                            className="flex items-center gap-1 text-[10px] font-black text-slate-500 hover:text-rose-500 uppercase tracking-widest transition-colors">
                            <Trash2 size={10} /> Delete
                        </button>
                    )}
                </div>
            </div>
        </div>
        {comment.replies?.map(reply => (
            <CommentItem key={reply.id} comment={reply} user={user} onDelete={onDelete} onReply={onReply} depth={1} />
        ))}
    </motion.div>
);

const BoardDetail = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const commentRef = useRef(null);
    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [likeLoading, setLikeLoading] = useState(false);
    const [showTop, setShowTop] = useState(false);

    useEffect(() => {
        const onScroll = () => setShowTop(window.scrollY > 500);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const fetchPost = async () => {
        try {
            const [postRes, commentRes] = await Promise.all([
                boardAPI.getPost(id),
                boardAPI.getComments(id),
            ]);
            setPost(postRes.data?.data || postRes.data);
            setComments(commentRes.data?.data || commentRes.data || []);
        } catch {
            toast.error('게시글을 불러올 수 없습니다.');
            navigate(-1);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPost(); }, [id]);

    const handleLike = async () => {
        if (!user) { toast.info('로그인이 필요합니다.'); return; }
        if (likeLoading) return;
        setLikeLoading(true);
        try {
            const res = await boardAPI.toggleLike(id);
            const { liked, like_count } = res.data?.data || {};
            setPost(p => ({ ...p, is_liked: liked, like_count }));
        } catch {
            toast.error('잠시 후 다시 시도해주세요.');
        } finally {
            setLikeLoading(false);
        }
    };

    const handleComment = async (e) => {
        e.preventDefault();
        if (!user) { toast.info('로그인이 필요합니다.'); return; }
        if (!commentText.trim()) return;
        try {
            await boardAPI.createComment(id, {
                content: commentText.trim(),
                parent_id: replyTo?.id || null,
            });
            setCommentText('');
            setReplyTo(null);
            await fetchPost();
            toast.success('댓글이 등록되었습니다.');
        } catch {
            toast.error('댓글 등록에 실패했습니다.');
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!window.confirm('댓글을 삭제하시겠습니까?')) return;
        try {
            await boardAPI.deleteComment(commentId);
            await fetchPost();
            toast.success('삭제되었습니다.');
        } catch {
            toast.error('삭제에 실패했습니다.');
        }
    };

    const handleDeletePost = async () => {
        if (!window.confirm('게시글을 삭제하시겠습니까?')) return;
        try {
            await boardAPI.deletePost(id);
            toast.success('삭제되었습니다.');
            navigate(`/board/${post?.board_type || 'free'}`);
        } catch {
            toast.error('삭제에 실패했습니다.');
        }
    };

    const handlePin = async () => {
        try {
            await boardAPI.togglePin(id);
            setPost(p => ({ ...p, is_pinned: !p.is_pinned }));
            toast.success(post?.is_pinned ? '고정 해제되었습니다.' : '고정되었습니다.');
        } catch {
            toast.error('처리에 실패했습니다.');
        }
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success('링크가 복사되었습니다.');
    };

    const isOwner = user && post && user.id === post.author_id;
    const isAdmin = user && ['super_admin', 'store_admin'].includes(user.role);
    const isEditable = isOwner || isAdmin;

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 animate-pulse">
                <div className="space-y-12">
                    <div className="w-24 h-8 bg-white/10 rounded-xl" />
                    <div className="space-y-6">
                        <div className="w-20 h-6 bg-white/10 rounded-lg" />
                        <div className="w-full h-20 bg-white/10 rounded-3xl" />
                        <div className="w-1/2 h-20 bg-white/5 rounded-3xl" />
                    </div>
                    <div className="h-px bg-white/10" />
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map(i => <div key={i} className="w-full h-4 bg-white/5 rounded" />)}
                    </div>
                </div>
            </div>
        );
    }

    if (!post) return null;

    const tags = post.tags ? post.tags.split(',').filter(Boolean) : [];

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
            {/* ── 상단 네비게이션 ── */}
            <div className="flex items-center justify-between py-8 border-b border-white/10">
                <button onClick={() => navigate(`/board/${post.board_type}`)}
                    className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-[0.3em] transition-colors group">
                    <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                    Back to {TYPE_LABELS[post.board_type] || 'Board'}
                </button>
                <div className="flex items-center gap-3 flex-wrap">
                    {isAdmin && (
                        <button onClick={handlePin}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${post.is_pinned ? 'bg-rose-100 text-rose-600' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                            <Pin size={12} /> {post.is_pinned ? 'Unpin' : 'Pin'}
                        </button>
                    )}
                    {isEditable && (
                        <>
                            <button onClick={() => navigate(`/board/edit/${id}?type=${post.board_type}`)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 text-slate-400 hover:bg-orange-500/10 hover:text-orange-500 text-[10px] font-black uppercase tracking-widest transition-all">
                                <Edit3 size={12} /> Edit
                            </button>
                            <button onClick={handleDeletePost}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 text-[10px] font-black uppercase tracking-widest transition-all">
                                <Trash2 size={12} /> Delete
                            </button>
                        </>
                    )}
                    <button onClick={handleShare}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest transition-all">
                        <Share2 size={12} /> Share
                    </button>
                </div>
            </div>

            {/* ── 게시글 헤더 ── */}
            <motion.header initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="py-14 space-y-8 border-b-[3px] border-white/20">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-[0.3em] uppercase ${TYPE_COLORS[post.board_type] || 'bg-slate-700 text-white'}`}>
                        {TYPE_LABELS[post.board_type] || post.board_type}
                    </span>
                    {post.is_pinned && (
                        <span className="px-4 py-1.5 rounded-lg text-[10px] font-black tracking-[0.3em] uppercase bg-rose-600 text-white flex items-center gap-1.5">
                            <Pin size={10} /> HEADLINE STORY
                        </span>
                    )}
                </div>

                <h1 className="text-5xl md:text-7xl font-serif font-black italic tracking-tighter leading-[1.05]">
                    {post.title}
                </h1>

                {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {tags.map(tag => (
                            <Link key={tag} to={`/board/${post.board_type}?tag=${tag}`}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-orange-500/15 hover:text-orange-400 text-slate-500 rounded-full text-[10px] font-black tracking-widest uppercase transition-all">
                                <Tag size={9} />#{tag}
                            </Link>
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-6 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center text-sm font-black">
                            {post.author_name?.charAt(0)}
                        </div>
                        <div>
                            <p className="text-[11px] font-black text-white uppercase tracking-widest">{post.author_name}</p>
                            <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mt-0.5">
                                <Clock size={9} /> {fmtDateFull(post.created_at)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <span className="flex items-center gap-1.5"><Eye size={12} /> {post.view_count || 0}</span>
                        <span className="flex items-center gap-1.5"><MessageSquare size={12} /> {post.comment_count || 0}</span>
                        <span className={`flex items-center gap-1.5 ${post.is_liked ? 'text-rose-500' : ''}`}>
                            <Heart size={12} className={post.is_liked ? 'fill-rose-500' : ''} /> {post.like_count || 0}
                        </span>
                    </div>
                </div>
            </motion.header>

            {/* ── 본문 ── */}
            <motion.article initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                className="py-16 prose prose-slate prose-lg max-w-none font-serif
                    prose-headings:font-black prose-headings:tracking-tight prose-headings:font-serif
                    prose-p:leading-[1.9] prose-p:text-slate-500
                    prose-a:text-orange-500 prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-white prose-strong:font-black
                    prose-code:text-rose-600 prose-code:bg-rose-50 prose-code:px-2 prose-code:py-0.5 prose-code:rounded-lg prose-code:text-sm prose-code:font-mono
                    prose-pre:bg-white/10 prose-pre:text-slate-100 prose-pre:rounded-3xl prose-pre:shadow-2xl
                    prose-blockquote:border-l-4 prose-blockquote:border-orange-500/50 prose-blockquote:not-italic prose-blockquote:text-slate-600 prose-blockquote:font-serif
                    whitespace-pre-wrap">
                {post.content}
            </motion.article>

            {/* ── 좋아요 버튼 ── */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                className="flex flex-col items-center gap-4 py-16 border-t border-b border-white/10">
                <motion.button
                    onClick={handleLike}
                    disabled={likeLoading}
                    whileTap={{ scale: 0.9 }}
                    className={`group flex flex-col items-center gap-3 px-12 py-8 rounded-[2rem] border-2 transition-all
                        ${post.is_liked
                            ? 'bg-rose-50 border-rose-300 text-rose-600'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-500'
                        } ${likeLoading ? 'opacity-60 cursor-not-allowed' : ''}`}>
                    <Heart size={32} className={`transition-all ${post.is_liked ? 'fill-rose-500 text-rose-500 scale-110' : 'group-hover:scale-110'}`} />
                    <div className="text-center">
                        <div className="text-2xl font-black tabular-nums">{post.like_count || 0}</div>
                        <div className="text-[10px] font-black tracking-[0.3em] uppercase mt-1">
                            {post.is_liked ? 'Liked ✓' : 'Like this article'}
                        </div>
                    </div>
                </motion.button>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {post.is_liked ? '이 글에 공감을 남겼습니다' : '이 글이 도움이 되었나요?'}
                </p>
            </motion.div>

            {/* ── 댓글 섹션 ── */}
            <section className="pt-16 space-y-12" ref={commentRef}>
                <div className="flex items-center gap-4 pb-6 border-b-[3px] border-white/20">
                    <span className="h-1 w-10 bg-white/10" />
                    <h2 className="text-[12px] font-black tracking-[0.4em] uppercase">Reader Comments</h2>
                    <span className="ml-auto text-[11px] font-black tabular-nums text-slate-400 uppercase">{post.comment_count || 0} comments</span>
                </div>

                <div className="divide-y divide-slate-50">
                    {comments.length === 0 ? (
                        <div className="py-16 text-center">
                            <div className="text-6xl font-serif italic font-black text-slate-50 select-none">No Comments</div>
                            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-4">첫 번째 댓글을 남겨보세요</p>
                        </div>
                    ) : (
                        <AnimatePresence>
                            {comments.map(comment => (
                                <CommentItem key={comment.id} comment={comment} user={user}
                                    onDelete={handleDeleteComment}
                                    onReply={(cid, name) => {
                                        setReplyTo({ id: cid, name });
                                        commentRef.current?.querySelector('textarea')?.focus();
                                    }} />
                            ))}
                        </AnimatePresence>
                    )}
                </div>

                {/* 댓글 작성 */}
                <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleComment}
                    className="bg-white/5 rounded-[2rem] p-8 space-y-5 border border-white/10">
                    {replyTo && (
                        <div className="flex items-center justify-between px-4 py-2.5 bg-orange-500/10 border border-orange-500/15 rounded-xl">
                            <div className="flex items-center gap-2 text-[11px] font-black text-orange-500">
                                <CornerDownRight size={12} />
                                <span className="uppercase tracking-widest">{replyTo.name}</span>
                                <span className="text-orange-400 font-bold">에게 답글 작성 중</span>
                            </div>
                            <button type="button" onClick={() => setReplyTo(null)}
                                className="text-[10px] font-black text-orange-400 hover:text-rose-500 uppercase tracking-widest transition-colors">
                                취소
                            </button>
                        </div>
                    )}
                    {!user && (
                        <div className="text-[11px] font-bold text-slate-400 text-center py-2">
                            <Link to="/login" className="text-orange-500 font-black underline">로그인</Link>이 필요합니다.
                        </div>
                    )}
                    <textarea
                        rows={4}
                        disabled={!user}
                        placeholder={user
                            ? (replyTo ? `${replyTo.name}님께 답글을 남겨보세요...` : '의견을 자유롭게 남겨보세요...')
                            : '로그인 후 댓글을 작성할 수 있습니다.'}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-[13px] text-slate-500 placeholder:text-slate-500 resize-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50 outline-none transition-all disabled:opacity-60"
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleComment(e); }}
                    />
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ctrl+Enter로 전송</span>
                        <button type="submit" disabled={!user || !commentText.trim()}
                            className="flex items-center gap-2 px-8 py-3 bg-white/10 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-orange-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95">
                            <Send size={14} /> Submit
                        </button>
                    </div>
                </motion.form>
            </section>

            {/* ── 스크롤 투 탑 ── */}
            <AnimatePresence>
                {showTop && (
                    <motion.button
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="fixed bottom-8 right-8 w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-orange-500 transition-all active:scale-95 z-50">
                        <ChevronUp size={18} />
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
};

export default BoardDetail;
