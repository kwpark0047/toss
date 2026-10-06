import { Search, X, Edit, Trash2, ImageIcon, ShoppingBag } from 'lucide-react';
import { formatPrice } from '../../../utils/format';

export const MenuItemList = ({ products, categories, selectedCategory, setSelectedCategory, searchTerm, setSearchTerm, statusFilter, setStatusFilter, selectedProducts, filteredProducts, clearSelection, onAdd, loading, handleSelectAll, handleSelectProduct, handleBulkStatusUpdate, handleBulkDelete, setEditingProduct, setShowProductModal, handleDeleteProduct }) => {
  const allSelected = filteredProducts.length > 0 && filteredProducts.every(p => selectedProducts.includes(p.id));
  const edit = product => { setEditingProduct(product); setShowProductModal(true); };
  return <section className="min-w-0 space-y-3" aria-label="메뉴 목록 관리">
    <div className="menu-panel rounded-xl p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input aria-label="메뉴 검색" type="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="메뉴 이름·설명 검색" className="menu-field w-full h-11 pl-10 pr-3 rounded-lg" />
        </div>
        <select aria-label="카테고리 필터" value={selectedCategory ?? ''} onChange={e => setSelectedCategory(e.target.value ? Number(e.target.value) : null)} className="menu-field h-11 rounded-lg px-3 lg:hidden"><option value="">전체 카테고리</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select aria-label="판매 상태 필터" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="menu-field h-11 rounded-lg px-3"><option value="all">모든 상태</option><option value="available">판매 중</option><option value="sold-out">품절</option></select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
        <span role="status">검색 결과 <strong className="text-white tabular-nums">{filteredProducts.length}</strong>개 / 전체 {products.length}개</span>
        {(searchTerm || selectedCategory || statusFilter !== 'all') && <button type="button" className="menu-quiet inline-flex items-center gap-1 px-2 py-1 rounded" onClick={() => { setSearchTerm(''); setSelectedCategory(null); setStatusFilter('all'); }}><X size={14} />필터 초기화</button>}
      </div>
    </div>
    {selectedProducts.length > 0 && <div className="menu-selection flex flex-wrap items-center gap-2 rounded-xl p-3" role="region" aria-label="선택 메뉴 일괄 작업">
      <strong className="mr-auto tabular-nums">{selectedProducts.length}개 선택</strong>
      <button type="button" disabled={loading} className="menu-quiet rounded-lg px-3 py-2" onClick={() => handleBulkStatusUpdate(true)}>품절 처리</button>
      <button type="button" disabled={loading} className="menu-quiet rounded-lg px-3 py-2" onClick={() => handleBulkStatusUpdate(false)}>판매 재개</button>
      <button type="button" disabled={loading} className="menu-quiet text-rose-400 rounded-lg px-3 py-2" onClick={handleBulkDelete}>선택 삭제</button>
      <button type="button" onClick={clearSelection} aria-label="선택 해제" className="menu-quiet rounded-lg p-2"><X size={16} /></button>
    </div>}
    <div className="menu-panel overflow-hidden rounded-xl" aria-busy={loading}>
      <div className="menu-list-heading flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <input type="checkbox" aria-label="검색 결과 전체 선택" checked={allSelected} disabled={filteredProducts.length === 0 || loading} onChange={handleSelectAll} className="h-5 w-5 accent-orange-500" />
        <h2 className="font-semibold text-white">{categories.find(c => c.id === selectedCategory)?.name || '전체 메뉴'}</h2><span className="ml-auto text-xs text-slate-400">편집 버튼으로 상세 설정</span>
      </div>
      {filteredProducts.length === 0 ? <div className="p-8 text-center space-y-3">
        <ShoppingBag size={28} className="mx-auto text-slate-400" />
        <h3 className="font-semibold text-white">{products.length === 0 ? '첫 메뉴를 등록해 주세요' : '조건에 맞는 메뉴가 없습니다'}</h3>
        <p className="text-sm text-slate-400">{products.length === 0 ? '이름과 가격부터 등록하고 사진·옵션은 나중에 추가할 수 있어요.' : '검색어나 카테고리, 판매 상태를 변경해 보세요.'}</p>
        {products.length === 0 && <button type="button" onClick={onAdd} className="menu-primary px-4 py-3 rounded-lg">첫 메뉴 추가</button>}
      </div> : <div className="divide-y divide-white/10">{filteredProducts.map(product => <article key={product.id} className={'menu-product-row p-3 sm:p-4 grid grid-cols-[20px_56px_minmax(0,1fr)] sm:grid-cols-[20px_64px_minmax(0,1fr)_auto] items-center gap-3 '+(selectedProducts.includes(product.id) ? 'menu-selected' : '')}>
        <input type="checkbox" aria-label={product.name+' 선택'} checked={selectedProducts.includes(product.id)} disabled={loading} onChange={() => handleSelectProduct(product.id)} className="h-5 w-5 accent-orange-500" />
        <button type="button" onClick={() => edit(product)} aria-label={product.name+' 편집'} className="menu-image h-14 w-14 sm:h-16 sm:w-16 overflow-hidden rounded-lg grid place-items-center">{product.image_url ? <img src={product.image_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : <ImageIcon size={22} className="text-slate-500" />}</button>
        <div className="min-w-0"><button type="button" onClick={() => edit(product)} className="block w-full text-left font-semibold text-white truncate">{product.name}</button><p className="text-sm text-slate-400 truncate">{categories.find(c => c.id === product.category_id)?.name || '미분류'}{product.description ? ' · '+product.description : ''}</p><div className="flex items-center gap-3 mt-1"><span className="font-semibold tabular-nums text-white">{formatPrice(product.price)}</span><span className={'text-xs '+(product.is_sold_out ? 'text-amber-500' : 'text-emerald-500')}>{product.is_sold_out ? '품절' : '판매 중'}</span>{product.stock_quantity != null && <span className="text-xs text-slate-400 tabular-nums">재고 {product.stock_quantity}</span>}</div></div>
        <div className="col-start-2 col-span-2 sm:col-auto flex flex-wrap items-center justify-end gap-1"><button type="button" disabled={loading} onClick={() => edit(product)} className="menu-quiet inline-flex items-center gap-1 px-3 py-2 rounded-lg"><Edit size={15} />편집</button><button type="button" disabled={loading} aria-label={product.name+' 삭제'} onClick={() => handleDeleteProduct(product.id)} className="menu-quiet p-3 rounded-lg text-rose-400"><Trash2 size={16} /></button></div>
      </article>)}</div>}
    </div>
  </section>;
};
