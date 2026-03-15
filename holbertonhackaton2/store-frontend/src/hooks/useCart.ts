import { useState, useEffect, useCallback, useMemo } from 'react';
import { cartApi } from '@/api/client';
import type { CartItem, CartAddRequest, CartUpdateRequest } from '@/types';

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await cartApi.get();
      setItems(response.data.items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch cart';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const addItem = useCallback(async (body: CartAddRequest) => {
    setError(null);
    try {
      await cartApi.add(body);
      await refetch();
      window.dispatchEvent(new Event('cart-updated'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add item to cart';
      setError(message);
    }
  }, [refetch]);

  const updateItem = useCallback(async (itemId: number, body: CartUpdateRequest) => {
    setError(null);
    try {
      await cartApi.update(itemId, body);
      await refetch();
      window.dispatchEvent(new Event('cart-updated'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update cart item';
      setError(message);
    }
  }, [refetch]);

  const removeItem = useCallback(async (itemId: number) => {
    setError(null);
    try {
      await cartApi.remove(itemId);
      await refetch();
      window.dispatchEvent(new Event('cart-updated'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to remove cart item';
      setError(message);
    }
  }, [refetch]);

  const totalItems = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const totalPrice = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity * item.product.price, 0);
  }, [items]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { items, loading, error, refetch, addItem, updateItem, removeItem, totalItems, totalPrice };
}
