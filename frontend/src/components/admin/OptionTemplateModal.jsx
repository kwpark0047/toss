import { useState, useEffect } from 'react';
import { X, Plus, Trash2, FileText } from 'lucide-react';
import { optionTemplatesAPI } from '../../api';

const OptionTemplateModal = ({ storeId, onClose }) => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [newTemplate, setNewTemplate] = useState({ name: '', options: [] });

    useEffect(() => {
        fetchTemplates();
    }, [storeId]);

    const fetchTemplates = async () => {
        try {
            const res = await optionTemplatesAPI.getByStore(storeId);
            setTemplates(res || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!newTemplate.name) return alert('이름을 입력하세요.');
        try {
            if (editingTemplate) {
                await optionTemplatesAPI.update(editingTemplate.id, {
                    name: newTemplate.name,
                    options: JSON.stringify(newTemplate.options)
                });
            } else {
                await optionTemplatesAPI.create({
                    store_id: storeId,
                    name: newTemplate.name,
                    options: JSON.stringify(newTemplate.options)
                });
            }
            setNewTemplate({ name: '', options: [] });
            setEditingTemplate(null);
            fetchTemplates();
        } catch {
            alert('저장 실패');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('삭제하시겠습니까?')) return;
        try {
            await optionTemplatesAPI.delete(id);
            fetchTemplates();
        } catch {
            alert('삭제 실패');
        }
    };

    const addOptionField = () => {
        setNewTemplate(prev => ({
            ...prev,
            options: [...prev.options, { name: '', values: [], type: 'radio' }]
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
                <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                        <FileText className="text-blue-500" /> 옵션 템플릿 관리
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* 목록 */}
                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-400 text-xs uppercase tracking-widest">저장된 템플릿</h4>
                        {loading ? <p>로딩 중...</p> : (
                            <div className="space-y-2">
                                {templates.map(t => {
                                    const openEdit = () => {
                                        setEditingTemplate(t);
                                        setNewTemplate({ name: t.name, options: JSON.parse(t.options || '[]') });
                                    };
                                    return (
                                    <div key={t.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group">
                                        <div
                                            className="cursor-pointer flex-1"
                                            role="button"
                                            tabIndex={0}
                                            onClick={openEdit}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(); } }}
                                        >
                                            <p className="font-black text-slate-800">{t.name}</p>
                                            <p className="text-[10px] text-slate-400 font-bold">{JSON.parse(t.options || '[]').length}개의 옵션</p>
                                        </div>
                                        <button onClick={() => handleDelete(t.id)} aria-label={`${t.name} 템플릿 삭제`} className="p-2 text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100">
                                            <Trash2 size={16} aria-hidden="true" />
                                        </button>
                                    </div>
                                    );
                                })}
                                {templates.length === 0 && <p className="text-sm text-slate-300 py-4">저장된 템플릿이 없습니다.</p>}
                            </div>
                        )}
                    </div>

                    {/* 추가/수정 폼 */}
                    <div className="space-y-4 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                        <h4 className="font-bold text-slate-900 text-sm">{editingTemplate ? '템플릿 수정' : '새 템플릿 추가'}</h4>
                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="템플릿 이름 (예: 추천 옵션)"
                                className="w-full px-4 py-3 rounded-xl border-0 bg-white shadow-sm font-bold outline-none ring-1 ring-slate-100 focus:ring-blue-500"
                                value={newTemplate.name}
                                onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })}
                            />

                            <div className="space-y-2">
                                {newTemplate.options.map((opt, i) => (
                                    <div key={i} className="bg-white p-3 rounded-xl shadow-sm space-y-2 border border-slate-100">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                placeholder="옵션명 (예: 맵기)"
                                                className="flex-1 text-xs font-bold outline-none border-b border-slate-100 pb-1"
                                                value={opt.name}
                                                onChange={e => {
                                                    const newOpts = [...newTemplate.options];
                                                    newOpts[i].name = e.target.value;
                                                    setNewTemplate({ ...newTemplate, options: newOpts });
                                                }}
                                            />
                                            <select
                                                value={opt.type || 'radio'}
                                                onChange={e => {
                                                    const newOpts = [...newTemplate.options];
                                                    newOpts[i].type = e.target.value;
                                                    setNewTemplate({ ...newTemplate, options: newOpts });
                                                }}
                                                className="text-[10px] font-bold text-slate-500 outline-none bg-slate-50 rounded-lg px-2 py-1"
                                            >
                                                <option value="radio">단일</option>
                                                <option value="checkbox">복수</option>
                                            </select>
                                            <button
                                                onClick={() => {
                                                    const newOpts = newTemplate.options.filter((_, j) => j !== i);
                                                    setNewTemplate({ ...newTemplate, options: newOpts });
                                                }}
                                                className="p-1 text-slate-300 hover:text-rose-500 transition-all"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="값 (쉼표로 구분 예: 약간, 보통, 매움)"
                                            className="w-full text-[10px] text-slate-400 outline-none border-b border-slate-50 pb-1"
                                            value={Array.isArray(opt.values) ? opt.values.join(',') : opt.values}
                                            onChange={e => {
                                                const newOpts = [...newTemplate.options];
                                                newOpts[i].values = e.target.value.split(',').map(v => v.trim());
                                                setNewTemplate({ ...newTemplate, options: newOpts });
                                            }}
                                        />
                                    </div>
                                ))}
                                <button onClick={addOptionField} className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-300 hover:text-blue-500 hover:border-blue-200 transition-all flex items-center justify-center gap-1 text-xs font-bold">
                                    <Plus size={14} /> 필드 추가
                                </button>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => { setEditingTemplate(null); setNewTemplate({ name: '', options: [] }); }}
                                    className="flex-1 py-3 bg-white border border-slate-200 text-slate-400 rounded-xl font-black text-xs"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-xs shadow-lg shadow-blue-500/20"
                                >
                                    {editingTemplate ? '수정 완료' : '저장하기'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OptionTemplateModal;
