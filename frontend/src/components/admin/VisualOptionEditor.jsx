import { useState} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../ui/Icon';

export function VisualOptionEditor({ value, onChange }) {
  const [groups, setGroups] = useState(() => { try { return typeof value === 'string' && value.trim() ? JSON.parse(value) : Array.isArray(value) ? value : []; } catch { return []; } });

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
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <input
                type="text"
                value={group.name}
                onChange={(e) => updateGroup(gi, 'name', e.target.value)}
                placeholder="옵션 그룹 이름 (예: 굽기, 사이즈)"
                className="w-full sm:flex-1 h-11 px-4 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-orange-500/50 transition-all text-sm font-bold text-white placeholder:text-slate-700"
              />
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select aria-label="옵션 그룹 유형"
                  value={group.type}
                  onChange={(e) => updateGroup(gi, 'type', e.target.value)}
                  className="flex-1 sm:w-32 h-11 px-3 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-orange-500/50 transition-all text-xs font-bold text-white appearance-none"
                >
                  <option value="radio" className="bg-slate-900">단일 선택</option>
                  <option value="checkbox" className="bg-slate-900">복수 선택</option>
                </select>
                <button
                  type="button"
                  onClick={() => updateGroup(gi, 'required', !group.required)}
                  className={`h-11 px-4 rounded-xl text-xs font-black border transition-all \${group.required ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-white/5 border-white/10 text-slate-600'}`}
                >
                  필수
                </button>
                <button
                  type="button"
                  onClick={() => removeGroup(gi)}
                  className="h-11 w-11 flex items-center justify-center bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 text-slate-600 rounded-xl border border-white/10 transition-all"
                >
                  <Icon icon="Trash2" size="md" />
                </button>
              </div>
            </div>

            <div className="space-y-2 pl-2">
              {group.values.map((choice, vi) => (
                <div key={vi} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-700 shrink-0" />
                  <input
                    type="text"
                    value={choice}
                    onChange={(e) => updateChoice(gi, vi, 'name', e.target.value)}
                    placeholder={`선택지 \${vi + 1}`}
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
                    <Icon icon="X" size="md" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addChoice(gi)}
                className="flex items-center gap-2 text-xs font-black text-slate-600 hover:text-orange-400 transition-colors pl-4 mt-1"
              >
                <Icon icon="Plus" size="md" /> 선택지 추가
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
        <Icon icon="Plus" size="md" /> 옵션 그룹 추가
      </button>
    </div>
  );
}
