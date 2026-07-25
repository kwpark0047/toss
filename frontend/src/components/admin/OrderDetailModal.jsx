import { useState } from 'react';
import { X, Eye, RefreshCw, Scissors } from 'lucide-react';
import { formatPrice } from '../../utils/format';
import { paymentsAPI } from '../../api';

const OrderDetailModal = ({ order, statusConfig, onClose, onStatusChange, onPaymentCancel, formatDateTime }) => {
    const [showPartialRefund, setShowPartialRefund] = useState(false);
    const [partialAmount, setPartialAmount] = useState('');
    const [partialReason, setPartialReason] = useState('');
    const [partialLoading, setPartialLoading] = useState(false);
    const [partialError, setPartialError] = useState('');

    if (!order) return null;

    const handlePartialRefund = async () => {
        const amount = parseInt(partialAmount.replace(/,/g, ''), 10);
        if (!amount || amount <= 0) { setPartialError('금액을 입력하세요.'); return; }
        if (amount > order.total_amount) { setPartialError('결제 금액을 초과합니다.'); return; }
        setPartialLoading(true);
        setPartialError('');
        try {
            await paymentsAPI.partialCancel(order.id, amount, partialReason || '부분 환불');
            setShowPartialRefund(false);
            setPartialAmount('');
            onClose();
        } catch (e) {
            setPartialError(e?.response?.data?.error || e.message || '부분 환불 실패');
        } finally {
            setPartialLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white/90 backdrop-blur-lg p-5 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900">주문 상세</h2>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                        <X className="w-5 h-5 text-slate-600" />
                    </button>
                </div>

                <div className="p-5 space-y-6">
                    {/* 고객 및 테이블 정보 */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-2xl font-bold text-slate-900">#{order.order_number}</span>
                            <span className={'px-4 py-2 rounded-full font-medium ' + (statusConfig[order.status]?.color ?? 'bg-gray-100 text-gray-600')}>
                                {statusConfig[order.status]?.label ?? order.status}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="bg-gray-50 rounded-xl p-3">
                                <p className="text-slate-400 mb-1">주문시간</p>
                                <p className="font-medium text-slate-900">{formatDateTime(order.created_at)}</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3">
                                <p className="text-slate-400 mb-1">테이블</p>
                                <p className="font-medium text-slate-900">{order.table_name || '포장'}</p>
                            </div>
                            {order.customer_name && (
                                <div className="bg-gray-50 rounded-xl p-3">
                                    <p className="text-slate-400 mb-1">고객명</p>
                                    <p className="font-medium text-slate-900">{order.customer_name}</p>
                                </div>
                            )}
                            <div className="bg-gray-50 rounded-xl p-3">
                                <p className="text-slate-400 mb-1">결제상태</p>
                                <p className="font-medium text-slate-900">{order.payment_status === 'paid' ? '결제완료' : '미결제'}</p>
                            </div>
                        </div>
                    </div>

                    {/* 입금 증빙 이미지 표시 */}
                    {order.proof_image_url && (
                        <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100">
                            <h3 className="font-bold text-orange-800 text-sm mb-3 flex items-center gap-2">
                                <Eye className="w-4 h-4" /> 입금 증빙 사진 (송금 확인증)
                            </h3>
                            <a
                                href={order.proof_image_url.startsWith('http') ? order.proof_image_url : `${import.meta.env.VITE_API_URL || window.location.origin}${order.proof_image_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-xl overflow-hidden border-2 border-white shadow-sm hover:opacity-90 transition-opacity"
                            >
                                <img
                                    src={order.proof_image_url.startsWith('http') ? order.proof_image_url : `${import.meta.env.VITE_API_URL || window.location.origin}${order.proof_image_url}`}
                                    alt="입금 증빙"
                                    className="w-full h-auto max-h-64 object-contain bg-white"
                                />
                            </a>
                            <p className="text-[11px] text-orange-600 mt-2 text-center">
                                이미지를 클릭하면 원본 크기로 볼 수 있습니다.
                            </p>
                        </div>
                    )}

                    {/* 주문 상품 목록 */}
                    <div>
                        <h3 className="font-bold text-slate-900 mb-3">주문 항목</h3>
                        <div className="space-y-3">
                            {(order.items || []).map((item, idx) => (
                                <div key={item.id ?? `${item.product_id}-${idx}`} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                                    <div>
                                        <p className="font-medium text-slate-900">{item.product_name}</p>
                                        <p className="text-sm text-slate-500">{formatPrice(item.price, true)} x {item.quantity}</p>
                                    </div>
                                    <p className="font-bold text-slate-900">{formatPrice(item.price * item.quantity, true)}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 주방 요청사항 */}
                    {order.notes && (
                        <div>
                            <h3 className="font-bold text-slate-900 mb-3">요청사항</h3>
                            <div className="p-4 bg-yellow-50 rounded-xl">
                                <p className="text-yellow-800">{order.notes}</p>
                            </div>
                        </div>
                    )}

                    {/* 총 결제 정보 */}
                    <div className="flex justify-between items-center p-4 bg-orange-50 rounded-xl">
                        <span className="font-bold text-slate-900">총 결제금액</span>
                        <span className="text-2xl font-bold text-orange-600">{formatPrice(order.total_amount, true)}</span>
                    </div>

                    {/* 부분 환불 입력폼 */}
                    {showPartialRefund && (
                        <div className="border border-orange-200 rounded-2xl p-4 bg-orange-50 space-y-3">
                            <p className="text-sm font-bold text-orange-800">부분 환불 금액 입력</p>
                            <input
                                type="number"
                                placeholder="환불 금액 (원)"
                                value={partialAmount}
                                onChange={e => setPartialAmount(e.target.value)}
                                className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                            />
                            <input
                                type="text"
                                placeholder="환불 사유 (선택)"
                                value={partialReason}
                                onChange={e => setPartialReason(e.target.value)}
                                className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                            />
                            {partialError && <p className="text-xs text-red-500 font-medium">{partialError}</p>}
                            <div className="flex gap-2">
                                <button onClick={() => setShowPartialRefund(false)}
                                    className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">
                                    취소
                                </button>
                                <button onClick={handlePartialRefund} disabled={partialLoading}
                                    className="flex-1 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                                    {partialLoading ? '처리중...' : '부분 환불 실행'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 모달 하단 버튼 섹션: 상태 변경 및 환불 제어 */}
                    <div className="flex flex-wrap gap-3">
                        {order.status !== 'completed' && order.status !== 'cancelled' && (
                            <>
                                {statusConfig[order.status]?.next && (
                                    <button
                                        onClick={() => onStatusChange(order.id, statusConfig[order.status].next)}
                                        className="flex-1 py-4 btn-primary text-white rounded-2xl font-medium text-lg"
                                    >
                                        {statusConfig[statusConfig[order.status].next]?.label}으로 변경
                                    </button>
                                )}
                                {order.status === 'pending' && (
                                    <button
                                        onClick={() => onStatusChange(order.id, 'cancelled')}
                                        className="px-6 py-4 bg-red-50 text-red-500 rounded-2xl font-medium hover:bg-red-100 transition-colors border border-red-100"
                                    >
                                        주문 거절
                                    </button>
                                )}
                                {/* 전체 환불 버튼 */}
                                {order.payment_status === 'paid' && (
                                    <button
                                        onClick={() => onPaymentCancel(order.id)}
                                        className="px-5 py-4 bg-orange-100 text-orange-600 rounded-2xl font-bold hover:bg-orange-200 transition-all border border-orange-200 flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw className="w-4 h-4" /> 전체 취소
                                    </button>
                                )}
                                {/* 부분 환불 버튼 */}
                                {order.payment_status === 'paid' && !showPartialRefund && (
                                    <button
                                        onClick={() => setShowPartialRefund(true)}
                                        className="px-5 py-4 bg-amber-50 text-amber-700 rounded-2xl font-bold hover:bg-amber-100 transition-all border border-amber-200 flex items-center justify-center gap-2"
                                    >
                                        <Scissors className="w-4 h-4" /> 부분 환불
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderDetailModal;
