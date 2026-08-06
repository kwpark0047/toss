// 매장 테마 프리셋 공용 정의 — 관리자 설정(BusinessSettingsWithTheme)과
// 고객 메뉴판(MenuPage)이 동일한 프리셋을 공유한다.

export const THEME_PRESETS = [
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
      border: '#E2E8F0',
    },
    font: 'Inter, sans-serif',
    radius: 'rounded-lg',
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
    font: 'Pretendard, sans-serif',
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
    font: 'Inter, sans-serif',
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
    font: 'Pretendard, sans-serif',
    radius: 'rounded-xl',
  },
];

// 메뉴 표시 옵션 기본값 — 관리자 설정 폼의 초기값과 동일하게 유지
export const DEFAULT_THEME_SETTINGS = {
  theme_preset: 'classic-blue',
  ui_size: 'medium',
  menu_layout: 'grid',
  image_quality: 'high',
  menu_options: {
    showBadge: true,
    badgeTypes: {
      new: { label: 'NEW', color: '#EF4444', show: true },
      popular: { label: '인기', color: '#10B981', show: true },
      special: { label: 'SPECIAL', color: '#8B5CF6', show: false },
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
 */
export const resolveThemeStyle = (themeSettings) => {
  if (!themeSettings) return {};
  const preset = getThemePreset(themeSettings);
  // 저장 시점의 custom_colors(프리셋 선택 결과)를 우선 사용 — 이후 프리셋이 바뀌어도 유지
  const customColors = themeSettings.custom_colors;
  const c =
    customColors && (customColors.primary || customColors.background)
      ? {
          primary: customColors.primary,
          secondary: customColors.secondary,
          background: customColors.background,
          surface: customColors.surface || customColors.cardColor || '#FFFFFF',
          text: customColors.text,
          border: customColors.border || customColors.primary,
        }
      : preset?.colors;
  if (!c) return {};

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
    fontFamily: preset?.font || 'inherit',
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
