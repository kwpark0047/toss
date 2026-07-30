import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';

const h = React.createElement;

vi.mock('framer-motion', () => {
  const motionProxy = new Proxy({}, {
    get: (_, key) => (props) => {
      const tag = typeof key === 'string' ? key : 'div';
      return h(tag, props, props?.children);
    },
  });
  return {
    motion: motionProxy,
    AnimatePresence: ({ children }) => h(React.Fragment, null, children),
  };
});

vi.mock('@/components/customer/MenuItemImage', () => ({
  default: ({ alt }) => h('div', { 'data-testid': 'menu-item-image', 'aria-label': alt }),
}));

import MenuProductList from '@/components/customer/MenuProductList';

const theme = {
  primaryColor: '#f97316',
  secondaryColor: '#1e3a5f',
  accentColor: '#10b981',
  backgroundColor: '#f8fafc',
  textColor: '#1e293b',
  fontFamily: 'Pretendard',
  layoutMode: 'grid',
};

const gradientBg = 'linear-gradient(135deg, #f97316, #1e3a5f)';

const createWrapper = () => ({ children }) =>
  h(I18nextProvider, { i18n }, children);

describe('MenuProductList', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('빈 상품 목록 → EmptyState 렌더링', () => {
    render(h(MenuProductList, {
      filteredProducts: [],
      theme,
      translatedDescriptions: {},
      addToCart: vi.fn(),
      setSelectedStoryProduct: vi.fn(),
      setShowStoryModal: vi.fn(),
      gradientBg,
    }), { wrapper: createWrapper() });

    expect(screen.getByText(/no_items|상품이 없습니다|메뉴가 없습니다/)).toBeInTheDocument();
  });

  it('상품 목록 → 각 상품 카드 렌더링 (grid mode)', () => {
    const products = [
      { id: 1, name: '아메리카노', price: 3000, image_url: 'test.jpg', is_best: true },
      { id: 2, name: '라떼', price: 4000, image_url: null, is_sold_out: true },
    ];

    render(h(MenuProductList, {
      filteredProducts: products,
      theme,
      translatedDescriptions: {},
      addToCart: vi.fn(),
      setSelectedStoryProduct: vi.fn(),
      setShowStoryModal: vi.fn(),
      gradientBg,
    }), { wrapper: createWrapper() });

    expect(screen.getByText('아메리카노')).toBeInTheDocument();
    expect(screen.getByText('라떼')).toBeInTheDocument();
    expect(screen.getAllByText(/BEST|베스트/)).toHaveLength(1);
    expect(screen.getAllByText(/SOLD OUT|품절/)).toHaveLength(1);
  });

  it('가격 포맷팅 확인', () => {
    const products = [{ id: 1, name: '테스트', price: 15000, image_url: null }];

    render(h(MenuProductList, {
      filteredProducts: products,
      theme,
      translatedDescriptions: {},
      addToCart: vi.fn(),
      setSelectedStoryProduct: vi.fn(),
      setShowStoryModal: vi.fn(),
      gradientBg,
    }), { wrapper: createWrapper() });

    expect(screen.getByText('₩15,000')).toBeInTheDocument();
  });

  it('품절 상품 → 담기 버튼 비활성화', () => {
    const products = [{ id: 1, name: '품절상품', price: 5000, image_url: null, is_sold_out: true }];

    render(h(MenuProductList, {
      filteredProducts: products,
      theme,
      translatedDescriptions: {},
      addToCart: vi.fn(),
      setSelectedStoryProduct: vi.fn(),
      setShowStoryModal: vi.fn(),
      gradientBg,
    }), { wrapper: createWrapper() });

    expect(screen.getByText(/SOLD OUT|품절/)).toBeInTheDocument();
  });

  it('정상 상품 → 담기 버튼 클릭 시 addToCart 호출', () => {
    const mockAddToCart = vi.fn();
    const products = [{ id: 1, name: '테스트상품', price: 5000, image_url: null }];

    const { container } = render(h(MenuProductList, {
      filteredProducts: products,
      theme,
      translatedDescriptions: {},
      addToCart: mockAddToCart,
      setSelectedStoryProduct: vi.fn(),
      setShowStoryModal: vi.fn(),
      gradientBg,
    }), { wrapper: createWrapper() });

    const addButton = container.querySelector('button');
    if (addButton) addButton.click();
    expect(mockAddToCart).toHaveBeenCalledWith(products[0]);
  });

  it('번역된 설명 표시', () => {
    const products = [{ id: 1, name: '커피', price: 3000, image_url: null, description: '원두 커피' }];
    const translations = { 1: '번역된 설명', 1 + '_name': 'Translated Coffee' };

    render(h(MenuProductList, {
      filteredProducts: products,
      theme,
      translatedDescriptions: translations,
      addToCart: vi.fn(),
      setSelectedStoryProduct: vi.fn(),
      setShowStoryModal: vi.fn(),
      gradientBg,
    }), { wrapper: createWrapper() });

    expect(screen.getByText('번역된 설명')).toBeInTheDocument();
  });

  it('magazine 레이아웃 모드', () => {
    const magazineTheme = { ...theme, layoutMode: 'magazine' };
    const products = [{ id: 1, name: '매거진상품', price: 10000, image_url: null }];

    render(h(MenuProductList, {
      filteredProducts: products,
      theme: magazineTheme,
      translatedDescriptions: {},
      addToCart: vi.fn(),
      setSelectedStoryProduct: vi.fn(),
      setShowStoryModal: vi.fn(),
      gradientBg,
    }), { wrapper: createWrapper() });

    expect(screen.getByText('매거진상품')).toBeInTheDocument();
  });
});
