import { useState, useCallback } from 'react';
import { orderApi } from '@/api/client';
import type { Order, OrderCreateRequest } from '@/types';

export function useOrders() {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const createOrder = useCallback(async (body: OrderCreateRequest): Promise<Order> => {
    setLoading(true);
    setError(null);
    try {
      const response = await orderApi.create(body);
      setOrder(response.data);
      return response.data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create order';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { order, loading, error, createOrder };
}
