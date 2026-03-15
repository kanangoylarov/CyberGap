from pydantic import BaseModel


class ClassifyRequest(BaseModel):
    srcip: str = ""
    sport: int = 0
    dstip: str = ""
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
    Spkts: int = 0
    Dpkts: int = 0
    swin: int = 255
    dwin: int = 255
    stcpb: int = 0
    dtcpb: int = 0
    smeansz: int = 0
    dmeansz: int = 0
    trans_depth: int = 1
    res_bdy_len: int = 0
    Sjit: float = 0.0
    Djit: float = 0.0
    Sintpkt: float = 0.0
    Dintpkt: float = 0.0
    tcprtt: float = 0.0
    synack: float = 0.0
    ackdat: float = 0.0
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
    attack_type: int
    attack_label: str
    confidence: float
    inference_time_ms: float
