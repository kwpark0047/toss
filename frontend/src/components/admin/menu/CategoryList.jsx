import { motion } from 'framer-motion';
import { useState } from 'react';
import { Download, Edit, GripVertical, Plus, Settings, Tag, Trash2 } from 'lucide-react';

export const CategoryList = ({
  categories,
  products,
  selectedCategory,
  setSelectedCategory,
  setEditingCategory,
  setShowCategoryModal,
  handleDeleteCategory,
  handleCatDragStart,
  handleCatDragOver,
  handleCatDrop,
  importFromStore,
  setShowOptionTemplateModal
}) => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStoreId, setImportStoreId] = useState('');

  const handleImportSubmit = () => {
    const id = parseInt(importStoreId.trim(), 10);
    if (!id || Number.isNaN(id)) return;
    setShowImportModal(false);
    setImportStoreId('');
    importFromStore(id);
  };

  return (
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
            onClick={() => setShowImportModal(true)}
            className="w-full py-4 bg-white text-blue-700 rounded-[20px] font-black text-sm hover:bg-blue-50 active:scale-95 transition-all shadow-xl"
          >
            매장 데이터 불러오기
          </button>
        </div>
      </div>

      {/* 가져오기 모달 */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center z-[100] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-slate-900 border border-white/10 rounded-[24px] p-6 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-white">매장 데이터 가져오기</h3>
              <button onClick={() => setShowImportModal(false)} className="p-2 text-slate-400 hover:text-white transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <p className="text-slate-400 text-sm mb-6">가져올 매장의 ID를 입력하세요. 해당 매장의 메뉴가 현재 매장으로 복사됩니다.</p>
            <div className="space-y-4">
              <input
                type="number"
                value={importStoreId}
                onChange={(e) => setImportStoreId(e.target.value)}
                placeholder="매장 ID (숫자)"
                className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none transition-all"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowImportModal(false); setImportStoreId(''); }}
                  className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-black text-sm hover:bg-slate-700 transition-all"
                >
                  취소
                </button>
                <button
                  onClick={handleImportSubmit}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-all"
                >
                  가져오기
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

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
  );
};