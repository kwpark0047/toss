// 매장 테마 프리셋 공용 정의 — 관리자 설정(BusinessSettingsWithTheme)과
// 고객 메뉴판(MenuPage)이 동일한 프리셋을 공유한다.
// TDS 준수: 프리셋은 TDS 시맨틱 토큰(--color-brand-500 등)을 참조하며,
// 라이트/다크 양 테마에서 WCAG AA 대비 만족하도록 설계됨.

export const THEME_PRESETS = [
  {
    id: 'classic-orange',
    name: '클래식 오렌지',
    description: 'WeMarket 브랜드 컬러 — 신뢰·전문·스마트',
    colors: {
      // TDS 시맨틱 토큰 참조 — 런타임에 CSS 변수로 치환됨
      primary: 'var(--color-brand-500)', // #f97316
      secondary: 'var(--color-brand-400)', // #fb923c
      background: 'var(--color-grey-50)', // #f9fafb
      surface: 'var(--color-grey-0)', // #ffffff (white)
      text: 'var(--color-grey-900)', // #191f28
      border: 'var(--color-grey-200)', // #e5e8eb
    },
    font: 'Noto Sans KR, sans-serif',
    radius: 'rounded-lg',
  },
  {
    id: 'warm-cocoa',
    name: '웜 코코아',
    description: '따뜻하고 아늑한 분위기, 카페 컨셉에 적합',
    colors: {
      primary: '#D97706',
      secondary: '#F59E0B',
      background: '#FDFCFB',
      surface: '#FFFFFF',
      text: '#374151',
      border: '#E5E7EB',
    },
    font: 'Noto Sans KR, sans-serif',
    radius: 'rounded-xl',
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
      border: '#D1FAE5',
    },
    font: 'Noto Sans KR, sans-serif',
    radius: 'rounded-2xl',
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
      border: '#E9D5FF',
    },
    font: 'Noto Sans KR, sans-serif',
    radius: 'rounded-2xl',
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
      border: '#CCFBF1',
    },
    font: 'Noto Sans KR, sans-serif',
    radius: 'rounded-lg',
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
      border: '#FCE7F3',
    },
    font: 'Noto Sans KR, sans-serif',
    radius: 'rounded-xl',
  },
];

// TDS 시맨틱 토큰용 화이트 색상 상수
export const TDS_COLOR_WHITE = '#FFFFFF';

// 메뉴 표시 옵션 기본값 — 관리자 설정 폼의 초기값과 동일하게 유지
export const DEFAULT_THEME_SETTINGS = {
  theme_preset: 'classic-orange',
  ui_size: 'medium',
  menu_layout: 'grid',
  image_quality: 'high',
  menu_options: {
    showBadge: true,
    badgeTypes: {
      new: { label: 'NEW', color: 'var(--icon-color-destructive)', show: true },
      popular: { label: '인기', color: 'var(--icon-color-primary)', show: true },
      special: { label: 'SPECIAL', color: 'var(--color-brand-600)', show: false },
    },
    showPriceUnit: '원',
    showRating: true,
    showReviewCount: true,
    priceFormat: 'comma', // comma | dot | space
    showSoldOutBadge: true,
    showLowStockWarning: true,
    minimumOrderAmount: null,
    optionDisplay: 'dropdown', // dropdown | buttons | compact
  },
};

/** theme_settings → 프리셋 객체 (없으면 null) */
export const getThemePreset = (themeSettings) => {
  if (!themeSettings?.theme_preset) return null;
  return THEME_PRESETS.find((preset) => preset.id === themeSettings.theme_preset) || null;
};

/**
 * theme_settings → CSS 변수 스타일 객체.
 * 고객 메뉴판(MenuPage) 루트 요소에 적용하면 프리셋 색상·폰트가 페이지 전체에 반영된다.
 * `--customer-*` 시맨틱 토큰과 `--color-primary` 를 함께 덮어쓴다.
 *
 * 두 가지 포맷을 모두 지원:
 * 1. themePresets 포맷: { theme_preset, custom_colors, ... }
 * 2. MenuBuilder 포맷: { primaryColor, secondaryColor, backgroundColor, textColor, cardColor, fontFamily, ... }
 *
 * TDS 준수: 프리셋의 colors 값이 CSS 변수(var(--color-brand-500) 등)인 경우
 * 그대로 전달하여 런타임에 CSS 변수 해석되도록 함.
 */
export const resolveThemeStyle = (themeSettings) => {
  if (!themeSettings) return {};

  // 1. themePresets 포맷 감지 (theme_preset 또는 custom_colors 존재)
  const isPresetFormat = themeSettings.theme_preset || themeSettings.custom_colors;
  const preset = isPresetFormat ? getThemePreset(themeSettings) : null;

  let c;

  if (isPresetFormat) {
    const customColors = themeSettings.custom_colors;
    c =
      customColors && (customColors.primary || customColors.background)
        ? {
            primary: customColors.primary,
            secondary: customColors.secondary,
            background: customColors.background,
            surface: customColors.surface || customColors.cardColor || TDS_COLOR_WHITE,
            text: customColors.text,
            border: customColors.border || customColors.primary,
          }
        : preset?.colors;
  } else if (themeSettings.primaryColor || themeSettings.backgroundColor) {
    // 2. MenuBuilder 포맷 직접 매핑
    c = {
      primary: themeSettings.primaryColor || 'var(--color-brand-500)',
      secondary: themeSettings.secondaryColor || 'var(--color-brand-400)',
      background: themeSettings.backgroundColor || 'var(--color-grey-50)',
      surface: themeSettings.cardColor || TDS_COLOR_WHITE,
      text: themeSettings.textColor || 'var(--color-grey-900)',
      border:
        themeSettings.secondaryColor || themeSettings.primaryColor || 'var(--color-brand-500)',
    };
  } else {
    // 어떤 포맷도 아니면 빈 객체
    return {};
  }

  if (!c) return {};

  const fontFamily = isPresetFormat
    ? themeSettings.fontFamily || preset?.font || 'inherit'
    : themeSettings.fontFamily || 'Noto Sans KR, sans-serif';

  return {
    '--color-primary': c.primary,
    '--color-secondary': c.secondary,
    '--color-accent': c.secondary,
    '--customer-bg-base': c.background,
    '--customer-bg-card': c.surface,
    '--customer-text-main': c.text,
    '--customer-text-sub': `color-mix(in srgb, ${c.text} 72%, ${c.background})`,
    '--customer-border': c.border,
    '--customer-divider': c.border,
    fontFamily,
    backgroundColor: c.background,
    color: c.text,
  };
};

/**
 * menu_options.priceFormat + showPriceUnit → 가격 문자열.
 * 예: (1200, 'comma', '원') → "1,200원", (1200, 'dot', '원') → "1.200원"
 */
export const formatPriceWithOptions = (price, priceFormat = 'comma', unit = '원') => {
  if (price === undefined || price === null || isNaN(price)) return `0${unit}`;
  const number = Number(price);
  let formatted;
  if (priceFormat === 'space') {
    formatted = String(number).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  } else if (priceFormat === 'dot') {
    formatted = String(number).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  } else {
    formatted = number.toLocaleString('ko-KR');
  }
  return `${formatted}${unit}`;
};
