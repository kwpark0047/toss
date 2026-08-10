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
      // pointsController는 bare res.json(balance)로 응답하므로 본문을 그대로 사용
      const res = await pointsAPI.getBalance({
        toss_user_key,
        phone,
        user_id,
      });
      setPoints(res);
      return res;
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [toss_user_key, phone, user_id]);

  // 월렛 조회 (비인증 사용자용: phone/toss_user_key로 조회)
  const walletLookup = useCallback(
    async (storeId = null) => {
      if (!toss_user_key && !phone && !user_id) return null;

      setLoading(true);
      setError(null);

      try {
        const res = await pointsAPI.walletLookup({
          toss_user_key,
          phone,
          user_id,
          store_id: storeId,
        });
        setPoints(res.balance);
        return res;
      } catch (err) {
        setError(err.response?.data?.error || err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toss_user_key, phone, user_id]
  );

  // 포인트 내역 조회
  const fetchHistory = useCallback(
    async (options = {}) => {
      if (!toss_user_key && !phone && !user_id) return;

      try {
        const res = await pointsAPI.getHistory({
          toss_user_key,
          phone,
          user_id,
          ...options,
        });
        setHistory(res.transactions);
        return res;
      } catch {
        return null;
      }
    },
    [toss_user_key, phone, user_id]
  );

  // 사용 가능 포인트 계산
  const calculateUsablePoints = useCallback(
    async (amount, storeId) => {
      if (!toss_user_key && !phone && !user_id) return 0;

      try {
        const res = await pointsAPI.calculateUsable(amount, storeId, {
          toss_user_key,
          phone,
          user_id,
        });
        return res;
      } catch {
        return { total_points: 0, usable_points: 0, max_discount: 0 };
      }
    },
    [toss_user_key, phone, user_id]
  );

  // 적립 예정 포인트 계산
  const calculateEarnPoints = useCallback(async (amount, storeId) => {
    try {
      const res = await pointsAPI.calculateEarn(amount, storeId);
      return res.earn_points;
    } catch {
      return 0;
    }
  }, []);

  // 포인트 결제 실행
  const payWithPoints = useCallback(
    async ({ orderId, storeId, totalAmount, pointAmount }) => {
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
          phone,
        });

        // 잔액 새로고침
        await fetchBalance();

        return { success: true, payment };
      } catch (err) {
        const errorMessage = err.response?.data?.error || err.message;
        return { success: false, error: errorMessage };
      }
    },
    [points, toss_user_key, phone, fetchBalance]
  );

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
    walletLookup,
    fetchHistory,
    calculateUsablePoints,
    calculateEarnPoints,
    payWithPoints,
    hasPoints: (points?.total_points || 0) > 0,
  };
}

export default usePoints;
