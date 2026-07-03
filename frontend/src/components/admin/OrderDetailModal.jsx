import { X, Eye, RefreshCw } from 'lucide-react';
import { formatPrice } from '../../utils/format';

/**
 * [관리자용 주문 상세 모달 컴포넌트]
 * 주문의 모든 세부 항목, 요청사항, 결제 정보 및 환불 기능을 표시합니다.
 */
const OrderDetailModal = ({ order, statusConfig, onClose, onStatusChange, onPaymentCancel, formatDateTime }) => {
    if (!order) return null;

    return (
        <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white/90 backdrop-blur-lg p-5 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-navy-900">주문 상세</h2>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                        <X className="w-5 h-5 text-navy-600" />
                    </button>
                </div>

                <div className="p-5 space-y-6">
                    {/* 고객 및 테이블 정보 */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-2xl font-bold text-navy-900">#{order.order_number}</span>
                            <span className={'px-4 py-2 rounded-full font-medium ' + (statusConfig[order.status]?.color ?? 'bg-gray-100 text-gray-600')}>
                                {statusConfig[order.status]?.label ?? order.status}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="bg-gray-50 rounded-xl p-3">
                                <p className="text-navy-400 mb-1">주문시간</p>
                                <p className="font-medium text-navy-900">{formatDateTime(order.created_at)}</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3">
                                <p className="text-navy-400 mb-1">테이블</p>
                                <p className="font-medium text-navy-900">{order.table_name || '포장'}</p>
                            </div>
                            {order.customer_name && (
                                <div className="bg-gray-50 rounded-xl p-3">
                                    <p className="text-navy-400 mb-1">고객명</p>
                                    <p className="font-medium text-navy-900">{order.customer_name}</p>
                                </div>
                            )}
                            <div className="bg-gray-50 rounded-xl p-3">
                                <p className="text-navy-400 mb-1">결제상태</p>
                                <p className="font-medium text-navy-900">{order.payment_status === 'paid' ? '결제완료' : '미결제'}</p>
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
                                href={order.proof_image_url.startsWith('http') ? order.proof_image_url : `https://wemarket.onrender.com${order.proof_image_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-xl overflow-hidden border-2 border-white shadow-sm hover:opacity-90 transition-opacity"
                            >
                                <img
                                    src={order.proof_image_url.startsWith('http') ? order.proof_image_url : `https://wemarket.onrender.com${order.proof_image_url}`}
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
                        <h3 className="font-bold text-navy-900 mb-3">주문 항목</h3>
                        <div className="space-y-3">
                            {(order.items || []).map((item, idx) => (
                                <div key={item.id ?? `${item.product_id}-${idx}`} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                                    <div>
                                        <p className="font-medium text-navy-900">{item.product_name}</p>
                                        <p className="text-sm text-navy-500">{formatPrice(item.price, true)} x {item.quantity}</p>
                                    </div>
                                    <p className="font-bold text-navy-900">{formatPrice(item.price * item.quantity, true)}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 주방 요청사항 */}
                    {order.notes && (
                        <div>
                            <h3 className="font-bold text-navy-900 mb-3">요청사항</h3>
                            <div className="p-4 bg-yellow-50 rounded-xl">
                                <p className="text-yellow-800">{order.notes}</p>
                            </div>
                        </div>
                    )}

                    {/* 총 결제 정보 */}
                    <div className="flex justify-between items-center p-4 bg-primary-50 rounded-xl">
                        <span className="font-bold text-navy-900">총 결제금액</span>
                        <span className="text-2xl font-bold text-primary-600">{formatPrice(order.total_amount, true)}</span>
                    </div>

                    {/* 모달 하단 버튼 섹션: 상태 변경 및 환불 제어 */}
                    <div className="flex gap-3">
                        {order.status !== 'completed' && order.status !== 'cancelled' && (
                            <>
                                {statusConfig[order.status].next && (
                                    <button
                                        onClick={() => {
                                            onStatusChange(order.id, statusConfig[order.status].next);
                                        }}
                                        className="flex-1 py-4 btn-primary text-white rounded-2xl font-medium text-lg"
                                    >
                                        {statusConfig[statusConfig[order.status].next].label}으로 변경
                                    </button>
                                )}
                                {order.status === 'pending' && (
                                    <button
                                        onClick={() => {
                                            onStatusChange(order.id, 'cancelled');
                                        }}
                                        className="px-6 py-4 bg-red-50 text-red-500 rounded-2xl font-medium hover:bg-red-100 transition-colors border border-red-100"
                                    >
                                        주문 거절
                                    </button>
                                )}
                                {/* 결제 취소(환불) 버튼 */}
                                {order.payment_status === 'paid' && order.status !== 'cancelled' && (
                                    <button
                                        onClick={() => onPaymentCancel(order.id)}
                                        className="px-6 py-4 bg-orange-100 text-orange-600 rounded-2xl font-bold hover:bg-orange-200 transition-all border border-orange-200 flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw className="w-5 h-5" /> 결제 취소(환불)
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
