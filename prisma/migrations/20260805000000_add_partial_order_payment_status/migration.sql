-- 분할 결제 완료 전 주문 상태를 표현하기 위한 결제 상태 추가
ALTER TYPE "OrderPaymentStatus" ADD VALUE IF NOT EXISTS 'partial';
