import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storesAPI, categoriesAPI, productsAPI, uploadsAPI } from '../../api';
import { motion, AnimatePresence } from 'framer-motion';
import { formatPrice } from '../../utils/format';
import Icon from '../../components/ui/Icon';
import { readApiList } from '../../lib/apiList';
import './MenuBuilder.css';

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
    { id: 'grid', label: '그리드', icon: 'Grid', desc: '격자형 배치로 많은 메뉴를 한눈에' },
    { id: 'list', label: '리스트', icon: 'AlignLeft', desc: '이미지와 내용이 나란히, 모바일 최적화' },
    { id: 'magazine', label: '매거진', icon: 'BookOpen', desc: '이미지를 강조한 프리미엄 감성 스타일' }
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
    const [dataError, setDataError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [saveLoading, setSaveLoading] = useState(false);
    const [previewMode, setPreviewMode] = useState('mobile');
    const previewViewportRef = useRef(null);
    const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
    useEffect(() => {
        const viewport = previewViewportRef.current;
        if (!viewport) return;
        const observer = new ResizeObserver(([entry]) => {
            setPreviewSize({ width: entry.contentRect.width, height: entry.contentRect.height });
        });
        observer.observe(viewport);
        return () => observer.disconnect();
    }, [loading]);
    const [activeTab, setActiveTab] = useState('style');
    const [bannerUploading, setBannerUploading] = useState(false);
    const [saved, setSaved] = useState(false);
    const [bannerFailed, setBannerFailed] = useState(false);
    const bannerInputRef = useRef(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setDataError(false);
            try {
                const [s, c, p] = await Promise.all([
                    storesAPI.getById(storeId),
                    categoriesAPI.getByStore(storeId),
                    productsAPI.getByStore(storeId)
                ]);
                const storeData = s.data || s;
                setStore(storeData);
                setCategories(readApiList(c));
                setProducts(readApiList(p));

                const rawTheme = storeData?.theme;
                if (rawTheme) {
                    try {
                        const parsed = typeof rawTheme === 'string' ? JSON.parse(rawTheme) : rawTheme;
                        setTheme(prev => ({ ...prev, ...parsed }));
                    } catch { /* 기존 테마 파싱 실패 시 기본값 사용 */ }
                }
            } catch (err) {
                console.error(err);
                setDataError(true);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [storeId, reloadKey]);

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

    // 배너 URL이 깨졌을 때(404 등) 회색 박스 대신 기본 헤더로 대체
    useEffect(() => { setBannerFailed(false); }, [theme.bannerImageUrl]);

    if (loading) return (
        <div className="tds-stack tds-gap-4 min-h-[60vh] items-center justify-center">
            <div className="w-12 h-12 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin" />
        </div>
    );

    const previewProducts = products.slice(0, theme.layoutMode === 'magazine' ? 4 : 6);
    const previewCategories = categories.slice(0, 4);

    const storeTitle = theme.logoText || store?.name || '매장 이름';
    const showBanner = Boolean(theme.bannerImageUrl) && !bannerFailed;
    const cardRadiusValue = radiusOptions.find(r => r.id === theme.cardRadius)?.css || '1.5rem';
    const frameWidth = previewMode === 'tablet' ? 788 : 395;
    const frameHeight = previewMode === 'tablet' ? 920 : 780;
    const previewScale = previewSize.width && previewSize.height
        ? Math.min(1, previewSize.width / frameWidth, previewSize.height / frameHeight)
        : 1;

    return (
        <div className="menu-builder tds-stack tds-gap-6 w-full min-h-[720px] h-[calc(100vh-140px)]">
            {dataError && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-800">메뉴 데이터를 불러오지 못했습니다.<button type="button" className="ml-3 underline" onClick={() => setReloadKey(key => key + 1)}>다시 조회</button></div>}
            {/* 상단 툴바 */}
            <div className="menu-builder-toolbar tds-stack-h tds-gap-6 items-center justify-between px-6 py-4 bg-white rounded-[2rem] shadow-sm border border-slate-100 shrink-0">
                <div className="menu-builder-title tds-stack-h tds-gap-6 items-center">
                    <button onClick={() => navigate(-1)} className="w-10 h-10 tds-stack items-center justify-center text-slate-400 hover:text-slate-900 transition-all rounded-xl">
                        <Icon icon="ArrowLeft" />
                    </button>
                    <div className="tds-stack tds-gap-1">
                        <h1 className="tds-text-bold text-xl text-slate-900">메뉴판 비주얼 빌더</h1>
                        <p className="tds-small text-slate-400 font-bold uppercase tracking-widest mt-0.5">{store?.name}</p>
                    </div>
                </div>

                <div className="menu-builder-actions tds-stack-h tds-gap-6 items-center">
                    <button
                        onClick={() => window.open(`/menu/${storeId}`, '_blank')}
                        className="tds-stack-h tds-gap-2 items-center whitespace-nowrap text-slate-500 hover:text-slate-800 text-sm font-bold transition-all"
                    >
                        <Icon icon="ExternalLink" /> 실제 메뉴 미리보기
                    </button>

                    <div className="tds-stack-h tds-gap-1 bg-slate-50 p-1.5 rounded-2xl flex items-center border border-slate-100">
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
                            disabled={saveLoading || dataError}
                            className={`tds-stack-h tds-gap-2 items-center whitespace-nowrap px-6 py-3 rounded-2xl font-bold text-sm shadow-xl transition-all disabled:opacity-50 active:scale-95 ${saved ? 'bg-success text-white shadow-success/20' : 'bg-brand-500 text-white shadow-brand-500/20 hover:bg-brand-600'}`}
                        >
                            {saved ? <Icon icon="Check" /> : <Icon icon="Save" />}
                            {saved ? '저장 완료!' : saveLoading ? '저장 중...' : '디자인 저장'}
                        </motion.button>
                    </AnimatePresence>
                </div>
            </div>

            <div className="menu-builder-workspace tds-stack-h tds-gap-8 flex-1 min-h-0">
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
                                            className={`px-5 py-4 rounded-2xl text-left tds-text-bold text-sm transition-all border-2 ${theme.fontFamily === font.value ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-50 hover:border-slate-200 text-slate-500'}`}
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
                                            className={`p-5 rounded-[2rem] text-left transition-all border-2 tds-gap-4 flex ${theme.layoutMode === option.id ? 'border-brand-500 bg-brand-50' : 'border-slate-50 hover:border-slate-200'}`}>
                                            <div className={`w-12 h-12 rounded-2xl tds-stack items-center justify-center shrink-0 ${theme.layoutMode === option.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                <Icon icon={option.icon} size="md" />
                                            </div>
                                            <div className="flex-1">
                                                <p className={`tds-text-bold text-sm mb-1 ${theme.layoutMode === option.id ? 'text-brand-600' : 'text-slate-700'}`}>{option.label}</p>
                                                <p className="tds-small text-slate-400 font-bold leading-relaxed">{option.desc}</p>
                                            </div>
                                            {theme.layoutMode === option.id && <Icon icon="Check" />}
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

                            <div className="p-5 bg-amber-50 rounded-[2rem] border border-amber-100">
                                <div className="tds-stack-h tds-gap-3 mb-2">
                                    <Icon icon="Info" />
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
                                    className="w-full h-14 px-5 bg-slate-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 transition-all tds-text-bold text-slate-900" />
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
                                                    <label className="px-4 py-2 bg-white text-slate-900 rounded-xl tds-small font-black hover:bg-slate-50 cursor-pointer">
                                                        변경
                                                        <input ref={bannerInputRef} type="file" className="hidden" accept="image/*" onChange={handleBannerUpload} />
                                                    </label>
                                                    <button onClick={() => handleThemeChange('bannerImageUrl', '')} className="px-4 py-2 bg-rose-500 text-white rounded-xl tds-small font-black">제거</button>
                                                </div>
                                            </>
                                        ) : (
                                            <label className="tds-stack tds-gap-3 cursor-pointer w-full h-full items-center justify-center">
                                                {bannerUploading ? (
                                                    <div className="w-8 h-8 border-4 border-slate-200 border-t-brand-500 rounded-full animate-spin" />
                                                ) : (
                                                    <>
                                                        <Icon icon="Upload" />
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
                                        className="w-full h-12 px-5 bg-slate-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 transition-all tds-small font-medium text-slate-500" />
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

                            <div className="p-5 bg-brand-50 rounded-2xl border border-brand-100">
                                <div className="tds-stack-h tds-gap-3">
                                    <Icon icon="Info" />
                                    <p className="tds-small text-brand-600/80 font-medium leading-relaxed">공지사항은 고객 메뉴판 상단에 노란 배너로 표시됩니다. 영업시간 변경, 이벤트 등 중요 안내에 활용하세요.</p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </aside>

            {/* 우측 실시간 미리보기 */}
            <main className="flex-1 min-w-0 bg-slate-100 rounded-[3rem] p-6 tds-stack items-center overflow-hidden">
                <div className="tds-stack-h tds-gap-2 items-center mb-4 shrink-0 text-slate-500">
                    <Icon icon="Sparkles" size="sm" />
                    <span className="text-xs font-bold tracking-wide">실시간 미리보기</span>
                    <span className="text-xs text-slate-400">· {previewMode === 'mobile' ? '375px' : previewMode === 'tablet' ? '768px' : '전체'}</span>
                </div>

                <div ref={previewViewportRef} className="menu-preview-scope tds-stack items-center flex-1 min-h-0 min-w-0 w-full overflow-hidden">
                    <div className="relative shrink-0" style={previewMode === 'desktop'
                        ? { width: '100%', height: '100%' }
                        : { width: frameWidth * previewScale, height: frameHeight * previewScale }}>
                    <div
                        style={previewMode === 'desktop' ? undefined : { transform: `scale(${previewScale})`, transformOrigin: 'top left' }}
                        className={`relative shrink-0 overflow-hidden bg-white shadow-2xl ${previewMode === 'mobile'
                            ? 'box-content w-[375px] h-[760px] border-[10px] border-slate-900 rounded-[3rem]'
                            : previewMode === 'tablet'
                                ? 'box-content w-[768px] h-[900px] border-[10px] border-slate-900 rounded-[2rem]'
                                : 'w-full h-full border border-slate-200 rounded-[2rem]'}`}
                    >
                        {/* 디바이스 프레임 디테일 — 노치는 상태바 영역에만 두어 콘텐츠를 가리지 않는다 */}
                        {previewMode === 'mobile' && (
                            <>
                                <div className="absolute top-0 inset-x-0 h-7 z-30" style={{ backgroundColor: theme.cardColor }} />
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-slate-900 rounded-b-2xl z-40" />
                                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 bg-slate-900/20 rounded-full z-40" />
                            </>
                        )}

                        {/* 메뉴판 시뮬레이션 */}
                        <div className={`tds-stack absolute inset-x-0 bottom-0 overflow-y-auto overflow-x-hidden scrollbar-hide ${previewMode === 'mobile' ? 'top-7' : 'top-0'}`} style={{ backgroundColor: theme.backgroundColor, fontFamily: theme.fontFamily }}>
                            {/* 공지사항 */}
                            {theme.announcementActive && theme.announcement && (
                                <div className="tds-stack-h tds-gap-2 items-start px-4 py-2.5 bg-amber-400 text-amber-950 shrink-0">
                                    <Icon icon="Bell" size="sm" />
                                    <p className="text-xs font-semibold leading-[18px] line-clamp-2 break-keep">{theme.announcement}</p>
                                </div>
                            )}

                            {/* 헤더 — 배너가 없거나 배너 이미지를 불러오지 못하면 표시 */}
                            {!showBanner && (
                                <div className="sticky top-0 z-10 shrink-0 px-4 py-3 backdrop-blur-md border-b border-black/5" style={{ backgroundColor: theme.cardColor + 'E6' }}>
                                    <div className="tds-stack-h tds-gap-3 items-center justify-between">
                                        <div className="tds-stack-h tds-gap-3 items-center min-w-0">
                                            <div className="w-9 h-9 shrink-0 rounded-xl tds-stack items-center justify-center font-black text-sm" style={{ color: '#fff', background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})` }}>
                                                {storeTitle.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-[15px] leading-[22px] font-bold truncate" style={{ color: theme.textColor }}>{storeTitle}</h3>
                                                <p className="text-xs leading-4 opacity-60 truncate" style={{ color: theme.textColor }}>메뉴를 선택해주세요</p>
                                            </div>
                                        </div>
                                        <div className="w-9 h-9 shrink-0 bg-black/5 rounded-full tds-stack items-center justify-center" style={{ color: theme.textColor }}>
                                            <Icon icon="Clock" size="sm" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 배너 이미지 */}
                            {showBanner && (
                                <div className="w-full aspect-[16/9] shrink-0 relative overflow-hidden bg-slate-200">
                                    <img src={theme.bannerImageUrl} onError={() => setBannerFailed(true)} className="w-full h-full object-cover" alt="" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-5 py-4 flex items-end">
                                        <div className="min-w-0">
                                            <h3 className="text-lg leading-6 font-bold truncate" style={{ color: '#fff' }}>{storeTitle}</h3>
                                            <p className="text-xs leading-4 mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>메뉴를 선택해주세요</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 카테고리 탭 */}
                            <div className="tds-stack-h tds-gap-2 px-4 py-3 overflow-x-auto scrollbar-hide shrink-0">
                                <span className="px-4 py-2 rounded-full text-[13px] leading-5 font-bold whitespace-nowrap shadow-sm shrink-0" style={{ color: '#fff', backgroundColor: theme.primaryColor }}>전체보기</span>
                                {previewCategories.map(cat => (
                                    <span key={cat.id} className="px-4 py-2 rounded-full text-[13px] leading-5 font-bold whitespace-nowrap border border-black/5 shrink-0" style={{ backgroundColor: theme.cardColor, color: theme.textColor }}>{cat.name}</span>
                                ))}
                            </div>

                            {/* 상품 목록 */}
                            <div className="px-4 pb-4 flex-1">
                                {previewProducts.length === 0 ? (
                                    <p className="py-12 text-center text-sm opacity-50" style={{ color: theme.textColor }}>등록된 메뉴가 없어요</p>
                                ) : theme.layoutMode === 'grid' ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {previewProducts.map(product => (
                                            <PreviewCard key={product.id} product={product} theme={theme} cardRadius={cardRadiusValue} mode="grid" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="tds-stack tds-gap-3">
                                        {previewProducts.map((product, i) => (
                                            <PreviewCard key={product.id} product={product} theme={theme} cardRadius={cardRadiusValue}
                                                mode={theme.layoutMode === 'magazine' ? (i === 0 ? 'magazine-hero' : 'magazine') : 'list'} />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 플로팅 주문 버튼 */}
                            <div className="sticky bottom-4 mx-4 mb-4 shrink-0 z-10">
                                <div className="h-14 rounded-2xl shadow-xl tds-stack-h tds-gap-3 items-center justify-between px-5" style={{ color: '#fff', background: `linear-gradient(135deg, ${theme.secondaryColor}, ${theme.primaryColor})` }}>
                                    <span className="text-[15px] font-bold">장바구니 보기</span>
                                    <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold">3개</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    </div>
                </div>
            </main>
        </div>
    </div>
    );
};

/** 미리보기 썸네일 — 이미지가 없거나 로드에 실패하면 고객 메뉴판과 같은 🍽️ 플레이스홀더 */
const PreviewImage = ({ src, alt, className = '' }) => {
    const [failed, setFailed] = useState(false);
    useEffect(() => { setFailed(false); }, [src]);
    return (
        <div className={`bg-slate-100 overflow-hidden tds-stack items-center justify-center ${className}`}>
            {src && !failed
                ? <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className="w-full h-full object-cover" />
                : <span className="text-2xl" aria-hidden="true">🍽️</span>}
        </div>
    );
};

const Badges = ({ product, show }) => {
    if (!show || !(product.is_popular || product.is_new)) return null;
    return (
        <div className="tds-stack-h tds-gap-1">
            {product.is_popular ? <span className="rounded-md px-1.5 py-0.5 text-[10px] leading-3 font-bold shadow-sm" style={{ color: '#fff', backgroundColor: '#ea580c' }}>인기</span> : null}
            {product.is_new ? <span className="rounded-md px-1.5 py-0.5 text-[10px] leading-3 font-bold shadow-sm" style={{ color: '#fff', backgroundColor: '#1d4ed8' }}>신메뉴</span> : null}
        </div>
    );
};

const PreviewCard = ({ product, theme, cardRadius, mode }) => {
    const { primaryColor, textColor, cardColor, showBadges } = theme;
    const price = <span className="text-[15px] leading-[22px] font-bold tabular-nums truncate" style={{ color: primaryColor }}>{formatPrice(product.price)}</span>;
    const addButton = (label) => (
        <span className="inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-1 rounded-xl px-2.5 text-xs font-bold" style={{ color: '#fff', backgroundColor: primaryColor }}>
            <Icon icon="Plus" size="sm" />{label}
        </span>
    );

    if (mode === 'list' || mode === 'magazine') {
        const thumb = mode === 'list' ? 'w-24 h-24' : 'w-20 h-20';
        return (
            <div className="tds-stack-h shadow-sm overflow-hidden border border-black/5" style={{ borderRadius: cardRadius, backgroundColor: cardColor }}>
                <div className="relative shrink-0">
                    <PreviewImage src={product.image_url} alt={product.name} className={thumb} />
                    <div className="absolute top-1.5 left-1.5"><Badges product={product} show={showBadges} /></div>
                </div>
                <div className="tds-stack flex-1 min-w-0 justify-between gap-1 px-3 py-2.5">
                    <div className="min-w-0">
                        <h4 className="text-[15px] leading-[22px] font-bold truncate" style={{ color: textColor }}>{product.name}</h4>
                        {mode === 'list' && product.description && (
                            <p className="text-xs leading-4 opacity-60 line-clamp-1" style={{ color: textColor }}>{product.description}</p>
                        )}
                    </div>
                    <div className="tds-stack-h tds-gap-2 items-center justify-between">
                        {price}
                        {addButton(mode === 'list' ? '담기' : '')}
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'magazine-hero') {
        return (
            <div className="shadow-sm overflow-hidden relative" style={{ borderRadius: cardRadius, backgroundColor: cardColor }}>
                <PreviewImage src={product.image_url} alt={product.name} className="w-full aspect-[16/9]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent p-4 tds-stack justify-end">
                    <div className="mb-1.5"><Badges product={product} show={showBadges} /></div>
                    <h4 className="text-base leading-6 font-bold truncate" style={{ color: '#fff' }}>{product.name}</h4>
                    <div className="tds-stack-h tds-gap-2 items-center justify-between mt-1">
                        <span className="text-[15px] font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.92)' }}>{formatPrice(product.price)}</span>
                        {addButton('담기')}
                    </div>
                </div>
            </div>
        );
    }

    // grid mode (default) — 고객 메뉴판 그리드 카드(4:3 썸네일, 2줄 메뉴명)와 같은 비율
    return (
        <div className="tds-stack min-w-0 shadow-sm overflow-hidden border border-black/5" style={{ borderRadius: cardRadius, backgroundColor: cardColor }}>
            <div className="relative">
                <PreviewImage src={product.image_url} alt={product.name} className="w-full aspect-[4/3]" />
                <div className="absolute top-1.5 left-1.5"><Badges product={product} show={showBadges} /></div>
            </div>
            <div className="tds-stack flex-1 min-w-0 p-3">
                <h4 className="text-sm leading-5 font-bold line-clamp-2 min-h-10 break-keep" style={{ color: textColor }}>{product.name}</h4>
                {product.description && (
                    <p className="text-xs leading-4 opacity-60 line-clamp-1 mt-0.5" style={{ color: textColor }}>{product.description}</p>
                )}
                <div className="tds-stack-h tds-gap-2 items-center justify-between mt-auto pt-2.5">
                    {price}
                    {addButton('')}
                </div>
            </div>
        </div>
    );
};

export default MenuBuilder;
