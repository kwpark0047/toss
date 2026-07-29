import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { categoriesAPI, productsAPI, storesAPI } from '../api';
import { toast } from 'react-toastify';
import { handleApiError } from '../utils/apiError';

// ── 드래그 정렬 유틸 ──────────────────────────────────────────────────────────
const reorder = (list, startIdx, endIdx) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIdx, 1);
  result.splice(endIdx, 0, removed);
  return result;
};

export const useMenuManager = (storeId) => {
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showOptionTemplateModal, setShowOptionTemplateModal] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]);

  // 드래그 상태
  const dragCatIdx = useRef(null);
  const dragOverCatIdx = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const [storeRes, categoriesRes, productsRes] = await Promise.all([
        storesAPI.getById(storeId),
        categoriesAPI.getByStore(storeId),
        productsAPI.getByStore(storeId),
      ]);
      setStore(storeRes?.data || storeRes || null);
      setCategories(categoriesRes?.data || categoriesRes || []);
      setProducts(productsRes?.data || productsRes || []);
    } catch (error) {
      console.error(error);
      navigate('/admin');
    } finally {
      setLoading(false);
    }
  }, [storeId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredProducts = (Array.isArray(products) ? products : []).filter(
    (p) =>
      (!selectedCategory || p.category_id === selectedCategory) &&
      (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelectAll = (e) => {
    setSelectedProducts(e.target.checked ? filteredProducts.map((p) => p.id) : []);
  };

  const handleSelectProduct = (id) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkStatusUpdate = async (isSoldOut) => {
    if (!selectedProducts.length) return;
    try {
      setLoading(true);
      await Promise.all(
        selectedProducts.map((id) => productsAPI.update(id, { is_sold_out: isSoldOut ? 1 : 0 }))
      );
      fetchData();
      setSelectedProducts([]);
    } catch (e) {
      handleApiError(e, '상태 변경 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedProducts.length) return;
    if (!window.confirm(`${selectedProducts.length}개 메뉴를 삭제하시겠습니까?`)) return;
    try {
      setLoading(true);
      await Promise.all(selectedProducts.map((id) => productsAPI.delete(id)));
      fetchData();
      setSelectedProducts([]);
    } catch (e) {
      handleApiError(e, '일괄 삭제 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('이 카테고리를 삭제하시겠습니까? 포함된 메뉴는 미분류로 이동됩니다.'))
      return;
    try {
      await categoriesAPI.delete(id);
      if (selectedCategory === id) setSelectedCategory(null);
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.error || '카테고리 삭제에 실패했습니다');
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('이 메뉴를 삭제하시겠습니까?')) return;
    try {
      await productsAPI.delete(id);
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.error || '메뉴 삭제에 실패했습니다');
    }
  };

  // 카테고리 드래그 정렬
  const handleCatDragStart = (idx) => {
    dragCatIdx.current = idx;
  };
  const handleCatDragOver = (e, idx) => {
    e.preventDefault();
    dragOverCatIdx.current = idx;
  };
  const handleCatDrop = async () => {
    if (dragCatIdx.current === null || dragOverCatIdx.current === null) return;
    const reordered = reorder(categories, dragCatIdx.current, dragOverCatIdx.current);
    setCategories(reordered);
    dragCatIdx.current = null;
    dragOverCatIdx.current = null;
    try {
      await categoriesAPI.updateSort(reordered.map((c, i) => ({ id: c.id, sort_order: i })));
    } catch {
      fetchData();
    }
  };

  const importFromStore = async (sourceStoreId) => {
    if (sourceStoreId) {
      try {
        setLoading(true);
        await productsAPI.importFromStore(storeId, sourceStoreId);
        toast.success('데이터 가져오기 완료');
        fetchData();
      } catch (e) {
        handleApiError(e, '데이터 가져오기 실패');
      } finally {
        setLoading(false);
      }
    }
  };

  return {
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
    setSelectedProducts,
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
    importFromStore,
  };
};
