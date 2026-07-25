import { useState, useEffect, useCallback } from 'react';
import { pointsAPI, paymentsAPI } from '../api';

export function usePoints(identifier = {}) {
  const [points, setPoints] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { toss_user_key, phone, user_id } = identifier;

  // 포인트 잔액 조회
  const fetchBalance = useCallback(async () => {
    if (!toss_user_key && !phone && !user_id) return;

    setLoading(true);
    setError(null);

    try {
      const { data } = await pointsAPI.getBalance({
        toss_user_key,
        phone,
        user_id
      });
      setPoints(data);
      return data;
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [toss_user_key, phone, user_id]);

  // 포인트 내역 조회
  const fetchHistory = useCallback(async (options = {}) => {
    if (!toss_user_key && !phone && !user_id) return;

    try {
      const { data } = await pointsAPI.getHistory({
        toss_user_key,
        phone,
        user_id,
        ...options
      });
      setHistory(data.transactions);
      return data;
    } catch {
      return null;
    }
  }, [toss_user_key, phone, user_id]);

  // 사용 가능 포인트 계산
  const calculateUsablePoints = useCallback(async (amount, storeId) => {
    if (!toss_user_key && !phone && !user_id) return 0;

    try {
      const { data } = await pointsAPI.calculateUsable(amount, storeId, {
        toss_user_key,
        phone,
        user_id
      });
      return data;
    } catch {
      return { total_points: 0, usable_points: 0, max_discount: 0 };
    }
  }, [toss_user_key, phone, user_id]);

  // 적립 예정 포인트 계산
  const calculateEarnPoints = useCallback(async (amount, storeId) => {
    try {
      const { data } = await pointsAPI.calculateEarn(amount, storeId);
      return data.earn_points;
    } catch {
      return 0;
    }
  }, []);

  // 포인트 결제 실행
  const payWithPoints = useCallback(async ({
    orderId,
    storeId,
    totalAmount,
    pointAmount
  }) => {
    if (pointAmount > (points?.total_points || 0)) {
      return { success: false, error: '포인트가 부족합니다' };
    }

    try {
      const paymentMethod = pointAmount === totalAmount ? 'point' : 'mixed';

      const { data: payment } = await paymentsAPI.create({
        order_id: orderId,
        store_id: storeId,
        payment_method: paymentMethod,
        total_amount: totalAmount,
        point_amount: pointAmount,
        toss_user_key,
        phone
      });

      // 잔액 새로고침
      await fetchBalance();

      return { success: true, payment };
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message;
      return { success: false, error: errorMessage };
    }
  }, [points, toss_user_key, phone, fetchBalance]);

  // 초기 로드
  useEffect(() => {
    if (toss_user_key || phone || user_id) {
      fetchBalance();
    }
  }, [toss_user_key, phone, user_id, fetchBalance]);

  return {
    points,
    history,
    loading,
    error,
    fetchBalance,
    fetchHistory,
    calculateUsablePoints,
    calculateEarnPoints,
    payWithPoints,
    hasPoints: (points?.total_points || 0) > 0
  };
}

export default usePoints;
