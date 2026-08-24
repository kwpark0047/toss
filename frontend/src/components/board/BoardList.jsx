import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { boardAPI } from '../../api';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Megaphone, MessageSquare, HelpCircle,
    Pin, Eye, ChevronRight, Plus, Heart, TrendingUp,
    Tag, X, Clock, BarChart2
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/ui/Icon';

// 관리자 다크 테마 톤에 맞춘 게시판 타입 메타
const BOARD_TYPES = [
    { key: 'notice', label: '공지사항', eng: 'NOTICE',    icon: Megaphone,     text: 'text-rose-400',    bg: 'bg-rose-500/15',    dot: 'bg-rose-500' },
    { key: 'free',   label: '자유게시판', eng: 'COMMUNITY', icon: MessageSquare, text: 'text-indigo-400',  bg: 'bg-indigo-500/15',  dot: 'bg-indigo-500' },
    { key: 'news',   label: '뉴스/소식', eng: 'NEWS',      icon: BarChart2,     text: 'text-sky-400',    bg: 'bg-sky-500/15',      dot: 'bg-sky-500' },
    { key: 'qna',    label: '질문/답변', eng: 'Q&A',       icon: HelpCircle,    text: 'text-emerald-400', bg: 'bg-emerald-500/15', dot: 'bg-emerald-500' },
    { key: 'faq',    label: '도움말/FAQ', eng: 'FAQ',      icon: HelpCircle,    text: 'text-slate-300',   bg: 'bg-white/10',       dot: 'bg-slate-400' },
];

const TYPE_MAP = Object.fromEntries(BOARD_TYPES.map(t => [t.key, t]));

const fmtDate = (d) => {
    const date = new Date(d);
    const now = new Date();
    const diff = (now - date) / 1000;
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(date);
};

