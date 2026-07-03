import { useState, useEffect, useMemo } from 'react';
import {
    X, CreditCard, Star, Building2, Banknote,
    ChevronRight, Check, Loader2, ExternalLink,
    Smartphone, Store, AlertCircle, Construction,
    CheckSquare, Square
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePoints } from '../../../hooks/usePoints';
import { useTossPayment } from '../../../hooks/useTossPayment';
import { paymentsAPI, storeAccountAPI } from '../../../api';
import { useBrandPay } from '../../../hooks/useBrandPay';
import PointPayment from './PointPayment';
import TransferPayment from './TransferPayment';
import { formatPrice } from '../../../utils/format';

// ── 결제수단 정의 ────────────────────────────────────────────────────────────
// id: 백엔드 payment_method 값
// status: 'active'|'dev'|'manual'
// 'dev' = 개발 키 (작업중), 'manual' = 관리자 확인 필요
const ALL_PAYMENT_METHODS = [
    {
        id: 'cash',
        label: '현금 결제',
        desc: '직원에게 현금으로 직접 결제',
        icon: Banknote,
        color: '#16A34A',
        status: 'active',
        default: true
    },
    {
        id: 'store_card',
        label: '매장 카드 단말기',
        desc: 'POS 단말기로 카드 결제 후 직원 확인',
        icon: Store,
        color: '#0EA5E9',
        status: 'manual'
    },
    {
        id: 'transfer',
        label: '계좌이체',
        desc: '매장 계좌로 송금 후 직원 확인',
        icon: Building2,
        color: '#10B981',
        status: 'active'
    },
    {
        id: 'kakao',
        label: '카카오페이',
        desc: '카카오페이 앱으로 간편 결제',
        icon: Smartphone,
        color: '#FEE500',
        textColor: '#000000',
        status: 'dev'
    },
    {
        id: 'naver',
        label: '네이버페이',
        desc: '네이버페이로 간편 결제',
        icon: Smartphone,
        color: '#03C75A',
        status: 'dev'
    },
    {
        id: 'toss_pay',
        label: '토스페이먼츠',
        desc: '카드/간편결제 통합 결제',
        icon: CreditCard,
        color: '#0064FF',
        status: 'dev'
    },
    {
        id: 'point',
        label: '포인트 결제',
        desc: '보유 포인트 사용',
        icon: Star,
        color: '#F59E0B',
        status: 'active'
    }
];

