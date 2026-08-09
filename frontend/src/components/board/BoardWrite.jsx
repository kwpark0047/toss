import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { boardAPI } from '../../api';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Send, Pin, Save, X, Tag, Plus,
    FileText, AlignLeft, Layers
} from 'lucide-react';
import { toast } from 'react-toastify';

const BOARD_TYPES = [
    { key: 'free',   label: '자유게시판', restricted: false },
    { key: 'qna',    label: '질문/답변', restricted: false },
    { key: 'notice', label: '공지사항',  restricted: true },
    { key: 'faq',    label: '도움말/FAQ', restricted: true },
];

const DRAFT_KEY = (type) => `board_draft_${type}`;

const BoardWrite = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialType = searchParams.get('type') || 'free';
    const editId = searchParams.get('edit');

    const isAdmin = user && ['super_admin', 'store_admin'].includes(user.role);

    const [boardType, setBoardType] = useState(initialType);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isPinned, setIsPinned] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [hasDraft, setHasDraft] = useState(false);
    const [wordCount, setWordCount] = useState(0);
    const tagInputRef = useRef(null);

    // 기존 게시글 로드 (수정 모드)
    useEffect(() => {
        if (!editId) return;
        boardAPI.getPost(editId).then(res => {
            const p = res.data?.data || res.data;
            setTitle(p.title || '');
            setContent(p.content || '');
            setBoardType(p.board_type || initialType);
            setIsPinned(p.is_pinned || false);
            if (p.tags) setTags(p.tags.split(',').filter(Boolean));
        }).catch(() => toast.error('게시글을 불러올 수 없습니다.'));
    }, [editId, initialType]);

    // localStorage 임시저장 복원
    useEffect(() => {
        if (editId) return;
        const saved = localStorage.getItem(DRAFT_KEY(boardType));
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.title || parsed.content) setHasDraft(true);
            } catch {}
        }
    }, [boardType, editId]);

    // 자동 임시저장 (2초 디바운스)
    useEffect(() => {
        if (editId || (!title && !content)) return;
        const t = setTimeout(() => {
            localStorage.setItem(DRAFT_KEY(boardType), JSON.stringify({ title, content, tags }));
        }, 2000);
        return () => clearTimeout(t);
    }, [title, content, tags, boardType, editId]);

    // 글자수 카운트
    useEffect(() => {
        setWordCount(content.replace(/\s/g, '').length);
    }, [content]);

    const restoreDraft = () => {
        const saved = localStorage.getItem(DRAFT_KEY(boardType));
        if (!saved) return;
        try {
            const parsed = JSON.parse(saved);
            setTitle(parsed.title || '');
            setContent(parsed.content || '');
            setTags(parsed.tags || []);
            setHasDraft(false);
            toast.success('임시저장 내용을 불러왔습니다.');
        } catch {}
    };

    const clearDraft = () => {
        localStorage.removeItem(DRAFT_KEY(boardType));
        setHasDraft(false);
    };

    const addTag = (raw) => {
        const normalized = raw.replace(/^#/, '').trim().toLowerCase();
        if (!normalized || tags.includes(normalized) || tags.length >= 5) return;
        setTags(prev => [...prev, normalized]);
        setTagInput('');
    };

    const removeTag = (tag) => setTags(prev => prev.filter(t => t !== tag));

    const handleTagKeyDown = (e) => {
        if (['Enter', ',', ' '].includes(e.key)) {
            e.preventDefault();
            if (tagInput.trim()) addTag(tagInput);
        }
        if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
            setTags(prev => prev.slice(0, -1));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) { toast.error('제목을 입력해주세요.'); return; }
        if (!content.trim()) { toast.error('내용을 입력해주세요.'); return; }

        setSubmitting(true);
        const payload = {
            title: title.trim(),
            content: content.trim(),
            is_pinned: isPinned,
            tags: tags.join(','),
        };

        try {
            let res;
            if (editId) {
                res = await boardAPI.updatePost(editId, payload);
            } else {
                res = await boardAPI.createPost(boardType, payload);
            }

            localStorage.removeItem(DRAFT_KEY(boardType));
            toast.success(editId ? '수정되었습니다.' : '등록되었습니다.');

            const postId = editId || (res.data?.data?.id || res.data?.id);
            navigate(postId ? `/board/posts/${postId}` : `/board/${boardType}`);
        } catch (err) {
            toast.error(err.response?.data?.error || '등록에 실패했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    const availableTypes = BOARD_TYPES.filter(t => !t.restricted || isAdmin);

    return (
        <div className="min-h-screen">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-40">

                {/* ── 헤더 ── */}
                <div className="flex items-center justify-between py-8 border-b border-white/10">
                    <button onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-[0.3em] transition-colors group">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                        Back
                    </button>
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <FileText size={12} />
                        {editId ? 'Edit Article' : 'New Article'}
                    </div>
                </div>

                {/* 임시저장 복원 배너 */}
                <AnimatePresence>
                    {hasDraft && !editId && (
                        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                            className="flex items-center justify-between mt-6 px-6 py-4 bg-amber-50 border border-amber-200 rounded-2xl">
                            <div className="flex items-center gap-3 text-[11px] font-black text-amber-700">
                                <Save size={14} />
                                저장된 임시 원고가 있습니다
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={restoreDraft}
                                    className="px-4 py-2 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all">
                                    불러오기
                                </button>
                                <button onClick={clearDraft}
                                    className="px-4 py-2 bg-amber-100 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-200 transition-all">
                                    무시
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="pt-12 space-y-10">

                    {/* ── 게시판 타입 선택 ── */}
                    {!editId && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                                <Layers size={12} /> Section
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {availableTypes.map(type => (
                                    <button key={type.key} type="button" onClick={() => setBoardType(type.key)}
                                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${boardType === type.key
                                            ? 'bg-white/10 border-white/20 text-white'
                                            : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/30'
                                        }`}>
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── 제목 ── */}
                    <div className="space-y-4 border-b-[6px] border-white/20 pb-8">
                        <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                            <FileText size={12} /> Headline
                        </div>
                        <textarea
                            rows={3}
                            maxLength={200}
                            placeholder="Write your headline..."
                            className="w-full text-5xl md:text-7xl font-serif font-black italic tracking-tighter leading-[1.05] placeholder:text-slate-100 border-none outline-none resize-none bg-transparent text-white transition-all"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                        />
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-200 uppercase tracking-widest">Headline</span>
                            <span className={`text-[10px] font-black tabular-nums ${title.length > 180 ? 'text-rose-500' : 'text-slate-500'}`}>
                                {title.length} / 200
                            </span>
                        </div>
                    </div>

                    {/* ── 본문 ── */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                            <AlignLeft size={12} /> Body Copy
                        </div>
                        <textarea
                            rows={20}
                            placeholder="Write your article here..."
                            className="w-full text-[15px] font-serif leading-[2] text-slate-500 placeholder:text-slate-200 border-none outline-none resize-none bg-transparent transition-all"
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            required
                        />
                        <div className="flex justify-between items-center pt-2 border-t border-white/10">
                            <span className="text-[10px] font-bold text-slate-200 uppercase tracking-widest">Article Body</span>
                            <span className="text-[10px] font-black tabular-nums text-slate-500">
                                {wordCount.toLocaleString()} characters
                            </span>
                        </div>
                    </div>

                    {/* ── 태그 입력 ── */}
                    <div className="space-y-4 p-6 bg-white/5 rounded-3xl border border-white/10">
                        <div className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                            <Tag size={12} /> Tags
                            <span className="text-slate-500 font-bold normal-case tracking-normal ml-1">최대 5개</span>
                        </div>
                        <div className="flex flex-wrap gap-2 min-h-[36px] items-center">
                            {tags.map(tag => (
                                <motion.span key={tag} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-slate-600 tracking-widest shadow-sm">
                                    #{tag}
                                    <button type="button" onClick={() => removeTag(tag)}
                                        className="text-slate-500 hover:text-rose-500 transition-colors">
                                        <X size={10} />
                                    </button>
                                </motion.span>
                            ))}
                            {tags.length < 5 && (
                                <div className="flex items-center gap-2">
                                    <input
                                        ref={tagInputRef}
                                        type="text"
                                        value={tagInput}
                                        onChange={e => setTagInput(e.target.value)}
                                        onKeyDown={handleTagKeyDown}
                                        onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                                        placeholder={tags.length === 0 ? "#태그 입력 후 Enter" : "#추가..."}
                                        className="bg-transparent border-none outline-none text-[10px] font-black text-slate-600 placeholder:text-slate-500 tracking-widest w-40"
                                    />
                                    {tagInput && (
                                        <button type="button" onClick={() => addTag(tagInput)}
                                            className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-400 transition-all">
                                            <Plus size={10} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── 옵션 (관리자) ── */}
                    {isAdmin && (
                        <div className="flex items-center gap-4 p-5 bg-rose-50 rounded-2xl border border-rose-100">
                            <button type="button" onClick={() => setIsPinned(p => !p)}
                                className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${isPinned
                                    ? 'bg-rose-600 border-rose-600 text-white'
                                    : 'bg-white/5 border-rose-200 text-rose-400 hover:border-rose-400'
                                }`}>
                                <Pin size={12} />
                                {isPinned ? 'Pinned (Headline)' : 'Pin as Headline'}
                            </button>
                            <span className="text-[10px] font-bold text-rose-400">상단에 고정 노출됩니다</span>
                        </div>
                    )}

                    {/* ── 제출 버튼 ── */}
                    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-white/10 px-6 py-5">
                        <div className="max-w-4xl mx-auto flex items-center justify-between">
                            <div className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                <Save size={12} className="text-green-400" />
                                자동 임시저장 중
                            </div>
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={() => navigate(-1)}
                                    className="px-8 py-4 rounded-2xl border-2 border-white/10 text-slate-400 text-[11px] font-black uppercase tracking-widest hover:border-white/30 transition-all">
                                    Cancel
                                </button>
                                <motion.button
                                    type="submit"
                                    disabled={submitting || !title.trim() || !content.trim()}
                                    whileTap={{ scale: 0.96 }}
                                    className="flex items-center gap-3 px-10 py-4 bg-white/10 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-orange-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-xl shadow-slate-900/10">
                                    {submitting ? (
                                        <span className="flex items-center gap-2">
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Publishing...
                                        </span>
                                    ) : (
                                        <>
                                            <Send size={14} />
                                            {editId ? 'Update Article' : 'Publish Article'}
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BoardWrite;
