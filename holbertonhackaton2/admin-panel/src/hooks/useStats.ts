import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchOverview } from '@/api/client';
import type { OverviewStats } from '@/types';

const REFRESH_INTERVAL = 30_000;

interface UseStatsReturn {
  data: OverviewStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useStats(): UseStatsReturn {
  const [data, setData] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const stats = await fetchOverview();
      if (mountedRef.current) {
        setData(stats);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch stats');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refetch();

    const interval = setInterval(refetch, REFRESH_INTERVAL);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [refetch]);

  return { data, loading, error, refetch };
}
