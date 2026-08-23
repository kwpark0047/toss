import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, Coins, Ticket, Loader2, X, Check, AlertTriangle, FileText } from 'lucide-react';
import { adminAPI } from '../../api/admin';
import GrantTemplateManager from './GrantTemplateManager';
import Icon from '../ui/Icon';

export default function BatchIssueModal({ storeId, storeName, onClose }) {
  const [tab, setTab] = useState('points'); // points | coupons
  const [amount, setAmount] = useState(1000);
  const [reason, setReason] = useState('');
  const [couponId, setCouponId] = useState('');
  const [coupons, setCoupons] = useState([]);
  const [phones, setPhones] = useState([]);
  const [input, setInput] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showTemplateMgr, setShowTemplateMgr] = useState(false);

  const load = useCallback(async () => {
    try {
      const [tpl] = await Promise.all([
        adminAPI.getGrantTemplates(storeId).catch(() => ({ data: [] })),
      ]);
      setTemplates(tpl?.data || []);
    } catch { /* ignore */ }
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === 'coupons') {
      adminAPI.platformStores().then(r => {
        const stores = r?.data?.stores || [];
        const s = stores.find(st => st.id === storeId);
        if (s?.coupons) setCoupons(s.coupons);
      }).catch(() => {});
    }
  }, [tab, storeId]);

  const addPhones = () => {
    const nums = input.split(/[\n,]+/).map(s => s.trim()).filter(s => /^\d{10,11}$/.test(s));
    if (nums.length === 0) return;
    setPhones(prev => [...new Set([...prev, ...nums])]);
    setInput('');
  };

  const removePhone = (p) => setPhones(prev => prev.filter(x => x !== p));

  const submit = async () => {
    if (phones.length === 0) return;
    setLoading(true);
    setResult(null);
    try {
      const customers = phones;
      if (tab === 'points') {
        const r = await adminAPI.batchGrantPoints(storeId, { customers, amount: parseInt(amount), reason, template_id: templateId || undefined });
        setResult({ success: true, data: r?.data || r, type: 'points' });
      } else {
        if (!couponId) return;
        const r = await adminAPI.batchIssueCoupons(storeId, { customers, coupon_id: parseInt(couponId), template_id: templateId || undefined });
        setResult({ success: true, data: r?.data || r, type: 'coupons' });
      }
    } catch (e) {
      setResult({ success: false, error: e?.response?.data?.error || e.message, type: tab });
    }
    finally { setLoading(false); }
  };

  const reset = () => { setPhones([]); setResult(null); setCouponId(''); setReason(''); setTemplateId(''); };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()}
        className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h2 className="text-sm font-black flex items-center gap-2">{tab === 'points' ? <Coins size={16} className="text-amber-400" /> : <Ticket size={16} className="text-amber-400" />} 일괄 발급</h2>
            <p className="text-[11px] text-slate-500">{storeName || `매장 #${storeId}`}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-3">
          {/* 탭 */}
          <div className="inline-flex bg-white/5 rounded-lg p-0.5">
            {[['points', '포인트', Coins], ['coupons', '쿠폰', Ticket]].map(([k, l, Icon]) => (
              <button key={k} onClick={() => { setTab(k); setResult(null); }}
                className={`flex items-center gap-1.5 px-4 h-8 rounded-md text-xs font-black transition-colors ${tab === k ? 'bg-orange-500 text-white' : 'text-slate-400'}`}>
                <Icon size={14} /> {l}
              </button>
            ))}
          </div>

          {/* 템플릿 선택 */}
          <div className="flex items-center gap-2">
            <select value={templateId} onChange={e => setTemplateId(e.target.value)} className="flex-1 h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-xs outline-none focus:border-orange-500/50">
              <option value="" className="bg-slate-900">사유 템플릿 (선택)</option>
              {templates.map(t => <option key={t.id} value={t.id} className="bg-slate-900">{t.title}</option>)}
            </select>
            <button onClick={() => setShowTemplateMgr(true)} className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black text-slate-400 hover:text-white flex items-center gap-1">
              <FileText size={12} /> 관리
            </button>
          </div>

          {/* 포인트 설정 */}
          {tab === 'points' && (
            <div className="bg-white/5 rounded-xl p-3 space-y-2">
              <label className="text-[10px] text-slate-500 font-bold">1인당 지급 포인트</label>
              <input type="number" value={amount} onChange={e => setAmount(parseInt(e.target.value) || 0)} min={100} step={100}
                className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-orange-500/50" />
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="사유 (직접 입력)" spellCheck={false}
                className="w-full h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-xs outline-none focus:border-orange-500/50" />
            </div>
          )}

          {/* 쿠폰 설정 */}
          {tab === 'coupons' && (
            <div className="bg-white/5 rounded-xl p-3 space-y-2">
              <label className="text-[10px] text-slate-500 font-bold">발급할 쿠폰 선택</label>
              <select value={couponId} onChange={e => setCouponId(e.target.value)} className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-xs outline-none focus:border-orange-500/50">
                <option value="" className="bg-slate-900">쿠폰 선택</option>
                {coupons.map(c => <option key={c.id} value={c.id} className="bg-slate-900">{c.name} ({c.discount_type === 'percent' ? `${c.discount_rate}%` : `₩${(c.discount_amount || 0).toLocaleString()}`})</option>)}
              </select>
            </div>
          )}

          {/* 전화번호 입력 */}
          <div>
            <label className="text-[10px] text-slate-500 font-bold block mb-1">전화번호 입력 (쉴표/줄바꿈 구분)</label>
            <div className="flex gap-2">
              <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="01012345678, 01087654321" spellCheck={false} rows={2}
                className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs outline-none focus:border-orange-500/50 resize-none" />
              <button onClick={addPhones} className="shrink-0 h-full px-4 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-300 text-[11px] font-black hover:bg-orange-500/25 flex items-center gap-1">
                <Upload size={12} /> 추가
              </button>
            </div>
          </div>

          {/* 추가된 번호 리스트 */}
          {phones.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {phones.map(p => (
                <span key={p} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 text-[11px] font-medium text-slate-300">
                  {p.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3')}
                  <button onClick={() => removePhone(p)} className="text-slate-500 hover:text-rose-400"><X size={12} /></button>
                </span>
              ))}
            </div>
          )}

          {/* 결과 */}
          {result && (
            <div className={`rounded-xl p-3 text-xs font-bold ${result.success ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
              <div className="flex items-center gap-2 mb-1">
                {result.success ? <Check size={14} /> : <Icon icon="AlertTriangle" />}
                {result.success ? `완료: ${result.data?.success || 0}명 성공${result.data?.failed ? `, ${result.data.failed}명 실패` : ''}` : result.error}
              </div>
              {result.success && result.data?.batchId && <p className="text-[10px] text-slate-400">배치 ID: {result.data.batchId}</p>}
              <button onClick={reset} className="mt-2 text-[10px] underline text-slate-400 hover:text-white">초기화</button>
            </div>
          )}

          {/* 실행 */}
          <div className="flex gap-2 pt-1">
            <button onClick={submit} disabled={loading || phones.length === 0 || (tab === 'coupons' && !couponId)}
              className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-600 text-white font-black text-sm shadow-lg shadow-orange-500/20 disabled:opacity-40 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : tab === 'points' ? <Coins size={16} /> : <Ticket size={16} />}
              {loading ? '처리 중...' : `일괄 발급 (${phones.length}명)`}
            </button>
          </div>
        </div>

        {showTemplateMgr && <GrantTemplateManager storeId={storeId} onClose={() => setShowTemplateMgr(false)} />}
      </motion.div>
    </motion.div>
  );
}
