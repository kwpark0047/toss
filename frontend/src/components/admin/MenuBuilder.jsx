import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { storesAPI, categoriesAPI, productsAPI, uploadsAPI } from '../../api';
import { ArrowLeft, Palette, Layout, Image as ImageIcon, Save, Smartphone, Tablet, Monitor, Sparkles, Check, Info, Upload, ExternalLink, AlignLeft, Grid, BookOpen, Bell, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatPrice } from '../../utils/format';

const defaultTheme = {
    primaryColor: '#f97316',
    secondaryColor: '#1e3a5f',
    accentColor: '#10b981',
    backgroundColor: '#f8fafc',
    textColor: '#1e293b',
    cardColor: '#ffffff',
    fontFamily: 'Pretendard',
    logoText: '',
    layoutMode: 'grid',
    bannerImageUrl: '',
    showBadges: true,
    cardRadius: 'lg',
    announcement: '',
    announcementActive: false,
};

const fontOptions = [
    { value: 'Pretendard', label: 'Pretendard (기본)' },
    { value: 'Noto Sans KR', label: 'Noto Sans KR' },
    { value: 'Nanum Gothic', label: '나눔고딕' },
    { value: 'Spoqa Han Sans Neo', label: 'Spoqa Han Sans' }
];

const layoutOptions = [
    { id: 'grid', label: '그리드', icon: Grid, desc: '격자형 배치로 많은 메뉴를 한눈에' },
    { id: 'list', label: '리스트', icon: AlignLeft, desc: '이미지와 내용이 나란히, 모바일 최적화' },
    { id: 'magazine', label: '매거진', icon: BookOpen, desc: '이미지를 강조한 프리미엄 감성 스타일' }
];

const radiusOptions = [
    { id: 'sm', label: '작게', css: '0.75rem' },
    { id: 'lg', label: '기본', css: '1.5rem' },
    { id: 'xl', label: '크게', css: '2rem' },
    { id: 'full', label: '원형', css: '9999px' },
];

