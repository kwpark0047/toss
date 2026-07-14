import { useState, useCallback, useRef, useEffect } from 'react';
import { tablesAPI } from '../../api';
import { Save, Move, MousePointer2, Loader2, RefreshCw, X } from 'lucide-react';
import { toast } from 'react-toastify';

const GRID_SIZE = 20;
const TABLE_SIZE = 72; // px — 터치 타겟 크기

const STATUS = {
  available: { label: '이용 가능', color: 'bg-white text-orange-500 border-orange-200 hover:border-orange-500 hover:shadow-lg hover:shadow-orange-500/10', border: 'border-2', dot: 'bg-orange-500', text: 'text-orange-600', bg: 'hover:bg-orange-50' },
  occupied:  { label: '이용 중',   color: 'bg-slate-900 text-white border-slate-950 hover:bg-slate-800',    border: 'border-2',    dot: 'bg-slate-900',    text: 'text-slate-900',    bg: 'hover:bg-slate-100' },
  reserved:  { label: '예약됨',    color: 'bg-orange-500 text-white border-orange-600 hover:bg-orange-400',  border: 'border-2',  dot: 'bg-orange-500',  text: 'text-orange-600',   bg: 'hover:bg-orange-50' },
  dirty:     { label: '정리 필요', color: 'bg-amber-400 text-slate-900 border-amber-500 hover:bg-amber-300',   border: 'border-2',   dot: 'bg-amber-400',   text: 'text-amber-700',   bg: 'hover:bg-amber-50' },
};

