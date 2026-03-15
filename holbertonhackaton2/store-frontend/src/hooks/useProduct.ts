import { useState, useEffect, useCallback } from 'react';
import { productApi } from '@/api/client';
import type { Product } from '@/types';

export function useProduct(id: number) {
  const [data, setData] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await productApi.get(id);
      setData(response.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch product';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
