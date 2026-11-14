import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Coffee, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { normalizeMenuOptionGroups } from '../../utils/menuOptionGroups';

const makeId = (prefix, index) => `${prefix}-${index + 1}`;

const presets = {
  coffee: {
    label: '커피 기본 옵션',
    icon: Coffee,
    groups: [
      { name: '온도', type: 'radio', is_required: true, min_choices: 1, max_choices: 1, choices: [{ name: 'HOT' }, { name: 'ICE' }] },
      { name: '사이즈', type: 'radio', is_required: true, min_choices: 1, max_choices: 1, choices: [{ name: 'Regular' }, { name: 'Large', price_adjustment: 1000 }] },
      { name: '추가 옵션', type: 'checkbox', min_choices: 0, max_choices: 3, choices: [{ name: '샷 추가', price_adjustment: 500 }, { name: '시럽 추가', price_adjustment: 300 }, { name: '디카페인 변경', price_adjustment: 500 }] },
      { name: '매장 이용', type: 'radio', is_required: true, min_choices: 1, max_choices: 1, choices: [{ name: '매장' }, { name: '테이크아웃' }] },
    ],
  },
  meal: {
    label: '식사·요리 기본 옵션',
    icon: UtensilsCrossed,
    groups: [
      { name: '맵기', type: 'radio', is_required: true, min_choices: 1, max_choices: 1, choices: [{ name: '순한맛' }, { name: '보통맛' }, { name: '매운맛' }] },
      { name: '추가 토핑', type: 'checkbox', min_choices: 0, max_choices: 4, choices: [{ name: '치즈 추가', price_adjustment: 1000 }, { name: '계란 추가', price_adjustment: 1000 }, { name: '고기 추가', price_adjustment: 2000 }] },
      { name: '식사 방법', type: 'radio', is_required: true, min_choices: 1, max_choices: 1, choices: [{ name: '매장 식사' }, { name: '테이크아웃' }] },
    ],
  },
};

function withStableIds(groups) {
  return groups.map((group, groupIndex) => ({
    ...group,
    id: group.id || makeId('group', groupIndex),
    choices: group.choices.map((choice, choiceIndex) => ({
      is_active: true,
      ...choice,
      id: choice.id || `choice-${groupIndex + 1}-${choiceIndex + 1}`,
    })),
  }));
}

