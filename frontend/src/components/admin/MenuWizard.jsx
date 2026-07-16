import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, ArrowLeft, Check, Wand2, Tag, Image as ImageIcon, ListPlus, X, AlertCircle, Trash2 } from 'lucide-react';
import { aiAPI, productsAPI } from '../../api';

const MenuWizard = ({ storeId, categories, onClose, onSave }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // 폼 상태
    const [form, setForm] = useState({
        name: '',
        category_id: categories[0]?.id || '',
        price: '',
        description: '',
        tags: [],
        options: [],
        spicy_level: 0,
        image_url: '',
        image_keyword: ''
    });

    const nextStep = () => setStep(prev => Math.min(prev + 1, 4));
    const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

    // STEP 1: AI 분석 호출
    const handleAnalyzeMenu = async () => {
        if (!form.name) {
            setError('메뉴 이름을 입력해 주세요.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const selectedCat = categories.find(c => c.id === parseInt(form.category_id));
            const response = await aiAPI.proposeMenuFull({
                name: form.name,
                categoryName: selectedCat?.name
            });

            if (response && response.proposal) {
                const p = response.proposal;
                setForm(prev => ({
                    ...prev,
                    description: p.description || prev.description,
                    price: p.price || prev.price,
                    tags: p.tags || [],
                    options: p.options || [],
                    spicy_level: p.spicy_level || 0,
                    image_keyword: p.image_keyword || prev.name
                }));
                setStep(2);
            }
        } catch {
            setError('AI 분석에 실패했습니다. 수동으로 입력해 주세요.');
            setStep(2); // 오류가 나더라도 다음 단계로 이동해서 수동 입력 가능하게
        } finally {
            setLoading(false);
        }
    };

    const _activeTabClass = "bg-blue-600 text-white shadow-lg shadow-blue-500/30";
    const _inactiveTabClass = "bg-slate-50 text-slate-400 group-hover:bg-slate-100";

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
                {/* 헤더 */}
                <div className="p-8 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                            <Sparkles size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 leading-none">AI 메뉴 마법사</h2>
                            <p className="text-sm text-slate-400 font-bold mt-2">이름만 알려주시면 나머지는 AI가 도와드릴게요.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 bg-white rounded-xl border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* 진행률 바 */}
                <div className="px-12 py-6 bg-white border-b border-slate-50 flex items-center justify-between relative">
                    {[1, 2, 3, 4].map((num) => (
                        <div key={num} className="flex flex-col items-center gap-2 z-10">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all ${step >= num ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-300'}`}>
                                {step > num ? <Check size={14} /> : num}
                            </div>
                        </div>
                    ))}
                    <div className="absolute left-16 right-16 top-[40px] h-0.5 bg-slate-100 -z-0">
                        <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${((step - 1) / 3) * 100}%` }} />
                    </div>
                </div>

                {/* 콘텐츠 영역 */}
                <div className="flex-1 overflow-y-auto p-10">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div className="space-y-4">
                                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                        <Wand2 className="text-blue-500" size={20} /> 무엇을 만들어볼까요?
                                    </h3>
                                    <div className="grid grid-cols-1 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-black text-slate-500 ml-2">메뉴 이름</label>
                                            <input
                                                type="text"
                                                value={form.name}
                                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                                placeholder="예: 트러플 머쉬룸 리조또"
                                                className="w-full h-16 px-6 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-[1.5rem] outline-none transition-all font-bold text-lg"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-black text-slate-500 ml-2">카테고리</label>
                                            <select
                                                value={form.category_id}
                                                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                                                className="w-full h-16 px-6 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-[1.5rem] outline-none transition-all font-bold appearance-none"
                                            >
                                                {categories.map(cat => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                {error && (
                                    <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl flex items-center gap-3 text-sm font-bold border border-rose-100">
                                        <AlertCircle size={18} /> {error}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div className="space-y-6">
                                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                        <Tag className="text-blue-500" size={20} /> 기본 정보를 확인해 주세요.
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-black text-slate-500 ml-2">가격 추천</label>
                                            <div className="relative">
                                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg select-none">₩</span>
                                                <input
                                                    type="number"
                                                    value={form.price}
                                                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                                                    placeholder="0"
                                                    className="w-full h-16 pl-12 pr-16 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-[1.5rem] outline-none transition-all font-black text-xl text-blue-600"
                                                />
                                                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm select-none">원</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-black text-slate-500 ml-2">상품 설명</label>
                                            <textarea
                                                value={form.description}
                                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                                rows={3}
                                                className="w-full p-6 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-[1.5rem] outline-none transition-all font-bold resize-none leading-relaxed"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-black text-slate-500 ml-2">추천 태그</label>
                                            <div className="flex flex-wrap gap-2">
                                                {form.tags.map((tag, i) => (
                                                    <span key={i} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-black flex items-center gap-2">
                                                        #{tag} <X size={14} className="cursor-pointer" onClick={() => setForm(prev => ({ ...prev, tags: prev.tags.filter((_, idx) => idx !== i) }))} />
                                                    </span>
                                                ))}
                                                <button className="px-4 py-2 border-2 border-dashed border-slate-200 text-slate-400 rounded-xl text-xs font-black hover:bg-slate-50 transition-all">
                                                    + 직접 추가
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div className="space-y-6">
                                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                        <ListPlus className="text-blue-500" size={20} /> 고객을 위한 옵션을 추가할까요?
                                    </h3>
                                    <div className="space-y-4">
                                        {form.options.length === 0 ? (
                                            <div className="p-10 border-2 border-dashed border-slate-100 rounded-[2rem] text-center">
                                                <p className="text-slate-400 font-black text-sm mb-4">AI가 제안한 옵션이 없습니다.</p>
                                                <button className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs">옵션 직접 추가하기</button>
                                            </div>
                                        ) : (
                                            form.options.map((opt, i) => (
                                                <div key={i} className="p-6 bg-slate-50 rounded-[1.5rem] flex items-center justify-between group">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-black text-slate-900">{opt.name}</span>
                                                            <span className="px-2 py-0.5 bg-slate-200 text-slate-500 rounded text-[9px] font-black uppercase">{opt.type}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-400 font-bold">{opt.values.join(', ')}</p>
                                                    </div>
                                                    <button className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 4 && (
                            <motion.div
                                key="step4"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div className="space-y-6">
                                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                        <ImageIcon className="text-blue-500" size={20} /> 마지막 단계: 이미지 준비
                                    </h3>
                                    <div className="p-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] text-white text-center shadow-xl shadow-blue-500/20">
                                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                            <ImageIcon size={32} />
                                        </div>
                                        <h4 className="font-black text-lg mb-2">이미지 자동 검색 완료</h4>
                                        <p className="text-sm text-white/70 font-medium mb-8 leading-relaxed">
                                            AI가 메뉴명과 어울리는 고품질 무료 이미지를 <br />
                                            검색하기 위한 키워드<b>({form.image_keyword})</b>를 준비했습니다.
                                        </p>
                                        <div className="flex justify-center gap-4">
                                            <button className="px-6 py-3 bg-white text-blue-600 rounded-2xl font-black text-xs shadow-lg">Unsplash에서 선택</button>
                                            <button className="px-6 py-3 bg-blue-500/30 text-white rounded-2xl font-black text-xs border border-white/20">나중에 올리기</button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* 푸터 */}
                <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <button
                        onClick={prevStep}
                        disabled={step === 1 || loading}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all ${step === 1 ? 'opacity-0 cursor-default' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
                    >
                        <ArrowLeft size={18} /> 이전
                    </button>

                    {step === 1 ? (
                        <button
                            onClick={handleAnalyzeMenu}
                            disabled={loading}
                            className="flex items-center gap-2 px-10 py-4 bg-blue-600 text-white rounded-[1.5rem] font-black shadow-xl shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {loading ? (
                                <>AI 마법 발동 중... <Sparkles size={20} className="animate-spin" /></>
                            ) : (
                                <>메뉴 분석 시작 <Sparkles size={20} /></>
                            )}
                        </button>
                    ) : step === 4 ? (
                        <button
                            onClick={async () => {
                                setLoading(true);
                                try {
                                    const data = {
                                        ...form,
                                        store_id: parseInt(storeId),
                                        category_id: parseInt(form.category_id),
                                        price: parseInt(form.price) || 0,
                                        tags: Array.isArray(form.tags) ? form.tags.join(', ') : '',
                                        options: Array.isArray(form.options) ? form.options : [],
                                        is_active: 1
                                    };
                                    await productsAPI.create(data);
                                    onSave();
                                } catch {
                                    setError('저장 중 오류가 발생했습니다.');
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            disabled={loading}
                            className="flex items-center gap-2 px-10 py-4 bg-slate-900 text-white rounded-[1.5rem] font-black shadow-xl shadow-slate-900/30 hover:scale-105 active:scale-95 transition-all"
                        >
                            {loading ? '완료 중...' : '메뉴판에 올리기'}
                            <Check size={20} />
                        </button>
                    ) : (
                        <button
                            onClick={nextStep}
                            className="flex items-center gap-2 px-10 py-4 bg-blue-600 text-white rounded-[1.5rem] font-black shadow-xl shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all"
                        >
                            다음 단계 <ArrowRight size={20} />
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default MenuWizard;
