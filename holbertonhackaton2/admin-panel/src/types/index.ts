export interface OverviewStats {
  total_requests: number;
  total_attacks: number;
  attack_rate: number;
  unique_ips: number;
  unique_fingerprints: number;
  top_attack_type: string;
  top_attack_count: number;
  avg_confidence: number;
}

export interface AttackBreakdown {
  attack_type: number;
  attack_label: string;
  count: number;
  percentage: number;
}

export interface TimeSeriesPoint {
  timestamp: string;
  total: number;
  attacks: number;
  normal: number;
}

export interface TimeSeriesResponse {
  points: TimeSeriesPoint[];
  bucket_size: string;
}

export interface FingerprintSummary {
  fingerprint: string;
  source_ip: string;
  attack_type: number;
  attack_label: string;
  confidence: number;
  hit_count: number;
  first_seen: string;
  last_seen: string;
}

export interface FingerprintDetail {
  fingerprint: string;
  source_ips: string[];
  attack_type: number;
  attack_label: string;
  avg_confidence: number;
  total_requests: number;
  first_seen: string;
  last_seen: string;
  recent_paths: string[];
  methods_used: string[];
}

export interface LogEntry {
  id: number;
  timestamp: string;
  fingerprint: string;
  source_ip: string;
  attack_type: number;
  attack_label: string;
  confidence: number;
  method: string;
  path: string;
  user_agent: string;
}

export interface PaginatedLogs {
  items: LogEntry[];
  total: number;
  page: number;
  per_page: number;
}

export interface WebSocketMessage {
  type: "logs" | "heartbeat" | "error";
  data?: LogEntry[];
  timestamp?: string;
  message?: string;
}

export const ATTACK_TYPE_MAP: Record<number, { label: string; color: string; bg: string; text: string }> = {
  0: { label: 'Normal', color: '#10B981', bg: 'bg-green-900/50', text: 'text-green-400' },
  1: { label: 'Generic', color: '#EF4444', bg: 'bg-red-900/50', text: 'text-red-400' },
  2: { label: 'Exploits', color: '#F97316', bg: 'bg-orange-900/50', text: 'text-orange-400' },
  3: { label: 'Fuzzers', color: '#8B5CF6', bg: 'bg-purple-900/50', text: 'text-purple-400' },
  4: { label: 'DoS', color: '#EC4899', bg: 'bg-pink-900/50', text: 'text-pink-400' },
  5: { label: 'Recon', color: '#06B6D4', bg: 'bg-cyan-900/50', text: 'text-cyan-400' },
  6: { label: 'Analysis', color: '#F59E0B', bg: 'bg-amber-900/50', text: 'text-amber-400' },
  7: { label: 'Backdoor', color: '#E11D48', bg: 'bg-rose-900/50', text: 'text-rose-400' },
  8: { label: 'Shellcode', color: '#84CC16', bg: 'bg-lime-900/50', text: 'text-lime-400' },
  9: { label: 'Worms', color: '#6366F1', bg: 'bg-indigo-900/50', text: 'text-indigo-400' },
};
