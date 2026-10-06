import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MenuHeader from '../components/menu/MenuHeader';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: key => key }) }));
vi.mock('../components/common/LanguageSwitcher', () => ({ default: () => null }));

describe('customer menu header', () => {
  it('renders loaded store data and toggles the header without undefined hooks or motion methods', () => {
    const onHeight = vi.fn();
    const view = render(<MemoryRouter><MenuHeader storeName="검증 매장" tableNumber="창가 1" onHeaderHeightChange={onHeight} /></MemoryRouter>);
    expect(screen.getByText('검증 매장')).toBeTruthy();
    expect(onHeight).toHaveBeenCalledWith(70);
    view.rerender(<MemoryRouter><MenuHeader storeName="검증 매장" tableNumber="창가 1" showHeader={false} onHeaderHeightChange={onHeight} /></MemoryRouter>);
    expect(onHeight).toHaveBeenCalledWith(0);
  });
});
