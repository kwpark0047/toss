import { Eye, Clock, MapPin, User } from 'lucide-react';
import { formatPrice } from '../../utils/format';

/**
 * [관리자용 주문 카드 컴포넌트]
 * 개별 주문의 핵심 정보를 요약해서 보여주며, 상태 변경 및 상세 보기 기능을 제공합니다.
 */
const OrderCard = ({ order, statusConfig, onShowDetail, onStatusChange, formatTime }) => {
    const config = statusConfig[order.status];
    const StatusIcon = config.icon;

    return (
        <div
            className={'bg-white rounded-2xl shadow-soft overflow-hidden card-hover border-l-4 ' +
                (order.status === 'pending' ? 'border-l-yellow-400' :
                    order.status === 'preparing' ? 'border-l-purple-400' :
                        order.status === 'ready' ? 'border-l-green-400' : 'border-l-transparent')}
        >
            {/* 카드 정보 섹션 */}
            <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-navy-900 text-lg">#{order.order_number}</span>
                        {order.proof_image_url && (
                            <div className="p-1 bg-orange-100 rounded-md" title="입금 증빙 사진 있음">
                                <Eye className="w-3 h-3 text-orange-600" />
                            </div>
                        )}
                        {order.status === 'pending' && (
                            <span className="flex h-3 w-3 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                            </span>
                        )}
                    </div>
                    <span className={'px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ' + config.color}>
                        <StatusIcon className="w-3 h-3" />
                        {config.label}
                    </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-navy-500">
                    <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatTime(order.created_at)}
                    </span>
                    {order.table_name && (
                        <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {order.table_name}
                        </span>
                    )}
                    {order.customer_name && (
                        <span className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {order.customer_name}
                        </span>
                    )}
                </div>
            </div>

            {/* 주문 상품 섹션 */}
            <div className="p-4">
                <div className="space-y-2 mb-4">
                    {(order.items || []).slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                            <span className="text-navy-700">{item.product_name} x {item.quantity}</span>
                            <span className="text-navy-500">{formatPrice(item.price * item.quantity, true)}</span>
                        </div>
                    ))}
                    {(order.items || []).length > 3 && (
                        <p className="text-sm text-navy-400">외 {order.items.length - 3}개 항목</p>
                    )}
                </div>
                {order.notes && (
                    <div className="p-3 bg-yellow-50 rounded-xl mb-4">
                        <p className="text-sm text-yellow-800">요청: {order.notes}</p>
                    </div>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="text-lg font-bold text-primary-600">{formatPrice(order.total_amount, true)}</span>
                    <div className="flex items-center gap-2">
                        {/* 상세보기 모달 열기 */}
                        <button
                            onClick={() => onShowDetail(order)}
                            className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                        >
                            <Eye className="w-4 h-4 text-navy-600" />
                        </button>
                        {/* 다음 상태로 변경 버튼 (예: 조리시작, 완료 등) */}
                        {config.next && (
                            <button
                                onClick={() => onStatusChange(order.id, config.next)}
                                className="px-4 py-2 btn-primary text-white text-sm rounded-lg font-medium"
                            >
                                {statusConfig[config.next].label}
                            </button>
                        )}
                        {/* 접수 전 주문 취소 버튼 */}
                        {order.status === 'pending' && (
                            <button
                                onClick={() => onStatusChange(order.id, 'cancelled')}
                                className="px-3 py-2 bg-red-100 text-red-600 text-sm rounded-lg font-medium hover:bg-red-200 transition-colors"
                            >
                                취소
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderCard;