export default function PaymentSheet({
    isOpen,
    onClose,
    store,
    cart = [],
    totalAmount,
    onPaymentComplete,
    userIdentifier = {}
}) {
    const { t } = useTranslation();
    const [step, setStep] = useState('method');
    const [selectedMethod, setSelectedMethod] = useState(null);
    // 전자상거래법 §8 결제 전 동의 상태
    const [consented, setConsented] = useState({ terms: false, privacy: false, refund: false });
    const allConsented = consented.terms && consented.privacy && consented.refund;
    const [storeAccount, setStoreAccount] = useState(null);
    const [paymentResult, setPaymentResult] = useState(null);
    const [paymentLoading, setPaymentLoading] = useState(false);

    // 매장에서 활성화된 결제수단 파싱
    const enabledMethodIds = useMemo(() => {
        try {
            const raw = store?.enabled_payment_methods;
            if (!raw) return ['cash', 'store_card', 'transfer'];
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch { return ['cash', 'store_card', 'transfer']; }
    }, [store?.enabled_payment_methods]);

    // 표시할 결제수단 필터링 (항상 cash 포함, 활성화된 것만)
    const visibleMethods = useMemo(() => {
        return ALL_PAYMENT_METHODS.filter(m =>
            m.id === 'cash' || enabledMethodIds.includes(m.id)
        );
    }, [enabledMethodIds]);

    const { points, calculateUsablePoints, calculateEarnPoints } = usePoints(userIdentifier);
    const { initiateTossPayment, loading: tossPaymentLoading } = useTossPayment();
    const { requestPayment: initiateBrandPay, loading: brandPayLoading } = useBrandPay();
    const [usablePoints, setUsablePoints] = useState(0);
    const [earnPoints, setEarnPoints] = useState(0);

    useEffect(() => {
        if (store?.id && totalAmount > 0) {
            calculateUsablePoints(totalAmount, store.id).then(d => setUsablePoints(d?.usable_points || 0));
            calculateEarnPoints(totalAmount, store.id).then(p => setEarnPoints(p || 0));
        }
    }, [store?.id, totalAmount, calculateUsablePoints, calculateEarnPoints]);

    useEffect(() => {
        if (store?.id && selectedMethod === 'transfer') {
            storeAccountAPI.getPublic(store.id).then(res => setStoreAccount(res.data)).catch(() => setStoreAccount(null));
        }
    }, [store?.id, selectedMethod]);

    const createPayment = async (...args) => {
        setPaymentLoading(true);
        try { return await paymentsAPI.create(...args); }
        finally { setPaymentLoading(false); }
    };

    const handleMethodSelect = (methodId) => {
        const method = visibleMethods.find(m => m.id === methodId);
        if (!method) return;
        if (!allConsented) return;

        if (method.status === 'dev') {
            // 개발 중인 결제수단은 토스페이먼츠로 라우팅 (dev key)
            setSelectedMethod('toss_pay');
            handleTossPayment(methodId);
            return;
        }
        setSelectedMethod(methodId);
        if (methodId === 'point') { setStep('point'); return; }
        if (methodId === 'transfer') { setStep('transfer'); return; }
        handlePayment(methodId);
    };

    const handleTossPayment = async (methodHint) => {
        setStep('processing');
        try {
            const result = await initiateTossPayment({
                orderId: null,
                storeId: store.id,
                totalAmount,
                pointAmount: 0,
                tossUserKey: userIdentifier.toss_user_key,
                phone: userIdentifier.phone,
                easyPayProvider: methodHint === 'kakao' ? 'KAKAOPAY' : methodHint === 'naver' ? 'NAVERPAY' : undefined
            });
            if (result.success) {
                setPaymentResult({ success: true, method: methodHint, payment: result.payment, earnPoints });
                setStep('result');
            } else { throw new Error(result.error); }
        } catch (e) {
            setPaymentResult({ success: false, error: e.message || '결제 실패' });
            setStep('result');
        }
    };

    const handlePayment = async (method, customPointAmount = 0) => {
        setStep('processing');
        try {
            if (method === 'cash' || method === 'store_card') {
                const res = await createPayment({
                    store_id: store.id,
                    payment_method: method,
                    total_amount: totalAmount,
                    point_amount: 0,
                    toss_user_key: userIdentifier.toss_user_key,
                    phone: userIdentifier.phone,
                    items: cart
                });
                const msg = method === 'store_card'
                    ? '직원에게 카드 단말기 결제를 요청해주세요.'
                    : '직원에게 현금을 전달해주세요.';
                setPaymentResult({ success: true, method, payment: res.data, earnPoints, message: msg });
                setStep('result');
            } else if (method === 'point') {
                const res = await createPayment({
                    store_id: store.id,
                    payment_method: customPointAmount === totalAmount ? 'point' : 'mixed',
                    total_amount: totalAmount,
                    point_amount: customPointAmount,
                    toss_user_key: userIdentifier.toss_user_key,
                    phone: userIdentifier.phone,
                    items: cart
                });
                setPaymentResult({ success: true, method: 'point', payment: res.data, pointsUsed: customPointAmount, earnPoints });
                setStep('result');
            }
        } catch (error) {
            setPaymentResult({ success: false, error: error.message || '결제 실패' });
            setStep('result');
        }
    };

    const handleTransferComplete = (payment) => {
        setPaymentResult({
            success: true,
            method: 'transfer',
            payment,
            message: '입금 확인 후 주문이 처리됩니다. 직원에게 알려주세요.'
        });
        setStep('result');
    };

    const handlePointPayment = (amount) => {
        if (amount === totalAmount) { handlePayment('point', amount); }
        else if (amount > 0) { setSelectedMethod('mixed'); handleTossPayment('toss_pay'); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
            <div className="w-full max-w-lg bg-white rounded-t-3xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* 헤더 */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-bold">
                        {step === 'method' && '결제 수단 선택'}
                        {step === 'point' && '포인트 사용'}
                        {step === 'transfer' && '계좌이체'}
                        {(step === 'processing' || step === 'result') && '결제 처리'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 72px)' }}>

                    {/* ── 결제수단 선택 ── */}
                    {step === 'method' && (
                        <div className="space-y-3">
                            {/* 결제 금액 */}
                            <div className="p-4 bg-gray-50 rounded-2xl mb-2">
                                <div className="text-sm text-gray-500">결제 금액</div>
                                <div className="text-2xl font-black text-gray-900">{formatPrice(totalAmount, true)}</div>
                                {earnPoints > 0 && (
                                    <div className="text-xs text-amber-600 mt-1 font-medium">결제 완료 시 {earnPoints.toLocaleString()}P 적립</div>
                                )}
                            </div>

                            {/* 포인트 보유 현황 */}
                            {points?.total_points > 0 && (
                                <div className="px-3 py-2 bg-amber-50 rounded-xl flex items-center justify-between border border-amber-100">
                                    <span className="text-xs text-amber-700 flex items-center gap-1.5">
                                        <Star className="w-3.5 h-3.5" /> 보유 포인트
                                    </span>
                                    <span className="text-sm font-black text-amber-600">{points.total_points.toLocaleString()}P</span>
                                </div>
                            )}

                            {/* 결제수단 목록 */}
                            {visibleMethods.map(method => {
                                const Icon = method.icon;
                                const isPointDisabled = method.id === 'point' && usablePoints === 0;
                                const isDev = method.status === 'dev';
                                const isManual = method.status === 'manual';

                                return (
                                    <button
                                        key={method.id}
                                        onClick={() => !isPointDisabled && handleMethodSelect(method.id)}
                                        disabled={isPointDisabled}
                                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left relative
                                            ${method.default ? 'border-green-400 bg-green-50' : 'border-gray-100 hover:border-blue-300 hover:bg-blue-50'}
                                            ${isPointDisabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-[0.98]'}`}
                                    >
                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                                            style={{ backgroundColor: (method.color || '#6B7280') + '20' }}>
                                            <Icon className="w-6 h-6" style={{ color: method.color }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-900">{method.label}</span>
                                                {method.default && (
                                                    <span className="px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-black rounded">기본</span>
                                                )}
                                                {isDev && (
                                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black rounded border border-amber-200">
                                                        <Construction className="w-2.5 h-2.5" /> 개발 키 (작업중)
                                                    </span>
                                                )}
                                                {isManual && (
                                                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">직원 확인 필요</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-0.5">
                                                {method.id === 'point' && usablePoints > 0
                                                    ? `최대 ${usablePoints.toLocaleString()}P 사용 가능`
                                                    : method.desc}
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                                    </button>
                                );
                            })}

                            {/* 결제 안내 */}
                            <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        카카오페이·네이버페이·토스페이먼츠는 현재 개발 키로 테스트 중입니다.
                                        실결제는 현금·계좌이체·매장카드 단말기를 이용해주세요.
                                    </p>
                                </div>
                            </div>

                            {/* ── 결제 전 필수 동의 (전자상거래법 §8, 개인정보보호법 §15) ── */}
                            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-3">
                                <p className="text-xs font-bold text-blue-800">결제 전 필수 동의</p>

                                {[
                                    {
                                        key: 'terms',
                                        label: '이용약관에 동의합니다.',
                                        link: store?.id ? `/legal/${store.id}/terms` : null,
                                    },
                                    {
                                        key: 'privacy',
                                        label: '개인정보 수집·이용에 동의합니다.',
                                        hint: '(주문 처리·포인트 적립 목적, 5년 보관)',
                                        link: store?.id ? `/legal/${store.id}/privacy` : null,
                                    },
                                    {
                                        key: 'refund',
                                        label: '환불·취소 규정을 확인하였습니다.',
                                        hint: '(조리 완료 후 취소 제한, 전자상거래법 §17)',
                                        link: store?.id ? `/legal/${store.id}/refund` : null,
                                    },
                                ].map(({ key, label, hint, link }) => (
                                    <div key={key} className="flex items-start gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setConsented(p => ({ ...p, [key]: !p[key] }))}
                                            className="mt-0.5 flex-shrink-0"
                                            aria-checked={consented[key]}
                                            role="checkbox"
                                        >
                                            {consented[key]
                                                ? <CheckSquare className="w-5 h-5 text-blue-600" />
                                                : <Square className="w-5 h-5 text-blue-300" />}
                                        </button>
                                        <div className="flex-1 text-xs">
                                            <span className="text-blue-900 font-medium">{label}</span>
                                            {hint && <span className="text-blue-600 ml-1">{hint}</span>}
                                            {link && (
                                                <a href={link} target="_blank" rel="noopener noreferrer"
                                                    className="ml-2 text-blue-500 underline">
                                                    보기
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* 전체 동의 */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const all = allConsented;
                                        setConsented({ terms: !all, privacy: !all, refund: !all });
                                    }}
                                    className="w-full mt-1 py-2 border border-blue-300 rounded-xl text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                                >
                                    {allConsented ? '전체 동의 해제' : '전체 동의'}
                                </button>

                                {!allConsented && (
                                    <p className="text-xs text-amber-700 flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                        위 항목에 모두 동의해야 결제를 진행할 수 있습니다.
                                    </p>
                                )}
                            </div>

                            {/* PG사 정보 (전자금융거래법 §30) */}
                            <div className="mt-3 px-3 py-2 bg-gray-50 rounded-xl flex items-center justify-between">
                                <span className="text-xs text-gray-400">결제 대행</span>
                                <span className="text-xs text-gray-600 font-medium">
                                    토스페이먼츠 · 214-88-00591 · 1544-7772
                                </span>
                            </div>
                        </div>
                    )}

                    {/* ── 포인트 결제 ── */}
                    {step === 'point' && (
                        <PointPayment
                            totalAmount={totalAmount}
                            availablePoints={points?.total_points || 0}
                            usablePoints={usablePoints}
                            onConfirm={handlePointPayment}
                            onBack={() => setStep('method')}
                        />
                    )}

                    {/* ── 계좌이체 ── */}
                    {step === 'transfer' && (
                        <TransferPayment
                            storeAccount={storeAccount}
                            totalAmount={totalAmount}
                            storeId={store?.id}
                            userIdentifier={userIdentifier}
                            onComplete={handleTransferComplete}
                            onBack={() => setStep('method')}
                        />
                    )}

                    {/* ── 처리 중 ── */}
                    {step === 'processing' && (
                        <div className="py-16 text-center">
                            <Loader2 className="w-12 h-12 mx-auto text-blue-500 animate-spin" />
                            <p className="mt-4 text-gray-600 font-medium">결제를 처리하는 중입니다...</p>
                        </div>
                    )}

                    {/* ── 결제 결과 ── */}
                    {step === 'result' && paymentResult && (
                        <div className="py-8 text-center">
                            {paymentResult.success ? (
                                <>
                                    <div className="w-20 h-20 mx-auto bg-green-50 rounded-full flex items-center justify-center mb-6">
                                        <Check className="w-10 h-10 text-green-500" strokeWidth={3} />
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-900">주문 완료!</h3>
                                    <p className="mt-2 text-gray-500 px-6 leading-relaxed text-sm">
                                        {paymentResult.message || '주문해 주셔서 감사합니다.'}
                                    </p>

                                    {paymentResult.earnPoints > 0 && (
                                        <div className="mt-5 px-4 py-3 bg-amber-50 rounded-2xl inline-flex flex-col items-center border border-amber-100">
                                            <span className="text-amber-600 font-black text-lg">+{paymentResult.earnPoints.toLocaleString()}P 적립!</span>
                                            <span className="text-amber-400 text-xs mt-0.5">포인트 혜택</span>
                                        </div>
                                    )}

                                    <div className="mt-8 flex flex-col gap-3 px-4">
                                        {paymentResult.payment?.receipt_url && (
                                            <button
                                                onClick={() => window.open(paymentResult.payment.receipt_url, '_blank')}
                                                className="w-full py-3.5 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50"
                                            >
                                                <ExternalLink className="w-4 h-4" /> 영수증 보기
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { onPaymentComplete?.(paymentResult); onClose(); }}
                                            className="w-full py-4 bg-blue-500 text-white rounded-2xl font-black text-lg shadow-lg shadow-blue-100 active:scale-95 transition-all"
                                        >
                                            주문 현황 확인
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-20 h-20 mx-auto bg-red-50 rounded-full flex items-center justify-center mb-6">
                                        <X className="w-10 h-10 text-red-500" strokeWidth={3} />
                                    </div>
                                    <h3 className="text-2xl font-black text-red-600">결제 실패</h3>
                                    <p className="mt-2 text-gray-500 px-6 text-sm">{paymentResult.error}</p>
                                    <div className="mt-8 px-4">
                                        <button
                                            onClick={() => { setStep('method'); setPaymentResult(null); }}
                                            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black active:scale-95 transition-all"
                                        >
                                            다른 결제수단 선택
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
