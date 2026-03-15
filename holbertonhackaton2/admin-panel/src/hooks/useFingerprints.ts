import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchFingerprints } from '@/api/client';
import type { FingerprintSummary } from '@/types';

interface UseFingerprintsReturn {
  data: { items: FingerprintSummary[]; total: number } | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useFingerprints(page: number = 1, perPage: number = 20): UseFingerprintsReturn {
  const [data, setData] = useState<{ items: FingerprintSummary[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFingerprints(page, perPage);
      if (mountedRef.current) {
        setData({ items: result.items, total: result.total });
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch fingerprints');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [page, perPage]);

  useEffect(() => {
    mountedRef.current = true;
    refetch();

    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  return { data, loading, error, refetch };
}
