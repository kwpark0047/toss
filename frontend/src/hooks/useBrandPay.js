import { useState, useCallback, useEffect } from 'react';
import { paymentsAPI } from '../api';

/**
 * [useBrandPay]
 * 토스 브랜드페이(BrandPay) SDK를 초기화하고 원터치 결제를 관리합니다.
 */
export function useBrandPay() {
    const [brandpay, setBrandpay] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // 1. 브랜드페이 SDK 로드 및 초기화
    useEffect(() => {
        const loadSDK = async () => {
            try {
                // 백엔드에서 설정 정보(clientKey, customerKey) 가져오기
                const { data: config } = await paymentsAPI.getBrandPayConfig();

                const script = document.createElement('script');
                script.src = 'https://sdk.tosspayments.com/brandpay/v1';
                script.async = true;
                script.onload = async () => {
                    const bp = await window.loadBrandPay(config.clientKey, config.customerKey, {
                        redirectUrl: `${window.location.origin}/payment/callback`
                    });
                    setBrandpay(bp);
                };
                document.body.appendChild(script);
            } catch (err) {
                console.error('[BrandPay] SDK 로드 실패:', err);
                setError('결제 시스템을 불러오는데 실패했습니다.');
            }
        };

        loadSDK();
    }, []);

    /**
     * [원터치 결제 실행]
     */
    const requestPayment = useCallback(async ({
        orderId,
        orderName,
        amount
    }) => {
        if (!brandpay) throw new Error('결제 시스템이 준비되지 않았습니다.');

        setLoading(true);
        setError(null);

        try {
            // 브랜드페이 결제창 호출 (One-touch 경험)
            const result = await brandpay.requestPayment({
                amount,
                orderId,
                orderName,
            });

            // 결제 성공 시 서버 승인 요청
            const { data: confirmed } = await paymentsAPI.confirm(orderId, {
                paymentKey: result.paymentKey,
                orderId: result.orderId,
                amount: result.amount,
                customerKey: brandpay.customerKey
            });

            return { success: true, ...confirmed };
        } catch (err) {
            console.error('[BrandPay] 결제 실패:', err);
            setError(err.message || '결제 중 오류가 발생했습니다.');
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    }, [brandpay]);

    return {
        brandpay,
        loading,
        error,
        requestPayment
    };
}

export default useBrandPay;
