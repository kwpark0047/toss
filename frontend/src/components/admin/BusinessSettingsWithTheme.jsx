import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { businessAPI, storeAccountAPI } from '../../api';
import { Palette, Layout, Image, Sliders, FileText, Save, RefreshCw, Check, AlertCircle, Info, CreditCard, Store, Building2, BadgeCheck } from 'lucide-react';
import { toast } from 'react-toastify';

// ── 지원 테마 프리셋 ────────────────────────────────────────────────────────────
const THEME_PRESETS = [
    {
        id: 'classic-blue',
        name: '클래식 블루',
        description: '전문적이고 신뢰할 수 있는 전통적인 스타일',
        colors: {
            primary: '#0EA5E9',
            secondary: '#6366F1',
            background: '#F8FAFC',
            surface: '#FFFFFF',
            text: '#1E293B',
            border: '#E2E8F0'
        },
        font: 'Inter, sans-serif',
        radius: 'rounded-lg'
    },
    {
        id: 'warm-cocoa',
        name: '웜 코코아',
        description: '따뜻하고 아늑한 분위기,카페 컨셉에 적합',
        colors: {
            primary: '#D97706',
            secondary: '#F59E0B',
            background: '#FDFCFB',
            surface: '#FFFFFF',
            text: '#374151',
            border: '#E5E7EB'
        },
        font: 'Noto Sans KR, sans-serif',
        radius: 'rounded-xl'
    },
    {
        id: 'forest-green',
        name: '포레스트 그린',
        description: '신선하고 자연 친화적인 분위기',
        colors: {
            primary: '#10B981',
            secondary: '#059669',
            background: '#F0FDF4',
            surface: '#FFFFFF',
            text: '#14532D',
            border: '#D1FAE5'
        },
        font: 'Pretendard, sans-serif',
        radius: 'rounded-2xl'
    },
    {
        id: 'royal-purple',
        name: '로열 퍼플',
        description: '고급스럽고 세련된 분위기로 고급 레스토랑에 적합',
        colors: {
            primary: '#9333EA',
            secondary: '#7C3AED',
            background: '#FAF5FF',
            surface: '#FFFFFF',
            text: '#581C87',
            border: '#E9D5FF'
        },
        font: 'Noto Sans KR, sans-serif',
        radius: 'rounded-2xl'
    },
    {
        id: 'ocean-breeze',
        name: '오션 브리즈',
        description: '시원하고 깔끔한 바다 분위기',
        colors: {
            primary: '#0F766E',
            secondary: '#14B8A6',
            background: '#F0F9FF',
            surface: '#FFFFFF',
            text: '#134E4A',
            border: '#CCFBF1'
        },
        font: 'Inter, sans-serif',
        radius: 'rounded-lg'
    },
    {
        id: 'sunset-rose',
        name: '선셋 로즈',
        description: '로맨틱하고 감각적인 분위기로 카페에 적합',
        colors: {
            primary: '#EC4899',
            secondary: '#F43F5E',
            background: '#FFF5F7',
            surface: '#FFFFFF',
            text: '#9D174D',
            border: '#FCE7F3'
        },
        font: 'Pretendard, sans-serif',
        radius: 'rounded-xl'
    }
];

