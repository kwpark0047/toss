export interface SharedCartItem {
  id: number;
  table_id: number;
  product_id: number;
  quantity: number;
  user_phone?: string | null;
  created_at?: Date;
  updated_at?: Date;
  products?: Product;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  image_url?: string | null;
  is_popular?: boolean;
  is_sold_out?: boolean;
  store_id?: number;
}

export interface CartItemCreateInput {
  table_id: number;
  product_id: number;
  quantity: number;
  user_phone?: string | null;
}

export interface CartItemUpdateInput {
  quantity: number;
  user_phone?: string | null;
}

export interface UpdateCartItemParams {
  tableId: number | string;
  productId: number | string;
  quantity: number | string;
  userPhone?: string;
}

export interface CartDeleteResult {
  count: number;
}
