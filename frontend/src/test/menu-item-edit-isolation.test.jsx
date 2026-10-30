import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { MenuItemList } from '../components/admin/menu/MenuItemList';

const CurrentPath = () => <output data-testid="current-path">{useLocation().pathname}</output>;

describe('메뉴 항목 편집 동작', () => {
  it('편집은 메뉴 편집 모달을 열고 테마 설정 경로로 이동하지 않는다', () => {
    const product = { id: 4, name: '라면', category_id: 2, price: 8000, is_sold_out: false };
    const setEditingProduct = vi.fn();
    const setShowProductModal = vi.fn();

    render(
      <MemoryRouter initialEntries={['/admin/stores/3/menu']}>
        <MenuItemList
          products={[product]}
          categories={[{ id: 2, name: '식사' }]}
          selectedCategory={null}
          setSelectedCategory={vi.fn()}
          searchTerm=""
          setSearchTerm={vi.fn()}
          statusFilter="all"
          setStatusFilter={vi.fn()}
          selectedProducts={[]}
          filteredProducts={[product]}
          clearSelection={vi.fn()}
          onAdd={vi.fn()}
          loading={false}
          handleSelectAll={vi.fn()}
          handleSelectProduct={vi.fn()}
          handleBulkStatusUpdate={vi.fn()}
          handleBulkDelete={vi.fn()}
          setEditingProduct={setEditingProduct}
          setShowProductModal={setShowProductModal}
          handleDeleteProduct={vi.fn()}
        />
        <CurrentPath />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '라면 편집' }));

    expect(setEditingProduct).toHaveBeenCalledWith(product);
    expect(setShowProductModal).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('current-path').textContent).toBe('/admin/stores/3/menu');
  });
});
