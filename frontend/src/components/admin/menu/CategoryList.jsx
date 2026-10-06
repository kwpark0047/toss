import { useEffect, useRef, useState } from 'react';
import { Download, Edit, GripVertical, Plus, Settings, Trash2, X } from 'lucide-react';

export const CategoryList = ({categories, products, selectedCategory, setSelectedCategory, setEditingCategory, setShowCategoryModal, handleDeleteCategory, handleCatDragStart, handleCatDragOver, handleCatDrop, importFromStore, setShowOptionTemplateModal}) => {
  const [showImport, setShowImport] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const dialog = useRef(null);
  useEffect(() => { if(showImport && !dialog.current.open) dialog.current.showModal(); else if(!showImport && dialog.current.open) dialog.current.close(); }, [showImport]);
  const add = () => { setEditingCategory(null); setShowCategoryModal(true); };
  const categoryRows = <div className="space-y-1 p-2">
    <button type="button" onClick={() => setSelectedCategory(null)} aria-pressed={selectedCategory === null} className={'menu-category w-full flex justify-between rounded-lg px-3 py-3 '+(selectedCategory === null ? 'menu-selected' : '')}>전체 메뉴<span className="tabular-nums">{products.length}</span></button>
    {categories.map((cat,index) => <div key={cat.id} draggable onDragStart={() => handleCatDragStart(index)} onDragOver={e => handleCatDragOver(e,index)} onDrop={handleCatDrop} className="flex items-center gap-1 rounded-lg">
      <GripVertical size={14} className="text-slate-500 shrink-0" aria-hidden="true" />
      <button type="button" aria-pressed={selectedCategory === cat.id} onClick={() => setSelectedCategory(cat.id)} className={'menu-category min-w-0 flex-1 text-left py-3 px-2 rounded-lg '+(selectedCategory === cat.id ? 'menu-selected' : '')}><span className="block truncate">{cat.name} <span className="text-slate-400 tabular-nums">{products.filter(p => p.category_id === cat.id).length}</span></span></button>
      <button type="button" aria-label={cat.name+' 카테고리 편집'} onClick={() => {setEditingCategory(cat);setShowCategoryModal(true);}} className="menu-quiet p-2 rounded-lg"><Edit size={14} /></button>
      <button type="button" aria-label={cat.name+' 카테고리 삭제'} onClick={() => handleDeleteCategory(cat.id)} className="menu-quiet p-2 rounded-lg text-rose-400"><Trash2 size={14} /></button>
    </div>)}
    {categories.length === 0 && <p className="p-2 text-xs text-slate-400">카테고리를 만들면 메뉴를 쉽게 찾을 수 있어요.</p>}
  </div>;
  return <aside className="min-w-0 space-y-3" aria-label="카테고리 및 메뉴 도구">
    <div className="menu-panel hidden lg:block rounded-xl"><div className="p-3 border-b border-white/10 flex items-center justify-between"><h2 className="font-semibold text-white">카테고리</h2><button type="button" aria-label="카테고리 추가" onClick={add} className="menu-quiet p-2 rounded-lg"><Plus size={16} /></button></div>{categoryRows}<p className="px-3 pb-3 text-xs text-slate-400">항목을 드래그해 순서 변경</p></div>
    <details className="menu-panel rounded-xl lg:hidden"><summary className="p-3 cursor-pointer text-white">카테고리 편집</summary>{categoryRows}<button type="button" onClick={add} className="menu-quiet m-2 px-3 py-2 rounded-lg">+ 카테고리 추가</button></details>
    <details className="menu-panel rounded-xl"><summary className="p-3 cursor-pointer text-white">가져오기 · 옵션 도구</summary><div className="border-t border-white/10 p-3 space-y-2"><button type="button" onClick={() => setShowImport(true)} className="menu-quiet w-full inline-flex items-center gap-2 rounded-lg px-3 py-2"><Download size={16} />다른 매장 메뉴 가져오기</button><button type="button" onClick={() => setShowOptionTemplateModal(true)} className="menu-quiet w-full inline-flex items-center gap-2 rounded-lg px-3 py-2"><Settings size={16} />옵션 템플릿 관리</button></div></details>
    <dialog ref={dialog} onCancel={() => setShowImport(false)} onClose={() => setShowImport(false)} className="menu-import-dialog menu-panel rounded-xl p-5 w-[calc(100%-32px)] max-w-md">
      <form onSubmit={e => {e.preventDefault(); const id=Number(sourceId); if(!Number.isInteger(id)||id<=0)return; importFromStore(id); setShowImport(false);setSourceId('');}} className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="font-semibold text-white">다른 매장 메뉴 가져오기</h2><button type="button" aria-label="가져오기 닫기" onClick={() => setShowImport(false)} className="menu-quiet p-2 rounded-lg"><X size={18} /></button></div>
        <p className="text-sm text-slate-400">가져올 매장 ID를 입력하세요. 해당 매장의 메뉴가 현재 매장으로 복사됩니다.</p>
        <label className="block text-sm text-white">매장 ID<input autoFocus required min="1" step="1" type="number" value={sourceId} onChange={e => setSourceId(e.target.value)} className="menu-field mt-2 w-full rounded-lg px-3 py-3" /></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowImport(false)} className="menu-quiet rounded-lg px-4 py-3">취소</button><button type="submit" className="menu-primary rounded-lg px-4 py-3">메뉴 가져오기</button></div>
      </form>
    </dialog>
  </aside>;
};
