import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { categoriesAPI, productsAPI, storesAPI, aiAPI, uploadsAPI, optionTemplatesAPI } from '../../api';
import {
  ArrowLeft, Plus, Edit, Trash2, Clock, Star, Sparkles, Flame, AlertTriangle,
  Image, Tag, FileText, Wand2, ShoppingBag, Download, Store, Folders, Search,
  Upload, Settings, GripVertical, X, ChevronDown, ChevronUp, Package, Leaf,
  LayoutGrid, Check, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatPrice } from '../../utils/format';
import { toast } from 'react-toastify';
import { handleApiError } from '../../utils/apiError';
import BulkMenuModal from './BulkMenuModal';
import MenuWizard from './MenuWizard';
import OptionTemplateModal from './OptionTemplateModal';

// ── 파일 사이즈 포맷 ──────────────────────────────────────────────────────────
const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ── 업종별 샘플 이미지 ────────────────────────────────────────────────────────
const SAMPLE_IMAGES = {
  '한식': [
    { label: '비빔밥', url: 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=600&h=600&fit=crop&auto=format' },
    { label: '찌개류', url: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=600&h=600&fit=crop&auto=format' },
    { label: '구이/삼겹살', url: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600&h=600&fit=crop&auto=format' },
    { label: '볶음밥', url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&h=600&fit=crop&auto=format' },
    { label: '샐러드/나물', url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=600&fit=crop&auto=format' },
    { label: '한정식/정식', url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=600&fit=crop&auto=format' },
  ],
  '일식': [
    { label: '스시/회', url: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&h=600&fit=crop&auto=format' },
    { label: '라멘', url: 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=600&h=600&fit=crop&auto=format' },
    { label: '우동/소바', url: 'https://images.unsplash.com/photo-1618841557871-b4664fbf0cb3?w=600&h=600&fit=crop&auto=format' },
    { label: '돈카츠', url: 'https://images.unsplash.com/photo-1607301405390-d831c242f59b?w=600&h=600&fit=crop&auto=format' },
    { label: '오야코동', url: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=600&h=600&fit=crop&auto=format' },
    { label: '규동/덮밥', url: 'https://images.unsplash.com/photo-1617196034183-421b4040d20d?w=600&h=600&fit=crop&auto=format' },
  ],
  '양식': [
    { label: '파스타', url: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=600&h=600&fit=crop&auto=format' },
    { label: '피자', url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=600&fit=crop&auto=format' },
    { label: '스테이크', url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=600&fit=crop&auto=format' },
    { label: '리조또', url: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=600&h=600&fit=crop&auto=format' },
    { label: '샐러드', url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=600&fit=crop&auto=format' },
    { label: '수프', url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&h=600&fit=crop&auto=format' },
  ],
  '중식': [
    { label: '짜장면', url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&h=600&fit=crop&auto=format' },
    { label: '탕수육', url: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=600&h=600&fit=crop&auto=format' },
    { label: '볶음밥', url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&h=600&fit=crop&auto=format' },
    { label: '딤섬', url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&h=600&fit=crop&auto=format' },
    { label: '마파두부', url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&h=600&fit=crop&auto=format' },
    { label: '깐풍기/닭요리', url: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&h=600&fit=crop&auto=format' },
  ],
  '카페/베이커리': [
    { label: '아메리카노', url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=600&fit=crop&auto=format' },
    { label: '라떼/카푸치노', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&h=600&fit=crop&auto=format' },
    { label: '케이크', url: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&h=600&fit=crop&auto=format' },
    { label: '크루아상', url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&h=600&fit=crop&auto=format' },
    { label: '샌드위치', url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&h=600&fit=crop&auto=format' },
    { label: '에이드/스무디', url: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=600&h=600&fit=crop&auto=format' },
  ],
  '치킨/패스트푸드': [
    { label: '후라이드', url: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&h=600&fit=crop&auto=format' },
    { label: '양념치킨', url: 'https://images.unsplash.com/photo-1585325701165-1e05a5ce1e2c?w=600&h=600&fit=crop&auto=format' },
    { label: '햄버거', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=600&fit=crop&auto=format' },
    { label: '감자튀김', url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&h=600&fit=crop&auto=format' },
    { label: '핫도그', url: 'https://images.unsplash.com/photo-1619740455993-9d622ff67a5e?w=600&h=600&fit=crop&auto=format' },
    { label: '치킨버거', url: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=600&h=600&fit=crop&auto=format' },
  ],
  '분식': [
    { label: '떡볶이', url: 'https://images.unsplash.com/photo-1635363638580-c2809d049eee?w=600&h=600&fit=crop&auto=format' },
    { label: '김밥', url: 'https://images.unsplash.com/photo-1617196034223-cd6d5bfc5bc9?w=600&h=600&fit=crop&auto=format' },
    { label: '라면/라볶이', url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&h=600&fit=crop&auto=format' },
    { label: '순대/어묵', url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=600&fit=crop&auto=format' },
    { label: '튀김', url: 'https://images.unsplash.com/photo-1565310022184-f23a884f29da?w=600&h=600&fit=crop&auto=format' },
    { label: '핫바/꼬치', url: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=600&h=600&fit=crop&auto=format' },
  ],
  '디저트': [
    { label: '아이스크림', url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&h=600&fit=crop&auto=format' },
    { label: '마카롱', url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=600&h=600&fit=crop&auto=format' },
    { label: '케이크/타르트', url: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&h=600&fit=crop&auto=format' },
    { label: '와플', url: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=600&h=600&fit=crop&auto=format' },
    { label: '쿠키/브라우니', url: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&h=600&fit=crop&auto=format' },
    { label: '빙수', url: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=600&h=600&fit=crop&auto=format' },
  ],
};

// ── 드래그 정렬 유틸 ──────────────────────────────────────────────────────────
const reorder = (list, startIdx, endIdx) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIdx, 1);
  result.splice(endIdx, 0, removed);
  return result;
};

// ── 시각적 옵션 에디터 ────────────────────────────────────────────────────────
const VisualOptionEditor = ({ value, onChange }) => {
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    try {
      const parsed = typeof value === 'string' && value.trim()
        ? JSON.parse(value)
        : Array.isArray(value) ? value : [];
      setGroups(parsed);
    } catch {
      setGroups([]);
    }
  }, []);

  const emit = (newGroups) => {
    setGroups(newGroups);
    onChange(JSON.stringify(newGroups));
  };

  const addGroup = () => {
    emit([...groups, { name: '', type: 'radio', required: false, values: [''], prices: [0] }]);
  };

  const removeGroup = (gi) => {
    emit(groups.filter((_, i) => i !== gi));
  };

  const updateGroup = (gi, field, val) => {
    const next = groups.map((g, i) => i === gi ? { ...g, [field]: val } : g);
    emit(next);
  };

  const addChoice = (gi) => {
    const g = groups[gi];
    const next = groups.map((gr, i) => i === gi
      ? { ...gr, values: [...g.values, ''], prices: [...(g.prices || []), 0] }
      : gr);
    emit(next);
  };

  const removeChoice = (gi, vi) => {
    const g = groups[gi];
    const next = groups.map((gr, i) => i === gi
      ? { ...gr, values: g.values.filter((_, j) => j !== vi), prices: (g.prices || []).filter((_, j) => j !== vi) }
      : gr);
    emit(next);
  };

  const updateChoice = (gi, vi, field, val) => {
    const g = groups[gi];
    const next = groups.map((gr, i) => {
      if (i !== gi) return gr;
      if (field === 'name') {
        const v = [...g.values];
        v[vi] = val;
        return { ...gr, values: v };
      }
      if (field === 'price') {
        const p = [...(g.prices || g.values.map(() => 0))];
        p[vi] = parseInt(val) || 0;
        return { ...gr, prices: p };
      }
      return gr;
    });
    emit(next);
  };

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {groups.map((group, gi) => (
          <motion.div
            key={gi}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-slate-950 border border-white/5 rounded-[24px] p-6 space-y-4"
          >
            {/* 그룹 헤더 */}
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-3">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={group.name}
                    onChange={(e) => updateGroup(gi, 'name', e.target.value)}
                    placeholder="옵션 그룹 이름 (예: 굽기, 사이즈)"
                    className="flex-1 h-11 px-4 bg-white/5 border border-white/5 rounded-xl outline-none focus:border-orange-500/50 transition-all text-sm font-bold text-white placeholder:text-slate-700"
                  />
                  <select aria-label="옵션 그룹 유형"
                    value={group.type}
                    onChange={(e) => updateGroup(gi, 'type', e.target.value)}
                    className="w-32 h-11 px-3 bg-white/5 border border-white/5 rounded-xl outline-none focus:border-orange-500/50 transition-all text-xs font-bold text-white appearance-none"
                  >
                    <option value="radio" className="bg-slate-900">단일 선택</option>
                    <option value="checkbox" className="bg-slate-900">복수 선택</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => updateGroup(gi, 'required', !group.required)}
                    className={`h-11 px-4 rounded-xl text-xs font-black border transition-all ${group.required ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-white/5 border-white/5 text-slate-600'}`}
                  >
                    필수
                  </button>
                  <button
                    type="button"
                    onClick={() => removeGroup(gi)}
                    className="h-11 w-11 flex items-center justify-center bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 text-slate-600 rounded-xl border border-white/5 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* 선택지 목록 */}
            <div className="space-y-2 pl-2">
              {group.values.map((choice, vi) => (
                <div key={vi} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-700 shrink-0" />
                  <input
                    type="text"
                    value={choice}
                    onChange={(e) => updateChoice(gi, vi, 'name', e.target.value)}
                    placeholder={`선택지 ${vi + 1}`}
                    className="flex-1 h-9 px-3 bg-white/5 border border-white/5 rounded-lg outline-none focus:border-orange-500/50 transition-all text-sm font-medium text-white placeholder:text-slate-700"
                  />
                  <span className="text-slate-600 text-xs font-bold">+</span>
                  <input
                    type="number"
                    value={(group.prices || [])[vi] || 0}
                    onChange={(e) => updateChoice(gi, vi, 'price', e.target.value)}
                    placeholder="0"
                    className="w-20 h-9 px-3 bg-white/5 border border-white/5 rounded-lg outline-none focus:border-orange-500/50 transition-all text-sm font-mono text-white"
                  />
                  <span className="text-slate-700 text-xs">원</span>
                  <button
                    type="button"
                    onClick={() => removeChoice(gi, vi)}
                    className="w-9 h-9 flex items-center justify-center hover:text-rose-400 text-slate-700 rounded-lg transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addChoice(gi)}
                className="flex items-center gap-2 text-xs font-black text-slate-600 hover:text-orange-400 transition-colors pl-4 mt-1"
              >
                <Plus size={14} /> 선택지 추가
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <button
        type="button"
        onClick={addGroup}
        className="w-full h-12 border-2 border-dashed border-white/5 hover:border-orange-500/30 text-slate-600 hover:text-orange-400 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2"
      >
        <Plus size={16} /> 옵션 그룹 추가
      </button>
    </div>
  );
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
    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
      <div className="w-16 h-16 bg-slate-100 rounded-full mb-4 flex items-center justify-center">
        <Clock className="text-slate-300 animate-spin" />
      </div>
      <p className="text-slate-400 font-bold">메뉴를 불러오는 중...</p>
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
                <div className="py-32 text-center flex flex-col items-center">
                  <div className="w-24 h-24 bg-slate-900 rounded-[32px] flex items-center justify-center mb-8 border border-white/5 shadow-inner group">
                    <ShoppingBag className="text-slate-800 group-hover:text-orange-500 transition-colors" size={48} />
                  </div>
                  <h4 className="text-white text-2xl font-black mb-3">등록된 메뉴가 없습니다</h4>
                  <p className="text-slate-500 font-medium max-w-sm mx-auto">위 버튼을 눌러 메뉴를 추가해보세요</p>
                </div>
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
                      {/* 모바일: 이름+액션 한 줄 */}
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

// ── 카테고리 모달 ─────────────────────────────────────────────────────────────
const CategoryModal = ({ storeId, category, onClose, onSave }) => {
  const [name, setName] = useState(category?.name || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (category) {
        await categoriesAPI.update(category.id, { name });
      } else {
        await categoriesAPI.create({ store_id: parseInt(storeId), name });
      }
      onSave();
    } catch (e) {
      handleApiError(e, '카테고리 저장 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-slate-900 border border-white/10 rounded-[32px] p-10 w-full max-w-md shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-rose-600" />
        <h3 className="text-2xl font-black text-white mb-8 tracking-tight">
          {category ? '카테고리 수정' : '새 카테고리 추가'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Category Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) 메인 요리, 사이드 메뉴, 음료..."
              required
              className="w-full h-16 px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white placeholder:text-slate-700"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 h-16 bg-white/5 text-slate-400 rounded-2xl font-black text-sm hover:bg-white/10 transition-all">취소</button>
            <button type="submit" disabled={loading} className="flex-[2] h-16 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50">
              {loading ? '저장 중...' : '카테고리 저장'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ── 샘플 이미지 피커 ─────────────────────────────────────────────────────────
const SampleImagePicker = ({ onSelect, onClose }) => {
  const cats = Object.keys(SAMPLE_IMAGES);
  const [cat, setCat] = useState(cats[0]);
  const [imgError, setImgError] = useState({});

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-slate-900 border border-white/10 rounded-[40px] w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-8 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-xl font-black text-white">샘플 이미지 선택</h3>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">업종별 기본 메뉴 이미지 · Unsplash</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-white/5 hover:bg-rose-500/10 hover:text-rose-500 text-slate-400 rounded-2xl flex items-center justify-center transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-2 px-8 py-4 overflow-x-auto border-b border-white/5 shrink-0 scrollbar-hide">
          {cats.map(c => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`shrink-0 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                cat === c ? 'bg-orange-500 text-white' : 'bg-white/5 text-slate-500 hover:text-white hover:bg-white/10'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-3 gap-4">
            {SAMPLE_IMAGES[cat].map((img, idx) => (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { onSelect(img.url); onClose(); }}
                className="group relative aspect-square rounded-[20px] overflow-hidden border border-white/10 hover:border-orange-500/50 transition-all shadow-xl"
              >
                {imgError[`${cat}-${idx}`] ? (
                  <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center text-slate-600 gap-2">
                    <Image size={28} />
                    <span className="text-[10px] font-bold">{img.label}</span>
                  </div>
                ) : (
                  <img
                    src={img.url}
                    alt={img.label}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={() => setImgError(prev => ({ ...prev, [`${cat}-${idx}`]: true }))}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all">
                  <p className="text-white text-xs font-black text-center">{img.label}</p>
                </div>
                <div className="absolute top-2 right-2 w-6 h-6 bg-orange-500 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                  <Check size={12} className="text-white" />
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        <div className="px-8 py-4 border-t border-white/5 shrink-0">
          <p className="text-[10px] text-slate-600 font-medium text-center">
            이미지 출처: Unsplash · 상업적 무료 사용 가능 · 실제 등록 시 고화질 촬영 이미지 권장
          </p>
        </div>
      </motion.div>
    </div>
  );
};

// ── 상품 모달 ─────────────────────────────────────────────────────────────────
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
    stock_quantity: product?.stock_quantity ?? '',
    low_stock_threshold: product?.low_stock_threshold ?? 5,
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [aiLoading, setAiLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [optionEditorKey, setOptionEditorKey] = useState(0);
  const [imageInfo, setImageInfo] = useState(null);
  const [showSamplePicker, setShowSamplePicker] = useState(false);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await optionTemplatesAPI.getByStore(storeId);
        setTemplates(Array.isArray(res) ? res : (res?.data || []));
      } catch { /* 옵션 템플릿 없음 */ }
    };
    loadTemplates();
  }, [storeId]);

  const handleFileUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    if (field === 'image_url') {
      const objectUrl = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        setImageInfo({
          name: file.name,
          size: formatFileSize(file.size),
          width: img.width,
          height: img.height,
          isLarge: file.size > 2 * 1024 * 1024,
        });
        URL.revokeObjectURL(objectUrl);
      };
      img.src = objectUrl;
    }

    setUploading(true);
    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await uploadsAPI.uploadImage(fd);
      const url = res?.url || res?.data?.url;
      if (url) {
        setForm(prev => ({
          ...prev,
          [field]: field === 'detail_images'
            ? (prev.detail_images ? prev.detail_images + '\n' + url : url)
            : url
        }));
      }
    } catch (e) { handleApiError(e, '이미지 업로드 실패'); }
    finally { setUploading(false); }
  };

  const handleGenerateAI = async () => {
    if (!form.name) { toast.warn('메뉴 이름을 입력해야 AI 설명을 생성할 수 있습니다.'); return; }
    setAiLoading(true);
    try {
      const catName = categories.find(c => c.id === parseInt(form.category_id))?.name || '';
      const res = await aiAPI.describeMenu({ name: form.name, category: catName, description: form.description });
      if (res?.description) setForm(prev => ({ ...prev, description: res.description }));
    } catch (e) { handleApiError(e, 'AI 설명 생성 중 오류가 발생했습니다'); }
    finally { setAiLoading(false); }
  };

  const applyTemplate = (tpl) => {
    try {
      setForm(prev => ({ ...prev, options: tpl.options || '[]' }));
      setOptionEditorKey(k => k + 1);
    } catch (e) { handleApiError(e, '템플릿 적용 실패'); }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      let parsedOptions = [];
      try {
        if (typeof form.options === 'string' && form.options.trim()) {
          parsedOptions = JSON.parse(form.options);
        } else if (Array.isArray(form.options)) {
          parsedOptions = form.options;
        }
      } catch {
        toast.error('옵션 JSON 형식이 올바르지 않습니다.');
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
        stock_quantity: form.stock_quantity !== '' ? parseInt(form.stock_quantity) : null,
        low_stock_threshold: parseInt(form.low_stock_threshold) || 5,
        is_active: 1
      };

      if (product) {
        await productsAPI.update(product.id, data);
      } else {
        await productsAPI.create(data);
      }
      onSave();
    } catch (e) {
      handleApiError(e, '메뉴 저장 실패');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'basic', label: '기본 정보', icon: FileText },
    { id: 'detail', label: '상세 & 이미지', icon: Image },
    { id: 'options', label: '옵션 설정', icon: Tag },
    { id: 'stock', label: '재고 관리', icon: Package },
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900 border border-white/10 rounded-t-[32px] sm:rounded-[40px] w-full max-w-3xl max-h-[95vh] sm:max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="px-5 py-4 sm:p-10 border-b border-white/5 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-xl sm:text-3xl font-black text-white tracking-tight">
              {product ? '메뉴 수정' : '메뉴 등록'}
            </h3>
            <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">상품 정보 설정</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-white/5 hover:bg-rose-500/10 hover:text-rose-500 text-slate-400 rounded-2xl flex items-center justify-center transition-all flex-shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex px-4 sm:px-10 gap-1 sm:gap-6 border-b border-white/5 bg-white/[0.01] overflow-x-auto scrollbar-hide flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 sm:py-6 flex items-center gap-1.5 sm:gap-3 text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all relative whitespace-nowrap px-2 sm:px-0 ${activeTab === tab.id ? 'text-orange-500' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <tab.icon size={13} className="sm:w-4 sm:h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 sm:h-1 bg-orange-500 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-10 space-y-6 sm:space-y-10">
          {/* 기본 정보 탭 */}
          {activeTab === 'basic' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">메뉴 이름 *</label>
                  <input
                    type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="메뉴 이름을 입력하세요" required
                    className="w-full h-16 px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">가격 (원) *</label>
                  <input
                    type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="0" required
                    className="w-full h-16 px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">카테고리</label>
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
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">조리 시간 (분)</label>
                  <input
                    type="number" value={form.cooking_time} onChange={(e) => setForm({ ...form, cooking_time: e.target.value })}
                    className="w-full h-16 px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">메뉴 요약 설명</label>
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    type="button" onClick={handleGenerateAI} disabled={aiLoading}
                    className="flex items-center gap-2 text-[10px] font-black text-orange-400 bg-orange-500/10 border border-orange-500/20 px-4 py-2 rounded-xl transition-all disabled:opacity-50"
                  >
                    <Sparkles size={14} className={aiLoading ? 'animate-spin' : ''} />
                    {aiLoading ? 'AI 생성 중...' : 'AI 설명 자동생성'}
                  </motion.button>
                </div>
                <textarea
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="메뉴의 특징을 간략하게 입력하세요 (AI 자동생성 가능)"
                  rows={3}
                  className="w-full p-6 bg-white/5 border border-white/5 rounded-3xl outline-none focus:border-orange-500/50 transition-all font-bold text-white placeholder:text-slate-700"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">태그 (쉼표로 구분)</label>
                <input
                  type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="예) 인기, 추천, 채식, 글루텐프리"
                  className="w-full h-14 px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white placeholder:text-slate-700"
                />
                {form.tags && (
                  <div className="flex flex-wrap gap-2 px-1">
                    {form.tags.split(',').map((t, i) => t.trim() && (
                      <span key={i} className="px-3 py-1 bg-orange-500/10 text-orange-400 rounded-lg text-[11px] font-black border border-orange-500/20">#{t.trim()}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { id: 'is_popular', label: '인기 메뉴', icon: Star, color: 'text-amber-400' },
                  { id: 'is_new', label: '신메뉴 표시', icon: Flame, color: 'text-blue-400' },
                  { id: 'is_sold_out', label: '품절 표시', icon: AlertTriangle, color: 'text-rose-500' },
                ].map((toggle) => (
                  <button
                    key={toggle.id} type="button"
                    onClick={() => setForm({ ...form, [toggle.id]: form[toggle.id] ? 0 : 1 })}
                    className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${form[toggle.id] ? `bg-white/5 border-white/20 ${toggle.color}` : 'bg-transparent border-white/5 text-slate-600 hover:border-white/10'}`}
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

          {/* 상세 & 이미지 탭 */}
          {activeTab === 'detail' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* 대표 이미지 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">대표 이미지</label>
                  <div className="flex items-center gap-2 text-[10px] text-slate-600 font-bold">
                    <Info size={11} />
                    <span>권장: 800×800 · 정방형 · 최대 2MB</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Image className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600" size={20} />
                    <input
                      type="text" value={form.image_url}
                      onChange={(e) => { setForm({ ...form, image_url: e.target.value }); setImageInfo(null); }}
                      placeholder="이미지 URL 또는 파일 업로드"
                      className="w-full h-14 pl-16 pr-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white placeholder:text-slate-700 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSamplePicker(true)}
                    className="shrink-0 flex items-center justify-center gap-2 px-5 h-14 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded-2xl transition-all font-black text-xs"
                  >
                    <LayoutGrid size={16} /> 샘플
                  </button>
                  <label className="shrink-0 flex items-center justify-center gap-2 px-5 h-14 bg-white text-slate-950 rounded-2xl cursor-pointer hover:bg-orange-500 hover:text-white transition-all font-black text-xs">
                    <Upload size={16} />
                    {uploading ? '업로드 중...' : '파일 선택'}
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'image_url')} />
                  </label>
                </div>

                {/* 이미지 파일 정보 */}
                <AnimatePresence>
                  {imageInfo && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold overflow-hidden ${
                        imageInfo.isLarge
                          ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                          : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {imageInfo.isLarge ? <AlertTriangle size={14} className="shrink-0" /> : <Check size={14} className="shrink-0" />}
                      <span className="truncate text-slate-300">{imageInfo.name}</span>
                      <span className="text-slate-600 shrink-0">·</span>
                      <span className="shrink-0">{imageInfo.size}</span>
                      <span className="text-slate-600 shrink-0">·</span>
                      <span className="shrink-0">{imageInfo.width}×{imageInfo.height}px</span>
                      {imageInfo.isLarge && (
                        <span className="ml-auto shrink-0 text-rose-400 font-black">용량 초과 — 압축 권장</span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 이미지 미리보기 */}
                {form.image_url && (
                  <div className="relative w-48">
                    <div className="absolute -inset-2 bg-gradient-to-r from-orange-500 to-rose-600 rounded-[28px] blur opacity-20" />
                    <div className="relative aspect-square rounded-[20px] overflow-hidden border border-white/10 shadow-2xl">
                      <img src={form.image_url} alt="미리보기" className="w-full h-full object-cover" />
                    </div>
                    <button
                      type="button"
                      onClick={() => { setForm(prev => ({ ...prev, image_url: '' })); setImageInfo(null); }}
                      className="absolute -top-2 -right-2 w-7 h-7 bg-slate-800 hover:bg-rose-500 text-white rounded-full flex items-center justify-center transition-all border border-white/10 shadow-lg"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* 상세 설명 */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">상세 설명</label>
                <textarea
                  value={form.detail_description} onChange={(e) => setForm({ ...form, detail_description: e.target.value })}
                  placeholder="메뉴의 상세한 설명, 특징, 조리법 등을 입력하세요"
                  rows={4}
                  className="w-full p-6 bg-white/5 border border-white/5 rounded-3xl outline-none focus:border-orange-500/50 transition-all font-bold text-white placeholder:text-slate-700"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">🌶️ 매운맛 강도 (0~5)</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range" min="0" max="5" value={form.spicy_level}
                      onChange={(e) => setForm({ ...form, spicy_level: parseInt(e.target.value) })}
                      className="flex-1 accent-orange-500"
                    />
                    <span className="text-white font-black text-lg w-8 text-center">{form.spicy_level}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">알레르기 정보</label>
                  <input
                    type="text" value={form.allergens} onChange={(e) => setForm({ ...form, allergens: e.target.value })}
                    placeholder="예) 땅콩, 밀, 우유, 계란..."
                    className="w-full h-14 px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white placeholder:text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2"><Leaf size={12} /> 원재료</label>
                  <textarea
                    value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })}
                    placeholder="주요 원재료를 입력하세요"
                    rows={3}
                    className="w-full p-4 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white placeholder:text-slate-700 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">영양 정보</label>
                  <textarea
                    value={form.nutrition_info} onChange={(e) => setForm({ ...form, nutrition_info: e.target.value })}
                    placeholder="칼로리, 탄수화물, 단백질, 지방 등"
                    rows={3}
                    className="w-full p-4 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white placeholder:text-slate-700 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 옵션 설정 탭 */}
          {activeTab === 'options' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {templates.length > 0 && (
                <div className="p-6 bg-orange-500/5 border border-orange-500/10 rounded-[24px] space-y-4">
                  <div className="flex items-center gap-3">
                    <Settings className="text-orange-500" size={18} />
                    <h4 className="text-white font-black text-sm">옵션 템플릿 적용</h4>
                    <span className="text-[10px] font-black text-orange-500/50 uppercase ml-auto">{templates.length}개 사용 가능</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {templates.map(t => (
                      <button key={t.id} type="button" onClick={() => applyTemplate(t)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[11px] font-black border border-white/5 transition-all">
                        {t.name} 적용
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-4 px-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">옵션 그룹 설정</label>
                  <span className="text-[10px] text-slate-600 font-bold">추가금은 기본 가격에 더해집니다</span>
                </div>
                <VisualOptionEditor
                  key={optionEditorKey}
                  value={form.options}
                  onChange={(val) => setForm(prev => ({ ...prev, options: val }))}
                />
              </div>
            </div>
          )}

          {/* 재고 관리 탭 */}
          {activeTab === 'stock' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-8 bg-blue-500/5 border border-blue-500/10 rounded-[28px]">
                <div className="flex items-center gap-3 mb-6">
                  <Package className="text-blue-400" size={20} />
                  <h4 className="text-white font-black">재고 수량 관리</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">현재 재고 수량</label>
                    <input
                      type="number" value={form.stock_quantity}
                      onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                      placeholder="비워두면 무제한"
                      className="w-full h-14 px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-blue-500/50 transition-all font-bold text-white placeholder:text-slate-700"
                    />
                    <p className="text-[10px] text-slate-600 font-medium px-2">비워두면 재고 제한 없이 주문 가능</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">부족 알림 기준 (개)</label>
                    <input
                      type="number" value={form.low_stock_threshold}
                      onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                      placeholder="5"
                      className="w-full h-14 px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-blue-500/50 transition-all font-bold text-white"
                    />
                    <p className="text-[10px] text-slate-600 font-medium px-2">이 수량 이하일 때 부족 경보 알림 발송</p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-800/50 rounded-[24px] border border-white/5">
                <p className="text-sm text-slate-400 font-medium leading-relaxed">
                  재고 이력 및 입출고 조정은 <strong className="text-white">재고 관리 메뉴</strong>에서 상세하게 처리할 수 있습니다.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 sm:p-10 border-t border-white/5 bg-white/[0.01] flex gap-3 flex-shrink-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
          <button type="button" onClick={onClose} className="flex-1 h-12 sm:h-16 bg-white/5 text-slate-400 rounded-2xl font-black text-sm hover:bg-white/10 transition-all">
            취소
          </button>
          <button
            onClick={handleSubmit} disabled={loading}
            className="flex-[3] h-12 sm:h-16 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? '저장 중...' : product ? '메뉴 수정' : '메뉴 등록'}
          </button>
        </div>
      </motion.div>

      {showSamplePicker && (
        <SampleImagePicker
          onSelect={(url) => { setForm(prev => ({ ...prev, image_url: url })); setImageInfo(null); setActiveTab('detail'); }}
          onClose={() => setShowSamplePicker(false)}
        />
      )}
    </div>
  );
};

export default MenuManager;
