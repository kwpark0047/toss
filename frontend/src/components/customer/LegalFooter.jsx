/**
 * LegalFooter — 전자상거래법 §13·§20 필수 표시 사항
 *
 * 통신판매업자는 구매 화면 또는 구매 전 단계에서 아래를 표시해야 합니다:
 *   상호, 대표자, 주소, 전화, 사업자번호, 통신판매업신고번호, PG사
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { legalAPI } from '@/api';

export default function LegalFooter({ storeId }) {
    const [expanded, setExpanded] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['legal-info', storeId],
        queryFn: () => legalAPI.getInfo(storeId).then(r => r.data?.data),
        enabled: !!storeId,
        staleTime: 5 * 60 * 1000,   // 5분 캐시
    });

    if (isLoading || !data) return null;

    const isMissing = (val) => !val || val === '미등록' || val === '미신고';

    return (
        <footer className="mt-6 px-4 pb-8">
            <div className="max-w-lg mx-auto border cust-border rounded-2xl overflow-hidden">
                {/* 토글 헤더 */}
                <button
                    type="button"
                    onClick={() => setExpanded(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-grey-50 dark:bg-white/5 text-left hover:brightness-95 transition-all"
                >
                    <span className="text-xs text-grey-500 dark:text-grey-400 font-bold">
                        사업자 정보 확인 (전자상거래법 제13조)
                    </span>
                    {expanded
                        ? <ChevronUp size={14} className="text-grey-400" />
                        : <ChevronDown size={14} className="text-grey-400" />}
                </button>

                {expanded && (
                    <div className="px-4 py-4 text-xs cust-text-sub space-y-1.5 cust-bg-card">
                        <Row label="상호명"       value={data.business_name} />
                        <Row label="대표자"       value={data.ceo_name} />
                        <Row label="사업장 소재지" value={data.business_address} />
                        <Row label="고객센터"      value={data.customer_service_phone} />
                        <Row label="사업자번호"    value={data.business_number}
                            warn={isMissing(data.business_number)} />
                        <Row label="통신판매업"    value={data.mail_order_number}
                            warn={isMissing(data.mail_order_number)} />

                        <div className="pt-2 border-t cust-border">
                            <p className="text-grey-400 font-bold mb-1">결제 대행 (PG사)</p>
                            <Row label="회사명"     value={data.pg_info?.name} />
                            <Row label="사업자번호" value={data.pg_info?.business_number} />
                            <Row label="고객센터"   value={data.pg_info?.customer_center} />
                        </div>

                        <div className="pt-2 border-t cust-border flex items-center gap-4">
                            <LegalLink storeId={storeId} type="terms"   label="이용약관" />
                            <LegalLink storeId={storeId} type="privacy" label="개인정보처리방침" />
                            <LegalLink storeId={storeId} type="refund"  label="환불정책" />
                        </div>

                        {(isMissing(data.business_number) || isMissing(data.mail_order_number)) && (
                            <p className="text-amber-600 text-xs pt-1">
                                ※ 일부 법적 정보가 미등록 상태입니다. 매장 측에 문의하세요.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </footer>
    );
}

function Row({ label, value, warn }) {
    return (
        <div className="flex items-start justify-between gap-2">
            <span className="text-grey-400 whitespace-nowrap flex-shrink-0">{label}</span>
            <span className={`text-right ${warn ? 'text-amber-500' : 'cust-text-main'}`}>
                {value || '—'}
            </span>
        </div>
    );
}

function LegalLink({ storeId, type, label }) {
    return (
        <a
            href={`/legal/${storeId}/${type}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-500 hover:underline"
        >
            {label}
            <ExternalLink size={10} />
        </a>
    );
}
