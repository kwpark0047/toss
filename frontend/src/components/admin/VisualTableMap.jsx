import { useState, useCallback, useRef, useEffect } from 'react';
import { tablesAPI } from '../../api';
import { Save, Move, MousePointer2, Loader2, RefreshCw } from 'lucide-react';

const GRID_SIZE = 20;
const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;

/**
 * [VisualTableMap]
 * 매장의 테이블을 실제 도면처럼 배치하고 상태를 확인할 수 있는 비주얼 맵 컴포넌트입니다.
 */
export default function VisualTableMap({ storeId, tables, onUpdate }) {
    const [items, setItems] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedTable, setSelectedTable] = useState(null); // 상태 변경 팝오버용
    const mapRef = useRef(null);

    useEffect(() => {
        setItems(tables.map(t => ({
            ...t,
            x: t.x || 0,
            y: t.y || 0
        })));
    }, [tables]);

    const handleDrag = (id, e) => {
        if (!isEditing) return;

        const mapRect = mapRef.current.getBoundingClientRect();
        const newX = Math.round((e.clientX - mapRect.left - 40) / GRID_SIZE) * GRID_SIZE;
        const newY = Math.round((e.clientY - mapRect.top - 40) / GRID_SIZE) * GRID_SIZE;

        // 맵 경계 제한
        const boundedX = Math.max(0, Math.min(newX, MAP_WIDTH - 80));
        const boundedY = Math.max(0, Math.min(newY, MAP_HEIGHT - 80));

        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, x: boundedX, y: boundedY } : item
        ));
    };

    const saveLayout = async () => {
        setSaving(true);
        try {
            await Promise.all(items.map(item =>
                tablesAPI.update(item.id, { x: item.x, y: item.y })
            ));
            setIsEditing(false);
            onUpdate?.();
        } catch (error) {
            alert('레이아웃 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (e, tableId, newStatus) => {
        e.stopPropagation();
        try {
            await tablesAPI.update(tableId, { status: newStatus });
            setSelectedTable(null);
            onUpdate?.(); // 상위 컴포넌트(TableManager)에서 fetch => socket으로 브로드캐스트
        } catch (error) {
            alert('상태 업데이트에 실패했습니다.');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'occupied': return 'bg-blue-500 border-blue-600';
            case 'dirty': return 'bg-yellow-500 border-yellow-600';
            case 'reserved': return 'bg-purple-500 border-purple-600';
            default: return 'bg-green-500 border-green-600';
        }
    };

    return (
        <div className="bg-gray-100 rounded-2xl p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold">비주얼 테이블 맵</h3>
                    <p className="text-sm text-gray-500">실제 매장 구조에 맞춰 테이블을 배치하세요.</p>
                </div>
                <div className="flex gap-2">
                    {isEditing ? (
                        <>
                            <button
                                onClick={() => { setItems(tables); setIsEditing(false); }}
                                className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all"
                            >
                                취소
                            </button>
                            <button
                                onClick={saveLayout}
                                disabled={saving}
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                레이아웃 저장
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-gray-50 transition-all"
                        >
                            <Move className="w-4 h-4 text-gray-400" />
                            위치 편집모드
                        </button>
                    )}
                    <button
                        onClick={onUpdate}
                        className="p-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all"
                        title="상태 새로고침"
                    >
                        <RefreshCw className="w-4 h-4 text-gray-400" />
                    </button>
                </div>
            </div>

            <div
                ref={mapRef}
                className="relative bg-white border-2 border-dashed border-gray-200 rounded-xl mx-auto shadow-inner overflow-hidden"
                style={{ width: MAP_WIDTH, height: MAP_HEIGHT, backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)', backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px` }}
            >
                {items.map((table) => (
                    <div
                        key={table.id}
                        draggable={isEditing}
                        onDragEnd={(e) => handleDrag(table.id, e)}
                        onClick={(e) => {
                            if (!isEditing) {
                                e.stopPropagation();
                                setSelectedTable(selectedTable === table.id ? null : table.id);
                            }
                        }}
                        className={`absolute w-20 h-20 rounded-2xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer shadow-sm
              ${getStatusColor(table.status)} text-white
              ${isEditing ? 'opacity-80 hover:scale-105 active:scale-95' : 'hover:brightness-95'}
            `}
                        style={{
                            left: table.x,
                            top: table.y,
                            userSelect: 'none'
                        }}
                    >
                        <span className="text-xs font-bold opacity-80">{table.capacity}인석</span>
                        <span className="text-lg font-black">{table.table_number}</span>
                        {!isEditing && table.status === 'occupied' && (
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                        )}
                        {isEditing && <Move className="w-4 h-4 mt-1 opacity-50" />}

                        {/* 상태 변경 팝오버 UI */}
                        {!isEditing && selectedTable === table.id && (
                            <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-gray-100 p-2 w-32 z-50 flex flex-col gap-1 text-gray-800" onClick={e => e.stopPropagation()}>
                                <button onClick={(e) => handleStatusChange(e, table.id, 'available')} className="px-3 py-1.5 text-xs font-bold text-left rounded-lg hover:bg-green-50 hover:text-green-700 w-full flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div>이용 가능</button>
                                <button onClick={(e) => handleStatusChange(e, table.id, 'occupied')} className="px-3 py-1.5 text-xs font-bold text-left rounded-lg hover:bg-blue-50 hover:text-blue-700 w-full flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div>이용 중</button>
                                <button onClick={(e) => handleStatusChange(e, table.id, 'dirty')} className="px-3 py-1.5 text-xs font-bold text-left rounded-lg hover:bg-yellow-50 hover:text-yellow-700 w-full flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500"></div>정리 필요</button>
                                <button onClick={(e) => handleStatusChange(e, table.id, 'reserved')} className="px-3 py-1.5 text-xs font-bold text-left rounded-lg hover:bg-purple-50 hover:text-purple-700 w-full flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500"></div>예약됨</button>
                            </div>
                        )}
                    </div>
                ))}

                {items.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                        <MousePointer2 className="w-12 h-12 mb-4 opacity-20" />
                        <p>등록된 테이블이 없습니다.</p>
                    </div>
                )}

                {/* 맵 빈 공간 클릭 시 팝오버 닫기용 오버레이 */}
                {selectedTable && (
                    <div className="absolute inset-0 z-40" onClick={() => setSelectedTable(null)} />
                )}
            </div>

            <div className="mt-6 flex flex-wrap gap-4 text-sm justify-center">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                    <span className="text-gray-600">이용 가능</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full" />
                    <span className="text-gray-600">이용 중</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                    <span className="text-gray-600">정리 필요</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full" />
                    <span className="text-gray-600">예약됨</span>
                </div>
            </div>
        </div>
    );
}
