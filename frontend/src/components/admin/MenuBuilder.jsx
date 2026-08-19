import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { storesAPI, categoriesAPI, productsAPI, uploadsAPI } from '../../api';
import { ArrowLeft, Palette, Layout, Image as ImageIcon, Save, Smartphone, Tablet, Monitor, Sparkles, Check, Info, Upload, ExternalLink, AlignLeft, Grid, BookOpen, Bell, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatPrice } from '../../utils/format';
import Icon from '../ui/Icon';

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
        <div className="tds-stack tds-gap-4 min-h-[60vh] items-center justify-center">
            <div className="w-12 h-12 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin" />
        </div>
    );

    const previewProducts = products.slice(0, theme.layoutMode === 'magazine' ? 4 : 6);
    const previewCategories = categories.slice(0, 4);

    const cardRadiusValue = radiusOptions.find(r => r.id === theme.cardRadius)?.css || '1.5rem';

    return (
        <div className="tds-viewport tds-stack tds-gap-6 h-[calc(100vh-140px)]">
            {/* 상단 툴바 */}
            <div className="tds-stack-h tds-gap-8 items-center justify-between tds-p-8 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 shrink-0">
                <div className="tds-stack-h tds-gap-6 items-center">
                    <button onClick={() => navigate(-1)} className="w-10 h-10 tds-stack items-center justify-center text-slate-400 hover:text-slate-900 transition-all rounded-xl">
                        <Icon icon="ArrowLeft" size="md" />
                    </button>
                    <div className="tds-stack tds-gap-1">
                        <h1 className="tds-text-bold text-xl text-slate-900">메뉴판 비주얼 빌더</h1>
                        <p className="tds-small text-slate-400 font-bold uppercase tracking-widest mt-0.5">{store?.name}</p>
                    </div>
                </div>

                <div className="tds-stack-h tds-gap-8 items-center">
                    <button
                        onClick={() => window.open(`/menu/${storeId}`, '_blank')}
                        className="tds-stack-h tds-gap-2 text-slate-400 hover:text-slate-700 tds-small font-black transition-all"
                    >
                        <Icon icon="ExternalLink" size="sm" /> 실제 메뉴 미리보기
                    </button>

                    <div className="tds-stack-h tds-gap-1 bg-slate-50 tds-p-1.5 rounded-2xl flex items-center border border-slate-100">
                        {[
                            { id: 'mobile', icon: 'Smartphone' },
                            { id: 'tablet', icon: 'Tablet' },
                            { id: 'desktop', icon: 'Monitor' },
                        ].map(({ id, icon }) => (
                            <button key={id} onClick={() => setPreviewMode(id)}
                                className={`tds-p-2 rounded-xl transition-all ${previewMode === id ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                <Icon icon={icon} size="md" />
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
                            className={`tds-stack-h tds-gap-2 tds-p-4 tds-p-8 rounded-2xl tds-text-bold text-sm shadow-xl transition-all disabled:opacity-50 active:scale-95 ${saved ? 'bg-success text-white shadow-success/20' : 'bg-brand-500 text-white shadow-brand-500/20 hover:bg-brand-600'}`}
                        >
                            {saved ? <Icon icon="Check" size="md" /> : <Icon icon="Save" size="md" />}
                            {saved ? '저장 완료!' : saveLoading ? '저장 중...' : '디자인 저장'}
                        </motion.button>
                    </AnimatePresence>
                </div>
            </div>

            <div className="tds-stack-h tds-gap-8 flex-1 min-h-0">
                {/* 좌측 설정 패널 */}
                <aside className="w-96 bg-white rounded-[3rem] shadow-sm border border-slate-100 tds-stack flex-col overflow-hidden shrink-0">
                    <div className="tds-stack-h border-b border-slate-50">
                        {[
                            { id: 'style', label: '스타일', icon: 'Palette' },
                            { id: 'layout', label: '레이아웃', icon: 'Layout' },
                            { id: 'header', label: '헤더', icon: 'Image' },
                            { id: 'notice', label: '공지', icon: 'Bell' },
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`tds-stack tds-gap-1.5 flex-1 py-5 flex-col items-center text-[10px] font-black transition-all border-b-2 ${activeTab === tab.id ? 'text-brand-600 border-brand-600 bg-brand-50/30' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
                                <Icon icon={tab.icon} size="sm" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="tds-stack tds-gap-8 tds-p-6 flex-1 overflow-y-auto">
                        {/* 스타일 탭 */}
                        {activeTab === 'style' && (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="tds-stack tds-gap-8">
                                <div>
                                    <label className="tds-caption text-slate-400 font-black uppercase tracking-widest mb-4 block">색상 팔레트</label>
                                    <div className="tds-stack tds-gap-3">
                                        {colorFields.map(item => (
                                            <div key={item.key} className="tds-p-4 bg-slate-50 rounded-2xl tds-stack-h tds-gap-2 items-center justify-between">
                                                <div>
                                                    <p className="tds-text-bold text-sm text-slate-700">{item.label}</p>
                                                    <p className="tds-caption text-slate-400 font-bold">{item.desc}</p>
                                                </div>
                                                <div className="tds-stack-h tds-gap-2 items-center">
                                                    <span className="tds-small font-mono text-slate-400">{theme[item.key]}</span>
                                                    <div className="relative">
                                                        <input
                                                            type="color"
                                                            value={theme[item.key]}
                                                            onChange={(e) => handleThemeChange(item.key, e.target.value)}
                                                            className="w-10 h-10 rounded-xl cursor-pointer border-0 p-0 bg-transparent" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
</div>
                            </div>

                            <div>
                                <label className="tds-caption text-slate-400 font-black uppercase tracking-widest mb-4 block">폰트 선택</label>
                                <div className="tds-stack tds-gap-2">
                                    {fontOptions.map(font => (
                                        <button key={font.value} onClick={() => handleThemeChange('fontFamily', font.value)}
                                            className={`tds-p-4 tds-p-5 rounded-2xl text-left tds-text-bold text-sm transition-all border-2 ${theme.fontFamily === font.value ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-50 hover:border-slate-200 text-slate-500'}`}
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
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="tds-stack tds-gap-8">
                            <div>
                                <label className="tds-caption text-slate-400 font-black uppercase tracking-widest mb-4 block">메뉴 레이아웃</label>
                                <div className="tds-stack tds-gap-3">
                                    {layoutOptions.map(option => (
                                        <button key={option.id} onClick={() => handleThemeChange('layoutMode', option.id)}
                                            className={`tds-p-5 rounded-[2rem] text-left transition-all border-2 tds-gap-4 flex ${theme.layoutMode === option.id ? 'border-brand-500 bg-brand-50' : 'border-slate-50 hover:border-slate-200'}`}>
                                            <div className={`w-12 h-12 rounded-2xl tds-stack items-center justify-center shrink-0 ${theme.layoutMode === option.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                <Icon icon={option.icon} size="md" />
                                            </div>
                                            <div className="flex-1">
                                                <p className={`tds-text-bold text-sm mb-1 ${theme.layoutMode === option.id ? 'text-brand-600' : 'text-slate-700'}`}>{option.label}</p>
                                                <p className="tds-small text-slate-400 font-bold leading-relaxed">{option.desc}</p>
                                            </div>
                                            {theme.layoutMode === option.id && <Icon icon="Check" size="sm" color="primary" className="ml-auto shrink-0 mt-1" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="tds-caption text-slate-400 font-black uppercase tracking-widest mb-4 block">카드 모서리</label>
                                <div className="tds-stack-h tds-gap-2 grid grid-cols-4">
                                    {radiusOptions.map(opt => (
                                        <button key={opt.id} onClick={() => handleThemeChange('cardRadius', opt.id)}
                                            className={`tds-p-3 rounded-xl tds-small tds-text-bold transition-all border ${theme.cardRadius === opt.id ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="tds-p-4 tds-stack-h tds-gap-4 items-center justify-between bg-slate-50 rounded-2xl">
                                <div>
                                    <p className="tds-text-bold text-sm text-slate-700">인기/신메뉴 배지</p>
                                    <p className="tds-small text-slate-400">상품 카드에 배지 표시</p>
                                </div>
                                <button
                                    onClick={() => handleThemeChange('showBadges', !theme.showBadges)}
                                    className={`w-12 h-6 rounded-full transition-all relative ${theme.showBadges ? 'bg-brand-500' : 'bg-slate-300'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${theme.showBadges ? 'left-6' : 'left-0.5'}`} />
                                </button>
                            </div>

                            <div className="tds-p-5 bg-amber-50 rounded-[2rem] border border-amber-100">
                                <div className="tds-stack-h tds-gap-3 mb-2">
                                    <Icon icon="Info" size="sm" color="warning" className="shrink-0 mt-0.5" />
                                    <p className="tds-caption text-amber-700 font-black uppercase">레이아웃 팁</p>
                                </div>
                                <p className="tds-small text-amber-600/80 font-medium leading-relaxed">매거진 스타일은 고품질 이미지가 등록된 메뉴가 많을 때 가장 돋보입니다.</p>
                            </div>
                        </motion.div>
                    )}

                    {/* 헤더 탭 */}
                    {activeTab === 'header' && (
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="tds-stack tds-gap-8">
                            <div>
                                <label className="tds-caption text-slate-400 font-black uppercase tracking-widest mb-4 block">로고 텍스트</label>
                                <input
                                    type="text" value={theme.logoText}
                                    onChange={(e) => handleThemeChange('logoText', e.target.value)}
                                    placeholder={store?.name || '매장 이름'}
                                    className="w-full h-14 tds-p-6 bg-slate-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 transition-all tds-text-bold text-slate-900" />
                                <p className="tds-small text-slate-400 font-bold mt-2">비워두면 매장명이 자동 표시됩니다</p>
                            </div>

                            <div>
                                <label className="tds-caption text-slate-400 font-black uppercase tracking-widest mb-4 block">메인 배너 이미지</label>
                                <div className="tds-stack tds-gap-4">
                                    <div className="aspect-[16/9] bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 tds-stack tds-gap-3 items-center justify-center text-slate-400 relative overflow-hidden group">
                                        {theme.bannerImageUrl ? (
                                            <>
                                                <img src={theme.bannerImageUrl} className="w-full h-full object-cover" alt="배너" />
                                                <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity tds-stack-h tds-gap-2 items-center justify-center">
                                                    <label className="tds-p-2 tds-p-4 bg-white text-slate-900 rounded-xl tds-small font-black hover:bg-slate-50 cursor-pointer">
                                                        변경
                                                        <input ref={bannerInputRef} type="file" className="hidden" accept="image/*" onChange={handleBannerUpload} />
                                                    </label>
                                                    <button onClick={() => handleThemeChange('bannerImageUrl', '')} className="tds-p-2 tds-p-4 bg-rose-500 text-white rounded-xl tds-small font-black">제거</button>
                                                </div>
                                            </>
                                        ) : (
                                            <label className="tds-stack tds-gap-3 cursor-pointer w-full h-full items-center justify-center">
                                                {bannerUploading ? (
                                                    <div className="w-8 h-8 border-4 border-slate-200 border-t-brand-500 rounded-full animate-spin" />
                                                ) : (
                                                    <>
                                                        <Icon icon="Upload" size="lg" color="muted" />
                                                        <span className="tds-small font-black uppercase tracking-widest text-slate-400">배너 이미지 업로드</span>
                                                        <span className="tds-small text-slate-300">또는 URL 입력</span>
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
                                        className="w-full h-12 tds-p-6 bg-slate-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 transition-all tds-small font-medium text-slate-500" />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* 공지 탭 */}
                    {activeTab === 'notice' && (
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="tds-stack tds-gap-6">
                            <div>
                                <div className="tds-stack-h tds-gap-2 items-center justify-between mb-4">
                                    <label className="tds-caption text-slate-400 font-black uppercase tracking-widest">공지사항 배너</label>
                                    <button
                                        onClick={() => handleThemeChange('announcementActive', !theme.announcementActive)}
                                        className={`w-12 h-6 rounded-full transition-all relative ${theme.announcementActive ? 'bg-brand-500' : 'bg-slate-300'}`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${theme.announcementActive ? 'left-6' : 'left-0.5'}`} />
                                    </button>
                                </div>
                                <textarea
                                    value={theme.announcement || ''}
                                    onChange={(e) => handleThemeChange('announcement', e.target.value)}
                                    placeholder="예) 매주 월요일은 정기 휴무입니다. 오늘 영업 시간은 11:00~21:00 입니다."
                                    rows={4}
                                    className="w-full tds-p-4 bg-slate-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 transition-all text-sm font-medium text-slate-700 placeholder:text-slate-300 resize-none" />
                            </div>

                            <div className="tds-p-5 bg-brand-50 rounded-2xl border border-brand-100">
                                <div className="tds-stack-h tds-gap-3">
                                    <Icon icon="Info" size="sm" color="primary" className="shrink-0 mt-0.5" />
                                    <p className="tds-small text-brand-600/80 font-medium leading-relaxed">공지사항은 고객 메뉴판 상단에 노란 배너로 표시됩니다. 영업시간 변경, 이벤트 등 중요 안내에 활용하세요.</p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </aside>

            {/* 우측 실시간 미리보기 */}
            <main className="flex-1 bg-slate-100 rounded-[3rem] tds-p-12 tds-stack flex-col items-center overflow-hidden">
                <div className="tds-stack-h tds-gap-2 mb-6 text-slate-400">
                    <Icon icon="Sparkles" size="sm" color="primary" />
                    <span className="tds-caption font-black uppercase tracking-widest">실시간 미리보기</span>
                    <span className="tds-small text-slate-300 ml-2">· {previewMode === 'mobile' ? '375px' : previewMode === 'tablet' ? '768px' : '전체'}</span>
                </div>

                <div className={`overflow-auto tds-stack justify-center ${previewMode === 'desktop' ? 'w-full h-full' : ''}`}>
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
                        <div className="tds-stack absolute inset-0 overflow-y-auto" style={{ backgroundColor: theme.backgroundColor, fontFamily: theme.fontFamily }}>
                            {/* 공지사항 */}
                            {theme.announcementActive && theme.announcement && (
                                <div className="tds-stack-h tds-gap-2 tds-p-4 tds-p-2.5 bg-amber-400 items-center">
                                    <Icon icon="Bell" size="sm" color="#78350f" className="shrink-0" />
                                    <p className="tds-small font-bold text-amber-900 line-clamp-1">{theme.announcement}</p>
                                </div>
                            )}

                            {/* 헤더 */}
                            <div className="tds-p-5 shrink-0 z-10 sticky top-0 backdrop-blur-md border-b border-black/5 tds-shrink-0" style={{ backgroundColor: theme.cardColor + 'CC' }}>
                                {theme.bannerImageUrl ? null : (
                                    <div className="tds-stack-h tds-gap-3 items-center justify-between">
                                        <div className="tds-stack-h tds-gap-3 items-center">
                                            <div className="w-9 h-9 rounded-xl tds-stack items-center justify-center text-white font-black text-sm" style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})` }}>
                                                {(theme.logoText || store?.name || 'W').charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="tds-text-bold text-sm" style={{ color: theme.textColor }}>{theme.logoText || store?.name}</h3>
                                                <p className="tds-small opacity-40" style={{ color: theme.textColor }}>메뉴를 선택해주세요</p>
                                            </div>
                                        </div>
                                        <div className="w-9 h-9 bg-slate-100 rounded-full tds-stack items-center justify-center">
                                            <Icon icon="Clock" size="sm" color="muted" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 배너 이미지 */}
                            {theme.bannerImageUrl && (
                                <div className="w-full aspect-[21/9] shrink-0 relative overflow-hidden">
                                    <img src={theme.bannerImageUrl} className="w-full h-full object-cover" alt="Banner" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent tds-p-6 flex items-end">
                                        <div>
                                            <h3 className="tds-text-bold text-lg text-white">{theme.logoText || store?.name}</h3>
                                            <p className="text-white/70 tds-small">메뉴를 선택해주세요</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 카테고리 탭 */}
                            <div className="tds-stack-h tds-gap-2 tds-p-4 py-4 overflow-x-auto scrollbar-hide shrink-0">
                                <button className="tds-p-2 tds-p-4 rounded-2xl tds-small tds-text-bold text-white shadow-lg shrink-0" style={{ backgroundColor: theme.primaryColor }}>전체보기</button>
                                {previewCategories.map(cat => (
                                    <button key={cat.id} className="tds-p-2 tds-p-4 rounded-2xl tds-small tds-text-bold shadow-sm border border-slate-100 shrink-0" style={{ backgroundColor: theme.cardColor, color: theme.secondaryColor }}>{cat.name}</button>
                                ))}
                            </div>

                            {/* 상품 목록 */}
                            <div className="tds-p-4 flex-1">
                                {theme.layoutMode === 'grid' && (
                                    <div className="tds-stack-h tds-gap-3 grid grid-cols-2">
                                        {previewProducts.map(product => (
                                            <PreviewCard key={product.id} product={product} theme={theme} cardRadius={cardRadiusValue} mode="grid" />
                                        ))}
                                    </div>
                                )}
                                {theme.layoutMode === 'list' && (
                                    <div className="tds-stack tds-gap-3">
                                        {previewProducts.map(product => (
                                            <PreviewCard key={product.id} product={product} theme={theme} cardRadius={cardRadiusValue} mode="list" />
                                        ))}
                                    </div>
                                )}
                                {theme.layoutMode === 'magazine' && (
                                    <div className="tds-stack tds-gap-3">
                                        {previewProducts.map((product, i) => (
                                            <PreviewCard key={product.id} product={product} theme={theme} cardRadius={cardRadiusValue} mode={i === 0 ? 'magazine-hero' : 'magazine'} />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 플로팅 주문 버튼 */}
                            <div className="sticky bottom-6 mx-4 mt-4 shrink-0">
                                <div className="h-14 rounded-[2rem] shadow-2xl tds-stack-h tds-gap-4 items-center justify-between tds-p-6 text-white" style={{ background: `linear-gradient(135deg, ${theme.secondaryColor}, ${theme.primaryColor})` }}>
                                    <span className="tds-small tds-text-bold">장바구니 주문하기</span>
                                    <span className="bg-white/20 tds-p-1 tds-p-3 rounded-full tds-small tds-text-bold">3 items</span>
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
            <div className="tds-stack-h tds-gap-3 shadow-sm overflow-hidden border border-slate-100" style={{ borderRadius: cardRadius, backgroundColor: cardColor }}>
                <div className="w-24 h-24 bg-slate-100 shrink-0 relative">
                    {product.image_url && <img src={product.image_url} className="w-full h-full object-cover" alt={product.name} />}
                </div>
                <div className="tds-stack tds-gap-1 tds-p-3 flex-1 flex-col justify-between min-w-0">
                    <div>
                        <div className="tds-stack-h tds-gap-1 mb-1">
                            {showBadges && product.is_popular ? <span className="tds-badge tds-badge-popular">인기</span> : null}
                            {showBadges && product.is_new ? <span className="tds-badge tds-badge-new">NEW</span> : null}
                        </div>
                        <h4 className="tds-text-bold tds-small line-clamp-1" style={{ color: textColor }}>{product.name}</h4>
                        <p className="tds-small opacity-50 line-clamp-1 mt-0.5" style={{ color: textColor }}>{product.description}</p>
                    </div>
                    <div className="tds-stack-h tds-gap-2 items-center justify-between">
                        <span className="tds-small tds-text-bold" style={{ color: primaryColor }}>{formatPrice(product.price)}</span>
                        <button className="tds-p-1 tds-p-3 rounded-xl tds-small tds-text-bold text-white" style={{ backgroundColor: primaryColor }}>담기</button>
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent tds-p-4 tds-stack items-end">
                        <div>
                            <div className="tds-stack-h tds-gap-1 mb-2">
                                {showBadges && product.is_popular ? <span className="tds-badge tds-badge-popular">인기</span> : null}
                            </div>
                            <h4 className="tds-text-bold text-sm text-white line-clamp-1">{product.name}</h4>
                            <div className="tds-stack-h tds-gap-2 items-center justify-between mt-1">
                                <span className="tds-small tds-text-bold text-white/90">{formatPrice(product.price)}</span>
                                <button className="tds-p-1 tds-p-3 rounded-xl tds-small tds-text-bold text-white" style={{ backgroundColor: primaryColor }}>담기</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'magazine') {
        return (
            <div className="tds-stack-h tds-gap-3 shadow-sm overflow-hidden border border-slate-100" style={{ borderRadius: cardRadius, backgroundColor: cardColor }}>
                <div className="w-20 h-20 bg-slate-100 shrink-0">
                    {product.image_url && <img src={product.image_url} className="w-full h-full object-cover" alt={product.name} />}
                </div>
                <div className="tds-p-3 flex-1 tds-stack flex-col justify-between">
                    <h4 className="tds-text-bold tds-small" style={{ color: textColor }}>{product.name}</h4>
                    <div className="tds-stack-h tds-gap-2 items-center justify-between">
                        <span className="tds-small tds-text-bold" style={{ color: primaryColor }}>{formatPrice(product.price)}</span>
                        <button className="tds-p-1 tds-p-2.5 rounded-lg tds-small tds-text-bold text-white" style={{ backgroundColor: primaryColor }}>+</button>
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
                    <div className="absolute top-2 left-2 tds-stack-h tds-gap-1">
                        {product.is_popular ? <span className="tds-badge tds-badge-popular">인기</span> : null}
                        {product.is_new ? <span className="tds-badge tds-badge-new">NEW</span> : null}
                    </div>
                )}
            </div>
            <div className="tds-p-3">
                <h4 className="tds-text-bold tds-small line-clamp-1 mb-1" style={{ color: textColor }}>{product.name}</h4>
                <div className="tds-stack-h tds-gap-2 items-center justify-between">
                    <span className="tds-small tds-text-bold" style={{ color: primaryColor }}>{formatPrice(product.price)}</span>
                    <button className="tds-p-1 tds-p-2.5 rounded-xl tds-small tds-text-bold text-white" style={{ backgroundColor: primaryColor }}>담기</button>
                </div>
            </div>
        </div>
    );
};

export default MenuBuilder;