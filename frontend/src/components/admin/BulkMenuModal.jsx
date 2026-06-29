import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Sparkles, Plus, Wand2, ArrowRight, Check, ShoppingBag,
    Loader2, FileSpreadsheet, Upload, Download, Info, ChevronDown, ChevronUp
} from 'lucide-react';
import { aiAPI, productsAPI, categoriesAPI } from '../../api';
import { formatPrice } from '../../utils/format';
import * as XLSX from 'xlsx';

// 엑셀 샘플 데이터
const SAMPLE_ROWS = [
    ['메뉴명*', '가격 (선택)', '카테고리 (선택)', '설명 (선택)', '맵기 0-3 (선택)', '알레르기 (선택)'],
    ['슈프림 양념치킨', 18000, '치킨', '매콤달콤한 양념소스를 통째로 코팅한 인기 메뉴', 2, '밀, 대두, 닭고기'],
    ['황금올리브 치킨', 19000, '치킨', '올리브오일로 튀겨 담백하고 고소한 치킨', 0, '밀, 닭고기'],
    ['마늘간장 치킨', 17000, '치킨', '', 1, ''],
    ['반반 치킨', 20000, '치킨', '양념+후라이드 반반 구성', 1, '밀'],
    ['콜라 1.5L', 3000, '음료', '', 0, ''],
    ['사이다 1.5L', 3000, '음료', '', 0, ''],
    ['맥주 500cc', 5000, '음료', '', 0, ''],
    ['감자튀김 (M)', 4000, '사이드', '바삭하게 튀긴 굵은 감자튀김', 0, '밀'],
    ['코울슬로', 2000, '사이드', '신선한 양배추 샐러드', 0, ''],
    ['허니버터 딥소스', 1000, '추가', '', 0, ''],
];

const COLUMN_GUIDE = [
    { col: 'A', name: '메뉴명*', required: true, desc: 'AI가 분석하는 기준 컬럼 (필수)' },
    { col: 'B', name: '가격', required: false, desc: '입력 시 AI가 그대로 사용, 미입력 시 AI가 추천' },
    { col: 'C', name: '카테고리', required: false, desc: '입력 시 우선 적용, 미입력 시 AI가 자동 분류' },
    { col: 'D', name: '설명', required: false, desc: '입력 시 AI가 더 풍성하게 보완' },
    { col: 'E', name: '맵기 (0~3)', required: false, desc: '0=안매움, 1=약간, 2=보통, 3=아주매움' },
    { col: 'F', name: '알레르기', required: false, desc: '쉼표로 구분 (예: 밀, 대두, 닭고기)' },
];

