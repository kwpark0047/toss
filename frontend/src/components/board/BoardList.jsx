import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { boardAPI } from '../../api';
import {
    Search, Megaphone, MessageSquare, HelpCircle,
    Pin, Clock, Eye, ChevronRight, Plus
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';

// ==============================================================
// BoardList - 매거진 스타일 리포맷
// 단순 리스트에서 편집 디자인 기반의 그리드 레이아웃으로 변경
// ==============================================================

const BOARD_TYPES = [
    { key: 'notice', label: '공지사항 (NOTICE)', icon: Megaphone, text: 'text-rose-600', bg: 'bg-rose-50' },
    { key: 'free', label: '자유게시판 (COMMUNITY)', icon: MessageSquare, text: 'text-indigo-600', bg: 'bg-indigo-50' },
    { key: 'qna', label: '질문/답변 (Q&A)', icon: HelpCircle, text: 'text-emerald-600', bg: 'bg-emerald-50' },
    { key: 'faq', label: '도움말/FAQ (FAQ)', icon: HelpCircle, text: 'text-slate-600', bg: 'bg-slate-50' },
];

const BoardList = () => {
    const { user } = useAuth();
    const { type: urlType } = useParams();
    const navigate = useNavigate();
    const [boardType, setBoardType] = useState(urlType || 'notice');
    const [posts, setPosts] = useState([]);
    const [pinnedPosts, setPinnedPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [searchType, setSearchType] = useState('title');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // 데이터 로드
    useEffect(() => {
        const fetchPosts = async () => {
            setLoading(true);
            try {
                const res = await boardAPI.getPosts(boardType, {
                    page,
                    search: search.trim(),
                    searchType,
                    limit: 12
                });

                // API 응답 구조에 맞게 데이터 추출
                const data = res.data?.data || res.data;
                const allPosts = data.posts || [];
                const total = data.totalPages || 1;

                // 고정글과 일반글 분리
                setPinnedPosts(allPosts.filter(p => p.is_pinned));
                setPosts(allPosts.filter(p => !p.is_pinned));
                setTotalPages(total);
            } catch (error) {
                console.error('Failed to fetch posts:', error);
            } finally {
                setLoading(false);
            }
        };

        // 검색 입력 시 디바운스 효과 (약간의 지연 후 요청)
        const timeoutId = setTimeout(fetchPosts, 300);
        return () => clearTimeout(timeoutId);
    }, [boardType, page, search, searchType]);

    const handleTypeChange = (newType) => {
        setBoardType(newType);
        setPage(1);
        setSearch(''); // 카테고리 변경 시 검색 초기화
        navigate(`/board/${newType}`);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-16 pb-32 font-sans text-slate-900 px-6 sm:px-8">
            {/* Editorial Header */}
            <header className="border-b-[6px] border-slate-900 pb-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <span className="h-0.5 w-10 bg-slate-200"></span>
                        <div className="text-[11px] font-black tracking-[0.4em] text-slate-400 uppercase">
                            Volume 2026 / Archive / {boardType}
                        </div>
                    </div>
                    <h1 className="text-7xl md:text-9xl font-serif font-black italic tracking-tighter leading-none select-none">
                        {BOARD_TYPES.find(t => t.key === boardType)?.label}
                    </h1>
                </div>
                <div className="flex flex-col items-start md:items-end">
                    <button
                        onClick={() => {
                            if (!user) {
                                toast.info('로그인이 필요한 서비스입니다. 로그인 페이지로 이동합니다.');
                                navigate('/login');
                                return;
                            }
                            navigate(`/board/write?type=${boardType}`);
                        }}
                        className="group relative flex items-center gap-3 px-10 py-5 bg-slate-900 text-white rounded-full font-bold text-sm overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-xl shadow-slate-900/10"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <Plus size={18} className="relative z-10" />
                        <span className="relative z-10">WRITE ARTICLE</span>
                    </button>
                    <div className="text-[10px] font-black text-slate-300 mt-6 tabular-nums tracking-[0.3em] uppercase">
                        {new Intl.DateTimeFormat('ko-KR', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date())}
                    </div>
                </div>
            </header>

            {/* Navigation Index */}
            <nav className="flex flex-wrap items-center gap-4 py-8 border-b border-slate-100">
                <div className="flex flex-wrap gap-2">
                    {BOARD_TYPES.map((type) => (
                        <button
                            key={type.key}
                            onClick={() => handleTypeChange(type.key)}
                            className={`px-8 py-3 rounded-xl text-[10px] font-black tracking-[0.2em] transition-all uppercase border-2 ${boardType === type.key
                                ? 'bg-slate-900 border-slate-900 text-white shadow-lg'
                                : 'bg-white border-slate-50 text-slate-400 hover:border-slate-200 hover:text-slate-600'
                                }`}
                        >
                            {type.label}
                        </button>
                    ))}
                </div>

                {/* Advanced Search Bar */}
                <div className="ml-auto w-full md:w-auto flex items-center gap-4 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 group transition-all focus-within:bg-white focus-within:border-slate-900 focus-within:shadow-2xl">
                    <select
                        value={searchType}
                        onChange={(e) => setSearchType(e.target.value)}
                        className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate-500 focus:ring-0 cursor-pointer"
                    >
                        <option value="title">Title</option>
                        <option value="content">Content</option>
                        <option value="author">Author</option>
                    </select>
                    <div className="w-[1px] h-4 bg-slate-200"></div>
                    <Search size={14} className="text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search keywords..."
                        className="bg-transparent border-none focus:ring-0 text-[10px] font-black tracking-widest placeholder:text-slate-300 w-full md:w-64 uppercase outline-none"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </nav>

            {/* [프리미엄 스켈레톤 UI] */}
            {loading ? (
                <div className="space-y-24 animate-pulse">
                    {/* Featured Skeleton */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {[1, 2].map(i => (
                            <div key={i} className="h-[400px] bg-slate-50 rounded-[3rem] border border-slate-100 p-12 space-y-8">
                                <div className="w-20 h-8 bg-slate-200 rounded-lg" />
                                <div className="space-y-4">
                                    <div className="w-full h-16 bg-slate-200 rounded-2xl" />
                                    <div className="w-3/4 h-16 bg-slate-200 rounded-2xl" />
                                </div>
                                <div className="pt-8 border-t border-slate-100 flex gap-4">
                                    <div className="w-12 h-12 rounded-full bg-slate-200" />
                                    <div className="space-y-2 py-1">
                                        <div className="w-24 h-4 bg-slate-200 rounded" />
                                        <div className="w-16 h-3 bg-slate-100 rounded" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Grid Skeleton */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-24">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="space-y-8">
                                <div className="aspect-[3/4] bg-slate-50 rounded-[3.5rem] border border-slate-100" />
                                <div className="space-y-4 px-4">
                                    <div className="w-full h-8 bg-slate-100 rounded-xl" />
                                    <div className="pt-6 border-t border-slate-50 flex justify-between">
                                        <div className="flex gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100" />
                                            <div className="w-20 h-4 bg-slate-100 rounded mt-2" />
                                        </div>
                                        <div className="w-12 h-4 bg-slate-50 rounded mt-2" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-32">
                    {/* Featured Section (Pinned Posts) */}
                    {pinnedPosts.length > 0 && (
                        <section className="space-y-10">
                            <div className="flex items-center gap-6">
                                <span className="h-[4px] w-16 bg-rose-600 rounded-full"></span>
                                <h2 className="text-[12px] font-black tracking-[0.4em] text-rose-600 uppercase italic">Featured Story</h2>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                {pinnedPosts.slice(0, 2).map((post, idx) => (
                                    <motion.div
                                        key={post.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        whileHover={{ y: -8 }}
                                    >
                                        <Link
                                            to={`/board/posts/${post.id}`}
                                            className={`group relative flex flex-col gap-10 overflow-hidden rounded-[3rem] p-12 border-2 transition-all hover:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] ${idx === 0 ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 text-slate-900'
                                                }`}
                                        >
                                            <div className={`absolute top-12 right-12 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transform group-hover:rotate-12 transition-transform ${idx === 0 ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'}`}>
                                                <Pin size={24} />
                                            </div>
                                            <div className="space-y-8">
                                                <div className={`inline-block px-5 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase ${idx === 0 ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white'}`}>
                                                    HEADLINE STORY
                                                </div>
                                                <h3 className="text-5xl md:text-6xl font-serif font-black leading-[1.05] group-hover:italic transition-all line-clamp-3 tracking-tighter">
                                                    {post.title}
                                                </h3>
                                                <div className={`flex items-center gap-6 pt-6 border-t ${idx === 0 ? 'border-slate-800' : 'border-slate-50'}`}>
                                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-sm ${idx === 0 ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-900'}`}>
                                                        {post.author_name?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className={`text-[11px] font-black tracking-widest uppercase ${idx === 0 ? 'text-white' : 'text-slate-900'}`}>{post.author_name}</p>
                                                        <p className={`text-[10px] font-bold mt-1 uppercase ${idx === 0 ? 'text-slate-500' : 'text-slate-300'}`}>
                                                            {new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(post.created_at))}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Main Grid */}
                    <section className="space-y-12">
                        <div className="flex items-center justify-between border-b-[3px] border-slate-900 pb-6">
                            <div className="flex items-center gap-4">
                                <span className="h-[4px] w-12 bg-slate-900"></span>
                                <h2 className="text-[12px] font-black tracking-[0.4em] uppercase">Archive / Latest</h2>
                            </div>
                            <div className="text-[10px] font-black text-slate-400 tabular-nums uppercase tracking-widest">
                                Index {posts.length} Items Found
                            </div>
                        </div>

                        {posts.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-32">
                                {posts.map((post, idx) => (
                                    <motion.div
                                        key={post.id}
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                    >
                                        <Link
                                            to={`/board/posts/${post.id}`}
                                            className={`group flex flex-col space-y-8 ${idx % 3 === 1 ? 'lg:mt-16' : ''}`}
                                        >
                                            {/* ... 이하 기존 Link 내부 코드 동일 유지하되 motion 효과만 외부 래핑 ... */}
                                            <div className="aspect-[3/4] bg-slate-50 rounded-[3.5rem] overflow-hidden border border-slate-100 transition-all duration-500 group-hover:shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] group-hover:border-slate-900 p-16 flex flex-col items-center justify-center relative">
                                                <div className="absolute inset-x-16 top-16 border-t-2 border-slate-200 group-hover:border-slate-900 transition-colors duration-500"></div>
                                                <div className="text-[140px] font-serif font-black text-slate-200/40 select-none group-hover:scale-110 group-hover:text-slate-900/5 transition-all duration-700 italic leading-none">
                                                    {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                                                </div>
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                                    <div className="px-8 py-3 bg-white border-2 border-slate-900 rounded-full text-[10px] font-black tracking-[0.3em] uppercase">
                                                        READ FULL
                                                    </div>
                                                </div>
                                                <div className="absolute bottom-12 left-12 flex flex-col gap-1">
                                                    <span className="text-[9px] font-black text-slate-300 tracking-widest uppercase italic">Archive No.</span>
                                                    <span className="text-[11px] font-black text-slate-900 tabular-nums uppercase">WM-0{post.id}</span>
                                                </div>
                                                <div className="absolute bottom-12 right-12 flex flex-col items-end gap-1">
                                                    <Eye size={18} className="text-slate-200 group-hover:text-indigo-600 transition-colors" />
                                                    <span className="text-[11px] font-black text-slate-400 group-hover:text-slate-900 transition-colors">{post.view_count}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-6 px-4">
                                                <h3 className="text-3xl font-serif font-black leading-tight group-hover:underline underline-offset-12 decoration-4 decoration-rose-500 transition-all">
                                                    {post.title}
                                                </h3>
                                                <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">
                                                            {post.author_name?.charAt(0)}
                                                        </div>
                                                        <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{post.author_name}</span>
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-300 tracking-[0.2em]">
                                                        {new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }).format(new Date(post.created_at)).replace(/\//g, '.')}
                                                    </span>
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="py-64 text-center space-y-12"
                            >
                                <div className="text-[16rem] font-serif italic font-black text-slate-50 leading-none select-none">EMPTY</div>
                                <div className="space-y-4">
                                    <p className="text-[12px] font-black tracking-[0.6em] text-slate-400 uppercase">Archive contains no articles</p>
                                    <p className="text-[10px] font-bold text-slate-200 uppercase tracking-widest underline cursor-pointer hover:text-slate-900 transition-all" onClick={() => handleTypeChange('free')}>Browse other sections</p>
                                </div>
                            </motion.div>
                        )}
                    </section>
                </div>
            )}

            {/* Pagination - Professional Editorial Style */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between border-t-[3px] border-slate-900 pt-16 mt-32 gap-8">
                    <div className="flex items-center gap-6">
                        <div className="text-[11px] font-black tracking-[0.3em] text-slate-900 uppercase">Section Archive</div>
                        <div className="h-1 w-12 bg-slate-100"></div>
                        <div className="text-[11px] font-black tracking-[0.3em] text-slate-400 uppercase">Page {page} / {totalPages}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="w-14 h-14 rounded-full border-2 border-slate-50 flex items-center justify-center text-slate-300 hover:border-slate-900 hover:text-slate-900 disabled:opacity-20 transition-all group active:scale-95"
                        >
                            <ChevronRight size={20} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <div className="flex gap-2">
                            {[...Array(totalPages)].map((_, i) => {
                                const p = i + 1;
                                if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => setPage(p)}
                                            className={`w-14 h-14 rounded-full text-[11px] font-black transition-all ${page === p ? 'bg-slate-900 text-white shadow-xl' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                        >
                                            {p < 10 ? `0${p}` : p}
                                        </button>
                                    );
                                }
                                if (p === 2 || p === totalPages - 1) return <span key={p} className="w-8 flex items-center justify-center text-slate-200 font-bold">...</span>;
                                return null;
                            })}
                        </div>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="w-14 h-14 rounded-full border-2 border-slate-50 flex items-center justify-center text-slate-300 hover:border-slate-900 hover:text-slate-900 disabled:opacity-20 transition-all group active:scale-95"
                        >
                            <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BoardList;
