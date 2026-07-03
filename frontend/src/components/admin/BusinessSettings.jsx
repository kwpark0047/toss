import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { businessAPI, storeAccountAPI } from '../../api';
import {
    Building2, CreditCard, BadgeCheck, RefreshCw, Save,
    AlertCircle, CheckCircle2, Banknote, Smartphone, Store,
    ChevronDown, ChevronUp, Info
} from 'lucide-react';
import { toast } from 'react-toastify';

// ── 지원 은행 목록 ────────────────────────────────────────────────────────────
const BANKS = [
    { code: '004', name: '국민은행' }, { code: '088', name: '신한은행' },
    { code: '020', name: '우리은행' }, { code: '081', name: '하나은행' },
    { code: '003', name: '기업은행' }, { code: '011', name: 'NH농협은행' },
    { code: '071', name: '우체국' },   { code: '089', name: '케이뱅크' },
    { code: '090', name: '카카오뱅크' }, { code: '092', name: '토스뱅크' },
    { code: '023', name: 'SC제일은행' }, { code: '027', name: '씨티은행' },
    { code: '035', name: '제주은행' }, { code: '045', name: '새마을금고' },
    { code: '048', name: '신협' },     { code: '050', name: '저축은행' },
];

// ── 결제수단 옵션 ─────────────────────────────────────────────────────────────
const PAYMENT_METHOD_OPTIONS = [
    { id: 'cash', label: '현금', desc: '기본 결제수단 (항상 활성)', icon: Banknote, color: '#16A34A', fixed: true },
    { id: 'store_card', label: '매장 카드 단말기', desc: 'POS 단말기 연결 시 활성화', icon: Store, color: '#0EA5E9' },
    { id: 'transfer', label: '계좌이체', desc: '사업자 계좌 등록 후 활성화', icon: Building2, color: '#10B981' },
    { id: 'kakao', label: '카카오페이', desc: '토스페이먼츠 연동 필요 (개발 중)', icon: Smartphone, color: '#FEE500', dev: true },
    { id: 'naver', label: '네이버페이', desc: '토스페이먼츠 연동 필요 (개발 중)', icon: Smartphone, color: '#03C75A', dev: true },
    { id: 'toss_pay', label: '토스페이먼츠', desc: '개발 키 테스트 중', icon: CreditCard, color: '#0064FF', dev: true },
    { id: 'point', label: '포인트 결제', desc: '포인트 적립 시 자동 제공', icon: BadgeCheck, color: '#F59E0B', fixed: true },
];

const SETTLEMENT_CYCLES = [
    { value: 'DAILY', label: '일 정산', desc: '매일 자정 정산' },
    { value: 'WEEKLY', label: '주 정산', desc: '매주 목요일 정산' },
    { value: 'MONTHLY', label: '월 정산', desc: '매월 1일 전월 정산' },
    { value: 'MANUAL', label: '수동 정산', desc: '관리자가 직접 생성' },
];