export function VisualOptionEditor({ value, onChange }) {
  const [groups, setGroups] = useState(() => normalizeMenuOptionGroups(value));

  const emit = (nextGroups) => {
    const normalized = withStableIds(nextGroups);
    setGroups(normalized);
    onChange(JSON.stringify(normalized));
  };

  const addGroup = () => emit([...groups, {
    id: makeId('group', groups.length), name: '', type: 'radio', is_required: false,
    min_choices: 0, max_choices: 1, choices: [{ id: `choice-${groups.length + 1}-1`, name: '', price_adjustment: 0, is_active: true }],
  }]);

  const applyPreset = (preset) => {
    const normalized = normalizeMenuOptionGroups(preset.groups).map((group, groupIndex) => ({
      ...group,
      id: makeId(`preset-${preset.key}`, groupIndex),
      choices: group.choices.map((choice, choiceIndex) => ({
        ...choice,
        id: makeId(`preset-${preset.key}-${groupIndex}`, choiceIndex),
      })),
    }));
    emit([...groups, ...normalized]);
  };

  const updateGroup = (groupIndex, field, value) => {
    const next = groups.map((group, index) => {
      if (index !== groupIndex) return group;
      const updated = { ...group, [field]: value };
      if (field === 'type' && value === 'radio') {
        updated.max_choices = 1;
        updated.min_choices = updated.is_required ? 1 : 0;
      }
      if (field === 'is_required') updated.min_choices = value ? Math.max(1, updated.min_choices) : 0;
      return updated;
    });
    emit(next);
  };

  const updateChoice = (groupIndex, choiceIndex, field, value) => {
    emit(groups.map((group, index) => index !== groupIndex ? group : ({
      ...group,
      choices: group.choices.map((choice, index2) => index2 !== choiceIndex ? choice : ({
        ...choice,
        [field]: field === 'price_adjustment' ? Math.max(0, Number.parseInt(value, 10) || 0) : value,
      })),
    })));
  };

  const addChoice = (groupIndex) => emit(groups.map((group, index) => index !== groupIndex ? group : ({
    ...group,
    max_choices: group.type === 'checkbox' ? Math.min(group.choices.length + 1, 20) : 1,
    choices: [...group.choices, { id: `choice-${groupIndex + 1}-${group.choices.length + 1}`, name: '', price_adjustment: 0, is_active: true }],
  })));

  const removeChoice = (groupIndex, choiceIndex) => emit(groups.map((group, index) => index !== groupIndex ? group : ({
    ...group,
    choices: group.choices.filter((_, index2) => index2 !== choiceIndex),
    max_choices: group.type === 'radio' ? 1 : Math.max(1, Math.min(group.max_choices, group.choices.length - 1)),
    min_choices: Math.min(group.min_choices, group.choices.length - 1),
  })));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-orange-500/15 bg-orange-500/[0.06] p-4">
        <p className="text-xs font-bold text-orange-200">빠르게 시작하기</p>
        <p className="mt-1 text-[11px] leading-5 text-slate-400">업종에 맞는 옵션 묶음을 불러온 뒤 메뉴에 맞게 수정하세요.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(presets).map(([key, preset]) => {
            const PresetIcon = preset.icon;
            return <button key={key} type="button" onClick={() => applyPreset({ ...preset, key })} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-orange-500/20 bg-slate-900 px-3 text-xs font-bold text-orange-100 transition hover:border-orange-400/50 hover:bg-orange-500/10"><PresetIcon size={15} />{preset.label}</button>;
          })}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {groups.map((group, groupIndex) => (
          <motion.section key={group.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4 rounded-2xl border border-white/10 bg-slate-950 p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-center">
              <label className="space-y-1.5"><span className="text-[10px] font-bold text-slate-400">옵션 그룹 이름</span><input value={group.name} onChange={(event) => updateGroup(groupIndex, 'name', event.target.value)} placeholder="예: 온도, 사이즈, 맵기" className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white outline-none focus:border-orange-400" /></label>
              <label className="space-y-1.5"><span className="text-[10px] font-bold text-slate-400">선택 방식</span><select value={group.type} onChange={(event) => updateGroup(groupIndex, 'type', event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-xs font-bold text-white outline-none focus:border-orange-400"><option value="radio">하나만 선택</option><option value="checkbox">여러 개 선택</option></select></label>
              <button type="button" aria-label={`${group.name || '옵션 그룹'} 삭제`} onClick={() => emit(groups.filter((_, index) => index !== groupIndex))} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-400/15 bg-rose-400/5 px-3 text-xs font-bold text-rose-300 hover:bg-rose-400/10"><Trash2 size={15} />그룹 삭제</button>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white/[0.035] px-3 py-2.5">
              <button type="button" aria-pressed={group.is_required} onClick={() => updateGroup(groupIndex, 'is_required', !group.is_required)} className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold ${group.is_required ? 'bg-orange-500 text-white' : 'bg-white/5 text-slate-400'}`}><Check size={14} />필수 선택</button>
              {group.type === 'checkbox' && <>
                <label className="flex items-center gap-2 text-[11px] text-slate-300">최소 <input type="number" min="0" max={group.choices.length} value={group.min_choices} onChange={(event) => updateGroup(groupIndex, 'min_choices', Math.min(group.choices.length, Math.max(0, Number(event.target.value) || 0)))} className="h-8 w-14 rounded-lg border border-white/10 bg-slate-900 px-2 text-center text-white" />개</label>
                <label className="flex items-center gap-2 text-[11px] text-slate-300">최대 <input type="number" min="1" max={group.choices.length} value={Math.min(group.max_choices, group.choices.length)} onChange={(event) => updateGroup(groupIndex, 'max_choices', Math.min(group.choices.length, Math.max(1, Number(event.target.value) || 1)))} className="h-8 w-14 rounded-lg border border-white/10 bg-slate-900 px-2 text-center text-white" />개</label>
              </>}
              <span className="ml-auto text-[10px] text-slate-500">선택 금액은 메뉴 가격에 반영됩니다</span>
            </div>

            <div className="space-y-2">
              <p className="px-1 text-[10px] font-bold text-slate-400">선택 항목과 추가 금액</p>
              {group.choices.map((choice, choiceIndex) => (
                <div key={choice.id} className="grid grid-cols-[minmax(0,1fr)_112px_36px] items-center gap-2">
                  <input value={choice.name} onChange={(event) => updateChoice(groupIndex, choiceIndex, 'name', event.target.value)} placeholder={`선택 항목 ${choiceIndex + 1}`} className="h-10 min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-orange-400" />
                  <label className="relative"><span className="sr-only">{choice.name || '선택 항목'} 추가 금액</span><input type="number" min="0" step="100" value={choice.price_adjustment} onChange={(event) => updateChoice(groupIndex, choiceIndex, 'price_adjustment', event.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 pr-8 text-right text-sm tabular-nums text-white outline-none focus:border-orange-400" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">원</span></label>
                  <button type="button" aria-label={`${choice.name || '선택 항목'} 삭제`} onClick={() => removeChoice(groupIndex, choiceIndex)} disabled={group.choices.length <= 1} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-30"><Trash2 size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => addChoice(groupIndex)} disabled={group.choices.length >= 50} className="inline-flex min-h-9 items-center gap-1.5 px-2 text-xs font-bold text-orange-300 hover:text-orange-200 disabled:opacity-40"><Plus size={15} />선택 항목 추가</button>
            </div>
          </motion.section>
        ))}
      </AnimatePresence>

      <button type="button" onClick={addGroup} disabled={groups.length >= 10} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/10 text-xs font-bold text-slate-400 transition hover:border-orange-400/40 hover:text-orange-300 disabled:opacity-40"><Plus size={16} />옵션 그룹 추가 {groups.length >= 10 && '(최대 10개)'}</button>
    </div>
  );
}
