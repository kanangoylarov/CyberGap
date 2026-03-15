export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  stock: number;
  created_at: string;
}

export interface CartItem {
  id: number;
  session_id: string;
  product_id: number;
  quantity: number;
  product: Product;
  created_at: string;
}

export interface CartAddRequest {
  product_id: number;
  quantity: number;
}

export interface CartUpdateRequest {
  quantity: number;
}

export interface CartResponse {
  items: CartItem[];
  total: number;
  item_count: number;
}

export interface Order {
  id: number;
  session_id: string;
  customer_name: string;
  customer_email: string;
  shipping_address: string;
  total: number;
  status: string;
  created_at: string;
}

export interface OrderCreateRequest {
  customer_name: string;
  customer_email: string;
  shipping_address: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}