export default function VisualTableMap({ storeId, tables, onUpdate }) {
  const [items, setItems]           = useState([]);
  const [isEditing, setIsEditing]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [selected, setSelected]     = useState(null);
  const [mapHeight, setMapHeight]   = useState(480);
  const mapRef      = useRef(null);
  const touchRef    = useRef(null);   // { id, startX, startY, itemX, itemY }
  const containerRef = useRef(null);

  /* 반응형 맵 높이 */
  useEffect(() => {
    const update = () => {
      const w = containerRef.current?.offsetWidth || window.innerWidth;
      setMapHeight(window.innerWidth < 640 ? Math.round(w * 1.1) : 480);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    setItems(tables.map(t => ({ ...t, x: t.x ?? 0, y: t.y ?? 0 })));
  }, [tables]);

  /* ─── 데스크탑 드래그 ─── */
  const handleDragEnd = (id, e) => {
    if (!isEditing) return;
    const mapRect = mapRef.current.getBoundingClientRect();
    const newX = Math.round((e.clientX - mapRect.left - TABLE_SIZE / 2) / GRID_SIZE) * GRID_SIZE;
    const newY = Math.round((e.clientY - mapRect.top  - TABLE_SIZE / 2) / GRID_SIZE) * GRID_SIZE;
    moveItem(id, newX, newY, mapRect.width);
  };

  /* ─── 터치 드래그 ─── */
  const handleTouchStart = (id, e) => {
    if (!isEditing) return;
    const t = e.touches[0];
    const item = items.find(i => i.id === id);
    touchRef.current = { id, startX: t.clientX, startY: t.clientY, itemX: item.x, itemY: item.y };
  };

  const handleTouchMove = useCallback((e) => {
    if (!isEditing || !touchRef.current) return;
    e.preventDefault();
    const t = e.touches[0];
    const { id, startX, startY, itemX, itemY } = touchRef.current;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    const mapRect = mapRef.current.getBoundingClientRect();
    const newX = Math.round((itemX + dx) / GRID_SIZE) * GRID_SIZE;
    const newY = Math.round((itemY + dy) / GRID_SIZE) * GRID_SIZE;
    moveItem(id, newX, newY, mapRect.width);
  }, [isEditing, items]);

  const handleTouchEnd = () => { touchRef.current = null; };

  const moveItem = (id, rawX, rawY, mapW) => {
    const bx = Math.max(0, Math.min(rawX, mapW - TABLE_SIZE));
    const by = Math.max(0, Math.min(rawY, mapHeight - TABLE_SIZE));
    setItems(prev => prev.map(i => i.id === id ? { ...i, x: bx, y: by } : i));
  };

  /* ─── 저장 ─── */
  const saveLayout = async () => {
    setSaving(true);
    try {
      await Promise.all(items.map(item => tablesAPI.update(item.id, { x: item.x, y: item.y })));
      setIsEditing(false);
      onUpdate?.();
      toast.success('레이아웃이 저장되었습니다.');
    } catch {
      toast.error('레이아웃 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  /* ─── 상태 변경 ─── */
  const handleStatusChange = async (e, tableId, newStatus) => {
    e.stopPropagation();
    try {
      await tablesAPI.update(tableId, { status: newStatus });
      setSelected(null);
      onUpdate?.();
    } catch {
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  /* 팝오버가 맵 밖으로 나가지 않도록 방향 결정 */
  const popoverDir = (item) => {
    const mapH = mapHeight;
    return item.y + TABLE_SIZE + 160 > mapH ? 'up' : 'down';
  };

  return (
    <div ref={containerRef} className="space-y-4">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm lg:text-base font-black text-white truncate">비주얼 테이블 맵</h3>
          <p className="text-[10px] lg:text-xs text-slate-500 font-medium mt-0.5 hidden sm:block">
            실제 매장 구조에 맞춰 테이블을 배치하세요.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isEditing ? (
            <>
              <button
                onClick={() => { setItems(tables.map(t => ({ ...t, x: t.x ?? 0, y: t.y ?? 0 }))); setIsEditing(false); }}
                className="h-9 px-3 lg:px-4 bg-white/5 border border-white/10 text-slate-400 rounded-xl text-xs font-black hover:bg-white/10 transition-all"
              >
                취소
              </button>
              <button
                onClick={saveLayout}
                disabled={saving}
                className="h-9 px-3 lg:px-4 bg-orange-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 hover:bg-orange-400 transition-all shadow-lg shadow-orange-500/20 disabled:opacity-60"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                저장
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="h-9 px-3 lg:px-4 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-xs font-black flex items-center gap-1.5 hover:bg-white/10 transition-all"
            >
              <Move size={13} className="text-slate-500" />
              위치 편집
            </button>
          )}
          <button
            onClick={onUpdate}
            className="w-9 h-9 bg-white/5 border border-white/10 text-slate-500 rounded-xl flex items-center justify-center hover:text-white hover:bg-white/10 transition-all"
            title="새로고침"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── 지도 캔버스 ── */}
      <div
        ref={mapRef}
        className={`relative w-full rounded-2xl overflow-hidden touch-none ${isEditing ? 'cursor-move' : 'cursor-default'}`}
        style={{
          height: mapHeight,
          background: 'rgba(255,255,255,0.02)',
          border: '1.5px dashed rgba(255,255,255,0.06)',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
        }}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => !isEditing && setSelected(null)}
      >
        {/* 첨부 이미지 데코레이션: 스터디카페 구역 레이블 */}
        <div className="absolute inset-0 pointer-events-none select-none z-0">
          <div className="absolute top-5 left-1/2 -translate-x-1/2 text-[11px] font-black text-slate-500/20 tracking-[0.3em] uppercase">프리미엄 석 (V)</div>
          <div className="absolute top-[140px] left-1/2 -translate-x-1/2 text-[11px] font-black text-slate-500/20 tracking-[0.3em] uppercase">독립식 (S)</div>
          <div className="absolute top-[240px] left-[25%] text-[10px] font-black text-slate-500/20 tracking-[0.2em]">푸드 존</div>
          <div className="absolute top-[370px] left-[25%] text-[10px] font-black text-slate-500/20 tracking-[0.2em]">푸드 존</div>
          <div className="absolute top-[200px] right-[15%] text-[10px] font-black text-slate-500/20 tracking-[0.2em] [writing-mode:vertical-rl] rotate-180">노트북 존</div>
          <div className="absolute top-[200px] left-[20px] text-[10px] font-black text-slate-500/20 tracking-[0.2em] [writing-mode:vertical-rl]">대기석</div>
          <div className="absolute top-[320px] left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-500/15 tracking-[0.1em]">C&C 복합기 & 워트 디스펜서</div>
          <div className="absolute top-[345px] left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-500/15 tracking-[0.1em]">커피머신 & 키오스크</div>
        </div>

        {/* 편집 모드 오버레이 안내 */}
        {isEditing && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 bg-orange-500/90 backdrop-blur-sm text-white text-[10px] font-black rounded-full shadow-lg tracking-widest uppercase pointer-events-none">
            드래그하여 위치 조정
          </div>
        )}

        {items.map((table) => {
          const st = STATUS[table.status] ?? STATUS.available;
          const dir = popoverDir(table);
          const isSelected = selected === table.id;

          return (
            <div
              key={table.id}
              draggable={isEditing}
              onDragEnd={(e) => handleDragEnd(table.id, e)}
              onTouchStart={(e) => handleTouchStart(table.id, e)}
              onClick={(e) => {
                e.stopPropagation();
                if (!isEditing) setSelected(isSelected ? null : table.id);
              }}
              className={`absolute flex flex-col items-center justify-center rounded-2xl transition-all select-none z-10
                ${st.color} ${st.border}
                ${isEditing ? 'active:scale-95 opacity-90' : 'hover:brightness-110 active:brightness-90'}
                ${isSelected ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-transparent scale-105 shadow-xl shadow-orange-500/15' : ''}
              `}
              style={{
                left: table.x,
                top: table.y,
                width: TABLE_SIZE,
                height: TABLE_SIZE,
                boxShadow: `0 4px 16px -4px rgba(0,0,0,0.35)`,
                userSelect: 'none',
                WebkitUserSelect: 'none',
                touchAction: isEditing ? 'none' : 'auto',
              }}
            >
              <span className="text-[9px] font-black tracking-tight leading-none opacity-60">{table.capacity > 0 ? `${table.capacity}인석` : '매장 공통'}</span>
              <span className="text-sm font-black leading-none mt-1 max-w-[62px] text-center truncate px-1">
                {table.table_number || table.name}
              </span>

              {/* 사용 중 펄스 인디케이터 */}
              {!isEditing && table.status === 'occupied' && (
                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
              )}

              {/* 드래그 아이콘 */}
              {isEditing && <Move size={12} className="absolute bottom-2 opacity-50" />}

              {/* 상태 팝오버 */}
              {!isEditing && isSelected && (
                <div
                  className={`absolute ${dir === 'up' ? 'bottom-[calc(100%+10px)]' : 'top-[calc(100%+10px)]'} left-1/2 -translate-x-1/2 z-50`}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 w-36 space-y-0.5">
                    <div className="flex items-center justify-between px-2 pb-1.5 border-b border-slate-100 mb-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">상태 변경</span>
                      <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700">
                        <X size={12} />
                      </button>
                    </div>
                    {Object.entries(STATUS).map(([key, s]) => (
                      <button
                        key={key}
                        onClick={(e) => handleStatusChange(e, table.id, key)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold text-slate-700 transition-all ${s.bg} ${table.status === key ? 'bg-slate-50' : ''}`}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                        {s.label}
                        {table.status === key && <span className="ml-auto text-[9px] font-black text-slate-400">현재</span>}
                      </button>
                    ))}
                  </div>
                  {/* 말풍선 꼬리 */}
                  <div className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-slate-100 rotate-45
                    ${dir === 'up' ? '-bottom-1.5 border-r border-b' : '-top-1.5 border-l border-t'}`} />
                </div>
              )}
            </div>
          );
        })}

        {/* 빈 상태 */}
        {items.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
              <MousePointer2 size={28} className="text-slate-700" />
            </div>
            <p className="text-slate-600 font-bold text-sm">등록된 테이블이 없습니다</p>
            <p className="text-slate-700 text-xs">우측 상단 테이블 추가 버튼을 눌러보세요</p>
          </div>
        )}

        {/* 팝오버 닫기 투명 오버레이 */}
        {selected && !isEditing && (
          <div className="absolute inset-0 z-40" onClick={() => setSelected(null)} />
        )}
      </div>

      {/* ── 범례 ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center">
        {Object.entries(STATUS).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
            <span className="text-[11px] text-slate-500 font-bold">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
