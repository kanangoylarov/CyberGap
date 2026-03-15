import axios from 'axios';
import type {
  OverviewStats,
  AttackBreakdown,
  TimeSeriesResponse,
  FingerprintSummary,
  FingerprintDetail,
  PaginatedLogs,
} from '@/types';

const api = axios.create({
  baseURL: '/api/admin',
});

export default api;

export async function fetchOverview(since?: string): Promise<OverviewStats> {
  const params: Record<string, string> = {};
  if (since) params.since = since;
  const { data } = await api.get<OverviewStats>('/stats/overview', { params });
  return data;
}

export async function fetchBreakdown(since?: string): Promise<AttackBreakdown[]> {
  const params: Record<string, string> = {};
  if (since) params.since = since;
  const { data } = await api.get<AttackBreakdown[]>('/stats/breakdown', { params });
  return data;
}

export async function fetchTimeseries(
  since?: string,
  bucket?: string,
): Promise<TimeSeriesResponse> {
  const params: Record<string, string> = {};
  if (since) params.since = since;
  if (bucket) params.bucket = bucket;
  const { data } = await api.get<TimeSeriesResponse>('/stats/timeseries', { params });
  return data;
}

export async function fetchFingerprints(
  page: number,
  perPage: number,
): Promise<{ items: FingerprintSummary[]; total: number; page: number; per_page: number }> {
  const { data } = await api.get<{
    items: FingerprintSummary[];
    total: number;
    page: number;
    per_page: number;
  }>('/fingerprints', { params: { page, per_page: perPage } });
  return data;
}

export async function fetchFingerprintDetail(hash: string): Promise<FingerprintDetail> {
  const { data } = await api.get<FingerprintDetail>(`/fingerprints/${hash}`);
  return data;
}

export async function fetchLogs(
  page: number,
  perPage: number,
  filters?: Record<string, string>,
): Promise<PaginatedLogs> {
  const params: Record<string, string | number> = { page, per_page: perPage };
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params[key] = value;
    });
  }
  const { data } = await api.get<PaginatedLogs>('/logs', { params });
  return data;
}
