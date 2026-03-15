from datetime import datetime
from pydantic import BaseModel


class OverviewStats(BaseModel):
    total_requests: int
    total_attacks: int
    attack_rate: float
    unique_ips: int
    unique_fingerprints: int
    top_attack_type: str
    top_attack_count: int
    avg_confidence: float


class AttackBreakdown(BaseModel):
    attack_type: int
    attack_label: str
    count: int
    percentage: float


class TimeSeriesPoint(BaseModel):
    timestamp: datetime
    total: int
    attacks: int
    normal: int


class TimeSeriesResponse(BaseModel):
    points: list[TimeSeriesPoint]
    bucket_size: str


class FingerprintSummary(BaseModel):
    fingerprint: str
    source_ip: str
    attack_type: int
    attack_label: str
    confidence: float
    hit_count: int
    first_seen: datetime
    last_seen: datetime


class FingerprintDetail(BaseModel):
    fingerprint: str
    source_ips: list[str]
    attack_type: int
    attack_label: str
    avg_confidence: float
    total_requests: int
    first_seen: datetime
    last_seen: datetime
    recent_paths: list[str]
    methods_used: list[str]


class LogEntry(BaseModel):
    id: int
    timestamp: datetime
    fingerprint: str
    source_ip: str
    attack_type: int
    attack_label: str
    confidence: float
    method: str
    path: str
    user_agent: str

    model_config = {"from_attributes": True}


class PaginatedLogs(BaseModel):
    items: list[LogEntry]
    total: int
    page: int
    per_page: int
