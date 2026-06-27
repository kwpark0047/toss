import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storesAPI, categoriesAPI, productsAPI } from '../../api';
import {
    ArrowLeft, Palette, Layout, Type, Image as ImageIcon,
    Save, Eye, Smartphone, Tablet, Monitor, Sparkles,
    Check, ChevronRight, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatPrice } from '../../utils/format';

const defaultTheme = {
    primaryColor: '#f97316',
    secondaryColor: '#1e3a5f',
    accentColor: '#10b981',
    backgroundColor: '#f8fafc',
    textColor: '#1e293b',
    fontFamily: 'Pretendard',
    logoText: '',
    layoutMode: 'grid', // grid, list, magazine
    bannerImageUrl: ''
};

const fontOptions = [
    { value: 'Pretendard', label: 'Pretendard (기본)' },
    { value: 'Noto Sans KR', label: 'Noto Sans KR' },
    { value: 'Nanum Gothic', label: '나눔고딕' },
    { value: 'Spoqa Han Sans Neo', label: 'Spoqa Han Sans' }
];

const layoutOptions = [
    { id: 'grid', label: '그리드', icon: Layout, desc: '격자형 배치로 많은 메뉴를 한눈에' },
    { id: 'list', label: '리스트', icon: Smartphone, desc: '모바일에 최적화된 세로형 레이아웃' },
    { id: 'magazine', label: '매거진', icon: Eye, desc: '이미지와 감성을 강조한 프리미엄 스타일' }
];

