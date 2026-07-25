import { useParams, useNavigate } from 'react-router-dom';
import { useMenuManager } from '../../hooks/useMenuManager';
import { ArrowLeft, Plus, Sparkles, Folders, Store } from 'lucide-react';
import { motion } from 'framer-motion';
import { lazy, Suspense } from 'react';
import Skeleton from '../common/Skeleton';
import { CategoryModal } from './CategoryModal';
import { CategoryList } from './menu/CategoryList';
import { MenuItemList } from './menu/MenuItemList';

const BulkMenuModal = lazy(() => import('./BulkMenuModal'));
const MenuScanModal = lazy(() => import('./MenuScanModal'));
const MenuWizard = lazy(() => import('./MenuWizard'));
const OptionTemplateModal = lazy(() => import('./OptionTemplateModal'));
const ProductModal = lazy(() => import('./ProductModal'));

const MenuManager = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  
  const {
    store,
    categories,
    products,
    loading,
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
    <div className="max-w-[1600px] mx-auto space-y-6 lg:space-y-10">
      {/* 상단 헤더 */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 lg:gap-8">
        <div className="flex items-center gap-3 lg:gap-6">
          <motion.button
            whileHover={{ scale: 1.1, x: -5 }} whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/admin')}
            className="w-10 h-10 lg:w-14 h-14 bg-white/5 rounded-[16px] lg:rounded-[20px] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-2xl backdrop-blur-xl flex-shrink-0"
          >
            <ArrowLeft size={20} />
          </motion.button>
          <div className="min-w-0">
            <h1 className="text-2xl lg:text-4xl font-black text-white tracking-tight mb-1 lg:mb-2">메뉴 관리</h1>
            <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
              <div className="px-2.5 py-0.5 lg:px-3 lg:py-1 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <p className="text-orange-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5">
                  <Store size={10} /> {store?.name}
                </p>
              </div>
              <span className="text-slate-600 font-bold text-[10px] uppercase tracking-tighter hidden sm:block">상품 관리</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-3 overflow-x-auto pb-1 scrollbar-hide">
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }}
            onClick={() => setShowScanModal(true)}
            className="flex-shrink-0 flex items-center gap-2 px-4 lg:px-8 py-2.5 lg:py-4 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-[16px] lg:rounded-[20px] transition-all font-black text-xs lg:text-sm shadow-2xl shadow-orange-500/20 relative overflow-hidden group"
          >
            <Sparkles size={15} className="animate-pulse" />
            <span>AI 사진 스캔 등록</span>
          </motion.button>

          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }}
            onClick={() => setShowWizard(true)}
            className="flex-shrink-0 flex items-center gap-2 px-4 lg:px-8 py-2.5 lg:py-4 bg-white/5 text-white rounded-[16px] lg:rounded-[20px] transition-all font-black text-xs lg:text-sm shadow-xl border border-white/10"
          >
            <Sparkles size={15} />
            <span>AI 생성</span>
          </motion.button>

          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }}
            onClick={() => setShowBulkModal(true)}
            className="flex-shrink-0 flex items-center gap-2 px-4 lg:px-8 py-2.5 lg:py-4 bg-white/5 text-white rounded-[16px] lg:rounded-[20px] transition-all font-black text-xs lg:text-sm shadow-xl border border-white/10"
          >
            <Folders size={15} /> 일괄 등록
          </motion.button>

          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }}
            onClick={() => { setEditingProduct(null); setShowProductModal(true); }}
            className="flex-shrink-0 flex items-center gap-2 px-4 lg:px-8 py-2.5 lg:py-4 bg-orange-500 text-white rounded-[16px] lg:rounded-[20px] transition-all font-black text-xs lg:text-sm shadow-xl shadow-orange-500/25 hover:bg-orange-400"
          >
            <Plus size={16} /> 메뉴 추가
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-10">
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