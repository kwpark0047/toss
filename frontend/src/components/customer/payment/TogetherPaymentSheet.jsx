import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, ShoppingBag, CreditCard, ChevronRight, CheckCircle2, Info, AlertCircle } from 'lucide-react';

/**
 * [TogetherPaymentSheet]
 * "함께 결제하기" (분할 결제)를 위한 고도화된 바텀 시트입니다.
 * N분의 1 결제와 품목별 선택 결제를 지원하며, 실시간 정산 현황을 시각화합니다.
 */
// [최적화] React.memo를 사용하여 부모 컴포넌트 리렌더링 시 불필요한 시트 리렌더링 방지
const TogetherPaymentSheet = React.memo(({
    isOpen,
    onClose,
    cart,
    totalAmount,
    onConfirm,
    theme,
    formatPrice,
    socket,
    tableId
}) => {
    const [splitMode, setSplitMode] = useState('EQUAL');
    const [peopleCount, setPeopleCount] = useState(2);
    const [selectedItems, setSelectedItems] = useState([]);
    const [splitStatus, setSplitStatus] = useState(null);

    useEffect(() => {
        if (!socket || !tableId) return;

        const handleSplitUpdate = (data) => {
            // console.log('[Together] 정산 현황 업데이트 수신:', data);
            setSplitStatus(data);
        };

        socket.on('split-payment-update', handleSplitUpdate);
        return () => socket.off('split-payment-update', handleSplitUpdate);
    }, [socket, tableId]);

    const toggleItemSelection = (productId) => {
        setSelectedItems(prev =>
            prev.includes(productId)
                ? prev.filter(id => id !== productId)
                : [...prev, productId]
        );
    };

    // [최적화] 내가 결제할 금액 계산을 useMemo로 관리하여 렌더링 성능 향상
    const myAmount = useMemo(() => {
        if (splitMode === 'EQUAL') {
            return Math.floor(totalAmount / peopleCount);
        } else {
            return cart
                .filter(item => selectedItems.includes(item.product_id))
                .reduce((sum, item) => sum + (item.price * item.quantity), 0);
        }
    }, [splitMode, totalAmount, peopleCount, cart, selectedItems]);

    const handlePaymentStart = () => {
        if (myAmount <= 0) {
            alert('결제할 금액이 0원입니다. 품목을 선택하거나 인원수를 확인해주세요.');
            return;
        }

        onConfirm({
            split_type: splitMode,
            amount: myAmount,
            is_split_payment: true,
            selected_items: splitMode === 'ITEM' ? selectedItems : null,
            people_count: splitMode === 'EQUAL' ? peopleCount : null
        });
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[60] flex items-end justify-center">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Sheet Content */}
                <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="relative w-full max-w-lg bg-white rounded-t-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-6 border-b flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                                <Users className="text-blue-600" /> 함께 결제하기
                            </h2>
                            <p className="text-sm text-gray-500 font-medium">나누어 결제하면 토스 포인트도 각각 적립돼요!</p>
                        </div>
                        <button onClick={onClose} aria-label="닫기" className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                            <X size={24} className="text-gray-600" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        {/* 정산 현황 대시보드 (진행 중인 경우 표시) */}
                        {splitStatus && (
                            <div className="bg-blue-50 border border-blue-100 rounded-[2rem] p-5">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-blue-700 font-bold text-sm">실시간 정산 현황</span>
                                    <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">LIVE</span>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600 font-medium">총 금액</span>
                                        <span className="text-gray-900 font-bold">{formatPrice(splitStatus.totalAmount)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600 font-medium">결제된 금액</span>
                                        <span className="text-blue-600 font-bold">{formatPrice(splitStatus.paidAmount)}</span>
                                    </div>
                                    <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden mt-2">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(splitStatus.paidAmount / splitStatus.totalAmount) * 100}%` }}
                                            className="absolute inset-y-0 left-0 bg-blue-500"
                                        />
                                    </div>
                                    <p className="text-center text-xs text-gray-400 mt-2 font-medium">
                                        남은 정산액: <span className="text-gray-900 font-bold">{formatPrice(splitStatus.remainingAmount)}</span>
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 분할 모드 선택부 */}
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setSplitMode('EQUAL')}
                                className={`p-5 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 ${splitMode === 'EQUAL'
                                    ? 'border-blue-600 bg-blue-50 shadow-lg shadow-blue-100'
                                    : 'border-gray-100 bg-gray-50'
                                    }`}
                            >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${splitMode === 'EQUAL' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                    <Users size={24} />
                                </div>
                                <div className="text-center">
                                    <p className={`font-bold ${splitMode === 'EQUAL' ? 'text-blue-900' : 'text-gray-500'}`}>N분의 1</p>
                                    <p className="text-[10px] text-gray-400 font-medium">균등하게 나누기</p>
                                </div>
                            </button>

                            <button
                                onClick={() => setSplitMode('ITEM')}
                                className={`p-5 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 ${splitMode === 'ITEM'
                                    ? 'border-orange-500 bg-orange-50 shadow-lg shadow-orange-100'
                                    : 'border-gray-100 bg-gray-50'
                                    }`}
                            >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${splitMode === 'ITEM' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                    <ShoppingBag size={24} />
                                </div>
                                <div className="text-center">
                                    <p className={`font-bold ${splitMode === 'ITEM' ? 'text-orange-900' : 'text-gray-500'}`}>내가 먹은 것</p>
                                    <p className="text-[10px] text-gray-400 font-medium">품목별 직접 선택</p>
                                </div>
                            </button>
                        </div>

                        {/* 모드별 상세 설정 */}
                        <div className="bg-slate-50 rounded-[2.5rem] p-6 border border-slate-100">
                            {splitMode === 'EQUAL' ? (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-gray-700">함께한 인원수</span>
                                        <div className="flex items-center gap-4 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                                            <button
                                                onClick={() => setPeopleCount(Math.max(2, peopleCount - 1))}
                                                className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-600 font-bold hover:bg-gray-100"
                                            >
                                                -
                                            </button>
                                            <span className="w-6 text-center font-black text-lg text-gray-900">{peopleCount}</span>
                                            <button
                                                onClick={() => setPeopleCount(peopleCount + 1)}
                                                className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold hover:bg-blue-100"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-2xl p-4 border border-dashed border-blue-200 flex justify-between items-center">
                                        <span className="text-sm text-gray-500 font-bold">1인당 결제 금액</span>
                                        <span className="text-xl font-black text-blue-600">{formatPrice(myAmount)}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <span className="font-bold text-gray-700 block mb-2">내가 먹은 메뉴 선택</span>
                                    <div className="space-y-3">
                                        {cart.map((item) => (
                                            <button
                                                key={item.product_id}
                                                onClick={() => toggleItemSelection(item.product_id)}
                                                className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${selectedItems.includes(item.product_id)
                                                    ? 'border-orange-500 bg-white shadow-md'
                                                    : 'border-transparent bg-gray-100/50'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${selectedItems.includes(item.product_id) ? 'bg-orange-500 text-white' : 'bg-gray-300'
                                                        }`}>
                                                        {selectedItems.includes(item.product_id) && <CheckCircle2 size={14} />}
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-sm font-bold text-gray-800">{item.product_name}</p>
                                                        <p className="text-xs text-gray-400">수량 {item.quantity}개</p>
                                                    </div>
                                                </div>
                                                <span className="font-black text-gray-900">{formatPrice(item.price * item.quantity)}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 유의사항 알림 */}
                        <div className="flex gap-3 p-4 bg-orange-50 rounded-2xl text-[11px] text-orange-700 leading-relaxed font-medium">
                            <Info size={16} className="shrink-0 mt-0.5" />
                            <p>
                                분할 결제 시 모든 인원이 결제를 완료해야 주방으로 주문서가 전달됩니다. <br />
                                토스 브랜드페이 결제 시 개인별로 주문이 이력에 남습니다.
                            </p>
                        </div>
                    </div>

                    {/* Footer - Payment Action */}
                    <div className="p-8 border-t bg-white sticky bottom-0 z-10">
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">My Contribution</span>
                                <span className="text-gray-500 text-sm font-bold">총 {formatPrice(totalAmount)} 중</span>
                            </div>
                            <span className="text-4xl font-black text-gray-900" style={{ color: theme.primaryColor }}>
                                {formatPrice(myAmount)}
                            </span>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handlePaymentStart}
                            className="w-full py-6 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-blue-500/30 flex items-center justify-center gap-3 overflow-hidden group relative"
                            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
                        >
                            <CreditCard size={24} />
                            내 몫만 결제하기
                            <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                        </motion.button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
});

export default TogetherPaymentSheet;
