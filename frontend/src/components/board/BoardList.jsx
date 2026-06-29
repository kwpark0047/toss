import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { boardAPI } from '../../api';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Megaphone, MessageSquare, HelpCircle,
    Pin, Eye, ChevronRight, Plus, Heart, TrendingUp,
    Tag, X, Clock, BarChart2
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';

const BOARD_TYPES = [
    { key: 'notice', label: '공지사항', eng: 'NOTICE',    icon: Megaphone,    text: 'text-rose-600',   bg: 'bg-rose-50',   dot: 'bg-rose-500' },
    { key: 'free',   label: '자유게시판', eng: 'COMMUNITY', icon: MessageSquare, text: 'text-indigo-600', bg: 'bg-indigo-50', dot: 'bg-indigo-500' },
    { key: 'qna',    label: '질문/답변', eng: 'Q&A',       icon: HelpCircle,   text: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
    { key: 'faq',    label: '도움말/FAQ', eng: 'FAQ',      icon: HelpCircle,   text: 'text-slate-600',  bg: 'bg-slate-50',  dot: 'bg-slate-500' },
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
                    page,
                    search: search.trim(),
                    searchType,
                    tag: activeTag,
                    limit: 12,
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
    const TypeIcon = currentType.icon;

    return (
        <div className="max-w-7xl mx-auto pb-32 font-sans text-slate-900 px-4 sm:px-6 lg:px-8">

            {/* ── 헤더 ── */}
            <header className="border-b-[6px] border-slate-900 pb-10 pt-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <span className="h-0.5 w-10 bg-slate-200" />
                        <span className="text-[11px] font-black tracking-[0.4em] text-slate-400 uppercase">
                            Volume 2026 · Community Archive · {currentType.eng}
                        </span>
                    </div>
                    <h1 className="text-7xl md:text-9xl font-serif font-black italic tracking-tighter leading-none select-none">
                        {currentType.eng}
                    </h1>
                    <div className="flex items-center gap-6 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                        <span className="flex items-center gap-1.5"><BarChart2 size={12} /> {total} 게시글</span>
                    </div>
                </div>
                <div className="flex flex-col items-start md:items-end gap-4">
                    <button
                        onClick={() => {
                            if (!user) { toast.info('로그인이 필요한 서비스입니다.'); navigate('/login'); return; }
                            navigate(`/board/write?type=${boardType}`);
                        }}
                        className="group relative flex items-center gap-3 px-10 py-5 bg-slate-900 text-white rounded-full font-bold text-sm overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-xl shadow-slate-900/10"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Plus size={18} className="relative z-10" />
                        <span className="relative z-10">WRITE ARTICLE</span>
                    </button>
                    <div className="text-[10px] font-black text-slate-300 tabular-nums tracking-[0.3em] uppercase">
                        {new Intl.DateTimeFormat('ko-KR', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date())}
                    </div>
                </div>
            </header>

            {/* ── 인기글 (Trending) ── */}
            {trending.length > 0 && (
                <section className="py-10 border-b border-slate-100">
                    <div className="flex items-center gap-3 mb-6">
                        <TrendingUp size={14} className="text-rose-500" />
                        <span className="text-[11px] font-black tracking-[0.4em] text-rose-500 uppercase">Hot Articles</span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                        {trending.map((post, i) => (
                            <Link key={post.id} to={`/board/posts/${post.id}`}
                                className="shrink-0 flex items-center gap-3 px-5 py-3 bg-slate-50 hover:bg-slate-900 hover:text-white rounded-2xl border border-slate-100 hover:border-slate-900 transition-all group">
                                <span className="text-[10px] font-black tabular-nums text-slate-300 group-hover:text-slate-500">
                                    {String(i + 1).padStart(2, '0')}
                                </span>
                                <span className="text-[11px] font-black text-slate-800 group-hover:text-white max-w-[180px] truncate">
                                    {post.title}
                                </span>
                                <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 group-hover:text-slate-300 ml-1">
                                    <Heart size={10} /> {post.like_count || 0}
                                    <Eye size={10} className="ml-1" /> {post.view_count || 0}
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* ── 탭 내비게이션 + 검색 ── */}
            <nav className="flex flex-wrap items-center gap-4 py-8 border-b border-slate-100">
                <div className="flex flex-wrap gap-2">
                    {BOARD_TYPES.map((type) => {
                        const Icon = type.icon;
                        return (
                            <button key={type.key} onClick={() => handleTypeChange(type.key)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black tracking-[0.2em] transition-all uppercase border-2 ${boardType === type.key
                                    ? 'bg-slate-900 border-slate-900 text-white shadow-lg'
                                    : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300 hover:text-slate-700'
                                }`}>
                                <Icon size={12} />
                                {type.label}
                            </button>
                        );
                    })}
                </div>

                <div className="ml-auto flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 group transition-all focus-within:bg-white focus-within:border-slate-900 focus-within:shadow-xl w-full md:w-auto">
                    <select value={searchType} onChange={e => setSearchType(e.target.value)}
                        className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate-500 focus:ring-0 cursor-pointer">
                        <option value="title">Title</option>
                        <option value="content">Content</option>
                        <option value="author">Author</option>
                    </select>
                    <div className="w-px h-4 bg-slate-200" />
                    <Search size={14} className="text-slate-400 group-focus-within:text-slate-900 transition-colors shrink-0" />
                    <input type="text" placeholder="Search keywords..."
                        className="bg-transparent border-none focus:ring-0 text-[10px] font-black tracking-widest placeholder:text-slate-300 w-full md:w-56 uppercase outline-none"
                        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                    {search && (
                        <button onClick={() => setSearch('')} className="text-slate-300 hover:text-slate-900 transition-colors">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </nav>

            {/* 태그 필터 */}
            {activeTag && (
                <div className="py-4 flex items-center gap-3">
                    <Tag size={12} className="text-indigo-500" />
                    <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">태그 필터:</span>
                    <button onClick={() => setActiveTag('')}
                        className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full text-[10px] font-black tracking-widest hover:bg-indigo-100 transition-all">
                        #{activeTag} <X size={10} />
                    </button>
                </div>
            )}

            {/* ── 로딩 스켈레톤 ── */}
            {loading ? (
                <div className="space-y-24 animate-pulse mt-16">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {[1, 2].map(i => (
                            <div key={i} className="h-[320px] bg-slate-50 rounded-[3rem] border border-slate-100 p-12 space-y-8">
                                <div className="w-20 h-6 bg-slate-200 rounded-lg" />
                                <div className="space-y-4">
                                    <div className="w-full h-12 bg-slate-200 rounded-2xl" />
                                    <div className="w-3/4 h-12 bg-slate-200 rounded-2xl" />
                                </div>
                                <div className="pt-8 border-t border-slate-100 flex gap-4">
                                    <div className="w-10 h-10 rounded-full bg-slate-200" />
                                    <div className="space-y-2 py-1">
                                        <div className="w-24 h-4 bg-slate-200 rounded" />
                                        <div className="w-16 h-3 bg-slate-100 rounded" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="space-y-6">
                                <div className="aspect-video bg-slate-50 rounded-[2.5rem] border border-slate-100" />
                                <div className="space-y-3 px-2">
                                    <div className="w-full h-6 bg-slate-100 rounded-xl" />
                                    <div className="flex justify-between">
                                        <div className="w-20 h-4 bg-slate-100 rounded" />
                                        <div className="w-12 h-4 bg-slate-50 rounded" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-24 mt-16">
                    {/* ── 고정글 Featured ── */}
                    {pinnedPosts.length > 0 && (
                        <section className="space-y-10">
                            <div className="flex items-center gap-4">
                                <span className="h-1 w-12 bg-rose-600 rounded-full" />
                                <h2 className="text-[12px] font-black tracking-[0.4em] text-rose-600 uppercase italic">Featured Story</h2>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {pinnedPosts.slice(0, 2).map((post, idx) => (
                                    <motion.div key={post.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ y: -6 }}>
                                        <Link to={`/board/posts/${post.id}`}
                                            className={`group relative flex flex-col gap-8 overflow-hidden rounded-[2.5rem] p-10 border-2 transition-all hover:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.12)] ${idx === 0
                                                ? 'bg-slate-900 border-slate-900 text-white'
                                                : 'bg-white border-slate-100 text-slate-900 hover:border-slate-900'
                                            }`}>
                                            <div className={`absolute top-10 right-10 w-12 h-12 rounded-full flex items-center justify-center shadow-xl transform group-hover:rotate-12 transition-transform ${idx === 0 ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'}`}>
                                                <Pin size={18} />
                                            </div>
                                            <div className="space-y-6">
                                                <div className={`inline-block px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase ${idx === 0 ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white'}`}>
                                                    HEADLINE STORY
                                                </div>
                                                <h3 className="text-4xl md:text-5xl font-serif font-black leading-[1.05] group-hover:italic transition-all line-clamp-3 tracking-tighter">
                                                    {post.title}
                                                </h3>
                                                {post.tags && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {post.tags.split(',').filter(Boolean).map(tag => (
                                                            <span key={tag} className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest ${idx === 0 ? 'bg-white/10 text-white/70' : 'bg-slate-100 text-slate-500'}`}>
                                                                #{tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className={`flex items-center gap-6 pt-6 border-t ${idx === 0 ? 'border-slate-800' : 'border-slate-100'}`}>
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${idx === 0 ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-900'}`}>
                                                        {post.author_name?.charAt(0)}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className={`text-[11px] font-black tracking-widest uppercase ${idx === 0 ? 'text-white' : 'text-slate-900'}`}>{post.author_name}</p>
                                                        <p className={`text-[10px] font-bold mt-0.5 uppercase ${idx === 0 ? 'text-slate-500' : 'text-slate-300'}`}>{fmtDate(post.created_at)}</p>
                                                    </div>
                                                    <div className={`flex items-center gap-4 text-[10px] font-black ${idx === 0 ? 'text-slate-500' : 'text-slate-400'}`}>
                                                        <span className="flex items-center gap-1"><Heart size={10} /> {post.like_count || 0}</span>
                                                        <span className="flex items-center gap-1"><Eye size={10} /> {post.view_count || 0}</span>
                                                        <span className="flex items-center gap-1"><MessageSquare size={10} /> {post.comment_count || 0}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ── 일반 게시글 그리드 ── */}
                    <section className="space-y-10">
                        <div className="flex items-center justify-between border-b-[3px] border-slate-900 pb-5">
                            <div className="flex items-center gap-4">
                                <span className="h-1 w-10 bg-slate-900" />
                                <h2 className="text-[12px] font-black tracking-[0.4em] uppercase">Archive · Latest</h2>
                            </div>
                            <div className="text-[10px] font-black text-slate-400 tabular-nums uppercase tracking-widest">
                                {posts.length} / {total} Items
                            </div>
                        </div>

                        {posts.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {posts.map((post, idx) => (
                                    <motion.div key={post.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.04 }}>
                                        <Link to={`/board/posts/${post.id}`}
                                            className="group flex flex-col h-full bg-white border border-slate-100 rounded-[2rem] overflow-hidden hover:border-slate-900 hover:shadow-xl transition-all">
                                            {/* 카드 상단 */}
                                            <div className="flex items-center justify-between p-6 border-b border-slate-50">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${TYPE_MAP[post.board_type]?.dot || 'bg-slate-400'}`} />
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{TYPE_MAP[post.board_type]?.eng || post.board_type}</span>
                                                </div>
                                                <span className="text-[9px] font-black text-slate-300 tabular-nums flex items-center gap-1">
                                                    <Clock size={9} /> {fmtDate(post.created_at)}
                                                </span>
                                            </div>

                                            {/* 본문 */}
                                            <div className="flex-1 p-6 space-y-4">
                                                <h3 className="text-xl font-serif font-black leading-tight group-hover:text-indigo-600 transition-colors line-clamp-2">
                                                    {post.title}
                                                </h3>
                                                {post.tags && (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {post.tags.split(',').filter(Boolean).slice(0, 3).map(tag => (
                                                            <button key={tag}
                                                                onClick={e => { e.preventDefault(); handleTagClick(tag); }}
                                                                className={`px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-widest transition-all ${activeTag === tag ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700'}`}>
                                                                #{tag}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* 푸터 */}
                                            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-50">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[9px] font-black">
                                                        {post.author_name?.charAt(0)}
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest truncate max-w-[80px]">{post.author_name}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-[9px] font-black text-slate-400">
                                                    <span className="flex items-center gap-1">
                                                        <Heart size={10} className={post.is_liked ? 'text-rose-500 fill-rose-500' : ''} />
                                                        {post.like_count || 0}
                                                    </span>
                                                    <span className="flex items-center gap-1"><MessageSquare size={10} /> {post.comment_count || 0}</span>
                                                    <span className="flex items-center gap-1"><Eye size={10} /> {post.view_count || 0}</span>
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="py-48 text-center space-y-8">
                                <div className="text-[12rem] font-serif italic font-black text-slate-50 leading-none select-none">EMPTY</div>
                                <div className="space-y-3">
                                    <p className="text-[12px] font-black tracking-[0.6em] text-slate-400 uppercase">
                                        {activeTag ? `#${activeTag} 태그의 게시글이 없습니다` : 'Archive contains no articles'}
                                    </p>
                                    {activeTag && (
                                        <button onClick={() => setActiveTag('')}
                                            className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest underline hover:text-slate-900 transition-all">
                                            태그 필터 제거
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </section>
                </div>
            )}

            {/* ── 페이지네이션 ── */}
            <AnimatePresence>
                {totalPages > 1 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="flex flex-col sm:flex-row items-center justify-between border-t-[3px] border-slate-900 pt-12 mt-20 gap-6">
                        <div className="flex items-center gap-4 text-[11px] font-black tracking-[0.3em] uppercase">
                            <span className="text-slate-900">Page {page} / {totalPages}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                                className="w-12 h-12 rounded-full border-2 border-slate-100 flex items-center justify-center text-slate-300 hover:border-slate-900 hover:text-slate-900 disabled:opacity-20 transition-all group active:scale-95">
                                <ChevronRight size={18} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                            </button>
                            <div className="flex gap-1.5">
                                {[...Array(totalPages)].map((_, i) => {
                                    const p = i + 1;
                                    if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
                                        return (
                                            <button key={p} onClick={() => setPage(p)}
                                                className={`w-12 h-12 rounded-full text-[11px] font-black transition-all ${page === p ? 'bg-slate-900 text-white shadow-xl' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                                                {p < 10 ? `0${p}` : p}
                                            </button>
                                        );
                                    }
                                    if (p === 2 || p === totalPages - 1) return <span key={p} className="w-8 flex items-center justify-center text-slate-200 font-bold">…</span>;
                                    return null;
                                })}
                            </div>
                            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                                className="w-12 h-12 rounded-full border-2 border-slate-100 flex items-center justify-center text-slate-300 hover:border-slate-900 hover:text-slate-900 disabled:opacity-20 transition-all group active:scale-95">
                                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default BoardList;
