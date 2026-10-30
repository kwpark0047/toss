import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MenuItemCard from '@/components/menu/MenuItemCard';

vi.mock('framer-motion', () => ({ motion: { div: ({ children, ...props }) => <div {...props}>{children}</div> } }));
vi.mock('@/components/common/LazyImage', () => ({ default: () => <div aria-hidden="true" /> }));

describe('MenuItemCard customer information', () => {
  it('shows store-provided allergen information before the customer adds an item', () => {
    render(<MenuItemCard item={{ id: 1, name: '라떼', price: 4500, allergens: '["우유", "대두"]' }} onAddToCart={vi.fn()} />);
    expect(screen.getByLabelText('알레르기 유발 정보: 우유, 대두')).toHaveTextContent('알레르기 정보 · 우유 · 대두');
  });

  it('does not show an empty allergen label when the store has no information', () => {
    render(<MenuItemCard item={{ id: 2, name: '아메리카노', price: 3000 }} onAddToCart={vi.fn()} />);
    expect(screen.queryByText(/알레르기 정보/)).not.toBeInTheDocument();
  });
});
