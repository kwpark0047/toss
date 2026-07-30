import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus, Edit3, Trash2, Save, X, Loader2, Check } from 'lucide-react';
import { adminAPI } from '../../api/admin';

export default function GrantTemplateManager({ storeId, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', reason: '', is_auto: false, store_id: null });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await adminAPI.getGrantTemplates(storeId);
      setTemplates(r?.data || []);
    } catch { setTemplates([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [storeId]);

  const showMsg = (text, ok = true) => {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 2500);
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ title: '', reason: '', is_auto: false, store_id: storeId });
  };

  const startEdit = (t) => {
    setEditing(t.id);
    setCreating(false);
    setForm({ title: t.title, reason: t.reason, is_auto: t.is_auto, store_id: t.store_id });
  };

  const save = async () => {
    if (!form.title || !form.reason) { showMsg('제목과 사유를 입력하세요.', false); return; }
    setBusy(true);
    try {
      if (creating) {
        await adminAPI.createGrantTemplate(form);
        showMsg('템플릿이 생성되었습니다.');
      } else {
        await adminAPI.updateGrantTemplate(editing, form);
        showMsg('템플릿이 수정되었습니다.');
      }
      setCreating(false); setEditing(null);
      await load();
    } catch { showMsg('저장 실패', false); }
    finally { setBusy(false); }
  };

  const del = async (id) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setBusy(true);
    try {
      await adminAPI.deleteGrantTemplate(id);
      showMsg('삭제되었습니다.');
      await load();
    } catch { showMsg('삭제 실패', false); }
    finally { setBusy(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()}
        className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-sm font-black flex items-center gap-2"><FileText size={16} className="text-orange-400" /> 발급 템플릿 관리</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white"><X size={16} /></button>
        </div>

        {message && (
          <div className={`mx-4 mt-3 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${message.ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
            {message.ok ? <Check size={14} /> : <X size={14} />} {message.text}
          </div>
        )}

        <div className="p-4 space-y-2">
          {!creating && !editing && (
            <button onClick={startCreate} className="w-full h-10 rounded-xl border border-dashed border-white/20 text-xs font-black text-slate-400 hover:text-white hover:border-orange-500/50 transition-all flex items-center justify-center gap-1.5">
              <Plus size={14} /> 새 템플릿 추가
            </button>
          )}

          {(creating || editing) && (
            <div className="bg-white/5 rounded-xl p-3 space-y-2.5">
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="템플릿 제목 (예: 신규가입 포인트)" spellCheck={false}
                className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-xs outline-none focus:border-orange-500/50" />
              <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="사유 내용 (예: 신규 가입 축하 포인트)" spellCheck={false} rows={2}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs outline-none focus:border-orange-500/50 resize-none" />
              <label className="flex items-center gap-2 text-[11px] text-slate-400">
                <input type="checkbox" checked={form.is_auto} onChange={e => setForm(f => ({ ...f, is_auto: e.target.checked }))} className="w-4 h-4 rounded border-white/20 bg-white/5" />
                자동 발급 템플릿
              </label>
              <div className="flex gap-2">
                <button onClick={save} disabled={busy} className="flex-1 h-9 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-300 text-[11px] font-black hover:bg-orange-500/25 disabled:opacity-50 flex items-center justify-center gap-1">
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} 저장
                </button>
                <button onClick={() => { setCreating(false); setEditing(null); }} className="h-9 px-4 rounded-lg bg-white/5 border border-white/10 text-xs font-black text-slate-400 hover:text-white">취소</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton-dark h-12 rounded-xl" />)}</div>
          ) : templates.length === 0 ? (
            <p className="text-center py-8 text-slate-500 text-xs font-bold">등록된 템플릿이 없습니다.</p>
          ) : templates.map(t => (
            <div key={t.id} className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-black text-xs truncate">{t.title}</p>
                <p className="text-[11px] text-slate-500 truncate">{t.reason}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {t.is_auto && <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">자동</span>}
                <button onClick={() => startEdit(t)} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white"><Edit3 size={12} /></button>
                <button onClick={() => del(t.id)} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-rose-400"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
