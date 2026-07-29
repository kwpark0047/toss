/**
 * LegalPage — 공개 법적 문서 뷰어
 *
 * 라우트:
 *   /legal/:storeId/terms    → 이용약관
 *   /legal/:storeId/privacy  → 개인정보처리방침
 *   /legal/:storeId/refund   → 환불·취소 정책
 *
 * 인증 불필요 (QR 접속 고객 포함 누구나 열람 가능)
 */
import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, Shield, RefreshCw } from 'lucide-react';
import { legalAPI } from '@/api';

const TYPES = {
    terms:   { label: '이용약관',          icon: FileText, fetch: legalAPI.getTerms },
    privacy: { label: '개인정보처리방침',   icon: Shield,   fetch: legalAPI.getPrivacy },
    refund:  { label: '환불·취소 정책',    icon: FileText, fetch: legalAPI.getRefund },
};

export default function LegalPage() {
    const { storeId, type } = useParams();
    const navigate = useNavigate();
    const config = TYPES[type];

    const { data, isLoading, isError } = useQuery({
        queryKey: ['legal-doc', storeId, type],
        queryFn: () => config?.fetch(storeId).then(r => r.data?.data?.content),
        enabled: !!storeId && !!config,
        staleTime: 10 * 60 * 1000,
    });

    if (!config) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-400">존재하지 않는 문서입니다.</p>
            </div>
        );
    }

    const Icon = config.icon;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* 헤더 */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                    aria-label="뒤로가기"
                >
                    <ArrowLeft size={18} className="text-gray-600" />
                </button>
                <div className="flex items-center gap-2">
                    <Icon size={16} className="text-orange-500" />
                    <h1 className="font-bold text-gray-900">{config.label}</h1>
                </div>
            </div>

            {/* 본문 */}
            <div className="max-w-2xl mx-auto px-4 py-6">
                {isLoading && (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw size={24} className="animate-spin text-orange-500" />
                    </div>
                )}

                {isError && (
                    <div className="p-6 bg-red-50 rounded-2xl text-red-600 text-sm text-center">
                        문서를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
                    </div>
                )}

                {data && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">
                            {data}
                        </pre>
                        <p className="text-xs text-gray-400 mt-6 pt-4 border-t border-gray-100">
                            이 문서는 위마켓 서비스를 통해 제공됩니다.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
