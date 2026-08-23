import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { adminAPI } from '../../api/admin';
import Icon from '../ui/Icon';
import { ArrowRight, Check, ChevronDown, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';

const CATEGORY_LABELS = {
  basic: '기본 정보',
  legal: '법적 필수',
  settlement: '정산 설정',
  payment: '결제 수단',
  hours: '영업시간',
  optional: '선택 정보',
};

const FIELD_LABELS = {
  name: '상호',
  address: '주소',
  phone: '전화번호',
  business_type: '업종',
  description: '매장 설명',
  latitude: '위도',
  longitude: '경도',
  open_time: '오픈시간',
  close_time: '마감시간',
  business_hours: '영업시간',
  business_number: '사업자등록번호',
  business_name: '법인/상호명',
  ceo_name: '대표자명',
  tax_invoice_email: '세금계산서 이메일',
  mail_order_number: '통신판매업신고번호',
  business_address: '사업장 주소',
  customer_service_phone: '고객센터 전화',
  customer_service_email: '고객센터 이메일',
  terms_of_service: '이용약관',
  privacy_policy: '개인정보처리방침',
  refund_policy: '환불·취소 정책',
  settlement_cycle: '정산 주기',
  commission_rate: '수수료율',
  vat_rate: '부가세율',
  enabled_payment_methods: '결제 수단',
};

const PRIORITY_STYLE = {
  CRITICAL: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  HIGH: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  MEDIUM: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  LOW: 'bg-white/5 text-slate-300 border-white/10',
};

const scoreColor = (score) =>
  score >= 80 ? 'text-emerald-300' : score >= 50 ? 'text-amber-300' : 'text-rose-300';

const barColor = (score) =>
  score >= 80 ? 'from-emerald-500 to-teal-400' : score >= 50 ? 'from-amber-500 to-orange-400' : 'from-rose-500 to-red-400';

/**
 * StoreEnrichmentModal — 슈퍼관리자 매장별 AI 정보 보강.
 * 정보 완성도 리포트 + AI 보강 제안 생성/적용을 한 화면에서 처리한다.
 */
export default function StoreEnrichmentModal({ storeId, storeName, onClose, onChanged }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // AI 보강 결과 (미적용/적용)
  const [expanded, setExpanded] = useState({}); // 카테고리별 접기/펼치기
  const [msg, setMsg] = useState('');

  const loadReport = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const r = await adminAPI.storeCompletion(storeId);
      setReport(r?.data || r);
    } catch { setReport(null); }
    finally { setLoading(false); }
  }, [storeId]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const toggle = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const runEnhance = async (autoSave) => {
    setBusy(true);
    setMsg('');
    try {
      const r = await adminAPI.runStoreEnhance(storeId, { autoSave });
      const d = r?.data || r;
      setResult(d);
      setMsg(r?.message || (autoSave ? '보강 데이터가 적용되었습니다.' : '보강 제안이 생성되었습니다.'));
      if (autoSave) {
        onChanged?.();
        await loadReport();
      }
    } catch (e) {
      setMsg(e?.response?.data?.error || 'AI 보강에 실패했습니다.');
    } finally { setBusy(false); }
  };

  const applyResult = async () => {
    if (!result?.enhancements || Object.keys(result.enhancements).length === 0) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await adminAPI.applyStoreEnhance(storeId, result.enhancements);
      setMsg(r?.message || '적용 완료');
      onChanged?.();
      await loadReport();
    } catch (e) {
      setMsg(e?.response?.data?.error || '적용에 실패했습니다.');
    } finally { setBusy(false); }
  };

  const missing = report?.missingByCategory || {};
  const missingEntries = Object.entries(missing).filter(([, fields]) => fields && fields.length > 0);
  const fieldLabel = (f) => FIELD_LABELS[f] || f;
  const score = report?.completionScore ?? 0;

  return (
    <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        className="admin-dark-scope relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl text-white">
        {/* 헤더 */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <div className="min-w-0">
            <h3 className="text-lg font-black truncate flex items-center gap-2">
              <Icon icon="MapPin" /> 매장 정보 보강
            </h3>
            <p className="text-[11px] text-slate-500 truncate">{storeName || `매장 #${storeId}`}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="p-2 rounded-xl hover:bg-white/10 text-slate-400 shrink-0"><X size={18} aria-hidden="true" /></button>
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton-dark h-16 rounded-xl" />)}</div>
          ) : !report ? (
            <div className="py-10 text-center text-slate-500">완성도 정보를 불러오지 못했습니다.</div>
          ) : (
            <>
              {/* 완성도 점수 */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <p className="text-[11px] text-slate-500 font-black uppercase tracking-wider">정보 완성도</p>
                    <p className={`text-4xl font-black tabular-nums mt-1 ${scoreColor(score)}`}>
                      {score}<span className="text-lg text-slate-500">%</span>
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-slate-400 font-bold">
                    <p><span className="tabular-nums">{report.filledFields}</span> / <span className="tabular-nums">{report.totalFields}</span> 필드 작성</p>
                    <p className="mt-0.5">{report.missingCount}개 누락</p>
                  </div>
                </div>
                <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${barColor(score)} transition-all duration-700`} style={{ width: `${score}%` }} />
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {report.isLegalComplete
                    ? <span className="text-[10px] font-black px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">법적 필수 충족</span>
                    : <span className="text-[10px] font-black px-2 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">법적 필수 미충족</span>}
                  {report.canOperate
                    ? <span className="text-[10px] font-black px-2 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">운영 가능</span>
                    : <span className="text-[10px] font-black px-2 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">운영 불가</span>}
                </div>
              </div>

              {/* 우선순위 액션 */}
              {report.priorityActions?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-black flex items-center gap-1.5"><Icon icon="AlertTriangle" /> 우선 조치</h4>
                  {report.priorityActions.map((a, i) => (
                    <div key={i} className={`border rounded-xl px-4 py-3 text-xs ${PRIORITY_STYLE[a.priority] || PRIORITY_STYLE.LOW}`}>
                      <p className="font-black">{a.message}</p>
                      <p className="opacity-80 mt-0.5">{a.action}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 누락 필드 */}
              {missingEntries.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/10 text-sm font-black">누락 필드</div>
                  <div className="divide-y divide-white/5">
                    {missingEntries.map(([category, fields]) => {
                      const open = expanded[category] ?? (category === 'basic' || category === 'legal');
                      return (
                        <div key={category}>
                          <button type="button" onClick={() => toggle(category)}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/[0.03]">
                            <span className="text-xs font-black text-slate-200">{CATEGORY_LABELS[category] || category}
                              <span className="ml-1.5 text-[10px] text-rose-300 font-bold tabular-nums">{fields.length}건</span>
                            </span>
                            <ChevronDown size={14} aria-hidden="true" className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                          </button>
                          {open && (
                            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                              {fields.map((f) => (
                                <span key={f} className="text-[11px] font-bold px-2 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20">{fieldLabel(f)}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 추천사항 */}
              {report.recommendations?.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-sm font-black flex items-center gap-1.5"><Sparkles size={14} className="text-orange-400" aria-hidden="true" /> 추천사항</h4>
                  {report.recommendations.map((rec, i) => (
                    <p key={i} className="text-xs text-slate-400 flex items-start gap-2">
                      <ArrowRight size={13} className="shrink-0 mt-0.5 text-orange-400" aria-hidden="true" /> {rec.message}
                    </p>
                  ))}
                </div>
              )}

              {/* AI 보강 결과 미리보기 */}
              {result && !result.saved && Object.keys(result.enhancements || {}).length > 0 && (
                <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-2xl p-4">
                  <p className="text-sm font-black flex items-center gap-1.5 mb-2">
                    <Sparkles size={14} className="text-emerald-300" aria-hidden="true" /> AI 보강 제안
                  </p>
                  <p className="text-[11px] text-slate-400 mb-2">
                    완성도 <span className="text-slate-200 font-bold tabular-nums">{result.originalCompletion}%</span> → <span className="text-emerald-300 font-bold tabular-nums">{result.newCompletion}%</span>
                  </p>
                  <div className="space-y-1 mb-3 max-h-32 overflow-y-auto">
                    {Object.entries(result.enhancements).map(([key, value]) => (
                      <p key={key} className="text-[11px] text-slate-300 truncate">
                        <span className="font-black text-emerald-300">{fieldLabel(key)}</span>: {typeof value === 'object' ? JSON.stringify(value) : String(value).slice(0, 60)}
                      </p>
                    ))}
                  </div>
                  {result.suggestions?.length > 0 && (
                    <ul className="text-[11px] text-slate-400 list-disc list-inside mb-3 space-y-0.5">
                      {result.suggestions.slice(0, 5).map((s, i) => <li key={i} className="truncate">{s}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {msg && <p className="text-xs text-center text-slate-300 bg-white/5 rounded-lg py-2">{msg}</p>}

              {/* 액션 */}
              <div className="flex flex-col gap-2">
                <button type="button" disabled={busy} onClick={() => runEnhance(true)}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-600 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
                  {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />} AI 보강 자동 적용
                </button>
                {result && !result.saved && Object.keys(result.enhancements || {}).length > 0 && (
                  <button type="button" disabled={busy} onClick={applyResult}
                    className="w-full h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-black text-sm flex items-center justify-center gap-2 hover:bg-emerald-500/25 disabled:opacity-50 transition-all">
                    <Check size={16} aria-hidden="true" /> 제안 적용하기 ({Object.keys(result.enhancements).length}개)
                  </button>
                )}
                {!result && (
                  <button type="button" disabled={busy} onClick={() => runEnhance(false)}
                    className="w-full h-12 rounded-2xl bg-white/5 border border-white/10 text-slate-200 font-black text-sm flex items-center justify-center gap-2 hover:bg-white/10 disabled:opacity-50 transition-all">
                    {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />} 보강 제안만 생성
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
