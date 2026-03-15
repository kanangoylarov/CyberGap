from fastapi import Request

from app.models.schemas import RequestSignature, ClassifyRequest
from app.repositories.redis_repository import RedisRepository


class FeatureExtractorService:
    """Maps an HTTP request into all 49 UNSW-NB15 features for classification."""

    def __init__(self, redis_repo: RedisRepository):
        self._redis_repo = redis_repo

    async def extract_features(
        self, request: Request, signature: RequestSignature
    ) -> ClassifyRequest:
        """Map HTTP request to all 49 UNSW-NB15 features."""
        srcip = signature.source_ip
        sport = request.client.port if request.client else 0
        dstip = request.url.hostname or "0.0.0.0"
        dsport = request.url.port or (
            443 if request.url.scheme == "https" else 80
        )

        sbytes = signature.content_length
        dur = max(sbytes / 1_000_000, 0.001)
        sttl = 64
        dttl = 128
        Spkts = max(sbytes // 1460, 1)
        Dpkts = 1
        Sload = (sbytes * 8) / dur if dur > 0 else 0.0
        smeansz = sbytes // Spkts if Spkts > 0 else 0
        is_sm = 1 if srcip == dstip and sport == dsport else 0

        # Redis counter features (9 calls) - connection frequency counters
        ct_srv_src = await self._redis_repo.increment_connection_counter(
            "srv_src", srcip, "http"
        )
        ct_srv_dst = await self._redis_repo.increment_connection_counter(
            "srv_dst", dstip, "http"
        )
        ct_dst_ltm = await self._redis_repo.increment_connection_counter(
            "dst_ltm", dstip
        )
        ct_src_ltm = await self._redis_repo.increment_connection_counter(
            "src_ltm", srcip
        )
        ct_src_dport = await self._redis_repo.increment_connection_counter(
            "src_dport_ltm", srcip, str(dsport)
        )
        ct_dst_sport = await self._redis_repo.increment_connection_counter(
            "dst_sport_ltm", dstip, str(sport)
        )
        ct_dst_src = await self._redis_repo.increment_connection_counter(
            "dst_src_ltm", dstip, srcip
        )
        ct_flw = await self._redis_repo.increment_connection_counter(
            "flw_http_mthd", signature.request_method
        )
        ct_state = await self._redis_repo.increment_connection_counter(
            "state_ttl", "FIN", str(sttl)
        )

        return ClassifyRequest(
            srcip=srcip,
            sport=sport,
            dstip=dstip,
            dsport=dsport,
            proto="tcp",
            state="FIN",
            dur=dur,
            sbytes=sbytes,
            dbytes=0,
            sttl=sttl,
            dttl=dttl,
            sloss=0,
            dloss=0,
            service="http",
            Sload=Sload,
            Dload=0.0,
            Spkts=Spkts,
            Dpkts=Dpkts,
            swin=255,
            dwin=255,
            stcpb=0,
            dtcpb=0,
            smeansz=smeansz,
            dmeansz=0,
            trans_depth=1,
            res_bdy_len=0,
            Sjit=0.0,
            Djit=0.0,
            Sintpkt=0.0,
            Dintpkt=0.0,
            tcprtt=0.02,
            synack=0.01,
            ackdat=0.01,
            is_sm_ips_ports=is_sm,
            ct_state_ttl=ct_state,
            ct_flw_http_mthd=ct_flw,
            is_ftp_login=0,
            ct_ftp_cmd=0,
            ct_srv_src=ct_srv_src,
            ct_srv_dst=ct_srv_dst,
            ct_dst_ltm=ct_dst_ltm,
            ct_src_ltm=ct_src_ltm,
            ct_src_dport_ltm=ct_src_dport,
            ct_dst_sport_ltm=ct_dst_sport,
            ct_dst_src_ltm=ct_dst_src,
        )
