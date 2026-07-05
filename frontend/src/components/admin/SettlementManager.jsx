import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { adminAPI } from '../../api';
import {
    Calendar, CreditCard, Download, TrendingUp,
    AlertCircle, CheckCircle2, DollarSign, Calculator, ChevronRight,
    X, FileText, RefreshCw, Banknote, Building2, Smartphone, Store, Info
} from 'lucide-react';
import { toast } from 'react-toastify';
import { formatPrice } from '../../utils/format';

// 결제수단 레이블
const METHOD_LABELS = {
    cash: { label: '현금', icon: Banknote, color: '#16A34A' },
    store_card: { label: '매장 카드', icon: Store, color: '#0EA5E9' },
    transfer: { label: '계좌이체', icon: Building2, color: '#10B981' },
    kakao: { label: '카카오페이', icon: Smartphone, color: '#FEE500' },
    naver: { label: '네이버페이', icon: Smartphone, color: '#03C75A' },
    toss_pay: { label: '토스페이먼츠', icon: CreditCard, color: '#0064FF' },
    point: { label: '포인트', icon: DollarSign, color: '#F59E0B' },
    mixed: { label: '혼합', icon: DollarSign, color: '#8B5CF6' },
};

const STATUS_STYLES = {
    PENDING:   { label: '지급 대기', cls: 'bg-amber-50 text-amber-600', dot: 'bg-amber-400 animate-pulse' },
    COMPLETED: { label: '정산 완료', cls: 'bg-emerald-50 text-emerald-600', dot: '' },
    PAID:      { label: '지급 완료', cls: 'bg-blue-50 text-blue-600', dot: '' },
    CANCELLED: { label: '취소됨',   cls: 'bg-gray-100 text-gray-500', dot: '' },
};

