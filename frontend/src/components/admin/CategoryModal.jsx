import { useState } from 'react';
import { categoriesAPI } from '../../api';

import { handleApiError } from '../../utils/apiError';
import { motion } from 'framer-motion';

export function CategoryModal({ storeId, category, onClose, onSave }) {
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
}
