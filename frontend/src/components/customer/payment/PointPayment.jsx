import { useState } from 'react';
import { Star, ArrowLeft, Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../../utils/format';

export default function PointPayment({
  totalAmount,
  availablePoints,
  usablePoints,
  onConfirm,
  onBack
}) {
  const { t } = useTranslation();
  const [useAmount, setUseAmount] = useState(0);
  const remainingAmount = totalAmount - useAmount;

  // 사용 가능한 최대 포인트 (결제 금액과 사용 가능 포인트 중 작은 값)
  const maxUsable = Math.min(usablePoints, totalAmount);

  const handleSliderChange = (e) => {
    setUseAmount(parseInt(e.target.value, 10));
  };

  const handleIncrement = (amount) => {
    setUseAmount(prev => Math.min(prev + amount, maxUsable));
  };

  const handleDecrement = (amount) => {
    setUseAmount(prev => Math.max(prev - amount, 0));
  };

  const handleUseAll = () => {
    setUseAmount(maxUsable);
  };

  const handleConfirm = () => {
    if (useAmount > 0) {
      onConfirm(useAmount);
    }
  };

  return (
    <div className="space-y-6">
      {/* 뒤로가기 */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>{t('payment.back_to_method')}</span>
      </button>

      {/* 포인트 현황 */}
      <div className="p-4 bg-yellow-50 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            <span className="font-medium">{t('payment.holding_points')}</span>
          </div>
          <span className="text-xl font-bold text-yellow-600">
            {availablePoints.toLocaleString()}P
          </span>
        </div>
        <div className="text-sm text-gray-500">
          {t('payment.usable_here', { count: usablePoints.toLocaleString() })}
        </div>
      </div>

      {/* 결제 금액 정보 */}
      <div className="p-4 bg-gray-50 rounded-xl space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{t('payment.total_amount')}</span>
          <span className="font-medium">{formatPrice(totalAmount, true)}</span>
        </div>
        <div className="flex justify-between text-sm text-orange-600">
          <span>{t('payment.point_usage_title')}</span>
          <span>-{formatPrice(useAmount, true)}</span>
        </div>
        <div className="border-t pt-2 flex justify-between">
          <span className="font-medium">{t('payment.remaining_amount')}</span>
          <span className="text-xl font-bold text-blue-600">
            {formatPrice(remainingAmount, true)}
          </span>
        </div>
      </div>

      {/* 포인트 사용량 조절 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">{t('payment.point_usage_title')}</span>
          <button
            onClick={handleUseAll}
            className="text-sm text-blue-500 hover:text-blue-700"
          >
            {t('payment.use_all')}
          </button>
        </div>

        {/* 슬라이더 */}
        <div className="relative">
          <input
            type="range"
            min="0"
            max={maxUsable}
            value={useAmount}
            onChange={handleSliderChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-yellow-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0P</span>
            <span>{maxUsable.toLocaleString()}P</span>
          </div>
        </div>

        {/* 증감 버튼 */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => handleDecrement(1000)}
            className="p-2 rounded-full border hover:bg-gray-50 disabled:opacity-50"
            disabled={useAmount === 0}
          >
            <Minus className="w-5 h-5" />
          </button>
          <div className="text-2xl font-bold text-yellow-600 min-w-[120px] text-center">
            {useAmount.toLocaleString()}P
          </div>
          <button
            onClick={() => handleIncrement(1000)}
            className="p-2 rounded-full border hover:bg-gray-50 disabled:opacity-50"
            disabled={useAmount >= maxUsable}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* 빠른 선택 버튼 */}
        <div className="grid grid-cols-4 gap-2">
          {[1000, 5000, 10000, maxUsable].map((amount, idx) => (
            <button
              key={idx}
              onClick={() => setUseAmount(Math.min(amount, maxUsable))}
              disabled={amount > maxUsable}
              className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors
                ${amount <= maxUsable
                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
            >
              {idx === 3 ? t('payment.use_all') : `${(amount / 1000).toFixed(0)}k`}
            </button>
          ))}
        </div>
      </div>

      {/* 결제 버튼 */}
      <div className="space-y-2">
        {remainingAmount > 0 ? (
          <button
            onClick={handleConfirm}
            disabled={useAmount === 0}
            className="w-full py-4 bg-blue-500 text-white rounded-xl font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {useAmount > 0
              ? t('payment.mixed_payment_msg', { point: useAmount.toLocaleString(), remaining: formatPrice(remainingAmount, true) })
              : t('payment.select_points_prompt')}
          </button>
        ) : (
          <button
            onClick={handleConfirm}
            className="w-full py-4 bg-yellow-500 text-white rounded-xl font-medium"
          >
            {t('payment.pay_with_points', { amount: useAmount.toLocaleString() })}
          </button>
        )}
      </div>
    </div>
  );
}
