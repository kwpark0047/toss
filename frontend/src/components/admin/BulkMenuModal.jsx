import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Plus, Wand2, ArrowRight, Check, AlertCircle, ShoppingBag, Loader2, FileSpreadsheet, Upload } from 'lucide-react';
import { aiAPI, productsAPI, categoriesAPI } from '../../api';
import { formatPrice } from '../../utils/format';
import * as XLSX from 'xlsx';

const BulkMenuModal = ({ storeId, existingCategories, onClose, onSave }) => {
    const [step, setStep] = useState('input'); // input, review, loading
    const [menuText, setMenuText] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dragging, setDragging] = useState(false);

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

                // 첫 번째 열에서 메뉴명 추출 (헤더 제외 고려)
                const menuNames = data
                    .map(row => row[0])
                    .filter(val => val && typeof val === 'string' && val.trim().length > 0)
                    .map(val => val.trim());

                if (menuNames.length > 0) {
                    setMenuText(prev => (prev ? prev + '\n' : '') + menuNames.join('\n'));
                    alert(`${menuNames.length}개의 메뉴를 불러왔습니다.`);
                }
            } catch (err) {
                console.error('파일 파싱 실패:', err);
                alert('파일을 읽는 중 오류가 발생했습니다.');
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleAnalyze = async () => {
        if (!menuText.trim()) return;

        const menuNames = menuText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (menuNames.length === 0) return;

        setStep('loading');
        setLoading(true);
        try {
            const response = await aiAPI.analyzeMenuList({
                menuNames,
                categories: existingCategories
            });
            if (response && response.success) {
                setSuggestions(response.suggestions);
                setStep('review');
            }
        } catch (error) {
            console.error('AI 분석 실패:', error);
            alert('AI 분석 중 오류가 발생했습니다.');
            setStep('input');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. 필요한 카테고리들 먼저 확보 (기존 카테고리에 없으면 생성)
            const uniqueCategoryNames = [...new Set(suggestions.map(s => s.category_name))];
            const categoryMap = {};

            // 기존 카테고리 매핑
            existingCategories.forEach(c => {
                categoryMap[c.name] = c.id;
            });

            // 새로운 카테고리 생성 및 매핑
            for (const catName of uniqueCategoryNames) {
                if (!categoryMap[catName]) {
                    const res = await categoriesAPI.create({ store_id: parseInt(storeId), name: catName });
                    categoryMap[catName] = res.id;
                }
            }

            // 2. 상품 일괄 등록
            const productsToRegister = suggestions.map(s => ({
                name: s.name,
                price: s.price,
                description: s.description,
                image_url: s.image_url || null,
                category_id: categoryMap[s.category_name],
                tags: Array.isArray(s.tags) ? s.tags.join(', ') : (s.tags || ''),
                spicy_level: s.spicy_level || 0,
                options: typeof s.options === 'string' ? s.options : JSON.stringify(s.options || []),
                is_active: 1
            }));

            await productsAPI.bulkCreate({
                store_id: parseInt(storeId),
                products: productsToRegister
            });

            onSave();
        } catch (error) {
            console.error('저장 실패:', error);
            alert('상품 등록 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const updateSuggestion = (index, field, value) => {
        const newSuggestions = [...suggestions];
        newSuggestions[index][field] = value;
        setSuggestions(newSuggestions);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div>
                        <div className="flex items-center gap-3 text-blue-600 mb-1">
                            <Sparkles size={20} />
                            <span className="text-[10px] font-black uppercase tracking-widest">AI Power Engine</span>
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 leading-tight tracking-tight">
                            AI 일괄 <span className="text-blue-600">메뉴 등록</span>
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar focus-within:ring-0">
                    {step === 'input' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                            <div className="bg-blue-50/50 p-8 rounded-[30px] border border-blue-100/50">
                                <h4 className="text-blue-900 font-black mb-2 flex items-center gap-2">
                                    <ShoppingBag size={18} /> 사용 가이드
                                </h4>
                                <ul className="text-blue-700/70 text-sm font-bold space-y-2">
                                    <li>• 메뉴 이름을 한 줄에 하나씩 입력하거나 엑셀 파일을 업로드해 주세요.</li>
                                    <li>• AI가 분석하여 카테고리, 설명, 가격을 자동 생성합니다.</li>
                                    <li>• 가격과 설명은 분석 후 자유롭게 수정 가능합니다.</li>
                                </ul>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="relative group">
                                    <div className="absolute -top-3 left-6 px-3 py-1 bg-white border border-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest z-10">Direct Input</div>
                                    <textarea
                                        value={menuText}
                                        onChange={(e) => setMenuText(e.target.value)}
                                        placeholder="예:&#10;슈프림 양념치킨&#10;황금올리브 치킨..."
                                        className="w-full h-80 p-8 rounded-[30px] border-2 border-slate-100 focus:border-blue-500 focus:ring-0 text-lg font-bold placeholder:text-slate-300 transition-all resize-none shadow-sm"
                                    />
                                    <div className="absolute bottom-6 right-8 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                        {menuText.split('\n').filter(l => l.trim()).length} Items detected
                                    </div>
                                </div>

                                <div
                                    className={`relative rounded-[30px] border-2 border-dashed flex flex-col items-center justify-center p-10 transition-all ${dragging ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 bg-slate-50/30'
                                        }`}
                                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                    onDragLeave={() => setDragging(false)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setDragging(false);
                                        const file = e.dataTransfer.files?.[0];
                                        if (file) handleFileUpload({ target: { files: [file] } });
                                    }}
                                >
                                    <div className="absolute -top-3 left-6 px-3 py-1 bg-white border border-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest z-10">File Upload</div>
                                    <div className="w-20 h-20 bg-white rounded-[24px] shadow-sm flex items-center justify-center text-slate-400 mb-6 group-hover:scale-110 transition-transform">
                                        <FileSpreadsheet size={32} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-slate-900 font-black mb-1">엑셀 또는 CSV 업로드</p>
                                        <p className="text-slate-400 text-xs font-bold leading-relaxed">
                                            파일을 이곳에 끌어다 놓거나<br />아래 버튼을 클릭하세요
                                        </p>
                                    </div>
                                    <label className="mt-8 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 cursor-pointer transition-all shadow-sm">
                                        파일 선택
                                        <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
                                    </label>
                                    <div className="mt-4 flex items-center gap-1.5 text-slate-300 text-[9px] font-bold uppercase tracking-widest">
                                        <Check size={10} /> Supports .xlsx, .csv
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleAnalyze}
                                disabled={!menuText.trim() || loading}
                                className="w-full py-6 bg-slate-900 text-white rounded-[24px] font-black text-lg flex items-center justify-center gap-4 hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98] disabled:opacity-50"
                            >
                                <Wand2 size={24} /> AI가 분석하기
                            </button>
                        </motion.div>
                    )}

                    {step === 'loading' && (
                        <div className="h-96 flex flex-col items-center justify-center space-y-8">
                            <div className="relative">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="w-24 h-24 border-4 border-blue-100 border-t-blue-600 rounded-full"
                                />
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    className="absolute inset-0 flex items-center justify-center text-blue-600"
                                >
                                    <Sparkles size={32} />
                                </motion.div>
                            </div>
                            <div className="text-center">
                                <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">AI가 메뉴를 분석 중입니다</h3>
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Generating categories, descriptions, and prices...</p>
                            </div>
                        </div>
                    )}

                    {step === 'review' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                    <Check className="text-emerald-500" size={24} />
                                    분석 결과 확인
                                </h3>
                                <button onClick={() => setStep('input')} className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors">
                                    다시 작성하기
                                </button>
                            </div>

                            <div className="space-y-4">
                                {suggestions.map((item, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="p-6 bg-slate-50 rounded-[24px] border border-slate-200/50 group hover:bg-white hover:shadow-lg transition-all"
                                    >
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                                            {/* 이미지 추천 영역 */}
                                            <div className="md:col-span-2">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Suggested Image</div>
                                                <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-200 group-hover:shadow-md transition-all">
                                                    <img
                                                        src={`https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=200&auto=format&fit=crop&sig=${encodeURIComponent(item.image_keyword)}`}
                                                        alt={item.name}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=200'; // Fallback
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            const newUrl = `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop&sig=${encodeURIComponent(item.image_keyword)}`;
                                                            updateSuggestion(idx, 'image_url', newUrl);
                                                            alert('이미지가 선택되었습니다.');
                                                        }}
                                                        className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                                    >
                                                        <Plus className="text-white" size={24} />
                                                    </button>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={item.image_keyword}
                                                    onChange={(e) => updateSuggestion(idx, 'image_keyword', e.target.value)}
                                                    className="w-full mt-2 bg-white px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-500 focus:ring-1 focus:ring-blue-500"
                                                    placeholder="Search keyword..."
                                                />
                                            </div>

                                            <div className="md:col-span-3">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Menu Name</div>
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => updateSuggestion(idx, 'name', e.target.value)}
                                                    className="w-full bg-transparent border-none p-0 text-lg font-black text-slate-900 focus:ring-0 truncate"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Category</div>
                                                <input
                                                    type="text"
                                                    value={item.category_name}
                                                    onChange={(e) => updateSuggestion(idx, 'category_name', e.target.value)}
                                                    className="w-full bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Price & Extra</div>
                                                <div className="space-y-2">
                                                    <input
                                                        type="number"
                                                        value={item.price}
                                                        onChange={(e) => updateSuggestion(idx, 'price', parseInt(e.target.value) || 0)}
                                                        className="w-full bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-black text-orange-600 focus:ring-2 focus:ring-orange-500/20 text-right"
                                                    />
                                                    <div className="flex flex-wrap gap-1">
                                                        {item.tags?.map((t, i) => (
                                                            <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-500 text-[8px] font-black rounded-md uppercase">{t}</span>
                                                        ))}
                                                        {item.spicy_level > 0 && (
                                                            <span className="px-1.5 py-0.5 bg-red-50 text-red-500 text-[8px] font-black rounded-md">🌶️ L{item.spicy_level}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="md:col-span-3">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">AI Description & Options</div>
                                                <div className="space-y-2">
                                                    <textarea
                                                        value={item.description}
                                                        onChange={(e) => updateSuggestion(idx, 'description', e.target.value)}
                                                        rows={1}
                                                        className="w-full bg-transparent border-none p-0 text-xs font-bold text-slate-500 focus:ring-0 resize-none leading-relaxed"
                                                    />
                                                    {item.options?.length > 0 && (
                                                        <div className="p-2 bg-white rounded-xl border border-dashed border-slate-200">
                                                            <div className="text-[7px] font-black text-slate-300 uppercase mb-1">Recommended Options</div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {item.options.map((opt, i) => (
                                                                    <div key={i} className="text-[9px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md">
                                                                        {opt.name}: {opt.values?.join('/')}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Footer Footer */}
                {step === 'review' && (
                    <div className="p-10 border-t border-slate-100 bg-white sticky bottom-0 flex justify-end gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
                        <button
                            onClick={onClose}
                            className="px-8 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-[0.98]"
                        >
                            취소
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98]"
                        >
                            {saving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                            {saving ? '등록하는 중...' : `${suggestions.length}개 메뉴 등록 완료`}
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default BulkMenuModal;