const BoardList = () => {
    const { user } = useAuth();
    const { type: urlType } = useParams();
    const navigate = useNavigate();
    const [boardType, setBoardType] = useState(urlType || 'notice');
    const [posts, setPosts] = useState([]);
    const [pinnedPosts, setPinnedPosts] = useState([]);
    const [trending, setTrending] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [searchType, setSearchType] = useState('title');
    const [activeTag, setActiveTag] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        boardAPI.getTrending(6).then(res => setTrending(res.data?.data || [])).catch(() => {});
    }, []);

    useEffect(() => {
        const fetchPosts = async () => {
            setLoading(true);
            try {
                const res = await boardAPI.getPosts(boardType, {
                    page, search: search.trim(), searchType, tag: activeTag, limit: 12,
                });
                const data = res.data?.data || res.data;
                const allPosts = data.posts || [];
                setPinnedPosts(allPosts.filter(p => p.is_pinned));
                setPosts(allPosts.filter(p => !p.is_pinned));
                setTotalPages(data.totalPages || 1);
                setTotal(data.total || 0);
            } catch (error) {
                console.error('Failed to fetch posts:', error);
            } finally {
                setLoading(false);
            }
        };
        const t = setTimeout(fetchPosts, 300);
        return () => clearTimeout(t);
    }, [boardType, page, search, searchType, activeTag]);

    const handleTypeChange = (newType) => {
        setBoardType(newType);
        setPage(1);
        setSearch('');
        setActiveTag('');
        navigate(`/board/${newType}`);
    };

    const handleTagClick = (tag) => {
        setActiveTag(prev => prev === tag ? '' : tag);
        setPage(1);
    };

    const currentType = TYPE_MAP[boardType] || BOARD_TYPES[0];
    const CurrentIcon = currentType.icon;

    return (
        <div className="max-w-7xl mx-auto pb-32 px-1 sm:px-2 text-white">

            {/* ── 헤더 ── */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-5 pt-2 pb-6 border-b border-white/10">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl ${currentType.bg} flex items-center justify-center`}>
                        <CurrentIcon size={22} className={currentType.text} />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2 text-balance">
                            {currentType.label}
                        </h1>
                        <p className="text-xs text-slate-500 font-bold mt-0.5 flex items-center gap-1.5">
                            <BarChart2 size={12} aria-hidden="true" /> 총 <span className="tabular-nums text-slate-300">{total}</span>개 게시글 · 커뮤니티
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        if (!user) { toast.info('로그인이 필요한 서비스입니다.'); navigate('/login'); return; }
                        navigate(`/board/write?type=${boardType}`);
                    }}
                    className="inline-flex items-center justify-center gap-2 px-6 h-12 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-orange-500/20 hover:brightness-105 active:scale-95 transition-all"
                >
                    <Plus size={18} aria-hidden="true" /> 글쓰기
                </button>
            </header>

            {/* ── 인기글 (Trending) ── */}
            {trending.length > 0 && (
                <section className="py-6 border-b border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp size={15} className="text-orange-400" aria-hidden="true" />
                        <span className="text-sm font-black text-white">인기 게시글</span>
                    </div>
                    <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
                        {trending.map((post, i) => (
                            <Link key={post.id} to={`/board/posts/${post.id}`}
                                className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all group">
                                <span className="text-[11px] font-black tabular-nums text-orange-400">{String(i + 1).padStart(2, '0')}</span>
                                <span className="text-xs font-bold text-slate-200 max-w-[180px] truncate">{post.title}</span>
                                <span className="flex items-center gap-2 text-[10px] font-bold text-slate-500 ml-1">
                                    <span className="flex items-center gap-0.5"><Heart size={10} aria-hidden="true" /> {post.like_count || 0}</span>
                                    <span className="flex items-center gap-0.5"><Eye size={10} aria-hidden="true" /> {post.view_count || 0}</span>
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* ── 탭 + 검색 ── */}
            <nav className="flex flex-wrap items-center gap-3 py-6">
                <div className="flex flex-wrap gap-2">
                    {BOARD_TYPES.map((type) => {
                        const Icon = type.icon;
                        const active = boardType === type.key;
                        return (
                            <button key={type.key} type="button" onClick={() => handleTypeChange(type.key)}
                                aria-pressed={active}
                                className={`flex items-center gap-1.5 px-4 h-11 rounded-xl text-sm font-black transition-all ${active
                                    ? 'bg-gradient-to-r from-orange-500 to-rose-600 text-white shadow-lg shadow-orange-500/20'
                                    : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                                }`}>
                                <Icon size={14} aria-hidden="true" /> {type.label}
                            </button>
                        );
                    })}
                </div>

                <div className="ml-auto flex items-center gap-2 bg-white/5 border border-white/10 px-4 h-11 rounded-2xl focus-within:border-orange-500/50 transition-all w-full md:w-auto">
                    <select value={searchType} onChange={e => setSearchType(e.target.value)} aria-label="검색 기준"
                        className="bg-transparent border-none text-xs font-black text-slate-400 outline-none cursor-pointer">
                        <option value="title" className="bg-slate-900">제목</option>
                        <option value="content" className="bg-slate-900">내용</option>
                        <option value="author" className="bg-slate-900">작성자</option>
                    </select>
                    <div className="w-px h-4 bg-white/10" />
                    <Search size={15} className="text-slate-500 shrink-0" aria-hidden="true" />
                    <input type="text" placeholder="검색어…" aria-label="게시글 검색" spellCheck={false}
                        className="bg-transparent border-none text-sm font-bold text-white placeholder:text-slate-600 w-full md:w-52 outline-none"
                        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                    {search && (
                        <button type="button" onClick={() => setSearch('')} aria-label="검색어 지우기" className="text-slate-500 hover:text-white transition-colors">
                            <X size={14} aria-hidden="true" />
                        </button>
                    )}
                </div>
            </nav>

            {/* 태그 필터 */}
            {activeTag && (
                <div className="pb-4 flex items-center gap-2">
                    <Tag size={12} className="text-orange-400" aria-hidden="true" />
                    <span className="text-xs font-bold text-slate-400">태그 필터</span>
                    <button type="button" onClick={() => setActiveTag('')}
                        className="flex items-center gap-1.5 px-3 py-1 bg-orange-500/15 border border-orange-500/30 text-orange-300 rounded-full text-xs font-black hover:bg-orange-500/25 transition-all">
                        #{activeTag} <X size={10} aria-hidden="true" />
                    </button>
                </div>
            )}

            {/* ── 로딩 ── */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                    {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton-dark h-40 rounded-2xl" />)}
                </div>
            ) : (
                <div className="space-y-10 mt-2">
                    {/* ── 고정글 ── */}
                    {pinnedPosts.length > 0 && (
                        <section className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Pin size={14} className="text-rose-400" aria-hidden="true" />
                                <h2 className="text-sm font-black text-white">고정 게시글</h2>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {pinnedPosts.slice(0, 2).map((post) => (
                                    <motion.div key={post.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }}>
                                        <Link to={`/board/posts/${post.id}`}
                                            className="group relative flex flex-col gap-4 rounded-2xl p-6 bg-gradient-to-br from-orange-500/10 to-rose-500/10 border border-orange-500/20 hover:border-orange-500/40 transition-all">
                                            <div className="absolute top-5 right-5 w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center group-hover:rotate-12 transition-transform">
                                                <Pin size={15} aria-hidden="true" />
                                            </div>
                                            <span className="inline-block w-fit px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-500/20 text-rose-300">고정</span>
                                            <h3 className="text-xl font-black text-white leading-tight line-clamp-2 text-balance pr-10">{post.title}</h3>
                                            {post.tags && (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {post.tags.split(',').filter(Boolean).map(tag => (
                                                        <span key={tag} className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-300">#{tag}</span>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-3 pt-3 border-t border-white/10">
                                                <div className="w-8 h-8 rounded-lg bg-white/10 text-slate-300 flex items-center justify-center font-black text-xs">
                                                    {post.author_name?.charAt(0)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-black text-white truncate">{post.author_name}</p>
                                                    <p className="text-[11px] text-slate-500">{fmtDate(post.created_at)}</p>
                                                </div>
                                                <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
                                                    <span className="flex items-center gap-1"><Heart size={11} aria-hidden="true" /> {post.like_count || 0}</span>
                                                    <span className="flex items-center gap-1"><Eye size={11} aria-hidden="true" /> {post.view_count || 0}</span>
                                                    <span className="flex items-center gap-1"><MessageSquare size={11} aria-hidden="true" /> {post.comment_count || 0}</span>
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ── 일반 게시글 ── */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-black text-white">최신 게시글</h2>
                            <span className="text-[11px] font-bold text-slate-500 tabular-nums">{posts.length} / {total}건</span>
                        </div>

                        {posts.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {posts.map((post, idx) => (
                                    <motion.div key={post.id}
                                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.04, 0.3) }}>
                                        <Link to={`/board/posts/${post.id}`}
                                            className="group flex flex-col h-full bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 hover:bg-white/[0.07] transition-all">
                                            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                                                <span className="flex items-center gap-1.5">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${TYPE_MAP[post.board_type]?.dot || 'bg-slate-500'}`} />
                                                    <span className="text-[10px] font-black text-slate-500">{TYPE_MAP[post.board_type]?.label || post.board_type}</span>
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                                    <Clock size={10} aria-hidden="true" /> {fmtDate(post.created_at)}
                                                </span>
                                            </div>
                                            <div className="flex-1 px-5 py-4 space-y-3">
                                                <h3 className="text-base font-black text-white leading-snug group-hover:text-orange-300 transition-colors line-clamp-2">{post.title}</h3>
                                                {post.tags && (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {post.tags.split(',').filter(Boolean).slice(0, 3).map(tag => (
                                                            <button key={tag} type="button" onClick={e => { e.preventDefault(); handleTagClick(tag); }}
                                                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${activeTag === tag ? 'bg-orange-500 text-white' : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'}`}>
                                                                #{tag}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-6 h-6 rounded-lg bg-white/10 text-slate-300 flex items-center justify-center text-[10px] font-black shrink-0">
                                                        {post.author_name?.charAt(0)}
                                                    </div>
                                                    <span className="text-[11px] font-bold text-slate-400 truncate max-w-[90px]">{post.author_name}</span>
                                                </div>
                                                <div className="flex items-center gap-2.5 text-[10px] font-bold text-slate-500">
                                                    <span className="flex items-center gap-1"><Heart size={11} aria-hidden="true" className={post.is_liked ? 'text-rose-400 fill-rose-400' : ''} /> {post.like_count || 0}</span>
                                                    <span className="flex items-center gap-1"><MessageSquare size={11} aria-hidden="true" /> {post.comment_count || 0}</span>
                                                    <span className="flex items-center gap-1"><Eye size={11} aria-hidden="true" /> {post.view_count || 0}</span>
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-24 text-center">
                                <div className="text-5xl mb-3 select-none" aria-hidden="true">📭</div>
                                <p className="text-slate-400 font-bold">{activeTag ? `#${activeTag} 태그의 게시글이 없어요` : '아직 게시글이 없어요'}</p>
                                {activeTag && (
                                    <button type="button" onClick={() => setActiveTag('')}
                                        className="mt-2 text-sm font-black text-orange-400 hover:text-orange-300 transition-colors">태그 필터 제거</button>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            )}

            {/* ── 페이지네이션 ── */}
            <AnimatePresence>
                {totalPages > 1 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="flex items-center justify-between border-t border-white/10 pt-8 mt-12 gap-4">
                        <span className="text-xs font-black text-slate-400 tabular-nums">Page {page} / {totalPages}</span>
                        <div className="flex items-center gap-1.5">
                            <button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)} aria-label="이전 페이지"
                                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all">
                                <ChevronRight size={16} className="rotate-180" aria-hidden="true" />
                            </button>
                            <div className="flex gap-1.5">
                                {[...Array(totalPages)].map((_, i) => {
                                    const p = i + 1;
                                    if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
                                        return (
                                            <button key={p} type="button" onClick={() => setPage(p)} aria-current={page === p}
                                                className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${page === p ? 'bg-gradient-to-r from-orange-500 to-rose-600 text-white shadow-lg shadow-orange-500/20' : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'}`}>
                                                {p < 10 ? `0${p}` : p}
                                            </button>
                                        );
                                    }
                                    if (p === 2 || p === totalPages - 1) return <span key={p} className="w-6 flex items-center justify-center text-slate-600">…</span>;
                                    return null;
                                })}
                            </div>
                            <button type="button" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} aria-label="다음 페이지"
                                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all">
                                <ChevronRight size={16} aria-hidden="true" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default BoardList;