function SettlementDetailModal({ settlement, onClose, onTaxInvoice }) {
    const { storeId } = useParams();
    const [issuingInvoice, setIssuingInvoice] = useState(false);

    if (!settlement) return null;

    let breakdown = {};
    try { breakdown = typeof settlement.breakdown === 'object' ? settlement.breakdown : JSON.parse(settlement.payment_method_breakdown || '{}'); } catch {}

    const commissionExVat = settlement.commission_ex_vat ?? 0;
    const commissionVat   = settlement.commission_vat   ?? 0;
    const commissionTotal = settlement.commission_amount ?? (commissionExVat + commissionVat);
    const totalRefunds    = settlement.total_refunds    ?? 0;
    const netAmount       = settlement.net_amount       ?? 0;
    const netSales        = settlement.net_sales        ?? settlement.total_sales ?? 0;

    const handleIssue = async () => {
        setIssuingInvoice(true);
        try {
            await onTaxInvoice(settlement.id);
        } finally { setIssuingInvoice(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                {/* 헤더 */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-lg font-black text-gray-900">정산 상세 명세서</h2>
                        <p className="text-xs text-gray-400 mt-0.5">{settlement.period_start} ~ {settlement.period_end}</p>
                    </div>
                    <button onClick={onClose} aria-label="닫기" className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                </div>

                <div className="p-6 space-y-5">
                    {/* 매출 요약 */}
                    <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100">
                        <p className="text-xs font-bold text-emerald-600 mb-3 uppercase tracking-wider">매출 및 수수료 내역</p>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">총 매출액</span>
                                <span className="font-bold text-gray-900">{formatPrice(settlement.total_sales, true)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">총 환불액</span>
                                <span className="font-bold text-red-500">-{formatPrice(totalRefunds, true)}</span>
                            </div>
                            <div className="flex justify-between items-center border-t border-emerald-100 pt-2">
                                <span className="font-bold text-gray-700">순 매출액 (순매출)</span>
                                <span className="font-black text-gray-900">{formatPrice(netSales, true)}</span>
                            </div>
                        </div>
                    </div>

                    {/* 수수료 (법적 VAT 분리) */}
                    <div className="p-5 bg-red-50 rounded-2xl border border-red-100">
                        <p className="text-xs font-bold text-red-500 mb-3 uppercase tracking-wider">플랫폼 수수료 (부가세 별도)</p>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">수수료 공급가액</span>
                                <span className="font-bold text-gray-900">-{formatPrice(commissionExVat, true)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">수수료 부가세 (10%)</span>
                                <span className="font-bold text-gray-900">-{formatPrice(commissionVat, true)}</span>
                            </div>
                            <div className="flex justify-between items-center border-t border-red-100 pt-2">
                                <span className="font-bold text-gray-700">총 공제 수수료</span>
                                <span className="font-black text-red-600">-{formatPrice(commissionTotal, true)}</span>
                            </div>
                        </div>
                        <div className="mt-3 flex items-start gap-2 bg-white rounded-xl p-3">
                            <Info size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
                            <p className="text-[11px] text-gray-500 leading-relaxed">
                                수수료 부가세({formatPrice(commissionVat, true)})에 대한 세금계산서는 플랫폼이 발행합니다.
                                점주 매출 부가세(10%)는 점주가 국세청에 별도 신고합니다.
                            </p>
                        </div>
                    </div>

                    {/* 최종 지급액 */}
                    <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                        <div className="flex justify-between items-center">
                            <span className="font-black text-indigo-800">점주 최종 수취액</span>
                            <span className="text-2xl font-black text-indigo-700">{formatPrice(netAmount, true)}</span>
                        </div>
                        <p className="text-[11px] text-indigo-400 mt-1">
                            = 순매출 {formatPrice(netSales, true)} - 수수료 {formatPrice(commissionTotal, true)}
                        </p>
                    </div>

                    {/* 결제수단별 매출 분해 */}
                    {Object.keys(breakdown).length > 0 && (
                        <div className="p-5 bg-gray-50 rounded-2xl">
                            <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">결제수단별 매출 분해</p>
                            <div className="space-y-2">
                                {Object.entries(breakdown).map(([method, amount]) => {
                                    const m = METHOD_LABELS[method] || { label: method, icon: DollarSign, color: '#6B7280' };
                                    const Icon = m.icon;
                                    return (
                                        <div key={method} className="flex items-center justify-between py-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: m.color + '20' }}>
                                                    <Icon size={13} style={{ color: m.color }} />
                                                </div>
                                                <span className="text-sm text-gray-700">{m.label}</span>
                                            </div>
                                            <span className="text-sm font-bold text-gray-900">{formatPrice(amount, true)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 세금계산서 */}
                    <div className="p-4 border border-dashed border-gray-200 rounded-2xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-gray-700">세금계산서</p>
                                {settlement.tax_invoice_number
                                    ? <p className="text-xs text-emerald-600 font-mono mt-1">{settlement.tax_invoice_number}</p>
                                    : <p className="text-xs text-gray-400 mt-1">아직 발행되지 않음</p>
                                }
                            </div>
                            {!settlement.tax_invoice_number && (settlement.status === 'COMPLETED' || settlement.status === 'PAID') && (
                                <button
                                    onClick={handleIssue}
                                    disabled={issuingInvoice}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 disabled:opacity-50 transition-all"
                                >
                                    {issuingInvoice ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
                                    발행
                                </button>
                            )}
                            {settlement.tax_invoice_number && (
                                <CheckCircle2 size={20} className="text-emerald-500" />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const SettlementManager = () => {
    const { storeId } = useParams();
    const [settlements, setSettlements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showGenerate, setShowGenerate] = useState(false);
    const [period, setPeriod] = useState({ start: '', end: '' });
    const [selected, setSelected] = useState(null);

    useEffect(() => { fetchSettlements(); }, [storeId]);

    const fetchSettlements = async () => {
        try {
            const res = await adminAPI.getSettlements(storeId);
            setSettlements(res.data || res);
        } catch {
            toast.error('정산 내역을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const openDetail = async (s) => {
        try {
            const res = await adminAPI.getSettlement(storeId, s.id);
            setSelected(res.data || res);
        } catch {
            setSelected(s);
        }
    };

    const handleGenerate = async () => {
        if (!period.start || !period.end) { toast.warn('시작일과 종료일을 입력해주세요.'); return; }
        try {
            await adminAPI.generateSettlement(storeId, { period_start: period.start, period_end: period.end });
            toast.success('신규 정산 데이터가 생성되었습니다.');
            setShowGenerate(false);
            fetchSettlements();
        } catch {
            toast.error('정산 생성에 실패했습니다.');
        }
    };

    const handleTaxInvoice = async (settlementId) => {
        try {
            const res = await adminAPI.issueTaxInvoice(storeId, settlementId);
            toast.success(res.data?.message || '세금계산서가 발행되었습니다.');
            setSelected(prev => ({ ...prev, tax_invoice_number: res.data?.data?.tax_invoice_number }));
            fetchSettlements();
        } catch (e) {
            toast.error(e?.response?.data?.error || '세금계산서 발행 실패');
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-400">자금을 집계하는 중...</div>;

    const totalPending = settlements.filter(s => s.status === 'PENDING').length;
    const totalNet     = settlements.reduce((acc, s) => acc + (s.net_amount || 0), 0);

    return (
        <div className="max-w-6xl mx-auto p-6 max-h-[calc(100vh-80px)] overflow-y-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-black text-white flex items-center gap-2">
                        <DollarSign className="text-emerald-400" /> 정산 관리 시스템
                    </h1>
                    <p className="text-slate-400 mt-1">매출에서 수수료(공급가액 + 부가세) 차감 후 점주 수취액을 관리합니다.</p>
                </div>
                <button
                    onClick={() => setShowGenerate(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/25 hover:bg-emerald-500 active:scale-95 transition-all"
                >
                    <Calculator size={20} /> 정산 데이터 생성
                </button>
            </div>

            {/* 요약 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600"><TrendingUp /></div>
                        <div>
                            <p className="text-sm text-gray-400">누적 수취액 (점주)</p>
                            <h4 className="text-xl font-black text-gray-900">{formatPrice(totalNet, true)}</h4>
                        </div>
                    </div>
                    <div className="text-xs text-gray-400">수수료 차감 후 최종 수취 합계</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600"><CreditCard /></div>
                        <div>
                            <p className="text-sm text-gray-400">정산 주기</p>
                            <h4 className="text-xl font-black text-blue-600">월 정산</h4>
                        </div>
                    </div>
                    <div className="text-xs text-blue-400 font-medium flex items-center gap-1 cursor-pointer">사업자 설정에서 변경 <ChevronRight size={14} /></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-amber-400">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600"><AlertCircle /></div>
                        <div>
                            <p className="text-sm text-gray-400">지급 대기중</p>
                            <h4 className="text-xl font-black text-amber-600">{totalPending}건</h4>
                        </div>
                    </div>
                    <div className="text-xs text-amber-600 font-medium">관리자 확인 프로세스 진행 중</div>
                </div>
            </div>

            {/* 정산 생성 모달 */}
            {showGenerate && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-black mb-6 flex items-center gap-2">
                            <Calculator className="text-emerald-500" /> 신규 정산 합산
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">시작일</label>
                                <input type="date" value={period.start} onChange={e => setPeriod({ ...period, start: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">종료일</label>
                                <input type="date" value={period.end} onChange={e => setPeriod({ ...period, end: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setShowGenerate(false)} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200">취소</button>
                            <button onClick={handleGenerate} className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100">집계 시작</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 정산 목록 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">정산 기간</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">순 매출</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">수수료</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">수수료 부가세</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">점주 수취액</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">상태</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">명세서</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {settlements.map(s => {
                                const st = STATUS_STYLES[s.status] || STATUS_STYLES.PENDING;
                                const commissionExVat = s.commission_ex_vat ?? 0;
                                const commissionVat   = s.commission_vat   ?? 0;
                                return (
                                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => openDetail(s)}>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-gray-100 rounded-lg text-gray-500"><Calendar size={16} /></div>
                                                <div>
                                                    <div className="font-bold text-gray-900">{s.period_start} ~ {s.period_end}</div>
                                                    <div className="text-[10px] text-gray-400">집계: {new Date(s.created_at).toLocaleDateString()}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right font-medium text-gray-900">
                                            {formatPrice(s.net_sales ?? s.total_sales, true)}
                                        </td>
                                        <td className="px-6 py-5 text-right font-medium text-red-500">
                                            -{formatPrice(commissionExVat, true)}
                                        </td>
                                        <td className="px-6 py-5 text-right font-medium text-orange-500">
                                            -{formatPrice(commissionVat, true)}
                                        </td>
                                        <td className="px-6 py-5 text-right font-black text-indigo-600 underline underline-offset-4 decoration-indigo-200 decoration-2">
                                            {formatPrice(s.net_amount, true)}
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${st.cls}`}>
                                                {st.dot
                                                    ? <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                                    : <CheckCircle2 size={12} />}
                                                {st.label}
                                            </span>
                                            {s.tax_invoice_number && (
                                                <div className="mt-1 text-[10px] text-emerald-500 font-mono">세금계산서 발행됨</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <button className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="명세서 보기"
                                                onClick={e => { e.stopPropagation(); openDetail(s); }}>
                                                <Download size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {settlements.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="px-6 py-20 text-center text-gray-400">
                                        정산 데이터가 없습니다. 상단의 버튼을 눌러 집계를 시작하세요.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 세금계산서 안내 */}
            <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500 leading-relaxed">
                <strong>정산 수수료 계산 방식:</strong> 순매출(총매출 - 환불) × 수수료율(공급가액) → 수수료 VAT(공급가액 × 10%) → 총 공제액 = 공급가액 + VAT<br/>
                플랫폼은 <strong>수수료 공급가액에 대한 세금계산서</strong>만 발행합니다. 점주 매출에 대한 부가세 신고는 점주의 책임입니다.
            </div>

            {/* 상세 모달 */}
            {selected && (
                <SettlementDetailModal
                    settlement={selected}
                    onClose={() => setSelected(null)}
                    onTaxInvoice={handleTaxInvoice}
                />
            )}
        </div>
    );
};

export default SettlementManager;
