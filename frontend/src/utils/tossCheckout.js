const TOSS_CLIENT_KEY =
  import.meta.env.VITE_TOSS_CLIENT_KEY || 'test_ck_D54YPdW9w8NE198759v8Vj7ByY6f';

async function loadTossPayments() {
  if (window.TossPayments) return window.TossPayments;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.tosspayments.com/v1/payment';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Toss Payments SDK를 불러오지 못했습니다.'));
    document.head.appendChild(script);
  });
  return window.TossPayments;
}

export async function requestTossCheckout({ paymentId, amount, orderId, orderName, phone }) {
  const TossPayments = await loadTossPayments();
  if (!TossPayments) throw new Error('Toss Payments SDK를 활성화할 수 없습니다.');

  const metadata = new URLSearchParams({ payment_id: String(paymentId) });
  await TossPayments(TOSS_CLIENT_KEY).requestPayment('카드', {
    amount,
    orderId,
    orderName,
    successUrl: `${window.location.origin}/payment/success?${metadata}`,
    failUrl: `${window.location.origin}/payment/fail?${metadata}`,
    customerMobilePhone: phone || undefined,
  });
}
