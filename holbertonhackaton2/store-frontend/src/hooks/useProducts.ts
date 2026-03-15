import { useState, useEffect, useCallback } from 'react';
import { productApi } from '@/api/client';
import type { Product, PaginatedResponse } from '@/types';

interface UseProductsParams {
  search?: string;
  category?: string;
  page?: number;
  per_page?: number;
}

export function useProducts(params?: UseProductsParams) {
  const [data, setData] = useState<PaginatedResponse<Product> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await productApi.list(params);
      setData(response.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch products';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
