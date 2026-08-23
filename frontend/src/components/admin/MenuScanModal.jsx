import { useState } from 'react';
import { motion} from 'framer-motion';
import { X, Sparkles, Loader2, Check, Upload, AlertCircle, Trash2 } from 'lucide-react';
import { aiAPI, productsAPI, categoriesAPI } from '../../api';
import { toast } from 'react-toastify';

const MenuScanModal = ({ storeId, existingCategories, onClose, onSave }) => {
    const [step, setStep] = useState('upload');
    const [imagePreview, setImagePreview] = useState(null);
    const [base64Image, setBase64Image] = useState('');
    const [mimeType, setMimeType] = useState('image/jpeg');
    const [suggestions, setSuggestions] = useState([]);
    const [saving, setSaving] = useState(false);
    const [dragging, setDragging] = useState(false);

    const handleFile = (file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('이미지 파일만 지원합니다.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            setImagePreview(e.target.result);
            const base64Content = e.target.result.split(',')[1];
            setBase64Image(base64Content);
            setMimeType(file.type);
            setStep('preview');
        };
        reader.readAsDataURL(file);
    };

    const handleFileUpload = (e) => handleFile(e.target.files?.[0]);

    const handleDragOver = (e) => {
        e.preventDefault();
        setDragging(true);
    };

    const handleDragLeave = () => setDragging(false);

    const handleDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        handleFile(e.dataTransfer.files?.[0]);
    };

    const handleAnalyze = async () => {
        if (!base64Image) return;
        setStep('scanning');
        try {
            const response = await aiAPI.scanMenuImage({
                image: base64Image,
                mimeType: mimeType
            });

            if (response && response.success && response.suggestions) {
                setSuggestions(response.suggestions.map(item => ({
                    ...item,
                    checked: true
                })));
                setStep('review');
            } else {
                throw new Error('No suggestions returned');
            }
        } catch (error) {
            console.error(error);
            alert('AI 이미지 분석에 실패했습니다. 사진 선명도를 확인해 주세요.');
            setStep('upload');
        }
    };

    const handleSave = async () => {
        const approvedItems = suggestions.filter(s => s.checked);
        if (approvedItems.length === 0) {
            alert('등록할 메뉴를 최소 한 개 이상 선택해 주세요.');
            return;
        }

        setSaving(true);
        try {
            const uniqueCategoryNames = [...new Set(approvedItems.map(s => s.category_name))];
            const categoryMap = {};
            existingCategories.forEach(c => { categoryMap[c.name] = c.id; });

            for (const catName of uniqueCategoryNames) {
                if (!categoryMap[catName]) {
                    const res = await categoriesAPI.create({ store_id: parseInt(storeId), name: catName });
                    categoryMap[catName] = res.id || res?.data?.id;
                }
            }

            const productsToRegister = approvedItems.map(s => ({
                name: s.name,
                price: s.price,
                description: s.description,
                image_url: s.image_url || null,
                category_id: categoryMap[s.category_name],
                is_active: 1
            }));

            await productsAPI.bulkCreate({ store_id: parseInt(storeId), products: productsToRegister });
            toast.success(`${productsToRegister.length}개 메뉴 등록 완료!`);
            onSave();
            onClose();
        } catch (error) {
            console.error(error);
            alert('상품 등록 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const updateSuggestion = (index, field, value) => {
        const updated = [...suggestions];
        updated[index][field] = value;
        setSuggestions(updated);
    };

    const toggleCheck = (index) => {
        const updated = [...suggestions];
        updated[index].checked = !updated[index].checked;
        setSuggestions(updated);
    };

    const removeSuggestion = (index) => {
        setSuggestions(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100"
            >
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div>
                        <div className="flex items-center gap-2 text-orange-500 mb-1">
                            <Sparkles size={16} className="animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest leading-none">Smart AI Scanner</span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-none tracking-tight">
                            AI 메뉴판 사진 스캔 등록
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-all border border-slate-100">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {step === 'upload' && (
                        <div className="space-y-6">
                            <div className="bg-orange-50 rounded-2xl p-5 border border-orange-100 flex items-start gap-3">
                                <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={18} />
                                <div className="text-xs text-orange-800 leading-relaxed font-bold">
                                    기존 메뉴판이나 인쇄된 메뉴 보드 사진을 등록해 주세요. 
                                    글씨와 금액을 정밀하게 추출하여 최적의 카테고리 분류 및 감성적인 메뉴 설명을 자동으로 채워 드립니다!
                                </div>
                            </div>

                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`h-64 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center p-8 transition-all cursor-pointer ${
                                    dragging
                                        ? 'border-orange-500 bg-orange-50/30'
                                        : 'border-slate-200 hover:border-orange-400 bg-slate-50/50 hover:bg-slate-50'
                                }`}
                                onClick={() => document.getElementById('scan-file-input').click()}
                            >
                                <input
                                    id="scan-file-input"
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                                <div className="w-16 h-14 bg-white rounded-2xl flex items-center justify-center border border-slate-100 shadow-md text-orange-500 mb-4">
                                    <Upload size={24} />
                                </div>
                                <p className="text-sm font-black text-slate-800 mb-1">메뉴판 사진 드래그 또는 업로드</p>
                                <p className="text-xs font-bold text-slate-400">JPG, PNG, WEBP 이미지 지원</p>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-6 text-center">
                            <div className="aspect-[4/3] max-h-80 mx-auto rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-slate-50 relative">
                                <img src={imagePreview} alt="Menu preview" className="w-full h-full object-contain" />
                            </div>
                            <div className="flex justify-center gap-3">
                                <button
                                    onClick={() => setStep('upload')}
                                    className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-xs hover:bg-slate-200 transition-all border border-slate-200"
                                >
                                    다른 사진 선택
                                </button>
                                <button
                                    onClick={handleAnalyze}
                                    className="px-8 py-3 bg-orange-500 text-white rounded-xl font-black text-xs hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20"
                                >
                                    스캔 및 자동 분석 시작
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'scanning' && (
                        <div className="h-80 flex flex-col items-center justify-center space-y-6">
                            <div className="relative">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                    className="w-20 h-20 border-4 border-orange-100 border-t-orange-500 rounded-full"
                                />
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    className="absolute inset-0 flex items-center justify-center text-orange-500"
                                >
                                    <Sparkles size={28} />
                                </motion.div>
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-black text-slate-900 mb-2 tracking-tight">AI가 메뉴판을 정밀 분석하고 있습니다</h3>
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">이미지 속 텍스트 추출 및 고유 가격 매칭 중...</p>
                            </div>
                        </div>
                    )}

                    {step === 'review' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5">
                                    <Check className="text-emerald-500" size={18} />
                                    분석 완료된 대기열 ({suggestions.length}개 메뉴)
                                </h3>
                                <button onClick={() => setStep('upload')} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-orange-500 transition-all">
                                    다시 업로드
                                </button>
                            </div>

                            <div className="space-y-4">
                                {suggestions.map((item, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className={`p-5 rounded-2xl border transition-all relative flex flex-col md:flex-row gap-4 items-start ${
                                            item.checked ? 'border-orange-200 bg-orange-50/10' : 'border-slate-100 bg-slate-50/50 opacity-60'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={item.checked}
                                            onChange={() => toggleCheck(idx)}
                                            className="w-5 h-5 rounded border-slate-200 text-orange-500 focus:ring-orange-500 cursor-pointer appearance-none border-2 checked:bg-orange-500 transition-all shrink-0 mt-1"
                                        />

                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-grow w-full">
                                            <div className="md:col-span-3">
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">메뉴명</div>
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={e => updateSuggestion(idx, 'name', e.target.value)}
                                                    className="w-full bg-white px-3 py-2 rounded-xl border border-slate-200 text-sm font-black text-slate-800 focus:ring-2 focus:ring-orange-500/10 outline-none"
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">카테고리</div>
                                                <input
                                                    type="text"
                                                    value={item.category_name}
                                                    onChange={e => updateSuggestion(idx, 'category_name', e.target.value)}
                                                    className="w-full bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-orange-500/10 outline-none"
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">가격 (원)</div>
                                                <input
                                                    type="number"
                                                    value={item.price}
                                                    onChange={e => updateSuggestion(idx, 'price', parseInt(e.target.value) || 0)}
                                                    className="w-full bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs font-black text-orange-600 text-right focus:ring-2 focus:ring-orange-500/10 outline-none"
                                                />
                                            </div>

                                            <div className="md:col-span-5">
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">설명</div>
                                                <textarea
                                                    value={item.description}
                                                    onChange={e => updateSuggestion(idx, 'description', e.target.value)}
                                                    rows={1}
                                                    className="w-full bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 resize-none focus:ring-2 focus:ring-orange-500/10 outline-none leading-relaxed"
                                                />
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => removeSuggestion(idx)}
                                            className="absolute top-3 right-3 p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {step === 'review' && (
                    <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-between items-center gap-4">
                        <div className="text-xs text-slate-400 font-bold">
                            {suggestions.filter(s => s.checked).length}개 메뉴 승인 등록 가능
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-6 py-3 bg-slate-50 text-slate-400 rounded-xl font-black text-xs hover:bg-slate-100 transition-all"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || suggestions.filter(s => s.checked).length === 0}
                                className="px-8 py-3 bg-orange-500 text-white rounded-xl font-black text-xs flex items-center gap-2 hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                {saving ? '등록 중...' : `${suggestions.filter(s => s.checked).length}개 메뉴 최종 승인 및 등록`}
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default MenuScanModal;