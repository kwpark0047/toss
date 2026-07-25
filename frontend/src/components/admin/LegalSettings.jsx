/**
 * LegalSettings — 사업자·통신판매업·약관 통합 관리 화면
 *
 * 전자상거래법 §13, §17, §20 / 개인정보보호법 / 전자금융거래법 §30 준수
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
    Building2, FileText, Shield, CreditCard,
    CheckCircle2, AlertTriangle, Save, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';
import { legalAPI } from '../../api';

// ── 섹션 접기/펼치기 컴포넌트 ──────────────────────────────────────────────
const Section = ({ icon: Icon, title, subtitle, children, defaultOpen = false }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                        <Icon size={18} className="text-orange-600" />
                    </div>
                    <div>
                        <p className="font-bold text-gray-900">{title}</p>
                        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
                    </div>
                </div>
                {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
            </button>
            {open && <div className="px-5 pb-5 border-t border-gray-100">{children}</div>}
        </div>
    );
};

// ── 텍스트 입력 필드 ─────────────────────────────────────────────────────────
const Field = ({ label, name, value, onChange, placeholder, hint, textarea, rows = 8, required }) => (
    <div className="space-y-1.5">
        <label className="text-sm font-bold text-gray-700 flex items-center gap-1">
            {label}
            {required && <span className="text-red-500">*</span>}
        </label>
        {textarea ? (
            <textarea
                name={name} value={value || ''} onChange={onChange}
                rows={rows} placeholder={placeholder}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-y font-mono"
            />
        ) : (
            <input
                name={name} type="text" value={value || ''} onChange={onChange}
                placeholder={placeholder}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
        )}
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
);

export default function LegalSettings() {
    const { storeId } = useParams();
    const [form, setForm] = useState({
        business_name: '',
        business_number: '',
        ceo_name: '',
        business_address: '',
        tax_invoice_email: '',
        customer_service_phone: '',
        customer_service_email: '',
        mail_order_number: '',
        pg_company: '토스페이먼츠',
        pg_business_number: '214-88-00591',
        terms_of_service: '',
        privacy_policy: '',
        refund_policy: '',
    });
    const [bizValid, setBizValid] = useState(null);    // null | true | false
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!storeId) return;
        legalAPI.adminGet(storeId)
            .then(res => setForm(prev => ({ ...prev, ...res.data?.data })))
            .catch(() => toast.error('법적 정보를 불러오지 못했습니다.'))
            .finally(() => setLoading(false));
    }, [storeId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        if (name === 'business_number') setBizValid(null);
    };

    const verifyBizNum = async () => {
        if (!form.business_number) return;
        try {
            const res = await legalAPI.verifyBizNum(storeId, form.business_number);
            setBizValid(res.data?.data?.valid);
            toast[res.data?.data?.valid ? 'success' : 'error'](res.data?.data?.message);
        } catch {
            toast.error('검증 중 오류가 발생했습니다.');
        }
    };

    const handleSave = async () => {
        // 통신판매업신고번호 형식 클라이언트 선검증
        if (form.mail_order_number && !/^[\w가-힣]+-\d{4}-\d+$/.test(form.mail_order_number)) {
            toast.error('통신판매업신고번호 형식을 확인하세요. (예: 서울금천-2024-0001)');
            return;
        }

        setSaving(true);
        try {
            await legalAPI.adminUpdate(storeId, form);
            toast.success('법적 정보가 저장되었습니다.');
        } catch (err) {
            toast.error(err?.response?.data?.message || '저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw size={24} className="animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">법적 의무 정보 관리</h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        전자상거래법 · 통신판매업 · 개인정보처리방침 · 전자금융거래법 준수
                    </p>
                </div>
                <button
                    onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 disabled:opacity-50 transition-all"
                >
                    {saving
                        ? <RefreshCw size={14} className="animate-spin" />
                        : <Save size={14} />}
                    저장
                </button>
            </div>

            {/* 법 준수 체크리스트 */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1.5">
                <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
                    <AlertTriangle size={16} /> 전자상거래 법적 의무 체크리스트
                </p>
                {[
                    { label: '사업자등록번호 등록', done: !!form.business_number },
                    { label: '통신판매업신고번호 등록', done: !!form.mail_order_number },
                    { label: '사업장 소재지 입력', done: !!form.business_address },
                    { label: '고객센터 전화번호 입력', done: !!form.customer_service_phone },
                    { label: '이용약관 작성', done: (form.terms_of_service?.length || 0) > 50 },
                    { label: '개인정보처리방침 작성', done: (form.privacy_policy?.length || 0) > 50 },
                    { label: '환불·취소 정책 작성', done: (form.refund_policy?.length || 0) > 50 },
                ].map(({ label, done }) => (
                    <div key={label} className="flex items-center gap-2 text-sm">
                        {done
                            ? <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                            : <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />}
                        <span className={done ? 'text-gray-500 line-through' : 'text-amber-800 font-medium'}>
                            {label}
                        </span>
                    </div>
                ))}
            </div>

            {/* ① 사업자 기본 정보 */}
            <Section icon={Building2} title="사업자 정보 (전자상거래법 §13)" subtitle="고객에게 공개되는 필수 표시 사항" defaultOpen>
                <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="상호명" name="business_name" value={form.business_name}
                        onChange={handleChange} placeholder="홍길동 식당" required />
                    <Field label="대표자명" name="ceo_name" value={form.ceo_name}
                        onChange={handleChange} placeholder="홍길동" required />

                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-1">
                            사업자등록번호 <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2">
                            <input
                                name="business_number" type="text" value={form.business_number || ''}
                                onChange={handleChange} placeholder="000-00-00000"
                                className={`flex-1 px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                                    bizValid === true ? 'border-emerald-400 bg-emerald-50' :
                                    bizValid === false ? 'border-red-400 bg-red-50' : 'border-gray-200'
                                }`}
                            />
                            <button type="button" onClick={verifyBizNum}
                                className="px-3 py-2.5 bg-blue-500 text-white rounded-xl text-xs font-bold hover:bg-blue-600 transition-colors whitespace-nowrap">
                                검증
                            </button>
                        </div>
                        {bizValid === true && <p className="text-xs text-emerald-600">유효한 사업자등록번호입니다.</p>}
                        {bizValid === false && <p className="text-xs text-red-500">유효하지 않은 번호입니다. 국세청에서 재확인하세요.</p>}
                    </div>

                    <Field label="통신판매업신고번호" name="mail_order_number" value={form.mail_order_number}
                        onChange={handleChange} placeholder="서울금천-2024-0001"
                        hint="통신판매업 신고 시 발급받은 번호 (지역-연도-일련번호)" />

                    <div className="md:col-span-2">
                        <Field label="사업장 소재지" name="business_address" value={form.business_address}
                            onChange={handleChange} placeholder="서울특별시 금천구 가산디지털1로 123, 101호" required />
                    </div>

                    <Field label="고객센터 전화번호" name="customer_service_phone" value={form.customer_service_phone}
                        onChange={handleChange} placeholder="02-1234-5678" required />
                    <Field label="고객센터 이메일" name="customer_service_email" value={form.customer_service_email}
                        onChange={handleChange} placeholder="support@example.com" />
                    <Field label="세금계산서 이메일" name="tax_invoice_email" value={form.tax_invoice_email}
                        onChange={handleChange} placeholder="accounting@example.com" />
                </div>
            </Section>

            {/* ② PG사 정보 (전자금융거래법 §30) */}
            <Section icon={CreditCard} title="PG사 정보 (전자금융거래법 §30)" subtitle="결제 전 PG사 정보 표시 의무">
                <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="PG사명" name="pg_company" value={form.pg_company}
                        onChange={handleChange} placeholder="토스페이먼츠"
                        hint="결제 대행사 상호명" />
                    <Field label="PG사 사업자번호" name="pg_business_number" value={form.pg_business_number}
                        onChange={handleChange} placeholder="214-88-00591" />
                </div>
                <div className="mt-4 p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
                    <strong>토스페이먼츠</strong> — 사업자등록번호: 214-88-00591 | 고객센터: 1544-7772<br />
                    전자금융거래법 제30조에 따라 결제 페이지에 PG사 정보가 자동 표시됩니다.
                </div>
            </Section>

            {/* ③ 이용약관 */}
            <Section icon={FileText} title="이용약관 (전자상거래법 §16)" subtitle="서비스 이용 전 동의 필수">
                <div className="pt-4">
                    <Field label="이용약관" name="terms_of_service" value={form.terms_of_service}
                        onChange={handleChange} textarea rows={12}
                        placeholder="제1조 (목적)&#13;이 약관은 ..."
                        hint="결제 전 동의 화면에 표시됩니다. 변경 시 고객에게 사전 고지가 필요합니다." />
                </div>
            </Section>

            {/* ④ 개인정보처리방침 */}
            <Section icon={Shield} title="개인정보처리방침 (개인정보보호법 §30)" subtitle="수집·이용·보유 근거 공시">
                <div className="pt-4">
                    <Field label="개인정보처리방침" name="privacy_policy" value={form.privacy_policy}
                        onChange={handleChange} textarea rows={12}
                        placeholder="1. 개인정보 수집·이용 목적&#13;..."
                        hint="결제 전 동의 화면에 링크로 표시됩니다." />
                </div>
            </Section>

            {/* ⑤ 환불·취소 정책 */}
            <Section icon={AlertTriangle} title="환불·취소 정책 (전자상거래법 §17)" subtitle="7일 청약철회 기간 등 필수 명시">
                <div className="pt-4">
                    <Field label="환불·취소 정책" name="refund_policy" value={form.refund_policy}
                        onChange={handleChange} textarea rows={10}
                        placeholder="1. 조리 전 취소: 즉시 전액 환불&#13;2. 조리 중 취소: ..."
                        hint="결제 전 '환불 정책 보기' 링크로 표시됩니다." />
                </div>
                <div className="mt-3 p-3 bg-amber-50 rounded-xl text-xs text-amber-700">
                    <strong>전자상거래법 제17조</strong>: 소비자는 계약 체결일로부터 <strong>7일 이내</strong> 청약을 철회할 수 있습니다.
                    음식·음료 등 즉시 소비 품목은 청약철회 대상 예외 가능 (단, 명시 필수).
                </div>
            </Section>

            {/* 저장 버튼 (하단) */}
            <div className="flex justify-end pt-2">
                <button
                    onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50 transition-all"
                >
                    {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    전체 저장
                </button>
            </div>
        </div>
    );
}