// ── UI 크기 설정 ───────────────────────────────────────────────────────────────
const UISOften = () => {
    const [uiSize, setUiSize] = useState('medium');
    const [menuLayout, setMenuLayout] = useState('grid');
    const [imageQuality, setImageQuality] = useState('high');

    return (
        <div className="space-y-6">
            <div className="p-4 bg-purple-50 rounded-xl flex items-start gap-2">
                <Layout size={14} className="text-purple-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-purple-700">
                    UI 요소의 크기와 레이아웃을 설정하여 매장의 시각적 경험을 최적화하세요.
                </p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">UI 크기</label>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { value: 'small', label: '작게', desc: '콤팩트한 인터페이스' },
                            { value: 'medium', label: '보통', desc: '균형 잡힌 크기' },
                            { value: 'large', label: '크게', desc: '넓은 여백' }
                        ].map(option => (
                            <button
                                key={option.value}
                                onClick={() => setUiSize(option.value)}
                                className={`p-3 rounded-xl border-2 text-center transition-all ${uiSize === option.value
                                        ? 'border-purple-500 bg-purple-50'
                                        : 'border-gray-200 hover:border-purple-200'
                                    }`}
                            >
                                <p className="font-bold text-sm">{option.label}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">메뉴 레이아웃</label>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { value: 'grid', label: '그리드', desc: '격자형 배열' },
                            { value: 'list', label: '리스트', desc: '목록형 배열' }
                        ].map(option => (
                            <button
                                key={option.value}
                                onClick={() => setMenuLayout(option.value)}
                                className={`p-3 rounded-xl border-2 text-center transition-all ${menuLayout === option.value
                                        ? 'border-purple-500 bg-purple-50'
                                        : 'border-gray-200 hover:border-purple-200'
                                    }`}
                            >
                                <p className="font-bold text-sm">{option.label}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">이미지 품질</label>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { value: 'low', label: '저품질', desc: '빠른 로딩' },
                            { value: 'medium', label: '보통', desc: '균형 잡힌 품질' },
                            { value: 'high', label: '고품질', desc: '최적 품질' }
                        ].map(option => (
                            <button
                                key={option.value}
                                onClick={() => setImageQuality(option.value)}
                                className={`p-3 rounded-xl border-2 text-center transition-all ${imageQuality === option.value
                                        ? 'border-purple-500 bg-purple-50'
                                        : 'border-gray-200 hover:border-purple-200'
                                    }`}
                            >
                                <p className="font-bold text-sm">{option.label}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl">
                <h5 className="font-bold text-gray-800 mb-2">미리보기</h5>
                <div
                    className={`p-4 bg-white rounded-lg border shadow-sm ${uiSize === 'small' ? 'scale-90' : uiSize === 'large' ? 'scale-110' : 'scale-100'} transition-transform duration-300`}
                    style={{ transition: 'transform 0.3s ease' }}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                            <Store size={14} className="text-white" />
                        </div>
                        <span className="font-bold text-gray-800">매장명</span>
                    </div>
                    <div className={`grid gap-2 ${menuLayout === 'grid' ? 'grid-cols-2' : 'grid-cols-1'}`}>Your store items will appear here with the selected layout and size</div>
                </div>
            </div>
        </div>
    );
};

// ── 메뉴 옵션 템플릿 ─────────────────────────────────────────────────────────────
const MenuOptions = () => {
    const [options, setOptions] = useState({
        showBadge: true,
        badgeTypes: {
            new: { label: 'NEW', color: '#EF4444', show: true },
            popular: { label: '인기', color: '#10B981', show: true },
            special: { label: 'SPECIAL', color: '#8B5CF6', show: false }
        },
        showPriceUnit: '원',
        showRating: true,
        showReviewCount: true,
        priceFormat: 'comma', // comma | dot | space
        showSoldOutBadge: true,
        showLowStockWarning: true,
        minimumOrderAmount: null,
        optionDisplay: 'dropdown' // dropdown | buttons | compact
    });

    const handleOptionChange = (key, value) => {
        setOptions(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="space-y-6">
            <div className="p-4 bg-orange-50 rounded-xl flex items-start gap-2">
                <Sliders size={14} className="text-orange-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-orange-700">
                    메뉴 아이템 표시 방식과 옵션을 관리합니다. 이를 통해 고객에게 보여지는 모습을 조정할 수 있습니다.
                </p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">배지 표시</label>
                    <div className="space-y-2">
                        {Object.entries(options.badgeTypes).map(([type, config]) => (
                            <div key={type} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id={`badge-${type}`}
                                        checked={config.show}
                                        onChange={(e) => handleOptionChange('badgeTypes', {
                                            ...options.badgeTypes,
                                            [type]: { ...config, show: e.target.checked }
                                        })}
                                        className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                                    />
                                    <label htmlFor={`badge-${type}`} className="font-medium text-gray-700"> {config.label} 배지</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-xs"
                                        style={{ backgroundColor: config.color }}
                                    >
                                        {config.label}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">가격 표시</label>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { value: 'comma', label: '쉼표 단위 (1,234원)' },
                            { value: 'dot', label: '마침표 단위 (1.234원)' },
                            { value: 'space', label: '공백 단위 (1 234원)' }
                        ].map(option => (
                            <button
                                key={option.value}
                                onClick={() => handleOptionChange('priceFormat', option.value)}
                                className={`p-3 rounded-xl border-2 text-center transition-all ${options.priceFormat === option.value
                                        ? 'border-orange-500 bg-orange-50'
                                        : 'border-gray-200 hover:border-orange-200'
                                    }`}
                            >
                                <p className="font-bold text-sm">{option.label}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">메뉴 표시 옵션</label>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { key: 'showBadge', label: '신제품 배지', value: options.showBadge, onChange: (v) => handleOptionChange('showBadge', v) },
                            { key: 'showPriceUnit', label: '단위 표시', value: options.showPriceUnit, onChange: (v) => handleOptionChange('showPriceUnit', v) },
                            { key: 'showRating', label: '별점 표시', value: options.showRating, onChange: (v) => handleOptionChange('showRating', v) },
                            { key: 'showReviewCount', label: '리뷰 수 표시', value: options.showReviewCount, onChange: (v) => handleOptionChange('showReviewCount', v) },
                            { key: 'showSoldOutBadge', label: '품절 배지', value: options.showSoldOutBadge, onChange: (v) => handleOptionChange('showSoldOutBadge', v) },
                            { key: 'showLowStockWarning', label: '재고 부족 경고', value: options.showLowStockWarning, onChange: (v) => handleOptionChange('showLowStockWarning', v) }
                        ].map(opt => (
                            <div key={opt.key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                <span className="font-medium text-gray-700">{opt.label}</span>
                                <button
                                    onClick={() => opt.onChange(!opt.value)}
                                    className={`w-10 h-6 rounded-full transition-colors ${opt.value ? 'bg-orange-500' : 'bg-gray-300'} relative`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 left-1 transition-transform ${opt.value ? 'translate-x-4' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── 테마 프리셋 선택 컴포넌트 ─────────────────────────────────────────────────────
const ThemePresetSelector = ({ onSelect, selectedPreset }) => {
    const [selected, setSelected] = useState(selectedPreset);

    const handlePresetSelect = (preset) => {
        setSelected(preset.id);
        onSelect(preset);
    };

    return (
        <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-xl flex items-start gap-2">
                <Palette size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700">
                    매장의 전체 테마를 선택하세요. 메뉴, 결제창, 관리자 화면 등 모든 요소의 색상이 변경됩니다.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {THEME_PRESETS.map(preset => (
                    <button
                        key={preset.id}
                        onClick={() => handlePresetSelect(preset)}
                        className={`p-5 rounded-2xl border-2 transition-all hover:scale-105 ${selected === preset.id
                                ? 'border-blue-500 bg-blue-50 shadow-lg'
                                : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                            }`}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                                style={{ backgroundColor: preset.colors.primary }}
                            >
                                <Palette size={16} />
                            </div>
                            <div className="text-left flex-1">
                                <h4 className="font-bold text-gray-900">{preset.name}</h4>
                                <p className="text-xs text-gray-500 mt-0.5">{preset.description}</p>
                            </div>
                        </div>
                        <div className="flex gap-1.5 mt-3">
                            {['primary', 'secondary', 'background'].map(colorKey => (
                                <div
                                    key={colorKey}
                                    className="w-6 h-6 rounded-full border border-gray-200"
                                    style={{ backgroundColor: preset.colors[colorKey] }}
                                />
                            ))}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default function BusinessSettingsWithTheme() {
    const { storeId } = useParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeSection, setActiveSection] = useState('business');

    // 사업자 정보
    const [bizForm, setBizForm] = useState({
        business_number: '',
        business_name: '',
        ceo_name: '',
        tax_invoice_email: '',
        settlement_cycle: 'MONTHLY',
    });

    // 계좌 정보
    const [accountForm, setAccountForm] = useState({
        bank_code: '',
        bank_name: '',
        account_number: '',
        account_holder: '',
    });

    // 결제수단
    const [enabledMethods, setEnabledMethods] = useState(['cash', 'store_card', 'transfer', 'point']);

    const BANKS = [
        { code: '004', name: '국민은행' }, { code: '088', name: '신한은행' },
        { code: '020', name: '우리은행' }, { code: '081', name: '하나은행' },
        { code: '003', name: '기업은행' }, { code: '011', name: 'NH농협은행' },
        { code: '071', name: '우체국' },   { code: '089', name: '케이뱅크' },
        { code: '090', name: '카카오뱅크' }, { code: '092', name: '토스뱅크' },
        { code: '023', name: 'SC제일은행' }, { code: '027', name: '씨티은행' },
        { code: '035', name: '제주은행' }, { code: '045', name: '새마을금고' },
        { code: '048', name: '신협' },     { code: '050', name: '저축은행' },
    ];

    const toggleMethod = (id) => {
        const method = PAYMENT_METHOD_OPTIONS.find(m => m.id === id);
        if (method?.fixed) return;
        setEnabledMethods(prev =>
            prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
        );
    };

    const saveBusiness = async () => {
        setSaving(true);
        try {
            await businessAPI.update(storeId, { ...bizForm, enabled_payment_methods: enabledMethods });
            toast.success('사업자 정보가 저장되었습니다.');
        } catch (e) {
            toast.error(e?.response?.data?.error || '저장 실패');
        } finally { setSaving(false); }
    };

    // 테마 설정
    const [selectedTheme, setSelectedTheme] = useState(null);
    const [uiSize, setUiSize] = useState('medium');
    const [menuLayout, setMenuLayout] = useState('grid');
    const [imageQuality, setImageQuality] = useState('high');
    const [themePreview, setThemePreview] = useState(false);

    useEffect(() => { fetchData(); }, [storeId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await businessAPI.get(storeId);
            const data = res.data || res;
            setBizForm({
                business_number: data.business_number || '',
                business_name: data.business_name || '',
                ceo_name: data.ceo_name || '',
                tax_invoice_email: data.tax_invoice_email || '',
                settlement_cycle: data.settlement_cycle || 'MONTHLY',
            });
            if (data.store_accounts) {
                setAccountForm({
                    bank_code: data.store_accounts.bank_code || '',
                    bank_name: data.store_accounts.bank_name || '',
                    account_number: data.store_accounts.account_number || '',
                    account_holder: data.store_accounts.account_holder || '',
                });
            }
            if (Array.isArray(data.enabled_payment_methods)) {
                setEnabledMethods(data.enabled_payment_methods);
            }

            if (data.theme_settings) {
                const theme = THEME_PRESETS.find(t => t.id === data.theme_settings.theme_preset);
                setSelectedTheme(theme || null);
            }
        } catch {
            toast.error('설정을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const saveAll = async () => {
        setSaving(true);
        try {
            await businessAPI.update(storeId, {
                ...bizForm,
                enabled_payment_methods: enabledMethods,
                theme_settings: selectedTheme ? {
                    theme_preset: selectedTheme.id,
                    ui_size: uiSize,
                    menu_layout: menuLayout,
                    image_quality: imageQuality,
                    custom_colors: selectedTheme.colors
                } : null
            });
            await storeAccountAPI.update(storeId, accountForm);
            toast.success('모든 설정이 저장되었습니다.');
        } catch (e) {
            toast.error(e?.response?.data?.error || '저장 실패');
        } finally { setSaving(false); }
    };

    const formatBizNumber = (v) => {
        const digits = v.replace(/\D/g, '').slice(0, 10);
        if (digits.length <= 3) return digits;
        if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
        return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    };

    const BANKS = [
        { code: '004', name: '국민은행' }, { code: '088', name: '신한은행' },
        { code: '020', name: '우리은행' }, { code: '081', name: '하나은행' },
        { code: '003', name: '기업은행' }, { code: '011', name: 'NH농협은행' },
        { code: '071', name: '우체국' },   { code: '089', name: '케이뱅크' },
        { code: '090', name: '카카오뱅크' }, { code: '092', name: '토스뱅크' },
        { code: '023', name: 'SC제일은행' }, { code: '027', name: '씨티은행' },
        { code: '035', name: '제주은행' }, { code: '045', name: '새마을금고' },
        { code: '048', name: '신협' },     { code: '050', name: '저축은행' },
    ];

    if (loading) return <div className="p-10 text-center text-gray-400">설정을 불러오는 중...</div>;

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-white">사업자 설정 및 테마 관리</h1>
                <p className="text-sm text-slate-400 mt-1">매장의 기본 설정, 결제수단, 테마 및 UI 요소를 관리합니다.</p>
            </div>

            {/* 사업자 정보 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <SectionHeader
                    id="business"
                    icon={Building2}
                    title="사업자 정보"
                    desc="사업자번호, 상호명, 대표자명, 세금계산서 이메일"
                    active={activeSection}
                    onToggle={setActiveSection}
                />
                {activeSection === 'business' && (
                    <div className="px-5 pb-5 space-y-4 border-t border-gray-50">
                        <div className="mt-4 p-3 bg-blue-50 rounded-xl flex items-start gap-2">
                            <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-blue-700">
                                사업자번호 등록 시 세금계산서 발행이 가능합니다. 수수료에 대한 세금계산서는 플랫폼이 점주에게 발행합니다.
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">사업자등록번호</label>
                            <input
                                type="text"
                                placeholder="000-00-00000"
                                value={bizForm.business_number}
                                onChange={e => setBizForm(f => ({ ...f, business_number: formatBizNumber(e.target.value) }))}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-300 font-mono"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">상호명 (법인명)</label>
                                <input type="text" aria-label="상호명" placeholder="(주)위마켓" value={bizForm.business_name}
                                    onChange={e => setBizForm(f => ({ ...f, business_name: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">대표자명</label>
                                <input type="text" aria-label="대표자명" placeholder="홍길동" value={bizForm.ceo_name}
                                    onChange={e => setBizForm(f => ({ ...f, ceo_name: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">세금계산서 수신 이메일</label>
                            <input type="email" aria-label="세금계산서 수신 이메일" placeholder="billing@example.com" value={bizForm.tax_invoice_email}
                                onChange={e => setBizForm(f => ({ ...f, tax_invoice_email: e.target.value }))}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">정산 주기</label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { value: 'DAILY', label: '일 정산', desc: '매일 자정 정산' },
                                    { value: 'WEEKLY', label: '주 정산', desc: '매주 목요일 정산' },
                                    { value: 'MONTHLY', label: '월 정산', desc: '매월 1일 전월 정산' },
                                    { value: 'MANUAL', label: '수동 정산', desc: '관리자가 직접 생성' },
                                ].map(c => (
                                    <button key={c.value} onClick={() => setBizForm(f => ({ ...f, settlement_cycle: c.value }))}
                                        className={`p-3 rounded-xl border-2 text-left transition-all ${bizForm.settlement_cycle === c.value ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-blue-200'}`}
                                    >
                                        <p className="font-bold text-sm text-gray-900">{c.label}</p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">{c.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 계좌이체 계좌 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <SectionHeader
                    id="account"
                    icon={Building2}
                    title="계좌이체 계좌 등록"
                    desc="고객 송금용 사업자 계좌번호"
                    active={activeSection}
                    onToggle={setActiveSection}
                />
                {activeSection === 'account' && (
                    <div className="px-5 pb-5 space-y-4 border-t border-gray-50">
                        <div className="mt-4 p-3 bg-amber-50 rounded-xl flex items-start gap-2">
                            <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-amber-700">
                                사업자 명의 계좌를 등록하세요. 고객이 계좌이체 선택 시 이 계좌가 표시됩니다.
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">은행 선택</label>
                            <select aria-label="은행 선택" value={accountForm.bank_code}
                                onChange={e => {
                                    const b = BANKS.find(bank => bank.code === e.target.value);
                                    setAccountForm(f => ({ ...f, bank_code: e.target.value, bank_name: b?.name || '' }));
                                }}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                            >
                                <option value="">-- 은행 선택 --</option>
                                {BANKS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">계좌번호</label>
                            <input type="text" aria-label="계좌번호" placeholder="'-' 없이 숫자만 입력" value={accountForm.account_number}
                                onChange={e => setAccountForm(f => ({ ...f, account_number: e.target.value.replace(/\D/g, '') }))}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-300 font-mono" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">예금주명</label>
                            <input type="text" aria-label="예금주명" placeholder="(주)위마켓" value={accountForm.account_holder}
                                onChange={e => setAccountForm(f => ({ ...f, account_holder: e.target.value }))}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                        </div>
                        {accountForm.bank_name && accountForm.account_number && accountForm.account_holder && (
                            <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                                <p className="text-xs text-green-700 font-bold mb-2 flex items-center gap-1">
                                    <Check size={12} /> 등록될 계좌 미리보기
                                </p>
                                <p className="text-sm font-black text-green-900">{accountForm.bank_name}</p>
                                <p className="text-base font-mono font-black text-green-800">{accountForm.account_number}</p>
                                <p className="text-sm text-green-700">{accountForm.account_holder}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 결제수단 활성화 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <SectionHeader
                    id="methods"
                    icon={CreditCard}
                    title="결제수단 활성화"
                    desc="고객에게 제공할 결제수단 선택"
                    active={activeSection}
                    onToggle={setActiveSection}
                />
                {activeSection === 'methods' && (
                    <div className="px-5 pb-5 space-y-3 border-t border-gray-50">
                        <p className="text-xs text-gray-400 mt-4">활성화된 결제수단이 고객 결제 화면에 표시됩니다.</p>
                        {PAYMENT_METHOD_OPTIONS.map(m => {
                            const Icon = m.icon;
                            const isEnabled = enabledMethods.includes(m.id) || m.fixed;
                            return (
                                <div key={m.id}
                                    onClick={() => toggleMethod(m.id)}
                                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all
                                        ${isEnabled ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}
                                        ${m.fixed ? 'opacity-80 cursor-not-allowed' : ''}`}
                                >
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: m.color + '20' }}>
                                        <Icon size={18} style={{ color: m.color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-gray-900">{m.label}</span>
                                            {m.fixed && <span className="text-[10px] text-gray-400">(필수)</span>}
                                            {m.dev && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded font-bold">개발 중</span>}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isEnabled ? 'bg-blue-500' : 'bg-gray-200'}`">
                                        {isEnabled && <Check size={14} className="text-white" />}
                                    </div>
                                </div>
                            );
                        })}
                        <button onClick={saveBusiness} disabled={saving}
                            className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600 disabled:opacity-50 transition-all">
                            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                            결제수단 설정 저장
                        </button>
                    </div>
                )}
            </div>

            {/* 메뉴 옵션 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <SectionHeader
                    id="options"
                    icon={Sliders}
                    title="메뉴 표시 옵션"
                    desc="메뉴 아이템 표시 방식과 배지, 가격 표시 등 고객용 옵션을 설정합니다"
                    active={activeSection}
                    onToggle={setActiveSection}
                />
                {activeSection === 'options' && (
                    <div className="px-5 pb-5 space-y-6 border-t border-gray-50">
                        <MenuOptions />
                    </div>
                )}
            </div>

            {/* 테마 설정 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <SectionHeader
                    id="theme"
                    icon={Palette}
                    title="매장 테마 설정"
                    desc="매장의 전체 테마(색상, UI 크기, 레이아웃)을 관리합니다"
                    active={activeSection}
                    onToggle={setActiveSection}
                />
                {activeSection === 'theme' && (
                    <div className="px-5 pb-5 space-y-6 border-t border-gray-50">
                        <ThemePresetSelector onSelect={setSelectedTheme} selectedPreset={selectedTheme?.id} />
                        <UISOften />
                    </div>
                )}
            </div>

            {/* 메뉴 옵션 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <SectionHeader
                    id="options"
                    icon={Sliders}
                    title="메뉴 표시 옵션"
                    desc="메뉴 아이템 표시 방식과 배지, 가격 표시 등 고객용 옵션을 설정합니다"
                    active={activeSection}
                    onToggle={setActiveSection}
                />
                {activeSection === 'options' && (
                    <div className="px-5 pb-5 space-y-6 border-t border-gray-50">
                        <MenuOptions />
                    </div>
                )}
            </div>

            {/* 미리보기 및 전체 저장 */}
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border border-slate-100 p-6">
                <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                    <BadgeCheck size={18} className="text-blue-500" /> 설정 저장 및 미리보기
                </h3>

                {selectedTheme && (
                    <div className="mb-6 p-4 bg-white rounded-xl border border-blue-100">
                        <div className="flex items-center gap-3 mb-3">
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                                style={{ backgroundColor: selectedTheme.colors.primary }}
                            >
                                <Palette size={20} />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900">{selectedTheme.name} 선택됨</p>
                                <p className="text-sm text-gray-600">UI 크기: {uiSize}, 레이아웃: {menuLayout}, 품질: {imageQuality}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setThemePreview(!themePreview)}
                            className="w-full py-2 px-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-700 font-bold text-sm transition-colors"
                        >
                            {themePreview ? '미리보기 숨기기' : '미리보기 확인'}
                        </button>
                        {themePreview && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="text-xs text-gray-600 space-y-1">
                                    <p><strong>테마:</strong> {selectedTheme.name}</p>
                                    <p><strong>기본 색상:</strong> {selectedTheme.colors.primary}</p>
                                    <p><strong>보조 색상:</strong> {selectedTheme.colors.secondary}</p>
                                    <p><strong>UI 크기:</strong> {uiSize}</p>
                                    <p><strong>메뉴 레이아웃:</strong> {menuLayout}</p>
                                    <p><strong>이미지 품질:</strong> {imageQuality}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <button onClick={saveAll} disabled={saving}
                    className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-lg">
                    {saving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
                    모든 설정 저장 및 적용
                </button>
            </div>
        </div>
    );
}

export default BusinessSettingsWithTheme;
