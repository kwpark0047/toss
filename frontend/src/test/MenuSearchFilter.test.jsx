import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MenuSearchFilter from '@/components/menu/MenuSearchFilter';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));

describe('MenuSearchFilter', () => {
  it('hides allergen chips when the store registered none', () => {
    render(<MenuSearchFilter query="" onQueryChange={vi.fn()} allergens={[]} onToggleAllergen={vi.fn()} />);
    expect(screen.queryByText('menu.allergen_filter_label')).toBeNull();
  });

  it('reports query changes and clears the query', () => {
    const onQueryChange = vi.fn();
    render(<MenuSearchFilter query="파스" onQueryChange={onQueryChange} onToggleAllergen={vi.fn()} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '파스타' } });
    expect(onQueryChange).toHaveBeenLastCalledWith('파스타');
    fireEvent.click(screen.getByRole('button', { name: 'menu.search_clear' }));
    expect(onQueryChange).toHaveBeenLastCalledWith('');
  });

  it('toggles allergen chips and shows the disclaimer when one is excluded', () => {
    const onToggleAllergen = vi.fn();
    render(
      <MenuSearchFilter query="" onQueryChange={vi.fn()} allergens={['우유', '밀']} excludedAllergens={['우유']} onToggleAllergen={onToggleAllergen} />
    );
    expect(screen.getByRole('button', { name: '우유' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '밀' }));
    expect(onToggleAllergen).toHaveBeenCalledWith('밀');
    expect(screen.getByText('menu.allergen_disclaimer')).toBeInTheDocument();
  });
});
