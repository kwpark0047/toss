import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { categoriesAPI, productsAPI, storesAPI, aiAPI, uploadsAPI } from '../../api';
import { ArrowLeft, Plus, Edit, Trash2, FolderPlus, Clock, Star, Sparkles, Flame, AlertTriangle, Image, Tag, FileText, Wand2, ShoppingBag, Download, Store, Folders, Search, Upload, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatPrice } from '../../utils/format';
import axios from 'axios';
import BulkMenuModal from './BulkMenuModal';
import MenuWizard from './MenuWizard';
import OptionTemplateModal from './OptionTemplateModal';

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

  const filteredProducts = (Array.isArray(products) ? products : [])
    .filter((p) => (!selectedCategory || p.category_id === selectedCategory) &&
      (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchTerm.toLowerCase())));

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedProducts(filteredProducts.map(p => p.id));
    } else {
      setSelectedProducts([]);
    }
  };

  const handleSelectProduct = (id) => {
    setSelectedProducts(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkStatusUpdate = async (newStatus) => {
    if (selectedProducts.length === 0) return;
    try {
      setLoading(true);
      await Promise.all(selectedProducts.map(id =>
        productsAPI.update(id, { is_sold_out: newStatus ? 1 : 0 })
      ));
      fetchData();
      setSelectedProducts([]);
    } catch (error) {
      alert('선택 상태 변경 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.length === 0) return;
    if (!window.confirm(`${selectedProducts.length}` + '개의 메뉴를 삭제하시겠습니까?')) return;
    try {
      setLoading(true);
      await Promise.all(selectedProducts.map(id => productsAPI.delete(id)));
      fetchData();
      setSelectedProducts([]);
    } catch (error) {
      alert('선택 삭제 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('이 카테고리를 삭제하시겠습니까?')) return;
    try {
      await categoriesAPI.delete(id);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || '??젣 ?ㅽ뙣');
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('???곹뭹????젣?섏떆寃좎뒿?덇퉴?')) return;
    try {
      await productsAPI.delete(id);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || '??젣 ?ㅽ뙣');
    }
  };

  if (loading && products.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
      <div className="w-16 h-16 bg-slate-100 rounded-full mb-4 flex items-center justify-center">
        <Clock className="text-slate-300 animate-spin-slow" />
      </div>
      <p className="text-slate-400 font-bold">?멸린?덈뒗 硫붾돱瑜?以鍮꾪븯怨??덉뒿?덈떎...</p>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-10">
      {/* ?꾨━誘몄뾼 ?ㅻ뜑 */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <motion.button
            whileHover={{ scale: 1.1, x: -5 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/admin')}
            className="w-14 h-14 bg-white/5 rounded-[20px] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-2xl backdrop-blur-xl"
          >
            <ArrowLeft size={24} />
          </motion.button>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight mb-2">硫붾돱 ?몃깽?좊━</h1>
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <p className="text-orange-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5">
                  <Store size={12} /> {store?.name}
                </p>
              </div>
              <span className="text-slate-600 font-bold text-xs uppercase tracking-tighter">Inventory Control System</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <motion.button
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2.5 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-[20px] transition-all font-black text-sm shadow-2xl shadow-blue-500/20 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <Sparkles size={18} className="animate-pulse" />
            <span className="relative z-10">AI 메뉴 생성</span>
          </motion.button>
          
          <motion.button
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2.5 px-8 py-4 bg-slate-800 text-white rounded-[20px] transition-all font-black text-sm shadow-2xl border border-white/5"
          >
            <Folders size={18} />
            AI 일괄 등록
          </motion.button>
          
          <motion.button
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setEditingProduct(null); setShowProductModal(true); }}
            className="flex items-center gap-2.5 px-8 py-4 bg-white text-slate-950 rounded-[20px] transition-all font-black text-sm shadow-2xl hover:bg-orange-500 hover:text-white"
          >
            <Plus size={22} />
            신규 메뉴 추가
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* 카테고리 사이드바 */}
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/5 overflow-hidden">
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <h2 className="font-black text-white text-lg flex items-center gap-3">
                <Tag size={20} className="text-orange-500" /> 카테고리
              </h2>
              <motion.button
                whileHover={{ rotate: 90, scale: 1.1 }}
                onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}
                className="w-10 h-10 flex items-center justify-center bg-white/5 text-orange-500 hover:bg-orange-500 hover:text-white rounded-2xl transition-all border border-orange-500/20"
              >
                <Plus size={20} />
              </motion.button>
            </div>
            <div className="p-4 space-y-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full px-6 py-4 rounded-2xl text-left transition-all flex items-center justify-between group ${selectedCategory === null 
                  ? 'bg-gradient-to-r from-orange-500 to-rose-600 text-white shadow-xl shadow-orange-500/20' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="font-black">?꾩껜 ?몃깽?좊━</span>
                <span className={`text-[10px] px-2 py-1 rounded-lg font-black border ${selectedCategory === null ? 'bg-white/20 border-white/20 text-white' : 'bg-slate-800 border-white/5 text-slate-500'}`}>
                  {products.length}
                </span>
              </button>
              {categories.map((cat) => (
                <div key={cat.id} className="relative group/cat">
                  <button
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full px-6 py-4 rounded-2xl text-left transition-all flex items-center justify-between ${selectedCategory === cat.id 
                      ? 'bg-gradient-to-r from-orange-500 to-rose-600 text-white shadow-xl shadow-orange-500/20' 
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="font-black truncate pr-12">{cat.name}</span>
                    <span className={`text-[10px] px-2 py-1 rounded-lg font-black border ${selectedCategory === cat.id ? 'bg-white/20 border-white/20 text-white' : 'bg-slate-800 border-white/5 text-slate-500'}`}>
                      {(Array.isArray(products) ? products : []).filter((p) => p.category_id === cat.id).length}
                    </span>
                  </button>
                  <div className={`absolute right-14 top-1/2 -translate-y-1/2 transition-all gap-1.5 flex opacity-0 group-hover/cat:opacity-100 ${selectedCategory === cat.id ? 'text-white' : 'text-slate-500'}`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingCategory(cat); setShowCategoryModal(true); }}
                      className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                      className="p-2 hover:bg-rose-500/20 hover:text-rose-500 rounded-xl transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-blue-600 to-indigo-800 p-8 rounded-[40px] text-white shadow-2xl shadow-blue-500/10 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-700" />
            <div className="relative z-10">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-xl border border-white/10">
                <Download size={24} />
              </div>
              <h4 className="text-xl font-black mb-3">메뉴 데이터 가져오기</h4>
              <p className="text-sm text-blue-100/70 font-medium leading-relaxed mb-8">다른 매장의 검증된 메뉴 구성을<br/>빠르게 적용해보세요</p>
              <button
                onClick={async () => {
                  const sourceStoreId = window.prompt('가져올 매장의 ID를 입력해주세요');
                  if (sourceStoreId) {
                    try {
                      setLoading(true);
                      await productsAPI.importFromStore(storeId, sourceStoreId);
                      alert('데이터 가져오기가 완료되었습니다');
                      fetchData();
                    } catch (err) { alert('데이터 가져오기 실패'); }
                    finally { setLoading(false); }
                  }
                }}
                className="w-full py-4 bg-white text-blue-700 rounded-[20px] font-black text-sm hover:bg-blue-50 active:scale-95 transition-all shadow-xl"
              >
                留ㅼ옣 ?곗씠??議고쉶
              </button>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[40px] border border-white/5">
            <h4 className="font-black text-white text-lg mb-3 flex items-center gap-3">
              <Settings size={20} className="text-slate-500" /> 怨좉툒 ?ㅼ젙
            </h4>
            <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">?듭뀡 ?쒗뵆由우쓣 ?ъ슜?섏뿬<br/>硫붾돱 援ъ꽦???쒖??뷀븯?몄슂.</p>
            <button
              onClick={() => setShowOptionTemplateModal(true)}
              className="w-full py-4 bg-white/5 text-white rounded-[20px] font-black text-sm hover:bg-white/10 transition-all border border-white/10"
            >
              템플릿 불러오기
            </button>
          </div>
        </div>

        {/* ?곹뭹 ?곸뿭 */}
        <div className="lg:col-span-9 space-y-8">
          {/* 메뉴 목록 및 검색 */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-rose-600 rounded-[32px] blur opacity-5 group-focus-within:opacity-20 transition duration-1000" />
            <div className="relative bg-white/5 backdrop-blur-xl p-3 rounded-[32px] border border-white/5 flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 group/input w-full">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within/input:text-orange-500 transition-colors" size={22} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="硫붾돱 ?대쫫?대굹 ?ㅻ챸??寃?됲븯?몄슂..."
                  className="w-full h-16 pl-16 pr-8 bg-slate-900/50 border border-transparent focus:border-white/10 rounded-[24px] outline-none transition-all font-black text-white placeholder:text-slate-700 placeholder:font-bold"
                />
              </div>
            </div>
          </div>

          {/* ?쇨큵 ?몄쭛 ?대컮 */}
          <AnimatePresence>
            {selectedProducts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-orange-500 p-5 rounded-[28px] shadow-2xl shadow-orange-500/20 flex flex-col sm:flex-row items-center justify-between gap-6"
              >
                <div className="flex items-center gap-6 px-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-orange-200 uppercase tracking-[0.2em] mb-1">Bulk Actions</span>
                    <span className="font-black text-white text-lg tracking-tight">{selectedProducts.length} Selected</span>
                  </div>
                  <div className="w-px h-10 bg-white/20 hidden sm:block" />
                  <div className="flex gap-2">
                    <button onClick={() => handleBulkStatusUpdate(true)} className="px-5 py-2.5 bg-slate-950/20 hover:bg-slate-950/40 text-white rounded-xl text-xs font-black transition-all border border-white/10">?덉젅 泥섎━</button>
                    <button onClick={() => handleBulkStatusUpdate(false)} className="px-5 py-2.5 bg-slate-950/20 hover:bg-slate-950/40 text-white rounded-xl text-xs font-black transition-all border border-white/10">?먮ℓ 以묒? ?댁젣</button>
                  </div>
                </div>
                <button
                  onClick={handleBulkDelete}
                  className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-3 bg-slate-950 text-white rounded-2xl font-black text-sm hover:bg-rose-600 transition-all shadow-xl active:scale-95"
                >
                  <Trash2 size={18} /> ?좏깮 ??젣
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-white/5 backdrop-blur-xl rounded-[48px] border border-white/5 overflow-hidden shadow-2xl shadow-black/20">
            <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                    className="w-6 h-6 rounded-lg border-white/10 bg-white/5 text-orange-500 focus:ring-orange-500/50 cursor-pointer appearance-none border-2 checked:bg-orange-500 transition-all"
                  />
                  {selectedProducts.length === filteredProducts.length && filteredProducts.length > 0 && (
                     <Sparkles size={12} className="absolute inset-0 m-auto text-white pointer-events-none" />
                  )}
                </div>
                <div>
                  <h3 className="font-black text-white text-xl">硫붾돱 ?몃깽?좊━</h3>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Product Management List</p>
                </div>
              </div>
              <div className="px-5 py-2 bg-slate-900 border border-white/5 rounded-xl">
                 <p className="text-xs font-black text-slate-500">
                   TOTAL <span className="text-white ml-2">{filteredProducts.length}</span>
                 </p>
              </div>
            </div>

            <div className="divide-y divide-white/5">
              {filteredProducts.length === 0 ? (
                <div className="py-32 text-center flex flex-col items-center">
                  <div className="w-24 h-24 bg-slate-900 rounded-[32px] flex items-center justify-center mb-8 border border-white/5 shadow-inner group">
                    <ShoppingBag className="text-slate-800 group-hover:text-orange-500 transition-colors" size={48} />
                  </div>
                  <h4 className="text-white text-2xl font-black mb-3">등록된 메뉴가 없습니다</h4>
                  <p className="text-slate-500 font-medium max-w-sm mx-auto">메뉴를 추가해 주세요</p>
                </div>
              ) : (
                filteredProducts.map((product, idx) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={`p-8 flex items-center gap-10 hover:bg-white/[0.03] transition-all group ${selectedProducts.includes(product.id) ? 'bg-orange-500/[0.05]' : ''}`}
                  >
                    <div className="flex items-center gap-8 shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => handleSelectProduct(product.id)}
                        className="w-6 h-6 rounded-lg border-white/10 bg-white/5 text-orange-500 focus:ring-orange-500/50 cursor-pointer appearance-none border-2 checked:bg-orange-500 transition-all"
                      />
                      <div className={`w-32 h-32 bg-slate-900 rounded-[32px] overflow-hidden border border-white/10 relative shadow-2xl group-hover:scale-105 transition-all duration-500 ${product.is_sold_out ? 'grayscale-70 opacity-40' : ''}`}>
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-800">
                            <Image size={32} />
                            <span className="text-[10px] mt-2 font-black tracking-widest opacity-20 uppercase">No Media</span>
                          </div>
                        )}
                        {product.is_popular ? (
                          <div className="absolute top-4 left-4 bg-amber-400 text-slate-950 p-2 rounded-xl shadow-xl shadow-amber-400/20">
                            <Star size={14} fill="currentColor" />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-4 mb-3 flex-wrap">
                        <h4 className={`text-2xl font-black text-white tracking-tight group-hover:text-orange-400 transition-colors ${product.is_sold_out ? 'opacity-40' : ''}`}>{product.name}</h4>
                        <div className="flex gap-2">
                          {product.is_new ? (
                            <span className="px-3 py-1 text-[9px] bg-blue-500 text-white rounded-lg font-black tracking-[0.2em] uppercase shadow-lg shadow-blue-500/20">NEW</span>
                          ) : null}
                          {product.is_sold_out ? (
                            <span className="px-3 py-1 text-[9px] bg-rose-600 text-white rounded-lg font-black tracking-[0.2em] uppercase shadow-lg shadow-rose-600/20">SOLD OUT</span>
                          ) : null}
                          {product.spicy_level > 0 && (
                            <span className="px-3 py-1 text-[9px] bg-orange-500/10 text-orange-500 rounded-lg font-black border border-orange-500/20 uppercase tracking-[0.2em]">?뙳截?LV.{product.spicy_level}</span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 font-medium line-clamp-1 mb-5 pr-10">{product.description || '硫붾돱??????ㅻ챸???깅줉?섏? ?딆븯?듬땲??'}</p>
                      <div className="flex items-center gap-6">
                        <span className="text-2xl font-black text-white">{formatPrice(product.price, true)}</span>
                        {product.cooking_time && (
                          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                            <Clock size={14} className="text-slate-600" /> {product.cooking_time}MIN
                          </div>
                        )}
                        {product.tags && (
                          <div className="flex gap-2 overflow-hidden max-w-[300px]">
                            {product.tags.split(',').map((tag, idx) => (
                              <span key={idx} className="px-3 py-1 bg-white/[0.02] text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-tighter border border-white/5">#{tag.trim()}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => { setEditingProduct(product); setShowProductModal(true); }}
                        className="w-14 h-14 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 rounded-[20px] flex items-center justify-center border border-white/10 transition-all shadow-xl"
                      >
                        <Edit size={22} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
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

      {/* ?곹뭹 紐⑤떖 */}
      {showProductModal && (
        <ProductModal
          storeId={storeId}
          categories={categories}
          product={editingProduct}
          onClose={() => setShowProductModal(false)}
          onSave={() => {
            setShowProductModal(false);
            fetchData();
          }}
        />
      )}

      {showBulkModal && (
        <BulkMenuModal
          storeId={storeId}
          existingCategories={categories}
          onClose={() => setShowBulkModal(false)}
          onSave={() => {
            setShowBulkModal(false);
            fetchData();
          }}
        />
      )}

      {showWizard && (
        <MenuWizard
          storeId={storeId}
          categories={categories}
          onClose={() => setShowWizard(false)}
          onSave={() => {
            setShowWizard(false);
            fetchData();
          }}
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

const CategoryModal = ({ storeId, category, onClose, onSave }) => {
  const [name, setName] = useState(category?.name || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (category) {
        await categoriesAPI.update(category.id, { name });
      } else {
        await categoriesAPI.create({ store_id: parseInt(storeId), name });
      }
      onSave();
    } catch (error) {
      alert(error.response?.data?.error || '????ㅽ뙣');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-slate-900 border border-white/10 rounded-[32px] p-10 w-full max-w-md shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-rose-600" />
        <h3 className="text-2xl font-black text-white mb-8 tracking-tight">
          {category ? '카테고리 정보 수정' : '신규 카테고리 추가'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Category Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="?? ?쒓렇?덉쿂 硫붾돱, ?ъ씠???붿돩..."
              required
              className="w-full h-16 px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white placeholder:text-slate-700"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 h-16 bg-white/5 text-slate-400 rounded-2xl font-black text-sm hover:bg-white/10 transition-all"
            >
              痍⑥냼
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="flex-[2] h-16 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? '저장 중...' : '카테고리 저장'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const ProductModal = ({ storeId, categories, product, onClose, onSave }) => {
  const [form, setForm] = useState({
    name: product?.name || '',
    category_id: product?.category_id || '',
    price: product?.price || '',
    description: product?.description || '',
    image_url: product?.image_url || '',
    is_sold_out: product?.is_sold_out || 0,
    cooking_time: product?.cooking_time || 5,
    detail_description: product?.detail_description || '',
    detail_images: product?.detail_images || '',
    ingredients: product?.ingredients || '',
    allergens: product?.allergens || '',
    nutrition_info: product?.nutrition_info || '',
    spicy_level: product?.spicy_level || 0,
    is_popular: product?.is_popular || 0,
    is_new: product?.is_new || 0,
    tags: product?.tags || '',
    options: product?.options || '',
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [aiLoading, setAiLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await uploadsAPI.uploadImage(formData);
      if (res.data.success) {
        setForm(prev => ({
          ...prev,
          [field]: field === 'detail_images'
            ? (prev.detail_images ? prev.detail_images + '\n' + res.data.url : res.data.url)
            : res.data.url
        }));
      }
    } catch (err) {
      console.error(err);
      alert('?대?吏 ?낅줈???ㅽ뙣');
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!form.name) {
      alert('?곹뭹紐낆쓣 ?낅젰?댁빞 AI ?ㅻ챸???앹꽦?????덉뒿?덈떎.');
      return;
    }

    setAiLoading(true);
    try {
      const response = await aiAPI.describeMenu({
        name: form.name,
        category: categories.find(c => c.id === parseInt(form.category_id))?.name || '',
        description: form.description
      });

      if (response && response.description) {
        setForm(prev => ({ ...prev, description: response.description }));
      }
    } catch (error) {
      console.error('AI ?ㅻ챸 ?앹꽦 ?ㅽ뙣:', error);
      alert('AI 이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let parsedOptions = [];
      try {
        if (typeof form.options === 'string' && form.options.trim()) {
          parsedOptions = JSON.parse(form.options);
        } else if (Array.isArray(form.options)) {
          parsedOptions = form.options;
        }
      } catch (err) {
        alert('?듭뀡 JSON ?뺤떇???щ컮瑜댁? ?딆뒿?덈떎.');
        setLoading(false);
        return;
      }

      const data = {
        ...form,
        store_id: parseInt(storeId),
        category_id: form.category_id ? parseInt(form.category_id) : null,
        price: parseInt(form.price) || 0,
        cooking_time: parseInt(form.cooking_time) || 5,
        spicy_level: parseInt(form.spicy_level) || 0,
        options: parsedOptions,
        is_active: 1
      };
      if (product) {
        await productsAPI.update(product.id, data);
      } else {
        await productsAPI.create(data);
      }
      onSave();
    } catch (error) {
      alert(error.response?.data?.error || '????ㅽ뙣');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'basic', label: '기본 정보', icon: FileText },
    { id: 'detail', label: '상세설명', icon: Image },
    { id: 'options', label: '?몃깽?좊━ ?듭뀡', icon: Tag },
  ];

  const [templates, setTemplates] = useState([]);
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await axios.get(`${axios.defaults.baseURL || 'http://localhost:3000/api'}/option-templates/store/${storeId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setTemplates(res.data || []);
      } catch (err) { console.error(err); }
    };
    fetchTemplates();
  }, [storeId]);

  const applyTemplate = (template) => {
    try {
      const templateOptions = JSON.parse(template.options || '[]');
      setForm(prev => ({
        ...prev,
        options: JSON.stringify(templateOptions)
      }));
    } catch (err) { alert('템플릿 적용 실패'); }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center z-[100] p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-slate-900 border border-white/10 rounded-[40px] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-10 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-3xl font-black text-white tracking-tight">
              {product ? '메뉴 정보 수정' : '신규 메뉴 등록'}
            </h3>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2">Product Master Configuration</p>
          </div>
          <button onClick={onClose} className="w-12 h-12 bg-white/5 hover:bg-rose-500/10 hover:text-rose-500 text-slate-400 rounded-2xl flex items-center justify-center transition-all">
            <Plus className="rotate-45" size={24} />
          </button>
        </div>

        {/* ?꾨━誘몄뾼 ???대퉬寃뚯씠??*/}
        <div className="flex px-10 gap-8 border-b border-white/5 bg-white/[0.01]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-6 flex items-center gap-3 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === tab.id
                ? 'text-orange-500'
                : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              <tab.icon size={16} />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-orange-500 rounded-t-full shadow-[0_-4px_12px_rgba(249,115,22,0.4)]" />
              )}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-10">
          {activeTab === 'basic' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Product Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="메뉴 이름을 입력하세요"
                    required
                    className="w-full h-16 px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Price (KRW) *</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="0"
                    required
                    className="w-full h-16 px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Category Assignment</label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="w-full h-16 px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white appearance-none"
                  >
                    <option value="" className="bg-slate-900">카테고리 선택</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id} className="bg-slate-900">{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Cooking Time (MIN)</label>
                  <input
                    type="number"
                    value={form.cooking_time}
                    onChange={(e) => setForm({ ...form, cooking_time: e.target.value })}
                    className="w-full h-16 px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Product Summary</label>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={handleGenerateAI}
                    disabled={aiLoading}
                    className="flex items-center gap-2 text-[10px] font-black text-orange-400 bg-orange-500/10 border border-orange-500/20 px-4 py-2 rounded-xl transition-all disabled:opacity-50"
                  >
                    <Sparkles size={14} className={aiLoading ? 'animate-spin' : ''} />
                     {aiLoading ? 'GENERATE...' : 'AI 이미지 생성'}
                  </motion.button>
                </div>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="硫붾돱???뱀쭠??媛꾧껐?섍쾶 ?ㅻ챸??二쇱꽭??(AI 異붿쿇 湲곕뒫??沅뚯옣?⑸땲??"
                  rows={3}
                  className="w-full p-6 bg-white/5 border border-white/5 rounded-3xl outline-none focus:border-orange-500/50 transition-all font-bold text-white placeholder:text-slate-700"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { id: 'is_popular', label: '?멸린 硫붾돱', icon: Star, color: 'text-amber-400' },
                { id: 'is_new', label: '신메뉴 표시', icon: Flame, color: 'text-blue-400' },
                  { id: 'is_sold_out', label: '?꾩떆 ?덉젅', icon: AlertTriangle, color: 'text-rose-500' },
                ].map((toggle) => (
                  <button
                    key={toggle.id}
                    type="button"
                    onClick={() => setForm({ ...form, [toggle.id]: form[toggle.id] ? 0 : 1 })}
                    className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${form[toggle.id] 
                      ? `bg-white/5 border-white/20 ${toggle.color}` 
                      : 'bg-transparent border-white/5 text-slate-600 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <toggle.icon size={18} />
                      <span className="text-xs font-black uppercase tracking-tighter">{toggle.label}</span>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 ${form[toggle.id] ? 'bg-current border-transparent' : 'border-current'}`} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'detail' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Primary Media Assets</label>
                <div className="flex gap-4">
                  <div className="flex-1 relative group">
                     <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600" size={20} />
                     <input
                      type="text"
                      value={form.image_url}
                      onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                      placeholder="HTTPS URL 湲곕컲 誘몃뵒??二쇱냼"
                      className="w-full h-16 pl-16 pr-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white placeholder:text-slate-700"
                    />
                  </div>
                  <label className="shrink-0 flex items-center justify-center gap-3 px-8 bg-white text-slate-950 rounded-2xl cursor-pointer hover:bg-orange-500 hover:text-white transition-all font-black text-xs">
                    <Upload size={18} />
                    {uploading ? 'UPLOADING...' : 'LOCAL UPLOAD'}
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'image_url')} />
                  </label>
                </div>
                {form.image_url && (
                  <div className="relative group max-w-sm">
                    <div className="absolute -inset-2 bg-gradient-to-r from-orange-500 to-rose-600 rounded-[32px] blur opacity-20" />
                    <img src={form.image_url} alt="誘몃━蹂닿린" className="relative w-full aspect-video object-cover rounded-[24px] border border-white/10 shadow-2xl" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Spicy Intensity</label>
                    <input
                      type="number"
                      min="0" max="5"
                      value={form.spicy_level}
                      onChange={(e) => setForm({ ...form, spicy_level: e.target.value })}
                      className="w-full h-16 px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Ingredient Tags</label>
                    <input
                      type="text"
                      value={form.tags}
                      onChange={(e) => setForm({ ...form, tags: e.target.value })}
                      placeholder="예) 알레르기, 보관방법, 원산지"
                      className="w-full h-16 px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white placeholder:text-slate-700"
                    />
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'options' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="p-8 bg-orange-500/5 border border-orange-500/10 rounded-[32px] space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Settings className="text-orange-500" size={20} />
                      <h4 className="text-white font-black">?듭뀡 ?쒗뵆由??붿쭊</h4>
                    </div>
                    <span className="text-[10px] font-black text-orange-500/50 uppercase tracking-widest">Available Templates: {templates.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {templates.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => applyTemplate(t)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[11px] font-black border border-white/5 transition-all"
                      >
                        {t.name} ?곸슜
                      </button>
                    ))}
                  </div>
               </div>

               <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Option JSON Definition</label>
                  <textarea
                    value={form.options}
                    onChange={(e) => setForm({ ...form, options: e.target.value })}
                    placeholder='[{"name": "留듦린 議곗젅", "type": "radio", "values": ["?쒗븳留?, "留ㅼ슫留?]}]'
                    rows={10}
                    className="w-full p-8 bg-slate-950 border border-white/5 rounded-[32px] outline-none focus:border-orange-500/50 transition-all font-mono text-sm text-orange-400"
                  />
                  <p className="text-[10px] text-slate-600 font-bold px-2 italic">??怨좉툒 ?ъ슜?먮? ?꾪븳 JSON ?곗씠??吏곸젒 ?섏젙 紐⑤뱶?낅땲?? ?щ컮瑜??뺤떇???좎???二쇱꽭??</p>
               </div>
            </div>
          )}
        </form>

        <div className="p-10 border-t border-white/5 bg-white/[0.01] flex gap-4">
          <button 
            type="button" 
            onClick={onClose} 
            className="flex-1 h-16 bg-white/5 text-slate-400 rounded-2xl font-black text-sm hover:bg-white/10 transition-all"
          >
            ?몄쭛 痍⑥냼
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="flex-[3] h-16 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-2xl font-black text-sm shadow-2xl shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'MASTER RECORD UPDATING...' : '메뉴 저장하기'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default MenuManager;
