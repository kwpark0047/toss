import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { categoriesAPI, productsAPI, storesAPI } from '../../api';
import { ArrowLeft, Plus, Edit, Trash2, Clock, Star, Sparkles, Folders, Search, Settings, GripVertical, Tag, Download, Store } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatPrice } from '../../utils/format';
import { toast } from 'react-toastify';
import { handleApiError } from '../../utils/apiError';
import BulkMenuModal from './BulkMenuModal';
import MenuWizard from './MenuWizard';
import OptionTemplateModal from './OptionTemplateModal';
import Skeleton from '../common/Skeleton';
import EmptyState from '../common/EmptyState';
import { CategoryModal } from './CategoryModal';
import { ProductModal } from './ProductModal';

// ── 드래그 정렬 유틸 ──────────────────────────────────────────────────────────
const reorder = (list, startIdx, endIdx) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIdx, 1);
  result.splice(endIdx, 0, removed);
  return result;
};

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
const MenuManager = () => {
  const { storeId } = useParams();
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

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredProducts = (Array.isArray(products) ? products : [])
    .filter((p) => (!selectedCategory || p.category_id === selectedCategory) &&
      (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(searchTerm.toLowerCase())));

  const handleSelectAll = (e) => {
    setSelectedProducts(e.target.checked ? filteredProducts.map(p => p.id) : []);
  };

  const handleSelectProduct = (id) => {
    setSelectedProducts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkStatusUpdate = async (isSoldOut) => {
    if (!selectedProducts.length) return;
    try {
      setLoading(true);
      await Promise.all(selectedProducts.map(id => productsAPI.update(id, { is_sold_out: isSoldOut ? 1 : 0 })));
      fetchData();
      setSelectedProducts([]);
    } catch (e) { handleApiError(e, '상태 변경 실패'); }
    finally { setLoading(false); }
  };

  const handleBulkDelete = async () => {
    if (!selectedProducts.length) return;
    if (!window.confirm(`${selectedProducts.length}개 메뉴를 삭제하시겠습니까?`)) return;
    try {
      setLoading(true);
      await Promise.all(selectedProducts.map(id => productsAPI.delete(id)));
      fetchData();
      setSelectedProducts([]);
    } catch (e) { handleApiError(e, '일괄 삭제 실패'); }
    finally { setLoading(false); }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('이 카테고리를 삭제하시겠습니까? 포함된 메뉴는 미분류로 이동됩니다.')) return;
    try {
      await categoriesAPI.delete(id);
      if (selectedCategory === id) setSelectedCategory(null);
      fetchData();
    } catch (e) { toast.error(e.response?.data?.error || '카테고리 삭제에 실패했습니다'); }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('이 메뉴를 삭제하시겠습니까?')) return;
    try {
      await productsAPI.delete(id);
      fetchData();
    } catch (e) { toast.error(e.response?.data?.error || '메뉴 삭제에 실패했습니다'); }
  };

  // 카테고리 드래그 정렬
  const handleCatDragStart = (idx) => { dragCatIdx.current = idx; };
  const handleCatDragOver = (e, idx) => { e.preventDefault(); dragOverCatIdx.current = idx; };
  const handleCatDrop = async () => {
    if (dragCatIdx.current === null || dragOverCatIdx.current === null) return;
    const reordered = reorder(categories, dragCatIdx.current, dragOverCatIdx.current);
    setCategories(reordered);
    dragCatIdx.current = null;
    dragOverCatIdx.current = null;
    try {
      await categoriesAPI.updateSort(reordered.map((c, i) => ({ id: c.id, sort_order: i })));
    } catch { fetchData(); }
  };

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
            className="w-10 h-10 lg:w-14 lg:h-14 bg-white/5 rounded-[16px] lg:rounded-[20px] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-2xl backdrop-blur-xl flex-shrink-0"
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
            onClick={() => setShowWizard(true)}
            className="flex-shrink-0 flex items-center gap-2 px-4 lg:px-8 py-2.5 lg:py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-[16px] lg:rounded-[20px] transition-all font-black text-xs lg:text-sm shadow-2xl shadow-blue-500/20 relative overflow-hidden group"
          >
            <Sparkles size={15} className="animate-pulse" />
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
        {/* 카테고리 사이드바 — 데스크탑 전용 */}
        <div className="hidden lg:block lg:col-span-3 space-y-8">
          <div className="bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/5 overflow-hidden">
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <h2 className="font-black text-white text-lg flex items-center gap-3">
                <Tag size={20} className="text-orange-500" /> 카테고리
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-600 font-bold">드래그 정렬 가능</span>
                <motion.button
                  whileHover={{ rotate: 90, scale: 1.1 }}
                  onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}
                  className="w-10 h-10 flex items-center justify-center bg-white/5 text-orange-500 hover:bg-orange-500 hover:text-white rounded-2xl transition-all border border-orange-500/20"
                >
                  <Plus size={20} />
                </motion.button>
              </div>
            </div>
            <div className="p-4 space-y-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full px-6 py-4 rounded-2xl text-left transition-all flex items-center justify-between group ${selectedCategory === null
                  ? 'bg-gradient-to-r from-orange-500 to-rose-600 text-white shadow-xl shadow-orange-500/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
              >
                <span className="font-black">전체 메뉴</span>
                <span className={`text-[10px] px-2 py-1 rounded-lg font-black border ${selectedCategory === null ? 'bg-white/20 border-white/20 text-white' : 'bg-slate-800 border-white/5 text-slate-500'}`}>
                  {products.length}
                </span>
              </button>

              {categories.map((cat, idx) => (
                <div
                  key={cat.id}
                  draggable
                  onDragStart={() => handleCatDragStart(idx)}
                  onDragOver={(e) => handleCatDragOver(e, idx)}
                  onDrop={handleCatDrop}
                  className="relative group/cat cursor-grab active:cursor-grabbing"
                >
                  <button
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full px-6 py-4 rounded-2xl text-left transition-all flex items-center gap-3 ${selectedCategory === cat.id
                      ? 'bg-gradient-to-r from-orange-500 to-rose-600 text-white shadow-xl shadow-orange-500/20'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                  >
                    <GripVertical size={14} className="opacity-30 group-hover/cat:opacity-70 shrink-0" />
                    <span className="font-black flex-1 truncate">{cat.name}</span>
                    <span className={`text-[10px] px-2 py-1 rounded-lg font-black border ${selectedCategory === cat.id ? 'bg-white/20 border-white/20 text-white' : 'bg-slate-800 border-white/5 text-slate-500'}`}>
                      {(Array.isArray(products) ? products : []).filter((p) => p.category_id === cat.id).length}
                    </span>
                  </button>
                  <div className={`absolute right-12 top-1/2 -translate-y-1/2 transition-all gap-1 flex opacity-0 group-hover/cat:opacity-100 ${selectedCategory === cat.id ? 'text-white' : 'text-slate-500'}`}>
                    <button onClick={(e) => { e.stopPropagation(); setEditingCategory(cat); setShowCategoryModal(true); }} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                      <Edit size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }} className="p-2 hover:bg-rose-500/20 hover:text-rose-500 rounded-xl transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 메뉴 데이터 가져오기 */}
          <div className="group relative bg-gradient-to-br from-blue-600 to-indigo-800 p-8 rounded-[40px] text-white shadow-2xl shadow-blue-500/10 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-700" />
            <div className="relative z-10">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-xl border border-white/10">
                <Download size={24} />
              </div>
              <h4 className="text-xl font-black mb-3">메뉴 데이터 가져오기</h4>
              <p className="text-sm text-blue-100/70 font-medium leading-relaxed mb-8">다른 매장의 메뉴 구성을<br />빠르게 적용해보세요</p>
              <button
                onClick={async () => {
                  const sourceStoreId = window.prompt('가져올 매장의 ID를 입력해주세요');
                  if (sourceStoreId) {
                    try {
                      setLoading(true);
                      await productsAPI.importFromStore(storeId, sourceStoreId);
                      toast.success('데이터 가져오기 완료');
                      fetchData();
                    } catch (e) { handleApiError(e, '데이터 가져오기 실패'); }
                    finally { setLoading(false); }
                  }
                }}
                className="w-full py-4 bg-white text-blue-700 rounded-[20px] font-black text-sm hover:bg-blue-50 active:scale-95 transition-all shadow-xl"
              >
                매장 데이터 불러오기
              </button>
            </div>
          </div>

          {/* 옵션 템플릿 */}
          <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[40px] border border-white/5">
            <h4 className="font-black text-white text-lg mb-3 flex items-center gap-3">
              <Settings size={20} className="text-slate-500" /> 옵션 설정
            </h4>
            <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">옵션 템플릿을 사용하여<br />메뉴 편집 속도를 높여보세요.</p>
            <button
              onClick={() => setShowOptionTemplateModal(true)}
              className="w-full py-4 bg-white/5 text-white rounded-[20px] font-black text-sm hover:bg-white/10 transition-all border border-white/10"
            >
              템플릿 관리
            </button>
          </div>
        </div>

        {/* 상품 목록 */}
        <div className="lg:col-span-9 space-y-4 lg:space-y-8">
          {/* 모바일 카테고리 탭 */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide lg:hidden">
            {[{ id: null, name: '전체', count: products.length }, ...categories.map(c => ({ id: c.id, name: c.name, count: (Array.isArray(products) ? products : []).filter(p => p.category_id === c.id).length }))].map(cat => (
              <button
                key={String(cat.id)}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-black transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                    : 'bg-white/5 text-slate-400 border border-white/10 active:bg-white/10'
                }`}
              >
                {cat.name}
                <span className={`text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-black ${selectedCategory === cat.id ? 'bg-white/25 text-white' : 'bg-white/5 text-slate-600'}`}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          {/* 검색 바 */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-rose-600 rounded-2xl lg:rounded-[32px] blur opacity-5 group-focus-within:opacity-20 transition duration-1000" />
            <div className="relative bg-white/5 backdrop-blur-xl p-2 lg:p-3 rounded-2xl lg:rounded-[32px] border border-white/5">
              <div className="relative group/input w-full">
                <Search className="absolute left-4 lg:left-6 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within/input:text-orange-500 transition-colors" size={18} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="메뉴 이름 또는 설명으로 검색..."
                  className="w-full h-11 lg:h-16 pl-11 lg:pl-16 pr-4 lg:pr-8 bg-slate-900/50 border border-transparent focus:border-white/10 rounded-xl lg:rounded-[24px] outline-none transition-all font-bold text-white placeholder:text-slate-700 placeholder:font-medium text-sm"
                />
              </div>
            </div>
          </div>

          {/* 일괄 작업 배너 */}
          <AnimatePresence>
            {selectedProducts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }}
                className="bg-orange-500 px-4 py-3 lg:p-5 rounded-2xl lg:rounded-[28px] shadow-2xl shadow-orange-500/20 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 lg:gap-6">
                  <span className="font-black text-white text-sm lg:text-lg">{selectedProducts.length}개 선택</span>
                  <div className="flex gap-1.5 lg:gap-2">
                    <button onClick={() => handleBulkStatusUpdate(true)} className="px-3 py-1.5 lg:px-5 lg:py-2.5 bg-slate-950/20 hover:bg-slate-950/40 text-white rounded-lg lg:rounded-xl text-[11px] lg:text-xs font-black transition-all border border-white/10">품절</button>
                    <button onClick={() => handleBulkStatusUpdate(false)} className="px-3 py-1.5 lg:px-5 lg:py-2.5 bg-slate-950/20 hover:bg-slate-950/40 text-white rounded-lg lg:rounded-xl text-[11px] lg:text-xs font-black transition-all border border-white/10">해제</button>
                  </div>
                </div>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 px-4 py-2 lg:px-8 lg:py-3 bg-slate-950 text-white rounded-xl lg:rounded-2xl font-black text-xs lg:text-sm hover:bg-rose-600 transition-all shadow-xl active:scale-95"
                >
                  <Trash2 size={14} /> 삭제
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-white/5 backdrop-blur-xl rounded-[28px] lg:rounded-[48px] border border-white/5 overflow-hidden shadow-2xl shadow-black/20">
            <div className="px-5 py-4 lg:p-10 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3 lg:gap-6">
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                  className="w-5 h-5 lg:w-6 lg:h-6 rounded-lg border-white/10 bg-white/5 text-orange-500 focus:ring-orange-500/50 cursor-pointer appearance-none border-2 checked:bg-orange-500 transition-all flex-shrink-0"
                />
                <div>
                  <h3 className="font-black text-white text-base lg:text-xl">메뉴 목록</h3>
                  <p className="text-[9px] lg:text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mt-0.5">상품 관리</p>
                </div>
              </div>
              <div className="px-3 py-1.5 lg:px-5 lg:py-2 bg-slate-900 border border-white/5 rounded-xl">
                <p className="text-[11px] lg:text-xs font-black text-slate-500">
                  <span className="text-white">{filteredProducts.length}</span>개
                </p>
              </div>
            </div>

            <div className="divide-y divide-white/5">
              {filteredProducts.length === 0 ? (
                <EmptyState
                  tone="dark"
                  icon={<ShoppingBag className="text-slate-600" size={44} aria-hidden="true" />}
                  title="등록된 메뉴가 없습니다"
                  description="위 버튼을 눌러 메뉴를 추가해보세요"
                />
              ) : (
                filteredProducts.map((product, idx) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                    className={`px-4 py-3 lg:p-8 flex items-center gap-3 lg:gap-10 hover:bg-white/[0.03] transition-all group ${selectedProducts.includes(product.id) ? 'bg-orange-500/[0.05]' : ''}`}
                  >
                    {/* 체크박스 + 이미지 */}
                    <div className="flex items-center gap-2 lg:gap-8 flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => handleSelectProduct(product.id)}
                        className="w-5 h-5 lg:w-6 lg:h-6 rounded-lg border-white/10 bg-white/5 text-orange-500 focus:ring-orange-500/50 cursor-pointer appearance-none border-2 checked:bg-orange-500 transition-all flex-shrink-0"
                      />
                      <div className={`w-14 h-14 lg:w-32 lg:h-32 bg-slate-900 rounded-2xl lg:rounded-[32px] overflow-hidden border border-white/10 relative shadow-lg lg:shadow-2xl flex-shrink-0 group-hover:scale-105 transition-all duration-500 ${product.is_sold_out ? 'grayscale opacity-40' : ''}`}>
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-800">
                            <Image size={18} className="lg:hidden" />
                            <Image size={32} className="hidden lg:block" />
                          </div>
                        )}
                        {product.is_popular ? (
                          <div className="absolute top-1 left-1 lg:top-4 lg:left-4 bg-amber-400 text-slate-950 p-1 lg:p-2 rounded-lg shadow-lg">
                            <Star size={9} fill="currentColor" className="lg:hidden" />
                            <Star size={14} fill="currentColor" className="hidden lg:block" />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* 텍스트 내용 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1 lg:mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <h4 className={`text-sm lg:text-2xl font-black text-white tracking-tight group-hover:text-orange-400 transition-colors truncate max-w-[160px] sm:max-w-none ${product.is_sold_out ? 'opacity-40' : ''}`}>{product.name}</h4>
                            <div className="hidden sm:flex gap-1.5 flex-wrap">
                              {product.is_new ? <span className="px-2 py-0.5 text-[8px] bg-blue-500 text-white rounded font-black tracking-wider uppercase">NEW</span> : null}
                              {product.is_sold_out ? <span className="px-2 py-0.5 text-[8px] bg-rose-600 text-white rounded font-black tracking-wider uppercase">품절</span> : null}
                              {product.spicy_level > 0 && <span className="px-2 py-0.5 text-[8px] bg-orange-500/10 text-orange-500 rounded font-black border border-orange-500/20">🌶️ {product.spicy_level}</span>}
                            </div>
                          </div>
                          <p className="text-[11px] lg:text-sm text-slate-500 font-medium line-clamp-1 hidden sm:block">{product.description || ''}</p>
                        </div>

                        {/* 모바일 전용 액션 버튼 */}
                        <div className="flex gap-1.5 lg:hidden flex-shrink-0">
                          <button
                            onClick={() => { setEditingProduct(product); setShowProductModal(true); }}
                            className="w-8 h-8 bg-white/5 text-slate-400 active:text-white rounded-xl flex items-center justify-center border border-white/10"
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="w-8 h-8 bg-white/5 text-slate-400 active:text-rose-400 rounded-xl flex items-center justify-center border border-white/10"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* 모바일 뱃지 */}
                      <div className="flex gap-1 sm:hidden mb-1 flex-wrap">
                        {product.is_new ? <span className="px-1.5 py-0.5 text-[8px] bg-blue-500 text-white rounded font-black">NEW</span> : null}
                        {product.is_sold_out ? <span className="px-1.5 py-0.5 text-[8px] bg-rose-600 text-white rounded font-black">품절</span> : null}
                        {product.stock_quantity !== null && product.stock_quantity !== undefined && (
                          <span className={`px-1.5 py-0.5 text-[8px] rounded font-black ${product.stock_quantity <= (product.low_stock_threshold || 5) ? 'bg-rose-500/10 text-rose-400' : 'bg-green-500/10 text-green-400'}`}>
                            재고 {product.stock_quantity}
                          </span>
                        )}
                      </div>

                      {/* 가격 + 메타 */}
                      <div className="flex items-center gap-2 lg:gap-6 mt-1 lg:mt-5">
                        <span className="text-sm lg:text-2xl font-black text-white">{formatPrice(product.price, true)}</span>
                        {product.cooking_time && (
                          <div className="hidden lg:flex items-center gap-2 text-[10px] font-black text-slate-400 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                            <Clock size={14} className="text-slate-600" /> {product.cooking_time}분
                          </div>
                        )}
                        {product.tags && (
                          <div className="hidden lg:flex gap-2 overflow-hidden max-w-[300px]">
                            {product.tags.split(',').slice(0, 3).map((tag, i) => (
                              <span key={i} className="px-3 py-1 bg-white/[0.02] text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-tighter border border-white/5">#{tag.trim()}</span>
                            ))}
                          </div>
                        )}
                        {/* 모바일 조리시간 인라인 */}
                        {product.cooking_time && (
                          <span className="lg:hidden text-[10px] text-slate-600 font-bold flex items-center gap-1">
                            <Clock size={10} /> {product.cooking_time}분
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 데스크탑 전용 호버 버튼 */}
                    <div className="hidden lg:flex gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                      <motion.button
                        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                        onClick={() => { setEditingProduct(product); setShowProductModal(true); }}
                        className="w-14 h-14 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 rounded-[20px] flex items-center justify-center border border-white/10 transition-all shadow-xl"
                      >
                        <Edit size={22} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                        onClick={() => handleDeleteProduct(product.id)}
                        className="w-14 h-14 bg-white/5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-[20px] flex items-center justify-center border border-white/10 transition-all shadow-xl"
                      >
                        <Trash2 size={22} />
                      </motion.button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 카테고리 모달 */}
      {showCategoryModal && (
        <CategoryModal
          storeId={storeId}
          category={editingCategory}
          onClose={() => setShowCategoryModal(false)}
          onSave={() => { setShowCategoryModal(false); fetchData(); }}
        />
      )}

      {/* 상품 모달 */}
      {showProductModal && (
        <ProductModal
          storeId={storeId}
          categories={categories}
          product={editingProduct}
          onClose={() => setShowProductModal(false)}
          onSave={() => { setShowProductModal(false); fetchData(); }}
        />
      )}

      {showBulkModal && (
        <BulkMenuModal
          storeId={storeId}
          existingCategories={categories}
          onClose={() => setShowBulkModal(false)}
          onSave={() => { setShowBulkModal(false); fetchData(); }}
        />
      )}

      {showWizard && (
        <MenuWizard
          storeId={storeId}
          categories={categories}
          onClose={() => setShowWizard(false)}
          onSave={() => { setShowWizard(false); fetchData(); }}
        />
      )}

      {showOptionTemplateModal && (
        <OptionTemplateModal
          storeId={storeId}
          onClose={() => setShowOptionTemplateModal(false)}
        />
      )}
    </div>
  );
};

export default MenuManager;
