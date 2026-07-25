export interface Store {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  business_hours?: string;
  image_url?: string;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface StoreCreateInput {
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  business_hours?: string;
  image_url?: string;
}

export interface StoreUpdateInput {
  name?: string;
  description?: string;
  address?: string;
  phone?: string;
  business_hours?: string;
  image_url?: string;
  is_active?: boolean;
}

export interface StoreSearchOptions {
  query?: string;
  category?: string;
  district?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

export interface StoreSearchResult {
  stores: Store[];
  total: number;
  page: number;
  limit: number;
}
