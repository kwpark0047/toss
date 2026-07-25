export interface Order {
  id: number;
  store_id: number;
  order_number: string;
  customer_phone?: string;
  customer_name?: string;
  total_amount: number;
  status: string;
  method?: string;
  payment_status?: string;
  toss_user_key?: string;
  created_at?: Date;
  updated_at?: Date;
  completed_at?: Date;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id?: number;
  order_id?: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  subtotal?: number;
  options?: string;
  user_phone?: string;
}

export interface OrderCreateInput {
  store_id: number;
  customer_phone?: string;
  customer_name?: string;
  items: OrderItem[];
  toss_user_key?: string;
}

export interface OrderStatusUpdate {
  status: string;
  payment_status?: string;
}

export interface OrderListOptions {
  store_id: number;
  status?: string;
  page?: number;
  limit?: number;
  start_date?: Date;
  end_date?: Date;
}
