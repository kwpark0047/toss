export interface PaymentData {
  store_id: string | number;
  items: OrderItem[];
  total_amount: string | number;
  payment_method: string;
  point_amount?: number;
  phone?: string;
  toss_user_key?: string;
  customer_name?: string;
}

export interface OrderItem {
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  options?: Record<string, unknown>;
  user_phone?: string;
}

export interface SplitPaymentData {
  order_id: number;
  store_id: number;
  table_id?: number;
  splits: SplitItem[];
  toss_user_key?: string;
}

export interface SplitItem {
  user_phone: string;
  amount: number;
  point_amount?: number;
}

export interface PaymentResult {
  id: number;
  order_id: number;
  order_number: string;
  status: string;
  amount: number;
  method: string;
}

export interface TossConfirmResult {
  paymentKey: string;
  orderId: string;
  amount: number;
  method: string;
  status: string;
  approvedAt: string;
  receipt?: { url: string };
  card?: {
    company: string;
    number: string;
    installmentMonths: number;
  };
  easyPay?: {
    provider: string;
  };
  totalAmount: number;
  customerKey?: string;
}