export default function BusinessSettings() {
    const { storeId } = useParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeSection, setActiveSection] = useState('business');

    // 사업자 정보
    const [bizForm, setBizForm] = useState({
        business_number: '',
        business_name: '',
        ceo_name: '',
        tax_invoice_email: '',
        settlement_cycle: 'MONTHLY',
    });

    // 계좌 정보
    const [accountForm, setAccountForm] = useState({
        bank_code: '',
        bank_name: '',
        account_number: '',
        account_holder: '',
    });

    // 결제수단
    const [enabledMethods, setEnabledMethods] = useState(['cash', 'store_card', 'transfer', 'point']);

    useEffect(() => { fetchData(); }, [storeId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await businessAPI.get(storeId);
            const data = res.data || res;
            setBizForm({
                business_number: data.business_number || '',
                business_name: data.business_name || '',
                ceo_name: data.ceo_name || '',
                tax_invoice_email: data.tax_invoice_email || '',
                settlement_cycle: data.settlement_cycle || 'MONTHLY',
            });
            if (data.store_accounts) {
                setAccountForm({
                    bank_code: data.store_accounts.bank_code || '',
                    bank_name: data.store_accounts.bank_name || '',
                    account_number: data.store_accounts.account_number || '',
                    account_holder: data.store_accounts.account_holder || '',
                });
            }
            if (Array.isArray(data.enabled_payment_methods)) {
                setEnabledMethods(data.enabled_payment_methods);
            }
        } catch {
            toast.error('설정을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const saveBusiness = async () => {
        setSaving(true);
        try {
            await businessAPI.update(storeId, { ...bizForm, enabled_payment_methods: enabledMethods });
            toast.success('사업자 정보가 저장되었습니다.');
        } catch (e) {
            toast.error(e?.response?.data?.error || '저장 실패');
        } finally { setSaving(false); }
    };

    const saveAccount = async () => {
        setSaving(true);
        try {
            await storeAccountAPI.update(storeId, accountForm);
            toast.success('계좌 정보가 저장되었습니다.');
        } catch (e) {
            toast.error(e?.response?.data?.error || '저장 실패');
        } finally { setSaving(false); }
    };

    const toggleMethod = (id) => {
        const method = PAYMENT_METHOD_OPTIONS.find(m => m.id === id);
        if (method?.fixed) return; // cash, point는 항상 활성
        setEnabledMethods(prev =>
            prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
        );
    };

    const formatBizNumber = (v) => {
        const digits = v.replace(/\D/g, '').slice(0, 10);
        if (digits.length <= 3) return digits;
        if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
        return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    };

    if (loading) return <div className="p-10 text-center text-gray-400">설정을 불러오는 중...</div>;

    const SectionHeader = ({ id, icon: Icon, title, desc }) => (
        <button
            onClick={() => setActiveSection(activeSection === id ? null : id)}
            className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
        >
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <Icon size={18} className="text-white" />
                </div>
                <div className="text-left">
                    <p className="font-bold text-gray-900">{title}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                </div>
            </div>
            {activeSection === id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
    );

    return (
        <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
            <div className="mb-6">
                <h1 className="text-2xl font-black text-gray-900">사업자 & 결제 설정</h1>
                <p className="text-sm text-gray-500 mt-1">사업자번호, 계좌이체 계좌, 결제수단, 정산 주기를 관리합니다.</p>
            </div>

            {/* ── 사업자 정보 ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <SectionHeader id="business" icon={Building2} title="사업자 정보" desc="사업자번호, 상호명, 대표자명, 세금계산서 이메일" />
                {activeSection === 'business' && (
                    <div className="px-5 pb-5 space-y-4 border-t border-gray-50">
                        <div className="mt-4 p-3 bg-blue-50 rounded-xl flex items-start gap-2">
                            <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-blue-700">
                                사업자번호 등록 시 세금계산서 발행이 가능합니다.
                                수수료에 대한 세금계산서는 플랫폼이 점주에게 발행합니다.
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">사업자등록번호</label>
                            <input
                                type="text"
                                placeholder="000-00-00000"
                                value={bizForm.business_number}
                                onChange={e => setBizForm(f => ({ ...f, business_number: formatBizNumber(e.target.value) }))}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-300 font-mono"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">상호명 (법인명)</label>
                                <input type="text" placeholder="(주)위마켓" value={bizForm.business_name}
                                    onChange={e => setBizForm(f => ({ ...f, business_name: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">대표자명</label>
                                <input type="text" placeholder="홍길동" value={bizForm.ceo_name}
                                    onChange={e => setBizForm(f => ({ ...f, ceo_name: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">세금계산서 수신 이메일</label>
                            <input type="email" placeholder="billing@example.com" value={bizForm.tax_invoice_email}
                                onChange={e => setBizForm(f => ({ ...f, tax_invoice_email: e.target.value }))}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">정산 주기</label>
                            <div className="grid grid-cols-2 gap-2">
                                {SETTLEMENT_CYCLES.map(c => (
                                    <button key={c.value} onClick={() => setBizForm(f => ({ ...f, settlement_cycle: c.value }))}
                                        className={`p-3 rounded-xl border-2 text-left transition-all ${bizForm.settlement_cycle === c.value ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-blue-200'}`}>
                                        <p className="font-bold text-sm text-gray-900">{c.label}</p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">{c.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button onClick={saveBusiness} disabled={saving}
                            className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600 disabled:opacity-50 transition-all">
                            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                            사업자 정보 저장
                        </button>
                    </div>
                )}
            </div>

            {/* ── 계좌이체 계좌 ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <SectionHeader id="account" icon={Building2} title="계좌이체 계좌 등록" desc="고객 송금용 사업자 계좌번호" />
                {activeSection === 'account' && (
                    <div className="px-5 pb-5 space-y-4 border-t border-gray-50">
                        <div className="mt-4 p-3 bg-amber-50 rounded-xl flex items-start gap-2">
                            <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-amber-700">
                                사업자 명의 계좌를 등록하세요. 고객이 계좌이체 선택 시 이 계좌가 표시됩니다.
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">은행 선택</label>
                            <select value={accountForm.bank_code}
                                onChange={e => {
                                    const b = BANKS.find(b => b.code === e.target.value);
                                    setAccountForm(f => ({ ...f, bank_code: e.target.value, bank_name: b?.name || '' }));
                                }}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                                <option value="">-- 은행 선택 --</option>
                                {BANKS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">계좌번호</label>
                            <input type="text" placeholder="'-' 없이 숫자만 입력" value={accountForm.account_number}
                                onChange={e => setAccountForm(f => ({ ...f, account_number: e.target.value.replace(/\D/g, '') }))}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-300 font-mono" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">예금주명</label>
                            <input type="text" placeholder="(주)위마켓" value={accountForm.account_holder}
                                onChange={e => setAccountForm(f => ({ ...f, account_holder: e.target.value }))}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                        </div>
                        {accountForm.bank_name && accountForm.account_number && accountForm.account_holder && (
                            <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                                <p className="text-xs text-green-700 font-bold mb-2 flex items-center gap-1">
                                    <CheckCircle2 size={12} /> 등록될 계좌 미리보기
                                </p>
                                <p className="text-sm font-black text-green-900">{accountForm.bank_name}</p>
                                <p className="text-base font-mono font-black text-green-800">{accountForm.account_number}</p>
                                <p className="text-sm text-green-700">{accountForm.account_holder}</p>
                            </div>
                        )}
                        <button onClick={saveAccount} disabled={saving}
                            className="w-full py-3 bg-green-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-600 disabled:opacity-50 transition-all">
                            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                            계좌 정보 저장
                        </button>
                    </div>
                )}
            </div>

            {/* ── 결제수단 활성화 ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <SectionHeader id="methods" icon={CreditCard} title="결제수단 활성화" desc="고객에게 제공할 결제수단 선택" />
                {activeSection === 'methods' && (
                    <div className="px-5 pb-5 space-y-3 border-t border-gray-50">
                        <p className="text-xs text-gray-400 mt-4">활성화된 결제수단이 고객 결제 화면에 표시됩니다.</p>
                        {PAYMENT_METHOD_OPTIONS.map(m => {
                            const Icon = m.icon;
                            const isEnabled = enabledMethods.includes(m.id) || m.fixed;
                            return (
                                <div key={m.id}
                                    onClick={() => toggleMethod(m.id)}
                                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all
                                        ${isEnabled ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}
                                        ${m.fixed ? 'opacity-80 cursor-not-allowed' : ''}`}>
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: m.color + '20' }}>
                                        <Icon size={18} style={{ color: m.color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-gray-900">{m.label}</span>
                                            {m.fixed && <span className="text-[10px] text-gray-400">(필수)</span>}
                                            {m.dev && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded font-bold">개발 중</span>}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isEnabled ? 'bg-blue-500' : 'bg-gray-200'}`}>
                                        {isEnabled && <CheckCircle2 size={14} className="text-white" />}
                                    </div>
                                </div>
                            );
                        })}
                        <button onClick={saveBusiness} disabled={saving}
                            className="w-full mt-2 py-3 bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600 disabled:opacity-50 transition-all">
                            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                            결제수단 설정 저장
                        </button>
                    </div>
                )}
            </div>

            {/* ── 수수료·부가세 안내 ── */}
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border border-slate-100 p-5">
                <h3 className="font-black text-slate-800 mb-3 flex items-center gap-2">
                    <BadgeCheck size={18} className="text-blue-500" /> 정산 수수료 구조 안내
                </h3>
                <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <span>플랫폼 수수료율</span>
                        <span className="font-black text-slate-900">3% (기본)</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <span>수수료 부가세 (법정)</span>
                        <span className="font-black text-slate-900">10%</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <span>세금계산서</span>
                        <span className="font-bold text-blue-600">플랫폼 → 점주 발행</span>
                    </div>
                    <div className="mt-3 p-3 bg-white rounded-xl text-xs text-slate-500 leading-relaxed">
                        예시: 순매출 100,000원 시<br/>
                        수수료(공급가액) 3,000원 + 부가세 300원 = 총 3,300원 차감<br/>
                        <strong className="text-slate-700">점주 수취액: 96,700원</strong>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                        ※ 점주 매출에 대한 부가세(10%)는 점주가 국세청에 직접 신고합니다.
                    </p>
                </div>
            </div>
        </div>
    );
}
