import axios from 'axios';
import type {
  Product,
  CartResponse,
  CartAddRequest,
  CartUpdateRequest,
  CartItem,
  Order,
  OrderCreateRequest,
  PaginatedResponse,
} from '@/types';

const client = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const message = error.response.data?.detail || error.response.statusText;
      console.error(`API Error [${error.response.status}]: ${message}`);
    } else if (error.request) {
      console.error('Network error: No response received');
    } else {
      console.error('Request error:', error.message);
    }
    return Promise.reject(error);
  }
);

export const productApi = {
  list(params?: {
    page?: number;
    per_page?: number;
    category?: string;
    search?: string;
  }) {
    return client.get<PaginatedResponse<Product>>('/products', { params });
  },

  get(id: number) {
    return client.get<Product>(`/products/${id}`);
  },

  categories() {
    return client.get<string[]>('/products/categories');
  },
};

export const cartApi = {
  get() {
    return client.get<CartResponse>('/cart');
  },

  add(body: CartAddRequest) {
    return client.post<CartItem>('/cart', body);
  },

  update(itemId: number, body: CartUpdateRequest) {
    return client.put<CartItem>(`/cart/${itemId}`, body);
  },

  remove(itemId: number) {
    return client.delete(`/cart/${itemId}`);
  },
};

export const orderApi = {
  create(body: OrderCreateRequest) {
    return client.post<Order>('/orders', body);
  },

  get(id: number) {
    return client.get<Order>(`/orders/${id}`);
  },
};

export default client;
