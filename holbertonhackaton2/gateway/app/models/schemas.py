from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class RequestSignature(BaseModel):
    """Browser / client fingerprint extracted from the incoming request."""
    source_ip: str
    user_agent: str
    accept_language: str
    accept_encoding: str
    header_order: list[str]
    request_method: str
    path_pattern: str
    query_param_keys: list[str]
    content_type: Optional[str] = None
    body_entropy: float = 0.0
    content_length: int = 0


class ClassifyRequest(BaseModel):
    """All 49 UNSW-NB15 features sent to the AI classifier."""
    srcip: str = "0.0.0.0"
    sport: int = 0
    dstip: str = "0.0.0.0"
    dsport: int = 0
    proto: str = "tcp"
    state: str = "FIN"
    dur: float = 0.0
    sbytes: int = 0
    dbytes: int = 0
    sttl: int = 64
    dttl: int = 128
    sloss: int = 0
    dloss: int = 0
    service: str = "http"
    Sload: float = 0.0
    Dload: float = 0.0
    Spkts: int = 1
    Dpkts: int = 1
    swin: int = 255
    dwin: int = 255
    stcpb: int = 0
    dtcpb: int = 0
    smeansz: float = 0.0
    dmeansz: float = 0.0
    trans_depth: int = 1
    res_bdy_len: int = 0
    Sjit: float = 0.0
    Djit: float = 0.0
    Sintpkt: float = 0.0
    Dintpkt: float = 0.0
    tcprtt: float = 0.02
    synack: float = 0.01
    ackdat: float = 0.01
    is_sm_ips_ports: int = 0
    ct_state_ttl: int = 0
    ct_flw_http_mthd: int = 0
    is_ftp_login: int = 0
    ct_ftp_cmd: int = 0
    ct_srv_src: int = 0
    ct_srv_dst: int = 0
    ct_dst_ltm: int = 0
    ct_src_ltm: int = 0
    ct_src_dport_ltm: int = 0
    ct_dst_sport_ltm: int = 0
    ct_dst_src_ltm: int = 0


class ClassifyResponse(BaseModel):
    """Response from the AI classifier."""
    attack_type: int
    attack_label: str
    confidence: float
    inference_time_ms: float


class GatewayLogCreate(BaseModel):
    """Schema for creating a gateway log entry."""
    timestamp: datetime
    fingerprint: str
    source_ip: str
    attack_type: int
    attack_label: str
    confidence: float
    upstream: str
    latency_ms: float
    method: str
    path: str
    user_agent: str
