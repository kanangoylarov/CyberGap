const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export async function apiFetch<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchOverviewStats() {
  return apiFetch<import('../types').OverviewStats>('/overview/stats');
}

export async function fetchBreakdown(timeRange?: string) {
  const params: Record<string, string> = {};
  if (timeRange) params.time_range = timeRange;
  return apiFetch<import('../types').AttackBreakdown[]>('/overview/breakdown', params);
}

export async function fetchTimeseries(bucketSize: string = '1h', timeRange?: string) {
  const params: Record<string, string> = { bucket_size: bucketSize };
  if (timeRange) params.time_range = timeRange;
  return apiFetch<import('../types').TimeSeriesPoint[]>('/overview/timeseries', params);
}

export async function fetchFingerprints(page: number = 1, perPage: number = 20, search?: string) {
  const params: Record<string, string | number> = { page, per_page: perPage };
  if (search) params.search = search;
  return apiFetch<{ items: import('../types').FingerprintSummary[]; total: number; page: number; per_page: number }>('/fingerprints', params);
}