const colorFields = [
    { key: 'primaryColor', label: '메인 포인트', desc: '버튼, 가격, 활성 카테고리' },
    { key: 'secondaryColor', label: '보조 색상', desc: '네비게이션, 헤더 그라디언트' },
    { key: 'accentColor', label: '강조 색상', desc: '배지, 태그, 하이라이트' },
    { key: 'backgroundColor', label: '배경 색상', desc: '전체 페이지 배경' },
    { key: 'cardColor', label: '카드 배경', desc: '메뉴 카드 배경색' },
    { key: 'textColor', label: '기본 텍스트', desc: '상품명, 설명 텍스트' },
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
    const [previewMode, setPreviewMode] = useState('mobile');
    const [activeTab, setActiveTab] = useState('style');
    const [bannerUploading, setBannerUploading] = useState(false);
    const [saved, setSaved] = useState(false);
    const bannerInputRef = useRef(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [s, c, p] = await Promise.all([
                    storesAPI.getById(storeId),
                    categoriesAPI.getByStore(storeId),
                    productsAPI.getByStore(storeId)
                ]);
                const storeData = s.data || s;
                setStore(storeData);
                setCategories(c.data || c || []);
                setProducts(p.data || p || []);

                const rawTheme = storeData?.theme;
                if (rawTheme) {
                    try {
                        const parsed = typeof rawTheme === 'string' ? JSON.parse(rawTheme) : rawTheme;
                        setTheme(prev => ({ ...prev, ...parsed }));
                    } catch { /* 기존 테마 파싱 실패 시 기본값 사용 */ }
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

    const handleBannerUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setBannerUploading(true);
        const fd = new FormData();
        fd.append('image', file);
        try {
            const res = await uploadsAPI.uploadImage(fd);
            const url = res?.data?.url || res?.url;
            if (url) handleThemeChange('bannerImageUrl', url);
        } catch { alert('배너 이미지 업로드 실패'); }
        finally { setBannerUploading(false); }
    };

    const handleSave = async () => {
        setSaveLoading(true);
        try {
            // MenuBuilder 필드 + themePresets 호환 필드 모두 저장
            const themeToSave = {
                ...theme,
                // themePresets 호환 필드
                theme_preset: 'custom',
                custom_colors: {
                    primary: theme.primaryColor,
                    secondary: theme.secondaryColor,
                    background: theme.backgroundColor,
                    surface: theme.cardColor,
                    text: theme.textColor,
                    border: theme.secondaryColor,
                },
                ui_size: theme.cardRadius === 'sm' ? 'small' : theme.cardRadius === 'xl' || theme.cardRadius === 'full' ? 'large' : 'medium',
                menu_layout: theme.layoutMode,
                menu_options: {
                    showBadge: theme.showBadges,
                    badgeTypes: {
                        new: { label: 'NEW', color: '#EF4444', show: true },
                        popular: { label: '인기', color: theme.primaryColor, show: true },
                        special: { label: 'SPECIAL', color: '#8B5CF6', show: false },
                    },
                    showPriceUnit: '원',
                    showRating: true,
                    showReviewCount: true,
                    priceFormat: 'comma',
                    showSoldOutBadge: true,
                    showLowStockWarning: true,
                    minimumOrderAmount: null,
                    optionDisplay: 'dropdown',
                },
            };
            await storesAPI.update(storeId, { theme: JSON.stringify(themeToSave) });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch {
            alert('저장 실패. 다시 시도해주세요.');
        } finally {
            setSaveLoading(false);
        }
    };

    const _previewWidth = previewMode === 'mobile' ? 375 : previewMode === 'tablet' ? 768 : '100%';

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
        </div>
    );

    const previewProducts = products.slice(0, theme.layoutMode === 'magazine' ? 4 : 6);
    const previewCategories = categories.slice(0, 4);

    const cardRadiusValue = radiusOptions.find(r => r.id === theme.cardRadius)?.css || '1.5rem';

    return (
        <div className="max-w-[1600px] mx-auto h-[calc(100vh-140px)] flex flex-col gap-6">
            {/* 상단 툴바 */}
            <div className="flex items-center justify-between bg-white px-8 py-5 rounded-[2.5rem] shadow-sm border border-slate-100 shrink-0">
                <div className="flex items-center gap-6">
                    <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-xl font-black text-slate-900">메뉴판 비주얼 빌더</h1>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">{store?.name}</p>
                    </div>
                </div>

                <div className="flex items-center gap-8">
                    <button
                        onClick={() => window.open(`/menu/${storeId}`, '_blank')}
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-700 text-xs font-black transition-all"
                    >
                        <ExternalLink size={16} /> 실제 메뉴 미리보기
                    </button>

                    <div className="bg-slate-50 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-100">
                        {[
                            { id: 'mobile', icon: Smartphone },
                            { id: 'tablet', icon: Tablet },
                            { id: 'desktop', icon: Monitor },
                        ].map(({ id, icon: Icon }) => (
                            <button key={id} onClick={() => setPreviewMode(id)}
                                className={`p-2 rounded-xl transition-all ${previewMode === id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                <Icon size={18} />
                            </button>
                        ))}
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.button
                            key={saved ? 'saved' : 'save'}
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={handleSave}
                            disabled={saveLoading}
                            className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl font-black text-sm shadow-xl transition-all disabled:opacity-50 active:scale-95 ${saved ? 'bg-green-500 text-white shadow-green-500/20' : 'bg-blue-600 text-white shadow-blue-500/20 hover:bg-blue-700'}`}
                        >
                            {saved ? <Check size={18} /> : <Save size={18} />}
                            {saved ? '저장 완료!' : saveLoading ? '저장 중...' : '디자인 저장'}
                        </motion.button>
                    </AnimatePresence>
                </div>
            </div>

            <div className="flex-1 flex gap-8 min-h-0">
                {/* 좌측 설정 패널 */}
                <aside className="w-96 bg-white rounded-[3rem] shadow-sm border border-slate-100 flex flex-col overflow-hidden shrink-0">
                    <div className="flex border-b border-slate-50">
                        {[
                            { id: 'style', label: '스타일', icon: Palette },
                            { id: 'layout', label: '레이아웃', icon: Layout },
                            { id: 'header', label: '헤더', icon: ImageIcon },
                            { id: 'notice', label: '공지', icon: Bell },
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 py-5 flex flex-col items-center gap-1.5 text-[10px] font-black transition-all border-b-2 ${activeTab === tab.id ? 'text-blue-600 border-blue-600 bg-blue-50/30' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
                                <tab.icon size={16} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* 스타일 탭 */}
                        {activeTab === 'style' && (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">색상 팔레트</label>
                                    <div className="space-y-3">
                                        {colorFields.map(item => (
                                            <div key={item.key} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-black text-slate-700">{item.label}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold">{item.desc}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-mono text-slate-400">{theme[item.key]}</span>
                                                    <div className="relative">
                                                        <input
                                                            type="color"
                                                            value={theme[item.key]}
                                                            onChange={(e) => handleThemeChange(item.key, e.target.value)}
                                                            className="w-10 h-10 rounded-xl cursor-pointer border-0 p-0 bg-transparent"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">폰트 선택</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {fontOptions.map(font => (
                                            <button key={font.value} onClick={() => handleThemeChange('fontFamily', font.value)}
                                                className={`px-5 py-4 rounded-2xl text-left font-bold text-sm transition-all border-2 ${theme.fontFamily === font.value ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-50 hover:border-slate-200 text-slate-500'}`}
                                                style={{ fontFamily: font.value }}>
                                                {font.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* 레이아웃 탭 */}
                        {activeTab === 'layout' && (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">메뉴 레이아웃</label>
                                    <div className="space-y-3">
                                        {layoutOptions.map(option => (
                                            <button key={option.id} onClick={() => handleThemeChange('layoutMode', option.id)}
                                                className={`w-full p-5 rounded-[2rem] text-left transition-all border-2 flex gap-4 ${theme.layoutMode === option.id ? 'border-blue-500 bg-blue-50' : 'border-slate-50 hover:border-slate-200'}`}>
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${theme.layoutMode === option.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                    <option.icon size={22} />
                                                </div>
                                                <div className="flex-1">
                                                    <p className={`font-black text-sm mb-1 ${theme.layoutMode === option.id ? 'text-blue-600' : 'text-slate-700'}`}>{option.label}</p>
                                                    <p className="text-[11px] text-slate-400 font-bold leading-relaxed">{option.desc}</p>
                                                </div>
                                                {theme.layoutMode === option.id && <Check size={18} className="ml-auto text-blue-600 shrink-0 mt-1" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">카드 모서리</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {radiusOptions.map(opt => (
                                            <button key={opt.id} onClick={() => handleThemeChange('cardRadius', opt.id)}
                                                className={`p-3 rounded-xl text-xs font-black transition-all border ${theme.cardRadius === opt.id ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                    <div>
                                        <p className="text-sm font-black text-slate-700">인기/신메뉴 배지</p>
                                        <p className="text-[10px] text-slate-400">상품 카드에 배지 표시</p>
                                    </div>
                                    <button
                                        onClick={() => handleThemeChange('showBadges', !theme.showBadges)}
                                        className={`w-12 h-6 rounded-full transition-all relative ${theme.showBadges ? 'bg-blue-500' : 'bg-slate-300'}`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${theme.showBadges ? 'left-6' : 'left-0.5'}`} />
                                    </button>
                                </div>

                                <div className="p-5 bg-amber-50 rounded-[2rem] border border-amber-100">
                                    <div className="flex gap-3 mb-2">
                                        <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-xs font-black text-amber-700 uppercase">레이아웃 팁</p>
                                    </div>
                                    <p className="text-[11px] text-amber-600/80 font-medium leading-relaxed">매거진 스타일은 고품질 이미지가 등록된 메뉴가 많을 때 가장 돋보입니다.</p>
                                </div>
                            </motion.div>
                        )}

                        {/* 헤더 탭 */}
                        {activeTab === 'header' && (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">로고 텍스트</label>
                                    <input
                                        type="text" value={theme.logoText}
                                        onChange={(e) => handleThemeChange('logoText', e.target.value)}
                                        placeholder={store?.name || '매장 이름'}
                                        className="w-full h-14 px-6 bg-slate-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-900"
                                    />
                                    <p className="text-[10px] text-slate-400 font-bold mt-2">비워두면 매장명이 자동 표시됩니다</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">메인 배너 이미지</label>
                                    <div className="space-y-4">
                                        <div className="aspect-[16/9] bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 relative overflow-hidden group">
                                            {theme.bannerImageUrl ? (
                                                <>
                                                    <img src={theme.bannerImageUrl} className="w-full h-full object-cover" alt="배너" />
                                                    <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                        <label className="px-4 py-2 bg-white text-slate-900 rounded-xl text-[10px] font-black hover:bg-slate-50 cursor-pointer">
                                                            변경
                                                            <input ref={bannerInputRef} type="file" className="hidden" accept="image/*" onChange={handleBannerUpload} />
                                                        </label>
                                                        <button onClick={() => handleThemeChange('bannerImageUrl', '')} className="px-4 py-2 bg-rose-500 text-white rounded-xl text-[10px] font-black">제거</button>
                                                    </div>
                                                </>
                                            ) : (
                                                <label className="flex flex-col items-center gap-3 cursor-pointer w-full h-full justify-center">
                                                    {bannerUploading ? (
                                                        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Upload size={28} className="text-slate-300" />
                                                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">배너 이미지 업로드</span>
                                                            <span className="text-[10px] text-slate-300">또는 URL 입력</span>
                                                        </>
                                                    )}
                                                    <input type="file" className="hidden" accept="image/*" onChange={handleBannerUpload} />
                                                </label>
                                            )}
                                        </div>
                                        <input
                                            type="text" value={theme.bannerImageUrl}
                                            onChange={(e) => handleThemeChange('bannerImageUrl', e.target.value)}
                                            placeholder="또는 이미지 URL을 직접 입력"
                                            className="w-full h-12 px-6 bg-slate-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-xs font-medium text-slate-500"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* 공지 탭 */}
                        {activeTab === 'notice' && (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">공지사항 배너</label>
                                        <button
                                            onClick={() => handleThemeChange('announcementActive', !theme.announcementActive)}
                                            className={`w-12 h-6 rounded-full transition-all relative ${theme.announcementActive ? 'bg-blue-500' : 'bg-slate-300'}`}
                                        >
                                            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${theme.announcementActive ? 'left-6' : 'left-0.5'}`} />
                                        </button>
                                    </div>
                                    <textarea
                                        value={theme.announcement || ''}
                                        onChange={(e) => handleThemeChange('announcement', e.target.value)}
                                        placeholder="예) 매주 월요일은 정기 휴무입니다. 오늘 영업 시간은 11:00~21:00 입니다."
                                        rows={4}
                                        className="w-full p-4 bg-slate-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium text-slate-700 placeholder:text-slate-300 resize-none"
                                    />
                                </div>

                                <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100">
                                    <div className="flex gap-3">
                                        <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-blue-600/80 font-medium leading-relaxed">공지사항은 고객 메뉴판 상단에 노란 배너로 표시됩니다. 영업시간 변경, 이벤트 등 중요 안내에 활용하세요.</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </aside>

                {/* 우측 실시간 미리보기 */}
                <main className="flex-1 bg-slate-100 rounded-[3rem] p-12 flex flex-col items-center overflow-hidden">
                    <div className="flex items-center gap-2 mb-6 text-slate-400">
                        <Sparkles size={16} className="text-blue-400" />
                        <span className="text-xs font-black uppercase tracking-widest">실시간 미리보기</span>
                        <span className="text-[10px] text-slate-300 ml-2">· {previewMode === 'mobile' ? '375px' : previewMode === 'tablet' ? '768px' : '전체'}</span>
                    </div>

                    <div className={`overflow-auto flex justify-center ${previewMode === 'desktop' ? 'w-full h-full' : ''}`}>
                        <motion.div
                            layout
                            className={`shadow-2xl overflow-hidden relative bg-white border-8 border-slate-900 rounded-[3.5rem] ${previewMode === 'mobile' ? 'w-[375px] h-[750px]' : previewMode === 'tablet' ? 'w-[768px] h-[900px]' : 'w-full h-full rounded-[2rem]'}`}
                        >
                            {/* 디바이스 프레임 디테일 */}
                            {previewMode === 'mobile' && (
                                <>
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-8 bg-slate-900 rounded-b-3xl z-30" />
                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1.5 bg-slate-900/15 rounded-full z-30" />
                                </>
                            )}

                            {/* 메뉴판 시뮬레이션 */}
                            <div className="absolute inset-0 overflow-y-auto flex flex-col" style={{ backgroundColor: theme.backgroundColor, fontFamily: theme.fontFamily }}>
                                {/* 공지사항 */}
                                {theme.announcementActive && theme.announcement && (
                                    <div className="px-4 py-2.5 bg-amber-400 flex items-center gap-2">
                                        <Bell size={12} className="text-amber-900 shrink-0" />
                                        <p className="text-[10px] font-bold text-amber-900 line-clamp-1">{theme.announcement}</p>
                                    </div>
                                )}

                                {/* 헤더 */}
                                <div className="p-5 shrink-0 z-10 sticky top-0 backdrop-blur-md border-b border-black/5" style={{ backgroundColor: theme.cardColor + 'CC' }}>
                                    {theme.bannerImageUrl ? null : (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm" style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})` }}>
                                                    {(theme.logoText || store?.name || 'W').charAt(0)}
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-sm" style={{ color: theme.textColor }}>{theme.logoText || store?.name}</h3>
                                                    <p className="text-[10px] opacity-40" style={{ color: theme.textColor }}>메뉴를 선택해주세요</p>
                                                </div>
                                            </div>
                                            <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center">
                                                <Clock size={14} className="text-slate-400" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 배너 이미지 */}
                                {theme.bannerImageUrl && (
                                    <div className="w-full aspect-[21/9] shrink-0 relative overflow-hidden">
                                        <img src={theme.bannerImageUrl} className="w-full h-full object-cover" alt="Banner" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-6">
                                            <div>
                                                <h3 className="font-black text-white text-lg">{theme.logoText || store?.name}</h3>
                                                <p className="text-white/70 text-xs">메뉴를 선택해주세요</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 카테고리 탭 */}
                                <div className="flex overflow-x-auto py-4 px-4 gap-2 scrollbar-hide shrink-0">
                                    <button className="px-4 py-2 rounded-2xl text-[11px] font-black text-white shadow-lg shrink-0" style={{ backgroundColor: theme.primaryColor }}>전체보기</button>
                                    {previewCategories.map(cat => (
                                        <button key={cat.id} className="px-4 py-2 rounded-2xl text-[11px] font-black shadow-sm border border-slate-100 shrink-0" style={{ backgroundColor: theme.cardColor, color: theme.secondaryColor }}>{cat.name}</button>
                                    ))}
                                </div>

                                {/* 상품 목록 */}
                                <div className="p-4 flex-1">
                                    {theme.layoutMode === 'grid' && (
                                        <div className="grid grid-cols-2 gap-3">
                                            {previewProducts.map(product => (
                                                <PreviewCard key={product.id} product={product} theme={theme} cardRadius={cardRadiusValue} mode="grid" />
                                            ))}
                                        </div>
                                    )}
                                    {theme.layoutMode === 'list' && (
                                        <div className="space-y-3">
                                            {previewProducts.map(product => (
                                                <PreviewCard key={product.id} product={product} theme={theme} cardRadius={cardRadiusValue} mode="list" />
                                            ))}
                                        </div>
                                    )}
                                    {theme.layoutMode === 'magazine' && (
                                        <div className="space-y-3">
                                            {previewProducts.map((product, i) => (
                                                <PreviewCard key={product.id} product={product} theme={theme} cardRadius={cardRadiusValue} mode={i === 0 ? 'magazine-hero' : 'magazine'} />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* 플로팅 주문 버튼 */}
                                <div className="sticky bottom-6 mx-4 mt-4 shrink-0">
                                    <div className="h-14 rounded-[2rem] shadow-2xl flex items-center justify-between px-6 text-white" style={{ background: `linear-gradient(135deg, ${theme.secondaryColor}, ${theme.primaryColor})` }}>
                                        <span className="text-sm font-black">장바구니 주문하기</span>
                                        <span className="bg-white/20 px-3 py-1 rounded-full text-[11px] font-bold">3 items</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </main>
            </div>
        </div>
    );
};

const PreviewCard = ({ product, theme, cardRadius, mode }) => {
    const { primaryColor, textColor, cardColor, showBadges } = theme;

    if (mode === 'list') {
        return (
            <div className="flex gap-3 shadow-sm overflow-hidden border border-slate-100" style={{ borderRadius: cardRadius, backgroundColor: cardColor }}>
                <div className="w-24 h-24 bg-slate-100 shrink-0 relative">
                    {product.image_url && <img src={product.image_url} className="w-full h-full object-cover" alt={product.name} />}
                </div>
                <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                    <div>
                        <div className="flex gap-1 mb-1">
                            {showBadges && product.is_popular ? <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ backgroundColor: primaryColor, color: '#fff' }}>인기</span> : null}
                            {showBadges && product.is_new ? <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-500 text-white">NEW</span> : null}
                        </div>
                        <h4 className="font-black text-xs line-clamp-1" style={{ color: textColor }}>{product.name}</h4>
                        <p className="text-[10px] opacity-50 line-clamp-1 mt-0.5" style={{ color: textColor }}>{product.description}</p>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black" style={{ color: primaryColor }}>{formatPrice(product.price)}</span>
                        <button className="px-3 py-1 rounded-xl text-[10px] font-black text-white" style={{ backgroundColor: primaryColor }}>담기</button>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'magazine-hero') {
        return (
            <div className="shadow-sm overflow-hidden" style={{ borderRadius: cardRadius, backgroundColor: cardColor }}>
                <div className="aspect-[16/7] bg-slate-100 relative">
                    {product.image_url && <img src={product.image_url} className="w-full h-full object-cover" alt={product.name} />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4">
                        <div>
                            <div className="flex gap-1 mb-2">
                                {showBadges && product.is_popular ? <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ backgroundColor: primaryColor, color: '#fff' }}>인기</span> : null}
                            </div>
                            <h4 className="font-black text-sm text-white line-clamp-1">{product.name}</h4>
                            <div className="flex items-center justify-between mt-1">
                                <span className="text-xs font-black text-white/90">{formatPrice(product.price)}</span>
                                <button className="px-3 py-1 rounded-xl text-[10px] font-black text-white" style={{ backgroundColor: primaryColor }}>담기</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'magazine') {
        return (
            <div className="flex gap-3 shadow-sm overflow-hidden border border-slate-100" style={{ borderRadius: cardRadius, backgroundColor: cardColor }}>
                <div className="w-20 h-20 bg-slate-100 shrink-0">
                    {product.image_url && <img src={product.image_url} className="w-full h-full object-cover" alt={product.name} />}
                </div>
                <div className="flex-1 p-3 flex flex-col justify-between">
                    <h4 className="font-black text-xs" style={{ color: textColor }}>{product.name}</h4>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black" style={{ color: primaryColor }}>{formatPrice(product.price)}</span>
                        <button className="px-2.5 py-1 rounded-lg text-[10px] font-black text-white" style={{ backgroundColor: primaryColor }}>+</button>
                    </div>
                </div>
            </div>
        );
    }

    // grid mode (default)
    return (
        <div className="shadow-sm overflow-hidden border border-slate-100" style={{ borderRadius: cardRadius, backgroundColor: cardColor }}>
            <div className="aspect-square bg-slate-100 relative">
                {product.image_url && <img src={product.image_url} className="w-full h-full object-cover" alt={product.name} />}
                {showBadges && (product.is_popular || product.is_new) && (
                    <div className="absolute top-2 left-2 flex gap-1">
                        {product.is_popular ? <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ backgroundColor: primaryColor, color: '#fff' }}>인기</span> : null}
                        {product.is_new ? <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-500 text-white">NEW</span> : null}
                    </div>
                )}
            </div>
            <div className="p-3">
                <h4 className="font-black text-xs line-clamp-1 mb-1" style={{ color: textColor }}>{product.name}</h4>
                <div className="flex items-center justify-between">
                    <span className="text-xs font-black" style={{ color: primaryColor }}>{formatPrice(product.price)}</span>
                    <button className="px-2.5 py-1 rounded-xl text-[10px] font-black text-white" style={{ backgroundColor: primaryColor }}>담기</button>
                </div>
            </div>
        </div>
    );
};

export default MenuBuilder;
