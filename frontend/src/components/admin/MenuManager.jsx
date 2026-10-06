import './menu/menuWorkspace.css';
import { useParams, useNavigate } from 'react-router-dom';
import { useMenuManager } from '../../hooks/useMenuManager';

import { lazy, Suspense } from 'react';
import { useSEO } from '../../lib/useSEO';
import Skeleton from '../common/Skeleton';
import { CategoryModal } from './CategoryModal';
import { CategoryList } from './menu/CategoryList';
import { MenuItemList } from './menu/MenuItemList';
import { ArrowLeft, Folders, Plus, Sparkles, Store, RefreshCw } from 'lucide-react';

const BulkMenuModal = lazy(() => import('./BulkMenuModal'));
const MenuScanModal = lazy(() => import('./MenuScanModal'));
const MenuWizard = lazy(() => import('./MenuWizard'));
const OptionTemplateModal = lazy(() => import('./OptionTemplateModal'));
const ProductModal = lazy(() => import('./ProductModal').then(module => ({ default: module.ProductModal })));

const MenuManager = () => {
    useSEO({ title: '메뉴 관리 | 위마켓', description: '매장 메뉴를 관리합니다.' });
    const { storeId } = useParams();
  const navigate = useNavigate();

  const {
    store,
    categories,
    products,
    loading,
    dataError,
    statusFilter,
    setStatusFilter,
    setSelectedProducts,
    selectedCategory,
    setSelectedCategory,
    showCategoryModal,
    setShowCategoryModal,
    editingCategory,
    setEditingCategory,
    showProductModal,
    setShowProductModal,
    editingProduct,
    setEditingProduct,
    showBulkModal,
    setShowBulkModal,
    showScanModal,
    setShowScanModal,
    showWizard,
    setShowWizard,
    showOptionTemplateModal,
    setShowOptionTemplateModal,
    searchTerm,
    setSearchTerm,
    selectedProducts,
    filteredProducts,
    fetchData,
    handleSelectAll,
    handleSelectProduct,
    handleBulkStatusUpdate,
    handleBulkDelete,
    handleDeleteCategory,
    handleDeleteProduct,
    handleCatDragStart,
    handleCatDragOver,
    handleCatDrop,
    importFromStore
  } = useMenuManager(storeId);

  if (loading && products.length === 0) return (
    <div className="max-w-[1600px] mx-auto p-2 space-y-3">
      <Skeleton dark className="h-11 rounded-xl" />
      {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} dark className="h-24 rounded-2xl" />)}
    </div>
  );

  return (
    <div className="menu-workspace min-w-0 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" aria-label="대시보드로 돌아가기" onClick={() => navigate('/admin')} className="menu-quiet grid h-11 w-11 place-items-center rounded-xl"><ArrowLeft size={18} /></button>
          <div><h1 className="text-xl font-bold text-white">메뉴 관리</h1><p className="text-sm text-slate-400 flex items-center gap-2"><Store size={14} />{store?.name || '매장'} · 메뉴 {products.length}개</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => fetchData()} disabled={loading} aria-label="메뉴 새로고침" className="menu-quiet grid h-11 w-11 place-items-center rounded-xl"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button>
          <button type="button" onClick={() => { setEditingProduct(null); setShowProductModal(true); }} className="menu-primary inline-flex items-center gap-2 rounded-xl px-4 py-3 font-semibold"><Plus size={18} />메뉴 추가</button>
        </div>
      </header>
      {dataError && <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-500">메뉴를 불러오지 못했습니다. {products.length > 0 && '이전 조회 내용입니다.'}<button type="button" onClick={fetchData} className="ml-3 underline">다시 조회</button></div>}
      <details className="menu-panel rounded-xl" aria-label="메뉴 등록 도구">
        <summary className="p-3 cursor-pointer text-white">빠른 등록 도구 <span className="text-slate-400 text-xs">사진 · AI · 일괄 등록</span></summary>
        <div className="flex flex-wrap items-center gap-2 px-3 pb-3">

        <button type="button" onClick={() => setShowScanModal(true)} className="menu-quiet inline-flex items-center gap-2 rounded-lg px-3 py-2"><Sparkles size={16} />사진에서 가져오기</button>
        <button type="button" onClick={() => setShowWizard(true)} className="menu-quiet inline-flex items-center gap-2 rounded-lg px-3 py-2"><Sparkles size={16} />AI로 초안 만들기</button>
        <button type="button" onClick={() => setShowBulkModal(true)} className="menu-quiet inline-flex items-center gap-2 rounded-lg px-3 py-2"><Folders size={16} />일괄 등록</button>
      </div></details>
      <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-4">
        <CategoryList
          categories={categories}
          products={products}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          setEditingCategory={setEditingCategory}
          setShowCategoryModal={setShowCategoryModal}
          handleDeleteCategory={handleDeleteCategory}
          handleCatDragStart={handleCatDragStart}
          handleCatDragOver={handleCatDragOver}
          handleCatDrop={handleCatDrop}
          importFromStore={importFromStore}
          setShowOptionTemplateModal={setShowOptionTemplateModal}
        />

        <MenuItemList
          products={products}
          categories={categories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          clearSelection={() => setSelectedProducts([])}
          onAdd={() => { setEditingProduct(null); setShowProductModal(true); }}
          loading={loading}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedProducts={selectedProducts}
          filteredProducts={filteredProducts}
          handleSelectAll={handleSelectAll}
          handleSelectProduct={handleSelectProduct}
          handleBulkStatusUpdate={handleBulkStatusUpdate}
          handleBulkDelete={handleBulkDelete}
          setEditingProduct={setEditingProduct}
          setShowProductModal={setShowProductModal}
          handleDeleteProduct={handleDeleteProduct}
        />
      </div>

      {showCategoryModal && (
        <CategoryModal
          storeId={storeId}
          category={editingCategory}
          onClose={() => setShowCategoryModal(false)}
          onSave={() => { setShowCategoryModal(false); fetchData(); }}
        />
      )}

      {showProductModal && (
        <Suspense fallback={null}>
          <ProductModal
            storeId={storeId}
            categories={categories}
            product={editingProduct}
            onClose={() => setShowProductModal(false)}
            onSave={() => { setShowProductModal(false); fetchData(); }}
          />
        </Suspense>
      )}

      {showBulkModal && (
        <Suspense fallback={null}>
          <BulkMenuModal
            storeId={storeId}
            existingCategories={categories}
            onClose={() => setShowBulkModal(false)}
            onSave={() => { setShowBulkModal(false); fetchData(); }}
          />
        </Suspense>
      )}

      {showScanModal && (
        <Suspense fallback={null}>
          <MenuScanModal
            storeId={storeId}
            existingCategories={categories}
            onClose={() => setShowScanModal(false)}
            onSave={() => { setShowScanModal(false); fetchData(); }}
          />
        </Suspense>
      )}

      {showWizard && (
        <Suspense fallback={null}>
          <MenuWizard
            storeId={storeId}
            categories={categories}
            onClose={() => setShowWizard(false)}
            onSave={() => { setShowWizard(false); fetchData(); }}
          />
        </Suspense>
      )}

      {showOptionTemplateModal && (
        <Suspense fallback={null}>
          <OptionTemplateModal
            storeId={storeId}
            onClose={() => setShowOptionTemplateModal(false)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default MenuManager;