const MenuBuilder = () => {
    const { storeId } = useParams();
    const navigate = useNavigate();
    const [store, setStore] = useState(null);
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [theme, setTheme] = useState(defaultTheme);
    const [loading, setLoading] = useState(true);
    const [saveLoading, setSaveLoading] = useState(false);
    const [previewMode, setPreviewMode] = useState('mobile'); // mobile, tablet, desktop
    const [activeTab, setActiveTab] = useState('style'); // style, layout, header

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [s, c, p] = await Promise.all([
                    storesAPI.getById(storeId),
                    categoriesAPI.getByStore(storeId),
                    productsAPI.getByStore(storeId)
                ]);
                setStore(s.data || s);
                setCategories(c.data || c);
                setProducts(p.data || p);

                if (s.theme || s.data?.theme) {
                    const rawTheme = s.theme || s.data.theme;
                    const parsed = typeof rawTheme === 'string' ? JSON.parse(rawTheme) : rawTheme;
                    setTheme({ ...defaultTheme, ...parsed });
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [storeId]);

    const handleThemeChange = (key, value) => {
        setTheme(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setSaveLoading(true);
        try {
            await storesAPI.update(storeId, { theme: JSON.stringify(theme) });
            alert('성공적으로 저장되었습니다.');
        } catch (err) {
            alert('저장 실패');
        } finally {
            setSaveLoading(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="max-w-[1600px] mx-auto h-[calc(100vh-140px)] flex flex-col gap-6">
            {/* 상단 툴바 */}
            <div className="flex items-center justify-between bg-white px-8 py-5 rounded-[2.5rem] shadow-sm border border-slate-100 shrink-0">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-xl font-black text-slate-900">메뉴판 비주얼 빌더</h1>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">{store?.name}</p>
                    </div>
                </div>

                <div className="flex items-center gap-8">
                    {/* 디바이스 시뮬레이터 컨트롤 */}
                    <div className="bg-slate-50 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-100">
                        <button
                            onClick={() => setPreviewMode('mobile')}
                            className={`p-2 rounded-xl transition-all ${previewMode === 'mobile' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Smartphone size={18} />
                        </button>
                        <button
                            onClick={() => setPreviewMode('tablet')}
                            className={`p-2 rounded-xl transition-all ${previewMode === 'tablet' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Tablet size={18} />
                        </button>
                        <button
                            onClick={() => setPreviewMode('desktop')}
                            className={`p-2 rounded-xl transition-all ${previewMode === 'desktop' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Monitor size={18} />
                        </button>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saveLoading}
                        className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-95"
                    >
                        <Save size={18} />
                        {saveLoading ? '저장 중...' : '디자인 저장'}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex gap-8 min-h-0">
                {/* 좌측 설정 패널 */}
                <aside className="w-96 bg-white rounded-[3rem] shadow-sm border border-slate-100 flex flex-col overflow-hidden shrink-0">
                    <div className="flex border-b border-slate-50">
                        {[
                            { id: 'style', label: '스타일', icon: Palette },
                            { id: 'layout', label: '레이아웃', icon: Layout },
                            { id: 'header', label: '헤더/로고', icon: ImageIcon }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 py-5 flex flex-col items-center gap-1.5 text-[11px] font-black transition-all border-b-2 ${activeTab === tab.id ? 'text-blue-600 border-blue-600 bg-blue-50/30' : 'text-slate-400 border-transparent hover:text-slate-600'
                                    }`}
                            >
                                <tab.icon size={18} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
                        {activeTab === 'style' && (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">색상 팔레트</label>
                                    <div className="space-y-4">
                                        {[
                                            { key: 'primaryColor', label: '메인 포인트', desc: '버튼, 활성 카테고리 등' },
                                            { key: 'secondaryColor', label: '보조 색상', desc: '네비게이션, 강조 텍스트' },
                                            { key: 'backgroundColor', label: '배경 색상', desc: '전체 페이지 배경' }
                                        ].map(item => (
                                            <div key={item.key} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between group">
                                                <div>
                                                    <p className="text-sm font-black text-slate-700">{item.label}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold">{item.desc}</p>
                                                </div>
                                                <div className="relative">
                                                    <input
                                                        type="color"
                                                        value={theme[item.key]}
                                                        onChange={(e) => handleThemeChange(item.key, e.target.value)}
                                                        className="w-10 h-10 rounded-xl cursor-pointer border-0 p-0 overflow-hidden bg-transparent"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">타이포그래피</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {fontOptions.map(font => (
                                            <button
                                                key={font.value}
                                                onClick={() => handleThemeChange('fontFamily', font.value)}
                                                className={`px-5 py-4 rounded-2xl text-left font-bold text-sm transition-all border-2 ${theme.fontFamily === font.value ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-50 hover:border-slate-200 text-slate-500'
                                                    }`}
                                                style={{ fontFamily: font.value }}
                                            >
                                                {font.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'layout' && (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">메뉴 레이아웃 스타일</label>
                                    <div className="space-y-4">
                                        {layoutOptions.map(option => (
                                            <button
                                                key={option.id}
                                                onClick={() => handleThemeChange('layoutMode', option.id)}
                                                className={`w-full p-5 rounded-[2rem] text-left transition-all border-2 flex gap-4 ${theme.layoutMode === option.id ? 'border-blue-500 bg-blue-50' : 'border-slate-50 hover:border-slate-200'
                                                    }`}
                                            >
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${theme.layoutMode === option.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                                                    }`}>
                                                    <option.icon size={24} />
                                                </div>
                                                <div>
                                                    <p className={`font-black text-sm mb-1 ${theme.layoutMode === option.id ? 'text-blue-600' : 'text-slate-700'}`}>{option.label}</p>
                                                    <p className="text-[11px] text-slate-400 font-bold leading-relaxed">{option.desc}</p>
                                                </div>
                                                {theme.layoutMode === option.id && <Check size={20} className="ml-auto text-blue-600 shrink-0" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-6 bg-amber-50 rounded-[2rem] border border-amber-100">
                                    <div className="flex gap-3 mb-2">
                                        <Info size={18} className="text-amber-500 shrink-0" />
                                        <p className="text-xs font-black text-amber-700 leading-relaxed uppercase tracking-tighter">레이아웃 팁</p>
                                    </div>
                                    <p className="text-[11px] text-amber-600/80 font-medium leading-relaxed">매거진 스타일은 고품질 이미지가 등록된 메뉴가 많을 때 가장 빛납니다.</p>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'header' && (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">로고 텍스트</label>
                                    <input
                                        type="text"
                                        value={theme.logoText}
                                        onChange={(e) => handleThemeChange('logoText', e.target.value)}
                                        placeholder="매장 이름 대신 표시될 텍스트"
                                        className="w-full h-14 px-6 bg-slate-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-900"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">메인 배너 이미지</label>
                                    <div className="space-y-4">
                                        <div className="aspect-[16/9] bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 relative overflow-hidden group">
                                            {theme.bannerImageUrl ? (
                                                <img src={theme.bannerImageUrl} className="w-full h-full object-cover" alt="Banner" />
                                            ) : (
                                                <>
                                                    <ImageIcon size={32} className="mb-2" />
                                                    <span className="text-[11px] font-black uppercase tracking-widest">배너 이미지 등록</span>
                                                </>
                                            )}
                                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <button className="px-4 py-2 bg-white text-slate-900 rounded-xl text-[10px] font-black hover:bg-slate-50">변경</button>
                                                {theme.bannerImageUrl && <button onClick={() => handleThemeChange('bannerImageUrl', '')} className="px-4 py-2 bg-rose-500 text-white rounded-xl text-[10px] font-black hover:bg-rose-600">제거</button>}
                                            </div>
                                        </div>
                                        <input
                                            type="text"
                                            value={theme.bannerImageUrl}
                                            onChange={(e) => handleThemeChange('bannerImageUrl', e.target.value)}
                                            placeholder="이미지 URL을 입력하세요"
                                            className="w-full h-12 px-6 bg-slate-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-xs font-medium text-slate-500"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </aside>

                {/* 우측 실시간 미리보기 (Virtual Phone/Device Frame) */}
                <main className="flex-1 bg-slate-100 rounded-[3rem] p-12 flex flex-col items-center overflow-hidden">
                    <div className="flex items-center gap-2 mb-8 text-slate-400">
                        <Sparkles size={16} className="text-blue-400" />
                        <span className="text-xs font-black uppercase tracking-widest">Live Preview</span>
                    </div>

                    <motion.div
                        layout
                        className={`shadow-2xl overflow-hidden transition-all duration-500 relative bg-white border-8 border-slate-900 rounded-[3.5rem] ${previewMode === 'mobile' ? 'w-[375px] h-[750px]' :
                                previewMode === 'tablet' ? 'w-[768px] h-[1024px]' : 'w-full h-full'
                            }`}
                    >
                        {/* 시뮬레이션된 메뉴판 화면 */}
                        <div className="absolute inset-0 overflow-y-auto scrollbar-hide flex flex-col" style={{ backgroundColor: theme.backgroundColor, fontFamily: theme.fontFamily }}>
                            {/* Header */}
                            <div className="p-6 shrink-0 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-black/5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-lg" style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})` }}>
                                            {(theme.logoText || store?.name || 'W').charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-black text-sm" style={{ color: theme.textColor }}>{theme.logoText || store?.name}</h3>
                                            <p className="text-[10px] opacity-50" style={{ color: theme.textColor }}>Welcome! Discover our menu</p>
                                        </div>
                                    </div>
                                    <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
                                        <Smartphone size={18} />
                                    </div>
                                </div>
                            </div>

                            {/* Banner Area */}
                            {theme.bannerImageUrl && (
                                <div className="w-full aspect-[21/9] shrink-0 relative overflow-hidden">
                                    <img src={theme.bannerImageUrl} className="w-full h-full object-cover" alt="Banner" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                </div>
                            )}

                            {/* Categories */}
                            <div className="flex overflow-x-auto p-5 gap-2 scrollbar-hide shrink-0">
                                <button className="px-5 py-2.5 rounded-2xl text-[11px] font-black text-white shadow-lg" style={{ backgroundColor: theme.primaryColor }}>전체보기</button>
                                {categories.slice(0, 3).map(cat => (
                                    <button key={cat.id} className="px-5 py-2.5 rounded-2xl text-[11px] font-black bg-white shadow-sm border border-slate-100" style={{ color: theme.secondaryColor }}>{cat.name}</button>
                                ))}
                            </div>

                            {/* Product Listing Preview */}
                            <div className="p-5 flex-1">
                                <div className={`grid gap-4 ${theme.layoutMode === 'grid' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    {products.slice(0, 6).map(product => (
                                        <div
                                            key={product.id}
                                            className={`bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden ${theme.layoutMode === 'magazine' ? 'grid grid-cols-2 h-40' : ''}`}
                                        >
                                            <div className={`${theme.layoutMode === 'magazine' ? 'h-full' : 'aspect-square'} bg-slate-100 relative`}>
                                                {product.image_url ? <img src={product.image_url} className="w-full h-full object-cover" alt={product.name} /> : null}
                                            </div>
                                            <div className="p-4 flex flex-col justify-between">
                                                <div>
                                                    <h4 className="font-black text-xs line-clamp-1" style={{ color: theme.textColor }}>{product.name}</h4>
                                                    <p className="text-[10px] opacity-40 line-clamp-1 mt-1 leading-relaxed" style={{ color: theme.textColor }}>Experience the unique taste</p>
                                                </div>
                                                <div className="flex items-center justify-between mt-3">
                                                    <span className="text-xs font-black" style={{ color: theme.primaryColor }}>{formatPrice(product.price)}</span>
                                                    <button className="px-3 py-1.5 rounded-xl text-[10px] font-black text-white" style={{ backgroundColor: theme.primaryColor }}>담기</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Floating Cart Button Preview */}
                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[85%] h-16 rounded-[2rem] shadow-2xl flex items-center justify-between px-8 text-white z-20" style={{ background: `linear-gradient(135deg, ${theme.secondaryColor}, ${theme.primaryColor})` }}>
                                <div className="flex items-center gap-3">
                                    <Smartphone size={20} />
                                    <span className="text-sm font-black tracking-tight">주문하기</span>
                                </div>
                                <span className="bg-white/20 px-3 py-1 rounded-full text-[11px] font-bold">2 items</span>
                            </div>
                        </div>

                        {/* Device Detail Frames (Camera Notch, etc.) */}
                        {previewMode === 'mobile' && (
                            <>
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-8 bg-slate-900 rounded-b-3xl z-30" />
                                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-slate-900/10 rounded-full" />
                            </>
                        )}
                    </motion.div>
                </main>
            </div>
        </div>
    );
};

export default MenuBuilder;
