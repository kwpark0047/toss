import { useRef } from 'react';
import { Move, X } from 'lucide-react';

export const CARD_W = 130;
export const CARD_H = 80;

export default function TableLayoutCard({ table, canvasRef, onMove, onDelete }) {
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e) => {
    if (e.target.closest('[data-del]')) return;
    e.preventDefault();
    isDragging.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left - table.x,
      y: e.clientY - rect.top - table.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(0, Math.min(Math.round(e.clientX - rect.left - dragOffset.current.x), rect.width - CARD_W));
    const newY = Math.max(0, Math.min(Math.round(e.clientY - rect.top - dragOffset.current.y), rect.height - CARD_H));
    onMove(table.id, newX, newY);
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  const isBase = table.table_number === '기본QR';

  return (
    <div
      style={{ position: 'absolute', left: table.x, top: table.y, width: CARD_W, height: CARD_H, touchAction: 'none', zIndex: 10 }}
      className="select-none cursor-grab active:cursor-grabbing group"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className={`w-full h-full rounded-2xl border-2 flex flex-col items-center justify-center gap-1 shadow-lg transition-shadow group-active:shadow-2xl
        ${isBase
          ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/60'
          : 'bg-gradient-to-br from-slate-700/80 to-slate-800/80 border-slate-500/60'
        }`}>
        {/* 이동 핸들 아이콘 */}
        <Move size={11} className={`${isBase ? 'text-amber-400/60' : 'text-slate-500'}`} />
        {/* 테이블 번호 */}
        <span className={`text-xs font-black leading-none ${isBase ? 'text-amber-300' : 'text-white'}`}>
          {table.table_number}
        </span>
        {!isBase && (
          <span className="text-[10px] text-slate-500 font-medium">{table.capacity}인석</span>
        )}
        {isBase && (
          <span className="text-[10px] text-amber-500 font-medium">매장 공통 QR</span>
        )}
      </div>
      {/* 삭제 버튼 */}
      {!isBase && (
        <button
          data-del="1"
          onClick={() => onDelete(table.id)}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-rose-500 border-2 border-slate-900 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-400 z-20"
        >
          <X size={10} className="text-white" />
        </button>
      )}
    </div>
  );
}