const BulkMenuModal = ({ storeId, existingCategories, onClose, onSave }) => {
    const [step, setStep] = useState('input');
    const [menuText, setMenuText] = useState('');
    const [excelData, setExcelData] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [showColumnGuide, setShowColumnGuide] = useState(false);
    const [uploadedFileName, setUploadedFileName] = useState('');

    // 샘플 엑셀 다운로드
    const downloadSampleExcel = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(SAMPLE_ROWS);

        // 컬럼 너비 설정
        ws['!cols'] = [
            { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 38 }, { wch: 14 }, { wch: 22 }
        ];

        // 헤더 행 스타일 (배경색 + 굵게)
        const headerRange = XLSX.utils.decode_range(ws['!ref']);
        for (let C = headerRange.s.c; C <= headerRange.e.c; C++) {
            const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
            if (cell) {
                cell.s = {
                    font: { bold: true, color: { rgb: 'FFFFFF' } },
                    fill: { fgColor: { rgb: '2563EB' } },
                    alignment: { horizontal: 'center' }
                };
            }
        }

        XLSX.utils.book_append_sheet(wb, ws, '메뉴목록');
        XLSX.writeFile(wb, '위마켓_메뉴샘플.xlsx');
    };

    // 엑셀/CSV 파일 파싱 (다중 컬럼)
    const parseFile = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = XLSX.read(evt.target.result, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });

                if (raw.length === 0) { alert('빈 파일입니다.'); return; }

                // 첫 행이 헤더인지 감지 (A1이 문자열이고 숫자가 아닌 경우)
                const firstCell = String(raw[0]?.[0] || '');
                const isHeader = /메뉴|name|menu|항목/i.test(firstCell) || isNaN(Number(firstCell));
                const dataRows = isHeader ? raw.slice(1) : raw;

                const parsed = dataRows
                    .filter(row => row[0] && String(row[0]).trim().length > 0)
                    .map(row => ({
                        name: String(row[0]).trim(),
                        price: row[1] !== undefined && row[1] !== '' ? parseInt(row[1]) || null : null,
                        category: row[2] ? String(row[2]).trim() : '',
                        description: row[3] ? String(row[3]).trim() : '',
                        spicy_level: row[4] !== undefined && row[4] !== '' ? parseInt(row[4]) || 0 : null,
                        allergens: row[5] ? String(row[5]).trim() : '',
                    }));

                if (parsed.length === 0) { alert('메뉴명이 있는 행을 찾을 수 없습니다.'); return; }

                setExcelData(parsed);
                setMenuText(parsed.map(p => p.name).join('\n'));
                setUploadedFileName(file.name);

                const priceCount = parsed.filter(p => p.price).length;
                const catCount = parsed.filter(p => p.category).length;
                alert(
                    `✅ ${parsed.length}개 메뉴 불러옴\n` +
                    (priceCount > 0 ? `· 가격 입력된 항목: ${priceCount}개\n` : '') +
                    (catCount > 0 ? `· 카테고리 입력된 항목: ${catCount}개\n` : '') +
                    '\nAI가 분석할 준비가 됐습니다!'
                );
            } catch (err) {
                console.error('파일 파싱 실패:', err);
                alert('파일을 읽는 중 오류가 발생했습니다. 지원 형식: .xlsx, .xls, .csv');
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleFileUpload = (e) => parseFile(e.target.files?.[0]);

    const handleDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        parseFile(e.dataTransfer.files?.[0]);
    };

    const handleAnalyze = async () => {
        const menuNames = menuText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (menuNames.length === 0) return;

        setStep('loading');
        setLoading(true);
        try {
            const response = await aiAPI.analyzeMenuList({
                menuNames,
                menuData: excelData.length > 0 ? excelData : [],
                categories: existingCategories
            });
            if (response && response.success) {
                setSuggestions(response.suggestions);
                setStep('review');
            }
        } catch (error) {
            console.error('AI 분석 실패:', error);
            alert('AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            setStep('input');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const uniqueCategoryNames = [...new Set(suggestions.map(s => s.category_name))];
            const categoryMap = {};
            existingCategories.forEach(c => { categoryMap[c.name] = c.id; });

            for (const catName of uniqueCategoryNames) {
                if (!categoryMap[catName]) {
                    const res = await categoriesAPI.create({ store_id: parseInt(storeId), name: catName });
                    categoryMap[catName] = res.id || res?.data?.id;
                }
            }

            const productsToRegister = suggestions.map(s => ({
                name: s.name,
                price: s.price,
                description: s.description,
                image_url: s.image_url || null,
                category_id: categoryMap[s.category_name],
                allergens: s.allergens || '',
                tags: Array.isArray(s.tags) ? s.tags.join(', ') : (s.tags || ''),
                spicy_level: s.spicy_level || 0,
                options: typeof s.options === 'string' ? s.options : JSON.stringify(s.options || []),
                is_active: 1
            }));

            await productsAPI.bulkCreate({ store_id: parseInt(storeId), products: productsToRegister });
            onSave();
        } catch (error) {
            console.error('저장 실패:', error);
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

    const removeSuggestion = (index) => {
        setSuggestions(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div>
                        <div className="flex items-center gap-2 text-blue-600 mb-1">
                            <Sparkles size={18} />
                            <span className="text-[10px] font-black uppercase tracking-widest">AI Power Engine</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">
                            AI 일괄 <span className="text-blue-600">메뉴 등록</span>
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all">
                        <X size={22} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* ── STEP: INPUT ── */}
                    {step === 'input' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-6">

                            {/* 사용 가이드 */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[24px] border border-blue-100 overflow-hidden">
                                {/* 가이드 헤더 */}
                                <div className="px-6 py-4 border-b border-blue-100/60 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-blue-600 rounded-lg">
                                            <Info size={14} className="text-white" />
                                        </div>
                                        <span className="font-black text-slate-900 text-sm">사용 가이드</span>
                                    </div>
                                    <button
                                        onClick={downloadSampleExcel}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-sm shadow-blue-200"
                                    >
                                        <Download size={13} />
                                        샘플 파일 다운로드
                                    </button>
                                </div>

                                {/* 3단계 흐름 */}
                                <div className="px-6 py-5">
                                    <div className="grid grid-cols-3 gap-4 mb-5">
                                        {[
                                            { step: '01', label: '메뉴 입력', desc: '이름을 직접 입력하거나 엑셀 파일 업로드', icon: '✏️' },
                                            { step: '02', label: 'AI 분석', desc: '카테고리·설명·가격·옵션 자동 생성', icon: '🤖' },
                                            { step: '03', label: '확인 · 등록', desc: '결과를 수정한 뒤 한 번에 일괄 저장', icon: '✅' },
                                        ].map(({ step: s, label, desc, icon }) => (
                                            <div key={s} className="bg-white/70 rounded-2xl p-4 text-center border border-white">
                                                <div className="text-2xl mb-2">{icon}</div>
                                                <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Step {s}</div>
                                                <div className="font-black text-slate-900 text-xs mb-1">{label}</div>
                                                <div className="text-[10px] text-slate-400 leading-snug">{desc}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* 엑셀 컬럼 가이드 토글 */}
                                    <button
                                        onClick={() => setShowColumnGuide(v => !v)}
                                        className="w-full flex items-center justify-between px-4 py-3 bg-white/60 rounded-2xl border border-blue-100/60 hover:bg-white transition-all text-sm font-black text-slate-700"
                                    >
                                        <div className="flex items-center gap-2">
                                            <FileSpreadsheet size={16} className="text-blue-500" />
                                            엑셀 파일 컬럼 형식 보기
                                        </div>
                                        {showColumnGuide ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                    </button>

                                    <AnimatePresence>
                                        {showColumnGuide && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden mt-3"
                                            >
                                                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                                <th className="px-4 py-2.5 text-left font-black text-slate-500 uppercase tracking-widest text-[9px]">열</th>
                                                                <th className="px-4 py-2.5 text-left font-black text-slate-500 uppercase tracking-widest text-[9px]">항목</th>
                                                                <th className="px-4 py-2.5 text-left font-black text-slate-500 uppercase tracking-widest text-[9px]">필수</th>
                                                                <th className="px-4 py-2.5 text-left font-black text-slate-500 uppercase tracking-widest text-[9px]">설명</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {COLUMN_GUIDE.map(({ col, name, required, desc }) => (
                                                                <tr key={col} className="border-b border-slate-50 last:border-0">
                                                                    <td className="px-4 py-2.5">
                                                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md font-black text-[10px]">{col}</span>
                                                                    </td>
                                                                    <td className="px-4 py-2.5 font-bold text-slate-700">{name}</td>
                                                                    <td className="px-4 py-2.5">
                                                                        {required
                                                                            ? <span className="px-2 py-0.5 bg-red-50 text-red-500 rounded-md font-black text-[10px]">필수</span>
                                                                            : <span className="px-2 py-0.5 bg-slate-50 text-slate-400 rounded-md font-black text-[10px]">선택</span>
                                                                        }
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-slate-400">{desc}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    <div className="px-4 py-3 bg-amber-50 border-t border-amber-100">
                                                        <p className="text-[10px] text-amber-700 font-bold">
                                                            💡 가격·카테고리를 미리 입력하면 AI가 그대로 사용합니다. 비워두면 AI가 자동으로 추천합니다.
                                                        </p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* 입력 영역 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* 직접 입력 */}
                                <div className="relative group">
                                    <div className="absolute -top-3 left-5 px-3 py-1 bg-white border border-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest z-10">직접 입력</div>
                                    <textarea
                                        value={menuText}
                                        onChange={(e) => { setMenuText(e.target.value); setExcelData([]); setUploadedFileName(''); }}
                                        placeholder={"예:\n슈프림 양념치킨\n황금올리브 치킨\n감자튀김\n콜라 1.5L"}
                                        className="w-full h-72 p-6 pt-8 rounded-[24px] border-2 border-slate-100 focus:border-blue-500 focus:ring-0 text-sm font-bold placeholder:text-slate-300 transition-all resize-none shadow-sm"
                                    />
                                    <div className="absolute bottom-4 right-5 text-slate-300 text-[10px] font-black uppercase tracking-widest">
                                        {menuText.split('\n').filter(l => l.trim()).length} items
                                    </div>
                                </div>

                                {/* 파일 업로드 */}
                                <div
                                    className={`relative rounded-[24px] border-2 border-dashed flex flex-col items-center justify-center p-8 transition-all cursor-pointer ${dragging ? 'border-blue-500 bg-blue-50/40' : 'border-slate-200 bg-slate-50/30 hover:border-blue-300'}`}
                                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                    onDragLeave={() => setDragging(false)}
                                    onDrop={handleDrop}
                                >
                                    <div className="absolute -top-3 left-5 px-3 py-1 bg-white border border-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest z-10">파일 업로드</div>

                                    {uploadedFileName ? (
                                        <div className="text-center space-y-3">
                                            <div className="w-16 h-16 bg-emerald-50 rounded-[20px] flex items-center justify-center mx-auto">
                                                <Check size={28} className="text-emerald-500" />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900 text-sm">{uploadedFileName}</p>
                                                <p className="text-emerald-600 font-bold text-xs mt-1">
                                                    {excelData.length}개 메뉴 로드 완료
                                                </p>
                                                {excelData.filter(d => d.price).length > 0 && (
                                                    <p className="text-blue-500 font-bold text-[10px] mt-0.5">
                                                        가격 힌트 {excelData.filter(d => d.price).length}개 · 카테고리 힌트 {excelData.filter(d => d.category).length}개
                                                    </p>
                                                )}
                                            </div>
                                            <label className="px-4 py-2 bg-white border border-slate-200 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 cursor-pointer transition-all inline-block">
                                                다른 파일 선택
                                                <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                                            </label>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="w-16 h-16 bg-white rounded-[20px] shadow-sm flex items-center justify-center text-slate-400 mb-5">
                                                <FileSpreadsheet size={28} />
                                            </div>
                                            <p className="font-black text-slate-900 text-sm mb-1">엑셀 / CSV 업로드</p>
                                            <p className="text-slate-400 text-xs font-bold text-center leading-relaxed mb-5">
                                                파일을 드래그하거나<br />아래 버튼을 클릭하세요
                                            </p>
                                            <label className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 cursor-pointer transition-all shadow-sm flex items-center gap-2">
                                                <Upload size={13} /> 파일 선택
                                                <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                                            </label>
                                            <div className="mt-4 flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={downloadSampleExcel}
                                                    className="text-[10px] font-black text-blue-500 hover:text-blue-600 underline underline-offset-2 flex items-center gap-1 transition-colors"
                                                >
                                                    <Download size={11} /> 샘플 파일 받기
                                                </button>
                                            </div>
                                            <div className="mt-3 flex items-center gap-1.5 text-slate-300 text-[9px] font-black uppercase tracking-widest">
                                                <Check size={9} /> .xlsx · .xls · .csv 지원
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* 분석 버튼 */}
                            <button
                                onClick={handleAnalyze}
                                disabled={!menuText.trim() || loading}
                                className="w-full py-5 bg-slate-900 text-white rounded-[20px] font-black text-base flex items-center justify-center gap-3 hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Wand2 size={20} />
                                {excelData.length > 0
                                    ? `${excelData.length}개 메뉴 AI 분석 시작 (힌트 ${excelData.filter(d => d.price || d.category).length}개 포함)`
                                    : 'AI가 분석하기'}
                            </button>
                        </motion.div>
                    )}

                    {/* ── STEP: LOADING ── */}
                    {step === 'loading' && (
                        <div className="h-80 flex flex-col items-center justify-center space-y-6 p-8">
                            <div className="relative">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                    className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full"
                                />
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    className="absolute inset-0 flex items-center justify-center text-blue-600"
                                >
                                    <Sparkles size={28} />
                                </motion.div>
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">AI가 메뉴를 분석 중입니다</h3>
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">카테고리 · 설명 · 가격 · 옵션 생성 중...</p>
                            </div>
                        </div>
                    )}

                    {/* ── STEP: REVIEW ── */}
                    {step === 'review' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-5">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                    <Check className="text-emerald-500" size={22} />
                                    분석 결과 확인 ({suggestions.length}개)
                                </h3>
                                <button onClick={() => setStep('input')} className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors">
                                    다시 작성
                                </button>
                            </div>

                            <div className="space-y-3">
                                {suggestions.map((item, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.04 }}
                                        className="p-5 bg-slate-50 rounded-[20px] border border-slate-200/50 group hover:bg-white hover:shadow-lg transition-all"
                                    >
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                                            {/* 이미지 */}
                                            <div className="md:col-span-2">
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Image</div>
                                                <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-200">
                                                    <img
                                                        src={`https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=200&auto=format&fit=crop&sig=${encodeURIComponent(item.image_keyword)}`}
                                                        alt={item.name}
                                                        className="w-full h-full object-cover"
                                                        onError={e => { e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=200'; }}
                                                    />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={item.image_keyword}
                                                    onChange={e => updateSuggestion(idx, 'image_keyword', e.target.value)}
                                                    className="w-full mt-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200 text-[9px] font-bold text-slate-500 focus:ring-1 focus:ring-blue-500"
                                                    placeholder="image keyword..."
                                                />
                                            </div>

                                            {/* 메뉴명 */}
                                            <div className="md:col-span-3">
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">메뉴명</div>
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={e => updateSuggestion(idx, 'name', e.target.value)}
                                                    className="w-full bg-transparent border-none p-0 text-base font-black text-slate-900 focus:ring-0"
                                                />
                                            </div>

                                            {/* 카테고리 */}
                                            <div className="md:col-span-2">
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">카테고리</div>
                                                <input
                                                    type="text"
                                                    value={item.category_name}
                                                    onChange={e => updateSuggestion(idx, 'category_name', e.target.value)}
                                                    className="w-full bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                                                />
                                            </div>

                                            {/* 가격 */}
                                            <div className="md:col-span-2">
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">가격 (원)</div>
                                                <input
                                                    type="number"
                                                    value={item.price}
                                                    onChange={e => updateSuggestion(idx, 'price', parseInt(e.target.value) || 0)}
                                                    className="w-full bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-black text-orange-600 focus:ring-2 focus:ring-orange-500/20 text-right"
                                                />
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {item.tags?.slice(0, 2).map((t, i) => (
                                                        <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-500 text-[8px] font-black rounded">{t}</span>
                                                    ))}
                                                    {item.spicy_level > 0 && (
                                                        <span className="px-1.5 py-0.5 bg-red-50 text-red-500 text-[8px] font-black rounded">🌶️ L{item.spicy_level}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 설명 */}
                                            <div className="md:col-span-3">
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">설명</div>
                                                <textarea
                                                    value={item.description}
                                                    onChange={e => updateSuggestion(idx, 'description', e.target.value)}
                                                    rows={2}
                                                    className="w-full bg-transparent border-none p-0 text-xs font-bold text-slate-500 focus:ring-0 resize-none leading-relaxed"
                                                />
                                                {item.allergens && (
                                                    <div className="mt-1 text-[9px] text-slate-400 font-bold">
                                                        ⚠️ {item.allergens}
                                                    </div>
                                                )}
                                                {item.options?.length > 0 && (
                                                    <div className="mt-1.5 p-2 bg-white rounded-xl border border-dashed border-slate-200">
                                                        <div className="text-[7px] font-black text-slate-300 uppercase mb-1">옵션</div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {item.options.map((opt, i) => (
                                                                <div key={i} className="text-[8px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                                                                    {opt.name}: {opt.values?.join('/')}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* 삭제 버튼 */}
                                        <button
                                            onClick={() => removeSuggestion(idx)}
                                            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 transition-all text-[10px] font-black"
                                            style={{ position: 'absolute' }}
                                        >
                                            <X size={12} />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Footer */}
                {step === 'review' && (
                    <div className="px-8 py-5 border-t border-slate-100 bg-white sticky bottom-0 flex justify-between items-center gap-4">
                        <div className="text-xs text-slate-400 font-bold">
                            {suggestions.length}개 메뉴 · 수정 후 등록하세요
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-6 py-3 bg-slate-50 text-slate-400 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || suggestions.length === 0}
                                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                {saving ? '등록 중...' : `${suggestions.length}개 일괄 등록`}
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default BulkMenuModal;
