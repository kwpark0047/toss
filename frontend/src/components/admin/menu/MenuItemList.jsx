import { motion, AnimatePresence } from 'framer-motion';
import EmptyState from '../../common/EmptyState';
import { formatPrice } from '../../../utils/format';
import Icon from "../../ui/Icon";
import { Clock, Edit, ImageIcon, Search, ShoppingBag, Trash2 } from 'lucide-react';

export const MenuItemList = ({
  products,
  categories,
  selectedCategory,
  setSelectedCategory,
  searchTerm,
  setSearchTerm,
  selectedProducts,
  filteredProducts,
  handleSelectAll,
  handleSelectProduct,
  handleBulkStatusUpdate,
  handleBulkDelete,
  setEditingProduct,
  setShowProductModal,
  handleDeleteProduct
}) => {
  return (
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
                        <ImageIcon size={18} className="lg:hidden" />
                        <ImageIcon size={32} className="hidden lg:block" />
                      </div>
                    )}
                    {product.is_popular ? (
                      <div className="absolute top-1 left-1 lg:top-4 lg:left-4 bg-amber-400 text-slate-950 p-1 lg:p-2 rounded-lg shadow-lg">
                        <Icon icon="Star" />
                        <Icon icon="Star" />
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
  );
};